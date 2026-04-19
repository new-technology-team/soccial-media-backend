import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ObjectId } from "mongodb";
import { Repository } from "typeorm";
import { Conversation } from "./conversation.entity";
import { UserService } from "../user/user.service";
import { FriendshipService } from "../friendship/friendship.service";

@Injectable()
export class ConversationService {
	constructor(
		@InjectRepository(Conversation, 'mongodb')
		private readonly conversationRepository: Repository<Conversation>,
		private readonly userService: UserService,
		private readonly friendshipService: FriendshipService,
	) {}

	private mapConversation(conversation: any, viewerId: number) {
		return {
			id: String(conversation._id),
			type: conversation.type,
			name: conversation.name,
			avatarUrl: conversation.avatarUrl || null,
			createdBy: conversation.createdBy,
			createdAt: conversation.createdAt,
			updatedAt: conversation.updatedAt,
			members: (conversation.members || []).map((member: any) => ({
				userId: member.userId,
				fullName: member.fullName,
				avatarUrl: member.avatarUrl || null,
				role: this.normalizeRole(member.role),
				notificationsEnabled: member.notificationsEnabled !== false,
				lastReadAt: member.lastReadAt || null,
			})),
			lastMessage: conversation.lastMessage || null,
			pinnedMessageIds: Array.isArray(conversation.pinnedMessageIds) ? conversation.pinnedMessageIds.map((item: any) => String(item)) : [],
			unreadCount: 0,
			role: this.normalizeRole((conversation.members || []).find((item: any) => item.userId === viewerId)?.role),
			notificationsEnabled:
				(conversation.members || []).find((item: any) => item.userId === viewerId)?.notificationsEnabled !== false,
		};
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
		return { conversations: mine.map((item) => this.mapConversation(item, userId)) };
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
					lastReadAt: now,
				},
				{
					userId: targetUserId,
					fullName: target.displayName || 'Người dùng',
					avatarUrl: target.avatarUrl || null,
					role: 'member',
					notificationsEnabled: true,
					lastReadAt: null,
				},
			],
			lastMessage: null,
			pinnedMessageIds: [],
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
		return { conversation: this.mapConversation(conversation, userId) };
	}

	async setSeen(conversationId: string, userId: number) {
		const conversation = await this.ensureMembership(conversationId, userId);
		conversation.members = (conversation.members || []).map((item: any) =>
			item.userId === userId ? { ...item, lastReadAt: new Date() } : item,
		);
		await this.conversationRepository.save(conversation);
		return { message: 'Đã cập nhật trạng thái đã xem' };
	}

	async toggleNotifications(conversationId: string, userId: number, enabled: boolean) {
		const conversation = await this.ensureMembership(conversationId, userId);
		conversation.members = (conversation.members || []).map((item: any) =>
			item.userId === userId ? { ...item, notificationsEnabled: Boolean(enabled) } : item,
		);
		await this.conversationRepository.save(conversation);
		return { message: 'Đã cập nhật cài đặt thông báo' };
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
				lastReadAt: null,
			},
		];
		await this.conversationRepository.save(conversation);
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

			if (!deputy) {
				throw new BadRequestException('Trưởng nhóm cần chỉ định phó nhóm trước khi rời nhóm');
			}

			conversation.members = (conversation.members || [])
				.filter((item: any) => Number(item.userId) !== Number(actorId))
				.map((item: any) => {
					if (Number(item.userId) === Number(deputy.userId)) {
						return { ...item, role: 'leader' };
					}
					if (this.normalizeRole(item.role) === 'leader') {
						return { ...item, role: 'member' };
					}
					return item;
				});

			await this.conversationRepository.save(conversation);
			return { message: 'Bạn đã rời nhóm. Quyền trưởng nhóm đã được chuyển cho phó nhóm.' };
		}

		conversation.members = (conversation.members || []).filter((item: any) => Number(item.userId) !== Number(actorId));
		await this.conversationRepository.save(conversation);
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