import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { createHash } from "crypto";
import { ObjectId } from "mongodb";
import { Repository } from "typeorm";
import { Conversation } from "./conversation.entity";
import { Message } from "../message/message.entity";
import { UserService } from "../user/user.service";
import { FriendshipService } from "../friendship/friendship.service";
import { emitToConversation, emitToUser, getChatUserLastActiveAt, isChatUserOnline } from "../../common/socket/chat-socket";

@Injectable()
export class ConversationService {
	constructor(
		@InjectRepository(Conversation, 'mongodb')
		private readonly conversationRepository: Repository<Conversation>,
		@InjectRepository(Message, 'mongodb')
		private readonly messageRepository: Repository<Message>,
		private readonly userService: UserService,
		private readonly friendshipService: FriendshipService,
	) {}

	private async hydrateMemberAvatars(conversations: any[]) {
		const userIds: number[] = [];
		for (const conversation of conversations) {
			for (const member of conversation?.members || []) {
				userIds.push(Number(member.userId));
			}
		}
		if (!userIds.length) return;
		const avatarMap = await this.userService.getAvatarMap(userIds);
		for (const conversation of conversations) {
			for (const member of conversation?.members || []) {
				if (avatarMap.has(Number(member.userId))) {
					member.avatarUrl = avatarMap.get(Number(member.userId)) || null;
				}
			}
		}
	}

	private mapMember(member: any) {
		const online = isChatUserOnline(Number(member.userId));
		const lastActiveAt = getChatUserLastActiveAt(Number(member.userId));
		return {
			userId: Number(member.userId),
			fullName: member.nickname || member.fullName,
			realName: member.fullName,
			nickname: member.nickname || null,
			avatarUrl: member.avatarUrl || null,
			role: this.normalizeRole(member.role),
			notificationsEnabled: member.notificationsEnabled !== false && !this.isMuted(member),
			isMuted: this.isMuted(member),
			mutedUntil: member.mutedUntil || null,
			isPinned: Boolean(member.isPinned),
			pinnedAt: member.pinnedAt || null,
			isLocked: Boolean(member.isLocked),
			lockedAt: member.lockedAt || null,
			deletedHistoryAt: member.deletedHistoryAt || null,
			lastReadAt: member.lastReadAt || null,
			lastReadMessageId: member.lastReadMessageId || null,
			online,
			lastActiveAt: lastActiveAt || member.lastActiveAt || null,
		};
	}

	private mapConversation(conversation: any, viewerId: number) {
		const viewerMember = this.getMemberByUserId(conversation, viewerId);
		return {
			id: String(conversation._id),
			type: conversation.type,
			name: conversation.name,
			avatarUrl: conversation.avatarUrl || null,
			backgroundUrl: conversation.backgroundUrl || null,
			themeColor: conversation.themeColor || null,
			defaultEmoji: conversation.defaultEmoji || null,
			autoDeleteAfterSeconds: conversation.autoDeleteAfterSeconds ?? null,
			createdBy: conversation.createdBy,
			createdAt: conversation.createdAt,
			updatedAt: conversation.updatedAt,
			groupOwner: conversation.createdBy,
			members: (conversation.members || []).map((member: any) => this.mapMember(member)),
			lastMessage: conversation.lastMessage || null,
			pinnedMessageIds: Array.isArray(conversation.pinnedMessageIds) ? conversation.pinnedMessageIds.map((item: any) => String(item)) : [],
			unreadCount: 0,
			role: this.normalizeRole(viewerMember?.role),
			isPinned: Boolean(viewerMember?.isPinned),
			isMuted: this.isMuted(viewerMember),
			isHidden: (conversation.deletedForUserIds || []).some((item: any) => Number(item) === Number(viewerId)),
			mutedUntil: viewerMember?.mutedUntil || null,
			isLocked: Boolean(viewerMember?.isLocked),
			lockedAt: viewerMember?.lockedAt || null,
			notificationsEnabled: viewerMember?.notificationsEnabled !== false && !this.isMuted(viewerMember),
			onlineCount: (conversation.members || []).filter((member: any) => isChatUserOnline(Number(member.userId))).length,
		};
	}

	private mapPinnedMessagePreview(row: any, conversation: any) {
		const senderId = Number(row.senderId || 0);
		const senderMember = (conversation?.members || []).find((item: any) => Number(item.userId) === senderId);
		return {
			id: String(row._id),
			conversationId: row.conversationId,
			senderId,
			senderName: senderMember?.nickname || row.senderName || row.meta?.senderName || senderMember?.fullName || `Người dùng #${senderId}`,
			senderAvatar: senderMember?.avatarUrl || row.senderAvatar || row.meta?.senderAvatar || null,
			type: row.type,
			text: row.isRecalled ? 'Tin nhắn đã được thu hồi' : row.text || null,
			mediaUrl: row.isRecalled ? null : row.mediaUrl || null,
			fileName: row.fileName || null,
			mimeType: row.mimeType || null,
			fileSize: row.fileSize || null,
			meta: row.meta || null,
			links: Array.isArray(row.links) ? row.links : [],
			status: 'sent',
			readBy: [],
			deliveredTo: [],
			reactionCount: Array.isArray(row.reactions) ? row.reactions.length : 0,
			viewerReaction: null,
			reactions: [],
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
			expiresAt: row.expiresAt || null,
			isDeleted: Boolean(row.isRecalled),
		};
	}

	private async getPinnedMessagePreviews(conversation: any, viewerId: number) {
		const ids = Array.isArray(conversation.pinnedMessageIds) ? conversation.pinnedMessageIds.map((item: any) => String(item)) : [];
		if (!ids.length) return [];

		const rows = await Promise.all(
			ids.map((id: string) => (
				ObjectId.isValid(id)
					? this.messageRepository.findOne({ where: { _id: new ObjectId(id) as any } }).catch(() => null)
					: Promise.resolve(null)
			)),
		);

		return rows
			.filter((row: any) => row && String(row.conversationId) === String(conversation._id))
			.filter((row: any) => !this.isExpiredMessage(row))
			.filter((row: any) => !(row.deletedForUserIds || []).some((uid: number) => Number(uid) === Number(viewerId)))
			.map((row: any) => this.mapPinnedMessagePreview(row, conversation));
	}

	private isExpiredMessage(row: any) {
		if (!row?.expiresAt) return false;
		const expiresAt = new Date(row.expiresAt).getTime();
		return !Number.isNaN(expiresAt) && expiresAt <= Date.now();
	}

	private getConversationExpirationMillis(conversation: any) {
		const seconds = Number(conversation?.autoDeleteAfterSeconds || 0);
		if (!seconds || seconds <= 0) return null;
		return seconds * 1000;
	}

	private getMessageExpiresAt(conversation: any, createdAt: Date) {
		const duration = this.getConversationExpirationMillis(conversation);
		if (!duration) return null;
		return new Date(createdAt.getTime() + duration);
	}

	private hashSecret(value: string) {
		return createHash('sha256').update(String(value || '').trim()).digest('hex');
	}

	private verifySecret(value: string, hash?: string | null) {
		if (!hash) return false;
		return this.hashSecret(value) === String(hash);
	}

	private isMuted(member: any) {
		if (!member) return false;
		if (member.notificationsEnabled === false && !member.mutedUntil) return true;
		if (!member.mutedUntil) return false;
		const mutedUntil = new Date(member.mutedUntil).getTime();
		return !Number.isNaN(mutedUntil) && mutedUntil > Date.now();
	}

	private getConversationSortKey(conversation: any) {
		const raw = conversation?.lastMessage?.createdAt || conversation?.updatedAt || conversation?.createdAt || null;
		const time = raw ? new Date(raw).getTime() : 0;
		return Number.isNaN(time) ? 0 : time;
	}

	private async countUnreadMessages(conversation: any, viewerId: number) {
		const member = this.getMemberByUserId(conversation, viewerId);
		const lastReadAt = member?.lastReadAt ? new Date(member.lastReadAt) : null;
		const deletedHistoryAt = member?.deletedHistoryAt ? new Date(member.deletedHistoryAt) : null;
		const rows = await this.messageRepository.find({
			where: { conversationId: String(conversation._id) } as any,
			order: { createdAt: 'ASC' },
		});

		return rows.filter((item: any) => {
			if (!item || item.isRecalled) return false;
			if (this.isExpiredMessage(item)) return false;
			if ((item.deletedForUserIds || []).some((uid: number) => Number(uid) === Number(viewerId))) return false;
			if (Number(item.senderId) === Number(viewerId)) return false;
			if (!lastReadAt) return true;
			const createdAt = new Date(item.createdAt).getTime();
			if (deletedHistoryAt && !Number.isNaN(createdAt) && createdAt <= deletedHistoryAt.getTime()) return false;
			return !Number.isNaN(createdAt) && createdAt > lastReadAt.getTime();
		}).length;
	}

	private normalizeRole(role: unknown) {
		const raw = String(role || '').toLowerCase();
		if (raw === 'leader' || raw === 'deputy' || raw === 'member') {
			return raw;
		}
		// Backward compatibility for old records.
		if (raw === 'admin') {
			return 'leader';
		}
		return 'member';
	}

	private getMemberByUserId(conversation: any, userId: number) {
		return (conversation.members || []).find((item: any) => Number(item.userId) === Number(userId));
	}

	private isLeader(conversation: any, userId: number) {
		return this.normalizeRole(this.getMemberByUserId(conversation, userId)?.role) === 'leader';
	}

	private isLeaderOrDeputy(conversation: any, userId: number) {
		const role = this.normalizeRole(this.getMemberByUserId(conversation, userId)?.role);
		return role === 'leader' || role === 'deputy';
	}

	private enforceSingleLeaderSingleDeputy(conversation: any) {
		if (!conversation || conversation.type !== 'group') return false;
		const members = Array.isArray(conversation.members) ? [...conversation.members] : [];
		if (members.length === 0) return false;

		let changed = false;
		let normalized = members.map((item: any) => {
			const nextRole = this.normalizeRole(item.role);
			if (nextRole !== item.role) changed = true;
			return { ...item, role: nextRole };
		});

		const leaderCandidates = normalized.filter((item: any) => item.role === 'leader');
		if (leaderCandidates.length === 0) {
			const owner = normalized.find((item: any) => Number(item.userId) === Number(conversation.createdBy));
			const fallback = owner || normalized[0];
			normalized = normalized.map((item: any) =>
				Number(item.userId) === Number(fallback.userId) ? { ...item, role: 'leader' } : item,
			);
			changed = true;
		} else if (leaderCandidates.length > 1) {
			const ownerLeader = leaderCandidates.find((item: any) => Number(item.userId) === Number(conversation.createdBy));
			const keep = ownerLeader || leaderCandidates[0];
			normalized = normalized.map((item: any) => {
				if (item.role !== 'leader') return item;
				if (Number(item.userId) === Number(keep.userId)) return item;
				changed = true;
				return { ...item, role: 'member' };
			});
		}

		const leader = normalized.find((item: any) => item.role === 'leader');
		const deputyCandidates = normalized.filter((item: any) => item.role === 'deputy' && Number(item.userId) !== Number(leader?.userId));
		if (deputyCandidates.length > 1) {
			const keepDeputy = deputyCandidates[0];
			normalized = normalized.map((item: any) => {
				if (item.role !== 'deputy') return item;
				if (Number(item.userId) === Number(keepDeputy.userId)) return item;
				changed = true;
				return { ...item, role: 'member' };
			});
		}

		conversation.members = normalized;
		return changed;
	}

	async listConversations(userId: number) {
		const rows = await this.conversationRepository.find();
		for (const row of rows as any[]) {
			if (this.enforceSingleLeaderSingleDeputy(row)) {
				await this.conversationRepository.save(row);
			}
		}
		const mine = rows.filter((item: any) => (item.members || []).some((m: any) => m.userId === userId));
		await this.hydrateMemberAvatars(mine);
		const sorted = [...mine].sort((a: any, b: any) => {
			const aPinned = Boolean(this.getMemberByUserId(a, userId)?.isPinned);
			const bPinned = Boolean(this.getMemberByUserId(b, userId)?.isPinned);
			if (aPinned !== bPinned) return Number(bPinned) - Number(aPinned);
			return this.getConversationSortKey(b) - this.getConversationSortKey(a);
		});
		const conversations = await Promise.all(
			sorted.map(async (item) => ({
				...this.mapConversation(item, userId),
				pinnedMessages: await this.getPinnedMessagePreviews(item, userId),
				unreadCount: await this.countUnreadMessages(item, userId),
			})),
		);
		return { conversations };
	}

	async createDirect(actorId: number, targetUserId: number) {
		if (actorId === targetUserId) {
			throw new BadRequestException('Không thể tạo hội thoại với chính mình');
		}

		const target = await this.userService.findOne(targetUserId);
		if (!target) {
			throw new NotFoundException('Người dùng không tồn tại');
		}

		const all = await this.conversationRepository.find();
		const existed = all.find(
			(item: any) =>
				item.type === 'direct' &&
				(item.members || []).length === 2 &&
				(item.members || []).some((m: any) => m.userId === actorId) &&
				(item.members || []).some((m: any) => m.userId === targetUserId),
		);

		if (existed) {
			return { conversation: this.mapConversation(existed, actorId) };
		}

		const actor = await this.userService.findOne(actorId);
		const now = new Date();
		const conversation = this.conversationRepository.create({
			type: 'direct',
			name: `${actor?.displayName || 'Bạn'} - ${target.displayName || 'Người dùng'}`,
			avatarUrl: null,
			createdBy: actorId,
			createdAt: now,
			updatedAt: now,
			members: [
				{
					userId: actorId,
					fullName: actor?.displayName || 'Bạn',
					avatarUrl: actor?.avatarUrl || null,
					role: 'member',
					notificationsEnabled: true,
					isPinned: false,
					isLocked: false,
					nickname: null,
					lastReadAt: now,
				},
				{
					userId: targetUserId,
					fullName: target.displayName || 'Người dùng',
					avatarUrl: target.avatarUrl || null,
					role: 'member',
					notificationsEnabled: true,
					isPinned: false,
					isLocked: false,
					nickname: null,
					lastReadAt: null,
				},
			],
			lastMessage: null,
			pinnedMessageIds: [],
			autoDeleteAfterSeconds: null,
			backgroundUrl: null,
			themeColor: null,
			defaultEmoji: null,
		});

		const saved = await this.conversationRepository.save(conversation);
		return { conversation: this.mapConversation(saved, actorId) };
	}

	async createGroup(actorId: number, name: string, avatarUrl: string | undefined, memberIds: number[]) {
		const groupName = String(name || '').trim();
		if (!groupName) {
			throw new BadRequestException('Tên nhóm không được để trống');
		}

		const actor = await this.userService.findOne(actorId);
		const uniqueMemberIds = [...new Set(memberIds.filter((item) => item !== actorId))];
		if (uniqueMemberIds.length === 0) {
			throw new BadRequestException('Nhóm cần ít nhất 1 thành viên khác');
		}

		const acceptedFriendIds = await this.friendshipService.getAcceptedFriendIds(actorId);
		const nonFriendIds = uniqueMemberIds.filter((id) => !acceptedFriendIds.has(id));
		if (nonFriendIds.length > 0) {
			throw new ForbiddenException('Chỉ có thể thêm bạn bè vào nhóm chat');
		}

		const members: any[] = [
			{
				userId: actorId,
				fullName: actor?.displayName || 'Bạn',
				avatarUrl: actor?.avatarUrl || null,
				role: 'leader',
					notificationsEnabled: true,
					isPinned: false,
					isLocked: false,
					nickname: null,
					lastReadAt: new Date(),
			},
		];

		for (const id of uniqueMemberIds) {
			const user = await this.userService.findOne(id);
			if (!user) {
				throw new NotFoundException(`Không tìm thấy user ${id}`);
			}
			members.push({
				userId: id,
				fullName: user.displayName,
				avatarUrl: user.avatarUrl || null,
				role: 'member',
				notificationsEnabled: true,
				isPinned: false,
					isLocked: false,
				nickname: null,
				lastReadAt: null,
			});
		}

		const now = new Date();
		const saved = await this.conversationRepository.save(
			this.conversationRepository.create({
				type: 'group',
				name: groupName,
				avatarUrl: avatarUrl || null,
				createdBy: actorId,
				createdAt: now,
				updatedAt: now,
				members,
				lastMessage: null,
				pinnedMessageIds: [],
				autoDeleteAfterSeconds: null,
				backgroundUrl: null,
				themeColor: null,
				defaultEmoji: null,
			}),
		);

		return { conversation: this.mapConversation(saved, actorId) };
	}

	async getConversationById(conversationId: string) {
		return this.conversationRepository.findOne({ where: { _id: new ObjectId(conversationId) as any } });
	}

	async ensureMembership(conversationId: string, userId: number) {
		const conversation = await this.getConversationById(conversationId);
		if (!conversation) {
			throw new NotFoundException('Không tìm thấy hội thoại');
		}

		if (this.enforceSingleLeaderSingleDeputy(conversation)) {
			await this.conversationRepository.save(conversation);
		}

		const joined = (conversation.members || []).some((item: any) => item.userId === userId);
		if (!joined) {
			throw new ForbiddenException('Bạn không thuộc cuộc trò chuyện này');
		}
		return conversation;
	}

	async getConversationDetail(conversationId: string, userId: number) {
		const conversation = await this.ensureMembership(conversationId, userId);
		await this.hydrateMemberAvatars([conversation]);
		return { conversation: this.mapConversation(conversation, userId) };
	}

	async updatePreferences(
		conversationId: string,
		userId: number,
		body: {
			backgroundUrl?: string | null;
			themeColor?: string | null;
			defaultEmoji?: string | null;
			autoDeleteAfterSeconds?: number | null;
			hidden?: boolean;
			locked?: boolean;
				hiddenPassword?: string | null;
				lockedPassword?: string | null;
		},
	) {
		const conversation = await this.ensureMembership(conversationId, userId);
		const allowedDurations = new Set([3600, 86400, 604800, 2592000]);
		const now = new Date();

		if (body.backgroundUrl !== undefined) {
			conversation.backgroundUrl = body.backgroundUrl ? String(body.backgroundUrl).trim().slice(0, 500) : null;
		}
		if (body.themeColor !== undefined) {
			conversation.themeColor = body.themeColor ? String(body.themeColor).trim().slice(0, 64) : null;
		}
		if (body.defaultEmoji !== undefined) {
			conversation.defaultEmoji = body.defaultEmoji ? String(body.defaultEmoji).trim().slice(0, 16) : null;
		}
		if (body.autoDeleteAfterSeconds !== undefined) {
			const nextDuration = body.autoDeleteAfterSeconds === null ? null : Number(body.autoDeleteAfterSeconds) || null;
			if (nextDuration !== null && !allowedDurations.has(nextDuration)) {
				throw new BadRequestException('Thời hạn tự động xóa tin nhắn không hợp lệ');
			}
			conversation.autoDeleteAfterSeconds = nextDuration;
		}
		if (body.hidden !== undefined) {
			const member = this.getMemberByUserId(conversation, userId);
			const providedPassword = String(body.hiddenPassword || '').trim();
			if (body.hidden) {
				if (!providedPassword) throw new BadRequestException('Cần mật khẩu ẩn để bật trạng thái ẩn');
				member.hiddenPasswordHash = this.hashSecret(providedPassword);
				const deletedForUserIds = Array.isArray(conversation.deletedForUserIds) ? [...conversation.deletedForUserIds] : [];
				if (!deletedForUserIds.some((item: number) => Number(item) === Number(userId))) {
					deletedForUserIds.push(userId);
				}
				conversation.deletedForUserIds = deletedForUserIds;
			} else {
				if (member?.hiddenPasswordHash && !this.verifySecret(providedPassword, member.hiddenPasswordHash)) {
					throw new BadRequestException('Mật khẩu ẩn không đúng');
				}
				conversation.deletedForUserIds = (Array.isArray(conversation.deletedForUserIds) ? conversation.deletedForUserIds : []).filter((item: number) => Number(item) !== Number(userId));
			}
		}
		if (body.locked !== undefined) {
			const member = this.getMemberByUserId(conversation, userId);
			const providedPassword = String(body.lockedPassword || '').trim();
			if (body.locked) {
				if (!providedPassword) throw new BadRequestException('Cần mật khẩu khóa để bật trạng thái khóa');
				member.lockPasswordHash = this.hashSecret(providedPassword);
				conversation.members = (conversation.members || []).map((item: any) =>
					Number(item.userId) === Number(userId)
						? { ...item, isLocked: true, lockedAt: now, lockPasswordHash: this.hashSecret(providedPassword) }
						: item,
				);
			} else {
				if (member?.lockPasswordHash && !this.verifySecret(providedPassword, member.lockPasswordHash)) {
					throw new BadRequestException('Mật khẩu khóa không đúng');
				}
				conversation.members = (conversation.members || []).map((item: any) =>
					Number(item.userId) === Number(userId)
						? { ...item, isLocked: false, lockedAt: null }
						: item,
				);
			}
		}

		conversation.updatedAt = now;
		await this.conversationRepository.save(conversation);
		const mapped = this.mapConversation(conversation, userId);
		emitToUser(userId, 'conversation:updated', { conversation: mapped });
		if (body.hidden !== undefined || body.locked !== undefined) {
			emitToConversation(conversationId, 'conversation:updated', { conversation: mapped });
		}
		return { message: 'Đã cập nhật thiết lập hội thoại', conversation: mapped };
	}

	async verifyHiddenAccess(conversationId: string, userId: number, hiddenPassword: string) {
		const conversation = await this.ensureMembership(conversationId, userId);
		const member = this.getMemberByUserId(conversation, userId);
		const isHidden = (conversation.deletedForUserIds || []).some((item: any) => Number(item) === Number(userId));
		if (!isHidden) {
			return { ok: true, conversation: this.mapConversation(conversation, userId) };
		}
		if (!member?.hiddenPasswordHash || !this.verifySecret(hiddenPassword, member.hiddenPasswordHash)) {
			throw new BadRequestException('Mật khẩu ẩn không đúng');
		}
		return { ok: true, conversation: this.mapConversation(conversation, userId) };
	}

	async setSeen(conversationId: string, userId: number, lastReadMessageId?: string | null) {
		const conversation = await this.ensureMembership(conversationId, userId);
		conversation.members = (conversation.members || []).map((item: any) =>
			item.userId === userId ? { ...item, lastReadAt: new Date(), lastReadMessageId: lastReadMessageId || item.lastReadMessageId || null } : item,
		);
		await this.conversationRepository.save(conversation);
		emitToConversation(conversationId, 'conversation:seen', {
			conversationId,
			userId,
			lastReadAt: this.getMemberByUserId(conversation, userId)?.lastReadAt || new Date(),
			lastReadMessageId: lastReadMessageId || null,
		});
		return { message: 'Đã cập nhật trạng thái đã xem' };
	}

	async toggleNotifications(conversationId: string, userId: number, enabled: boolean) {
		const conversation = await this.ensureMembership(conversationId, userId);
		conversation.members = (conversation.members || []).map((item: any) =>
			item.userId === userId ? { ...item, notificationsEnabled: Boolean(enabled) } : item,
		);
		await this.conversationRepository.save(conversation);
		emitToConversation(conversationId, 'conversation:updated', { conversation: this.mapConversation(conversation, userId) });
		return { message: 'Đã cập nhật cài đặt thông báo' };
	}

	async setPinned(conversationId: string, userId: number, pinned: boolean) {
		const conversation = await this.ensureMembership(conversationId, userId);
		conversation.members = (conversation.members || []).map((item: any) =>
			Number(item.userId) === Number(userId)
				? { ...item, isPinned: Boolean(pinned), pinnedAt: pinned ? new Date() : null }
				: item,
		);
		await this.conversationRepository.save(conversation);
		emitToUser(userId, 'conversation:updated', { conversation: this.mapConversation(conversation, userId) });
		return { message: pinned ? 'Đã ghim cuộc trò chuyện' : 'Đã bỏ ghim cuộc trò chuyện', conversation: this.mapConversation(conversation, userId) };
	}

	async setMuted(conversationId: string, userId: number, muted: boolean, mutedUntil?: string | null) {
		const conversation = await this.ensureMembership(conversationId, userId);
		const parsedMutedUntil = mutedUntil ? new Date(mutedUntil) : null;
		if (parsedMutedUntil && Number.isNaN(parsedMutedUntil.getTime())) {
			throw new BadRequestException('Thời gian tắt thông báo không hợp lệ');
		}
		conversation.members = (conversation.members || []).map((item: any) =>
			Number(item.userId) === Number(userId)
				? {
					...item,
					notificationsEnabled: muted ? Boolean(parsedMutedUntil) : true,
					mutedUntil: muted ? parsedMutedUntil || null : null,
				}
				: item,
		);
		await this.conversationRepository.save(conversation);
		emitToUser(userId, 'conversation:updated', { conversation: this.mapConversation(conversation, userId) });
		return { message: muted ? 'Đã tắt thông báo' : 'Đã bật thông báo', conversation: this.mapConversation(conversation, userId) };
	}

	async clearHistoryCursor(conversationId: string, userId: number) {
		const conversation = await this.ensureMembership(conversationId, userId);
		conversation.members = (conversation.members || []).map((item: any) =>
			Number(item.userId) === Number(userId) ? { ...item, deletedHistoryAt: new Date(), lastReadAt: new Date() } : item,
		);
		await this.conversationRepository.save(conversation);
		return conversation;
	}

	async renameGroup(conversationId: string, actorId: number, name: string, avatarUrl?: string | null) {
		const conversation = await this.ensureMembership(conversationId, actorId);
		if (conversation.type !== 'group') throw new BadRequestException('Chỉ nhóm chat mới có thể đổi thông tin');
		if (!this.isLeaderOrDeputy(conversation, actorId)) throw new ForbiddenException('Bạn không có quyền cập nhật nhóm');
		const nextName = String(name || conversation.name || '').trim();
		if (!nextName) throw new BadRequestException('Tên nhóm không được để trống');
		conversation.name = nextName;
		if (avatarUrl !== undefined) conversation.avatarUrl = avatarUrl || null;
		conversation.updatedAt = new Date();
		await this.conversationRepository.save(conversation);
		emitToConversation(conversationId, 'conversation:updated', { conversation: this.mapConversation(conversation, actorId) });
		return { message: 'Đã cập nhật nhóm', conversation: this.mapConversation(conversation, actorId) };
	}

	async updateNickname(conversationId: string, actorId: number, targetUserId: number, nickname?: string | null) {
		const conversation = await this.ensureMembership(conversationId, actorId);
		if (!this.getMemberByUserId(conversation, targetUserId)) throw new NotFoundException('Thành viên không tồn tại');
		const normalized = String(nickname || '').trim().slice(0, 60);
		conversation.members = (conversation.members || []).map((item: any) =>
			Number(item.userId) === Number(targetUserId) ? { ...item, nickname: normalized || null } : item,
		);
		await this.conversationRepository.save(conversation);
		emitToConversation(conversationId, 'conversation:nickname', {
			conversationId,
			userId: targetUserId,
			nickname: normalized || null,
		});
		return { message: normalized ? 'Đã cập nhật biệt danh' : 'Đã xóa biệt danh', conversation: this.mapConversation(conversation, actorId) };
	}

	async addMember(conversationId: string, actorId: number, userId: number) {
		const conversation = await this.ensureMembership(conversationId, actorId);
		if (conversation.type !== 'group') {
			throw new BadRequestException('Chỉ hỗ trợ thêm thành viên cho nhóm chat');
		}
		if (!this.isLeaderOrDeputy(conversation, actorId)) {
			throw new ForbiddenException('Chỉ trưởng nhóm hoặc phó nhóm mới có quyền thêm thành viên');
		}

		if ((conversation.members || []).some((item: any) => item.userId === userId)) {
			return { message: 'Người dùng đã ở trong nhóm' };
		}

		const user = await this.userService.findOne(userId);
		if (!user) {
			throw new NotFoundException('Người dùng không tồn tại');
		}

		conversation.members = [
			...(conversation.members || []),
			{
				userId,
				fullName: user.displayName,
				avatarUrl: user.avatarUrl || null,
				role: 'member',
				notificationsEnabled: true,
				isPinned: false,
				nickname: null,
				lastReadAt: null,
			},
		];
		await this.conversationRepository.save(conversation);
		emitToConversation(conversationId, 'conversation:members', { conversationId, action: 'added', userId, conversation: this.mapConversation(conversation, actorId) });
		return { message: 'Đã thêm thành viên' };
	}

	async removeMember(conversationId: string, actorId: number, targetUserId: number) {
		const conversation = await this.ensureMembership(conversationId, actorId);
		if (conversation.type !== 'group') {
			throw new BadRequestException('Chỉ hỗ trợ xóa thành viên cho nhóm chat');
		}
		if (!this.isLeaderOrDeputy(conversation, actorId)) {
			throw new ForbiddenException('Chỉ trưởng nhóm hoặc phó nhóm mới có quyền xóa thành viên');
		}

		if (!(conversation.members || []).some((item: any) => item.userId === targetUserId)) {
			throw new NotFoundException('Thành viên không tồn tại trong nhóm');
		}

		if (targetUserId === actorId) {
			throw new BadRequestException('Không thể tự xóa chính mình khỏi nhóm bằng chức năng này');
		}

		const target = this.getMemberByUserId(conversation, targetUserId);
		const actorRole = this.normalizeRole(this.getMemberByUserId(conversation, actorId)?.role);
		const targetRole = this.normalizeRole(target?.role);
		if (targetRole === 'leader') {
			throw new BadRequestException('Không thể xóa trưởng nhóm');
		}
		if (targetRole === 'deputy' && actorRole !== 'leader') {
			throw new ForbiddenException('Chỉ trưởng nhóm mới có thể xóa phó nhóm');
		}

		conversation.members = (conversation.members || []).filter((item: any) => item.userId !== targetUserId);
		await this.conversationRepository.save(conversation);
		emitToConversation(conversationId, 'conversation:members', { conversationId, action: 'removed', userId: targetUserId });
		return { message: 'Đã xóa thành viên' };
	}

	async leaveGroup(conversationId: string, actorId: number) {
		const conversation = await this.ensureMembership(conversationId, actorId);
		if (conversation.type !== 'group') {
			throw new BadRequestException('Chỉ hỗ trợ rời khỏi nhóm chat');
		}

		const actor = this.getMemberByUserId(conversation, actorId);
		if (!actor) {
			throw new NotFoundException('Thành viên không tồn tại trong nhóm');
		}

		const actorRole = this.normalizeRole(actor.role);
		if (actorRole === 'leader') {
			const deputy = (conversation.members || []).find(
				(item: any) => this.normalizeRole(item.role) === 'deputy' && Number(item.userId) !== Number(actorId),
			);

			const nextOwner = deputy || (conversation.members || []).find((item: any) => Number(item.userId) !== Number(actorId));
			if (!nextOwner) throw new BadRequestException('Nhóm cần có thành viên khác trước khi trưởng nhóm rời đi');

			conversation.members = (conversation.members || [])
				.filter((item: any) => Number(item.userId) !== Number(actorId))
				.map((item: any) => {
					if (Number(item.userId) === Number(nextOwner.userId)) {
						return { ...item, role: 'leader' };
					}
					if (this.normalizeRole(item.role) === 'leader') {
						return { ...item, role: 'member' };
					}
					return item;
				});
			conversation.createdBy = Number(nextOwner.userId);

			await this.conversationRepository.save(conversation);
			emitToConversation(conversationId, 'conversation:members', { conversationId, action: 'left', userId: actorId });
			return { message: 'Bạn đã rời nhóm. Quyền trưởng nhóm đã được tự động chuyển.' };
		}

		conversation.members = (conversation.members || []).filter((item: any) => Number(item.userId) !== Number(actorId));
		await this.conversationRepository.save(conversation);
		emitToConversation(conversationId, 'conversation:members', { conversationId, action: 'left', userId: actorId });
		return { message: 'Bạn đã rời nhóm chat' };
	}

	async transferLeader(conversationId: string, actorId: number, targetUserId: number) {
		const conversation = await this.ensureMembership(conversationId, actorId);
		if (conversation.type !== 'group') {
			throw new BadRequestException('Chỉ hỗ trợ chuyển quyền trưởng nhóm cho nhóm chat');
		}
		if (!this.isLeader(conversation, actorId)) {
			throw new ForbiddenException('Chỉ trưởng nhóm mới có quyền chuyển quyền trưởng nhóm');
		}
		if (Number(actorId) === Number(targetUserId)) {
			throw new BadRequestException('Không thể chuyển quyền cho chính mình');
		}

		const target = this.getMemberByUserId(conversation, targetUserId);
		if (!target) {
			throw new NotFoundException('Thành viên không tồn tại trong nhóm');
		}

		conversation.members = (conversation.members || []).map((item: any) => {
			if (Number(item.userId) === Number(actorId)) {
				return { ...item, role: 'member' };
			}
			if (Number(item.userId) === Number(targetUserId)) {
				return { ...item, role: 'leader' };
			}
			return this.normalizeRole(item.role) === 'leader' ? { ...item, role: 'member' } : item;
		});
		conversation.createdBy = Number(targetUserId);

		await this.conversationRepository.save(conversation);
		return { message: 'Đã chuyển quyền trưởng nhóm' };
	}

	async setDeputy(conversationId: string, actorId: number, targetUserId: number | null) {
		const conversation = await this.ensureMembership(conversationId, actorId);
		if (conversation.type !== 'group') {
			throw new BadRequestException('Chỉ hỗ trợ cấp quyền phó nhóm cho nhóm chat');
		}
		if (!this.isLeader(conversation, actorId)) {
			throw new ForbiddenException('Chỉ trưởng nhóm mới có quyền cấp quyền phó nhóm');
		}

		const desiredDeputyId = targetUserId ? Number(targetUserId) : null;
		if (desiredDeputyId && Number(desiredDeputyId) === Number(actorId)) {
			throw new BadRequestException('Trưởng nhóm không thể tự đặt làm phó nhóm');
		}
		if (desiredDeputyId) {
			const target = this.getMemberByUserId(conversation, desiredDeputyId);
			if (!target) {
				throw new NotFoundException('Thành viên không tồn tại trong nhóm');
			}
			if (this.normalizeRole(target.role) === 'leader') {
				throw new BadRequestException('Không thể gán trưởng nhóm làm phó nhóm');
			}
		}

		conversation.members = (conversation.members || []).map((item: any) => {
			const uid = Number(item.userId);
			const role = this.normalizeRole(item.role);
			if (role === 'leader') return { ...item, role: 'leader' };
			if (desiredDeputyId && uid === desiredDeputyId) {
				return { ...item, role: 'deputy' };
			}
			if (role === 'deputy') {
				return { ...item, role: 'member' };
			}
			return { ...item, role: 'member' };
		});

		await this.conversationRepository.save(conversation);
		return { message: desiredDeputyId ? 'Đã cấp quyền phó nhóm' : 'Đã thu hồi quyền phó nhóm' };
	}

	async updateAdmin(conversationId: string, actorId: number, userId: number, isAdmin: boolean) {
		// Backward-compat endpoint: map admin=true to deputy, admin=false to remove deputy.
		return this.setDeputy(conversationId, actorId, isAdmin ? Number(userId) : null);
	}

	async dissolveGroup(conversationId: string, actorId: number) {
		const conversation = await this.ensureMembership(conversationId, actorId);
		if (conversation.type !== 'group') {
			throw new BadRequestException('Chỉ hỗ trợ giải tán nhóm chat');
		}

		if (!this.isLeader(conversation, actorId)) {
			throw new ForbiddenException('Chỉ trưởng nhóm mới có quyền giải tán nhóm');
		}

		await this.conversationRepository.delete({ _id: new ObjectId(conversationId) as any });
		return { message: 'Đã giải tán nhóm chat' };
	}

	async touchLastMessage(conversationId: string, payload: any) {
		const conversation = await this.getConversationById(conversationId);
		if (!conversation) {
			return;
		}
		conversation.lastMessage = payload;
		conversation.updatedAt = new Date();
		await this.conversationRepository.save(conversation);
		for (const member of conversation.members || []) {
			const userId = Number(member.userId || 0);
			if (userId > 0) {
				emitToUser(userId, 'conversation:updated', { conversation: this.mapConversation(conversation, userId) });
			}
		}
	}

	async pinMessage(conversationId: string, userId: number, messageId: string) {
		const conversation = await this.ensureMembership(conversationId, userId);
		const pinnedMessageIds = new Set<string>((conversation.pinnedMessageIds || []).map((item: any) => String(item)));
		pinnedMessageIds.add(String(messageId));
		conversation.pinnedMessageIds = Array.from(pinnedMessageIds);
		await this.conversationRepository.save(conversation);
		return { message: 'Đã ghim tin nhắn' };
	}

	async unpinMessage(conversationId: string, userId: number, messageId: string) {
		const conversation = await this.ensureMembership(conversationId, userId);
		const pinnedMessageIds = new Set<string>((conversation.pinnedMessageIds || []).map((item: any) => String(item)));
		pinnedMessageIds.delete(String(messageId));
		conversation.pinnedMessageIds = Array.from(pinnedMessageIds);
		await this.conversationRepository.save(conversation);
		return { message: 'Đã bỏ ghim tin nhắn' };
	}
}
