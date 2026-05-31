import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { InjectRepository } from "@nestjs/typeorm";
import { ObjectId } from "mongodb";
import { Repository } from "typeorm";
import { Message } from "./message.entity";
import { ConversationService } from "../conversation/conversation.service";
import { UserService } from "../user/user.service";
import { NotificationService } from "../notification/notification.service";
import { FriendshipService } from "../friendship/friendship.service";
import * as fs from "fs/promises";
import * as path from "path";
import { emitToConversation } from "../../common/socket/chat-socket";

@Injectable()
export class MessageService {
	private readonly allowedMessageReactions = new Set(["smile", "sad", "like", "love", "wow", "cry", "angry"]);

	constructor(
		@InjectRepository(Message, "mongodb")
		private readonly messageRepository: Repository<Message>,
		private readonly conversationService: ConversationService,
		private readonly userService: UserService,
		private readonly notificationService: NotificationService,
		private readonly friendshipService: FriendshipService,
	) {}

	private async hydrateMemberAvatars(conversation: any) {
		const members = conversation?.members || [];
		if (!members.length) return;
		const avatarMap = await this.userService.getAvatarMap(members.map((m: any) => Number(m.userId)));
		for (const member of members) {
			if (avatarMap.has(Number(member.userId))) {
				member.avatarUrl = avatarMap.get(Number(member.userId)) || null;
			}
		}
	}

	private mapMessage(row: any, viewerUserId?: number, conversation?: any) {
		const senderId = Number(row.senderId || 0);
		const senderMember = (conversation?.members || []).find((item: any) => Number(item.userId) === senderId);
		const senderName = senderMember?.nickname || row.senderName || row.meta?.senderName || senderMember?.fullName || `Người dùng #${senderId}`;
		const senderAvatar = senderMember?.avatarUrl || row.senderAvatar || row.meta?.senderAvatar || null;
		const reactions = (row.reactions || []).map((item: any) => ({
			userId: Number(item.userId),
			reaction: String(item.type || item.reaction || "like"),
			createdAt: item.createdAt || null,
		}));
		const viewerReaction = reactions.find((item: any) => Number(item.userId) === Number(viewerUserId))?.reaction || null;
		const readBy = (row.readBy || []).map((item: any) => ({
			userId: Number(item.userId),
			at: item.at || item.readAt || null,
		}));
		const deliveredTo = (row.deliveredTo || []).map((item: any) => ({
			userId: Number(item.userId),
			at: item.at || item.deliveredAt || null,
		}));
		const recipientIds = (conversation?.members || [])
			.map((item: any) => Number(item.userId))
			.filter((id: number) => id > 0 && id !== senderId);
		const seenCount = readBy.filter((item: any) => recipientIds.includes(Number(item.userId))).length;
		const deliveredCount = deliveredTo.filter((item: any) => recipientIds.includes(Number(item.userId))).length;
		const status = seenCount > 0 ? "seen" : deliveredCount > 0 ? "delivered" : "sent";

		return {
			id: String(row._id),
			conversationId: row.conversationId,
			senderId,
			senderName,
			senderAvatar,
			type: row.type,
			text: row.isRecalled ? "Tin nhắn đã được thu hồi" : row.text || null,
			mediaUrl: row.isRecalled ? null : row.mediaUrl || null,
			fileName: row.fileName || null,
			mimeType: row.mimeType || null,
			fileSize: row.fileSize || null,
			meta: row.meta || null,
			links: Array.isArray(row.links) ? row.links : this.extractLinks(row.text),
			status,
			readBy,
			deliveredTo,
			reactionCount: reactions.length,
			viewerReaction,
			reactions,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
			expiresAt: row.expiresAt || null,
			isDeleted: Boolean(row.isRecalled),
		};
	}

	private extractLinks(value: unknown) {
		const matches = String(value || "").match(/https?:\/\/[^\s<>()]+/gi) || [];
		return [...new Set(matches.map((item) => item.replace(/[.,!?;:]+$/, "")))];
	}

	private hasLink(row: any) {
		return (Array.isArray(row.links) && row.links.length > 0) || this.extractLinks(row.text).length > 0 || row.type === "link";
	}

	private isVisibleAfterHistoryClear(row: any, conversation: any, actorId: number) {
		const member = (conversation?.members || []).find((item: any) => Number(item.userId) === Number(actorId));
		if (!member?.deletedHistoryAt) return true;
		const rowTime = new Date(row.createdAt).getTime();
		const clearedTime = new Date(member.deletedHistoryAt).getTime();
		return Number.isNaN(rowTime) || Number.isNaN(clearedTime) || rowTime > clearedTime;
	}

	private isExpiredMessage(row: any) {
		if (!row?.expiresAt) return false;
		const expiresAt = new Date(row.expiresAt).getTime();
		return !Number.isNaN(expiresAt) && expiresAt <= Date.now();
	}

	private getConversationExpiresAt(conversation: any, createdAt: Date) {
		const seconds = Number(conversation?.autoDeleteAfterSeconds || 0);
		if (!seconds || seconds <= 0) return null;
		return new Date(createdAt.getTime() + seconds * 1000);
	}

	private async markDelivered(rows: any[], conversation: any, actorId: number) {
		const now = new Date();
		for (const row of rows as any[]) {
			if (Number(row.senderId) === Number(actorId)) continue;
			const deliveredTo = Array.isArray(row.deliveredTo) ? [...row.deliveredTo] : [];
			if (deliveredTo.some((item: any) => Number(item.userId) === Number(actorId))) continue;
			deliveredTo.push({ userId: actorId, at: now });
			row.deliveredTo = deliveredTo;
			row.updatedAt = now;
			await this.messageRepository.save(row);
			emitToConversation(row.conversationId, "message:delivery", {
				conversationId: row.conversationId,
				messageId: String(row._id),
				userId: actorId,
				deliveredAt: now,
			});
		}
	}

	private matchesFilters(row: any, filters?: { senderId?: number; type?: string; sentDate?: string; q?: string }) {
		if (filters?.senderId && Number(row.senderId) !== Number(filters.senderId)) return false;
		if (filters?.q && !String(row.text || "").toLowerCase().includes(String(filters.q).trim().toLowerCase())) return false;
		if (filters?.type) {
			const wantedType = String(filters.type).toLowerCase();
			if (wantedType === "link") {
				if (!this.hasLink(row)) return false;
			} else if (String(row.type || "text").toLowerCase() !== wantedType) {
				return false;
			}
		}
		if (filters?.sentDate) {
			const actual = new Date(row.createdAt);
			const expected = new Date(filters.sentDate);
			if (Number.isNaN(actual.getTime()) || Number.isNaN(expected.getTime())) return false;
			if (actual.toISOString().slice(0, 10) !== expected.toISOString().slice(0, 10)) return false;
		}
		return true;
	}

	private shouldNotifyMember(member: any) {
		if (member.notificationsEnabled === false && !member.mutedUntil) return false;
		if (!member.mutedUntil) return true;
		const mutedUntil = new Date(member.mutedUntil).getTime();
		return Number.isNaN(mutedUntil) || mutedUntil <= Date.now();
	}

	private sanitizeFileName(name: string) {
		return String(name || "file")
			.replace(/[^a-zA-Z0-9._-]/g, "-")
			.replace(/-+/g, "-")
			.slice(0, 120);
	}

	private getS3Config() {
		const bucket = process.env.AWS_S3_BUCKET || process.env.AWS_BUCKET_NAME || process.env.S3_BUCKET || "";
		const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ap-southeast-1";
		return { bucket, region };
	}

	private getS3Client() {
		const { region } = this.getS3Config();
		return new S3Client({
			region,
			credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
				? {
					accessKeyId: process.env.AWS_ACCESS_KEY_ID,
					secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
					sessionToken: process.env.AWS_SESSION_TOKEN || undefined,
				}
				: undefined,
		});
	}

	private buildS3Url(key: string) {
		const { bucket, region } = this.getS3Config();
		return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
	}

	private extractS3Key(fileUrl: string | null | undefined) {
		if (!fileUrl) return null;
		const { bucket } = this.getS3Config();
		if (!bucket) return null;

		try {
			const url = new URL(fileUrl);
			if (url.hostname === `${bucket}.s3.amazonaws.com` || url.hostname.startsWith(`${bucket}.s3.`)) {
				return decodeURIComponent(url.pathname.replace(/^\/+/, ""));
			}

			const pathParts = url.pathname.replace(/^\/+/, "").split("/");
			if (pathParts[0] === bucket) {
				return decodeURIComponent(pathParts.slice(1).join("/"));
			}
		} catch {
			return null;
		}

		return null;
	}

	private async deleteMediaUrl(fileUrl: string | null | undefined, ignoreMessageId?: string) {
		if (!fileUrl) return;
		const sharedRows = await this.messageRepository.find({ where: { mediaUrl: fileUrl } as any });
		const isStillReferenced = (sharedRows as any[]).some((item) =>
			String(item._id) !== String(ignoreMessageId || "") && !item.isRecalled,
		);
		if (isStillReferenced) return;

		const key = this.extractS3Key(fileUrl);
		const { bucket } = this.getS3Config();
		if (key && bucket) {
			await this.getS3Client().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
			return;
		}

		if (fileUrl.startsWith("/uploads/")) {
			const resolved = path.resolve(process.cwd(), fileUrl.replace(/^\/+/, ""));
			const uploadsRoot = path.resolve(process.cwd(), "uploads");
			if (resolved.startsWith(uploadsRoot)) {
				await fs.unlink(resolved).catch(() => undefined);
			}
		}
	}

	async listMessages(
		actorId: number,
		conversationId: string,
		limit = 30,
		beforeId?: string,
		filters?: { senderId?: number; type?: string; sentDate?: string; q?: string },
	) {
		const conversation = await this.conversationService.ensureMembership(conversationId, actorId);
		await this.hydrateMemberAvatars(conversation);
		const rows = await this.messageRepository.find({
			where: { conversationId } as any,
			order: { createdAt: "DESC" },
		});
		const take = Math.min(Math.max(Number(limit || 30), 1), 100);

		const visible = rows.filter(
			(item: any) => !(item.deletedForUserIds || []).some((uid: number) => Number(uid) === Number(actorId)),
		).filter((item: any) => this.isVisibleAfterHistoryClear(item, conversation, actorId));
		const active = visible.filter((item: any) => !this.isExpiredMessage(item));

		const filtered = beforeId
			? active.filter((item: any) => String(item._id) < beforeId)
			: active;
		const filteredByFacet = filtered.filter((item: any) => this.matchesFilters(item, filters)).slice(0, take);
		await this.markDelivered(filteredByFacet, conversation, actorId);

		return { messages: filteredByFacet.reverse().map((item) => this.mapMessage(item, actorId, conversation)) };
	}

	async sendMessage(actorId: number, conversationId: string, body: any) {
		const conversation = await this.conversationService.ensureMembership(conversationId, actorId);
		if (conversation.type === "direct") {
			const peer = (conversation.members || []).find((member: any) => Number(member.userId) !== Number(actorId));
			if (peer && await this.friendshipService.isBlockedBetween(actorId, Number(peer.userId))) {
				throw new ForbiddenException("Không thể gửi tin nhắn vì một trong hai bên đã chặn người còn lại");
			}
		}

		const links = this.extractLinks(body?.text);
		const requestedType = String(body?.type || "text");
		const type = requestedType === "text" && links.length > 0 && links.join("") === String(body?.text || "").trim() ? "link" : requestedType;
		if (type === "text" && !String(body?.text || "").trim()) {
			throw new BadRequestException("Tin nhắn văn bản không được để trống");
		}

		const now = new Date();
		const created = await this.messageRepository.save(
			this.messageRepository.create({
				conversationId,
				senderId: actorId,
				type,
				text: body?.text ? String(body.text).trim() : null,
				mediaUrl: body?.mediaUrl || null,
				fileName: body?.fileName || null,
				mimeType: body?.mimeType || null,
				fileSize: body?.fileSize || null,
				meta: body?.meta || (body?.sticker ? { sticker: body.sticker } : null),
				links,
				reactions: [],
				createdAt: now,
				updatedAt: now,
				expiresAt: this.getConversationExpiresAt(conversation, now),
				isRecalled: false,
				deletedForUserIds: [],
				deliveredTo: [],
				readBy: [],
			}),
		);

		const payload = this.mapMessage(created, actorId, conversation);
		await this.conversationService.touchLastMessage(conversationId, {
			id: payload.id,
			senderId: payload.senderId,
			senderName: payload.senderName,
			senderAvatar: payload.senderAvatar,
			type: payload.type,
			text: payload.text,
			mediaUrl: payload.mediaUrl,
			createdAt: payload.createdAt,
			expiresAt: payload.expiresAt || null,
		});
		emitToConversation(conversationId, "message:new", payload);

		for (const member of conversation.members || []) {
			if (Number(member.userId) === Number(actorId) || !this.shouldNotifyMember(member)) continue;
			await this.notificationService.createNotification({
				userId: member.userId,
				type: "message",
				title: "Tin nhắn mới",
				body: payload.text || "Bạn nhận được một tin nhắn đa phương tiện",
				meta: { conversationId, messageId: payload.id },
			});
		}

		return { message: payload };
	}

	async searchMessages(actorId: number, q: string) {
		const keyword = String(q || "").trim().toLowerCase();
		if (!keyword) {
			throw new BadRequestException("Thiếu từ khóa tìm kiếm");
		}

		const rows = await this.messageRepository.find();
		const conversationCache = new Map<string, any>();
		const matched: any[] = [];

		for (const item of rows as any[]) {
			let conversation = conversationCache.get(String(item.conversationId));
			if (!conversation) {
				conversation = await this.conversationService.ensureMembership(item.conversationId, actorId)
					.then((result) => {
						conversationCache.set(String(item.conversationId), result);
						return result;
					})
					.catch(() => null);
			}
			const isJoined = Boolean(conversation);

			if (!isJoined) continue;
			if ((item.deletedForUserIds || []).some((uid: number) => Number(uid) === Number(actorId))) continue;
			if (this.isExpiredMessage(item)) continue;
			if (!String(item.text || "").toLowerCase().includes(keyword)) continue;
			matched.push(this.mapMessage(item, actorId, conversation));
		}

		return { messages: matched };
	}

	async reactMessage(actorId: number, messageId: string, type: string) {
		const message = await this.messageRepository.findOne({ where: { _id: new ObjectId(messageId) as any } });
		if (!message || message.isRecalled) {
			throw new NotFoundException("Không tìm thấy tin nhắn");
		}
		if (this.isExpiredMessage(message)) {
			throw new NotFoundException("Không tìm thấy tin nhắn");
		}

		const conversation = await this.conversationService.ensureMembership(message.conversationId, actorId);
		const reactionType = String(type || "like");
		if (!this.allowedMessageReactions.has(reactionType)) {
			throw new BadRequestException("Cảm xúc tin nhắn không hợp lệ");
		}
		const reactions = (message.reactions || []).filter((item: any) => item.userId !== actorId);
		reactions.push({ userId: actorId, type: reactionType, createdAt: new Date() });
		message.reactions = reactions;
		message.updatedAt = new Date();
		const saved = await this.messageRepository.save(message);
		const payload = this.mapMessage(saved, actorId, conversation);
		emitToConversation(message.conversationId, "message:reaction", {
			conversationId: message.conversationId,
			message: payload,
		});
		return { message: "Đã cập nhật tương tác tin nhắn", chatMessage: this.mapMessage(saved, actorId) };
	}

	async removeReaction(actorId: number, messageId: string) {
		const message = await this.messageRepository.findOne({ where: { _id: new ObjectId(messageId) as any } });
		if (!message || message.isRecalled) {
			throw new NotFoundException("Không tìm thấy tin nhắn");
		}
		if (this.isExpiredMessage(message)) {
			throw new NotFoundException("Không tìm thấy tin nhắn");
		}
		const conversation = await this.conversationService.ensureMembership(message.conversationId, actorId);
		message.reactions = (message.reactions || []).filter((item: any) => item.userId !== actorId);
		message.updatedAt = new Date();
		const saved = await this.messageRepository.save(message);
		const payload = this.mapMessage(saved, actorId, conversation);
		emitToConversation(message.conversationId, "message:reaction", {
			conversationId: message.conversationId,
			message: payload,
		});
		return { message: "Đã gỡ tương tác tin nhắn", chatMessage: this.mapMessage(saved, actorId) };
	}

	async recallMessage(actorId: number, messageId: string) {
		const message = await this.messageRepository.findOne({ where: { _id: new ObjectId(messageId) as any } });
		if (!message) {
			throw new NotFoundException("Không tìm thấy tin nhắn");
		}

		const conversation = await this.conversationService.ensureMembership(message.conversationId, actorId);
		if (Number(message.senderId) !== Number(actorId)) {
			throw new ForbiddenException("Bạn chỉ có thể thu hồi tin nhắn của mình");
		}

		const recalledMediaUrl = message.mediaUrl;
		message.isRecalled = true;
		message.updatedAt = new Date();
		const saved = await this.messageRepository.save(message);
		await this.deleteMediaUrl(recalledMediaUrl, String(saved._id));
		const payload = this.mapMessage(saved, actorId, conversation);

		// Auto-unpin nếu tin nhắn đang được ghim
		const pinnedIds = (conversation.pinnedMessageIds || []).map(String);
		const wasPinned = pinnedIds.includes(String(saved._id));
		if (wasPinned) {
			await this.conversationService.unpinMessage(message.conversationId, actorId, String(saved._id));
		}

		emitToConversation(message.conversationId, "message:updated", {
			conversationId: message.conversationId,
			message: payload,
			unpinnedMessageId: wasPinned ? String(saved._id) : undefined,
		});
		return { message: "Đã thu hồi tin nhắn", chatMessage: payload };
	}

	async forwardMessage(actorId: number, messageId: string, targetConversationId: string) {
		const message = await this.messageRepository.findOne({ where: { _id: new ObjectId(messageId) as any } });
		if (!message || message.isRecalled) {
			throw new NotFoundException("Không tìm thấy tin nhắn");
		}
		if (this.isExpiredMessage(message)) {
			throw new NotFoundException("Không tìm thấy tin nhắn");
		}

		await this.conversationService.ensureMembership(message.conversationId, actorId);
		const targetConversation = await this.conversationService.ensureMembership(targetConversationId, actorId);

		const now = new Date();
		const forwarded = await this.messageRepository.save(
			this.messageRepository.create({
				conversationId: targetConversationId,
				senderId: actorId,
				type: message.type,
				text: message.text,
				mediaUrl: message.mediaUrl,
				fileName: message.fileName,
				mimeType: message.mimeType,
				fileSize: message.fileSize,
				meta: {
					...(message.meta || {}),
					forwardedFromMessageId: String(message._id),
					forwardedFromConversationId: message.conversationId,
				},
				reactions: [],
				links: Array.isArray(message.links) ? message.links : this.extractLinks(message.text),
				createdAt: now,
				updatedAt: now,
				isRecalled: false,
				deletedForUserIds: [],
				deliveredTo: [],
				readBy: [],
			}),
		);

		const payload = this.mapMessage(forwarded, actorId, targetConversation);
		await this.conversationService.touchLastMessage(targetConversationId, {
			id: payload.id,
			senderId: payload.senderId,
			senderName: payload.senderName,
			senderAvatar: payload.senderAvatar,
			type: payload.type,
			text: payload.text,
			mediaUrl: payload.mediaUrl,
			createdAt: payload.createdAt,
		});
		emitToConversation(targetConversationId, "message:new", payload);

		for (const member of targetConversation.members || []) {
			if (Number(member.userId) === Number(actorId) || !this.shouldNotifyMember(member)) continue;
			await this.notificationService.createNotification({
				userId: member.userId,
				type: "message",
				title: "Tin nhắn được chuyển tiếp",
				body: payload.text || "Bạn nhận được một tin nhắn đa phương tiện",
				meta: { conversationId: targetConversationId, messageId: payload.id },
			});
		}

		return { message: "Đã chuyển tiếp tin nhắn", chatMessage: payload };
	}

	async deleteMessage(actor: any, messageId: string) {
		const actorId = Number(actor?.id || actor?.userId || actor || 0);
		const message = await this.messageRepository.findOne({ where: { _id: new ObjectId(messageId) as any } });
		if (!message) {
			throw new NotFoundException("Không tìm thấy tin nhắn");
		}

		const conversation = await this.conversationService.ensureMembership(message.conversationId, actorId);
		const actorRole = String(actor?.role || '').toLowerCase();
		const canModerate = actorRole === 'admin' || actorRole === 'moderator';
		if (Number(message.senderId) !== Number(actorId) && !canModerate) {
			throw new ForbiddenException("Bạn chỉ có thể xóa tin nhắn của mình");
		}

		const deletedForUserIds = Array.isArray(message.deletedForUserIds) ? [...message.deletedForUserIds] : [];
		if (!deletedForUserIds.some((uid) => Number(uid) === Number(actorId))) {
			deletedForUserIds.push(actorId);
		}
		message.deletedForUserIds = deletedForUserIds;
		message.updatedAt = new Date();
		await this.messageRepository.save(message);

		// Auto-unpin nếu tin nhắn đang được ghim
		const pinnedIds = (conversation.pinnedMessageIds || []).map(String);
		const wasPinned = pinnedIds.includes(String(message._id));
		if (wasPinned) {
			await this.conversationService.unpinMessage(message.conversationId, actorId, String(message._id));
		}

		emitToConversation(message.conversationId, "message:deleted", {
			conversationId: message.conversationId,
			messageId: String(message._id),
			deletedBy: actorId,
			unpinnedMessageId: wasPinned ? String(message._id) : undefined,
		});

		return { message: "Đã xóa tin nhắn ở phía bạn" };
	}

	async clearConversationMessages(actorId: number, conversationId: string) {
		await this.conversationService.clearHistoryCursor(conversationId, actorId);
		const rows = await this.messageRepository.find({
			where: { conversationId } as any,
		});

		for (const row of rows as any[]) {
			const deletedForUserIds = Array.isArray(row.deletedForUserIds) ? [...row.deletedForUserIds] : [];
			if (!deletedForUserIds.some((uid) => Number(uid) === Number(actorId))) {
				deletedForUserIds.push(actorId);
				row.deletedForUserIds = deletedForUserIds;
				row.updatedAt = new Date();
				await this.messageRepository.save(row);
			}
		}

		return { message: "Đã xóa đoạn chat ở phía bạn" };
	}

	async markConversationRead(actorId: number, conversationId: string, lastReadMessageId?: string | null) {
		const conversation = await this.conversationService.ensureMembership(conversationId, actorId);
		const rows = await this.messageRepository.find({ where: { conversationId } as any });
		const now = new Date();
		let effectiveLastId = lastReadMessageId || null;
		for (const row of rows as any[]) {
			if (Number(row.senderId) === Number(actorId)) continue;
			if (!this.isVisibleAfterHistoryClear(row, conversation, actorId)) continue;
			if (this.isExpiredMessage(row)) continue;
			const readBy = Array.isArray(row.readBy) ? [...row.readBy] : [];
			if (!readBy.some((item: any) => Number(item.userId) === Number(actorId))) {
				readBy.push({ userId: actorId, at: now });
				row.readBy = readBy;
				row.updatedAt = now;
				await this.messageRepository.save(row);
				emitToConversation(conversationId, "message:seen", {
					conversationId,
					messageId: String(row._id),
					userId: actorId,
					seenAt: now,
				});
			}
			effectiveLastId = String(row._id);
		}
		await this.conversationService.setSeen(conversationId, actorId, effectiveLastId);
		return { message: "Đã cập nhật trạng thái đã xem" };
	}

	async getSharedConversationContent(actorId: number, conversationId: string) {
		const conversation = await this.conversationService.ensureMembership(conversationId, actorId);
		const rows = await this.messageRepository.find({
			where: { conversationId } as any,
			order: { createdAt: "DESC" },
		});
		const visible = rows
			.filter((item: any) => !item.isRecalled)
			.filter((item: any) => !this.isExpiredMessage(item))
			.filter((item: any) => !(item.deletedForUserIds || []).some((uid: number) => Number(uid) === Number(actorId)))
			.filter((item: any) => this.isVisibleAfterHistoryClear(item, conversation, actorId));
		const mapped = visible.map((item) => this.mapMessage(item, actorId, conversation));
		return {
			photosVideos: mapped.filter((item) => item.type === "image" || item.type === "video"),
			files: mapped.filter((item) => item.type === "file" || (item.mediaUrl && item.type !== "image" && item.type !== "video")),
			links: mapped.filter((item) => item.type === "link" || (item.links || []).length > 0),
		};
	}

	async pinMessage(actorId: number, messageId: string) {
		const message = await this.messageRepository.findOne({ where: { _id: new ObjectId(messageId) as any } });
		if (!message) {
			throw new NotFoundException("Không tìm thấy tin nhắn");
		}
		await this.conversationService.pinMessage(message.conversationId, actorId, messageId);
		return { message: "Đã ghim tin nhắn" };
	}

	async unpinMessage(actorId: number, messageId: string) {
		const message = await this.messageRepository.findOne({ where: { _id: new ObjectId(messageId) as any } });
		if (!message) {
			throw new NotFoundException("Không tìm thấy tin nhắn");
		}
		await this.conversationService.unpinMessage(message.conversationId, actorId, messageId);
		return { message: "Đã bỏ ghim tin nhắn" };
	}

	async getMessageUploadUrl(_actorId: number, _conversationId: string, body: any) {
		const conversationId = String(_conversationId || "general");
		const fileName = this.sanitizeFileName(body?.fileName || `file-${Date.now()}`);
		const outputName = `${Date.now()}-${fileName}`;
		const { bucket } = this.getS3Config();
		if (bucket) {
			const key = `uploads/messages/${conversationId}/${outputName}`;
			const command = new PutObjectCommand({
				Bucket: bucket,
				Key: key,
				ContentType: body?.contentType || "application/octet-stream",
			});
			return {
				uploadUrl: await getSignedUrl(this.getS3Client(), command, { expiresIn: 900 }),
				fileUrl: this.buildS3Url(key),
				expiresIn: 900,
				note: "Đã tạo URL tải tệp lên Amazon S3.",
			};
		}
		const relative = `/uploads/messages/${conversationId}/${outputName}`;
		return {
			uploadUrl: relative,
			fileUrl: relative,
			expiresIn: 900,
			note: "Đã tạo URL tải tệp lên bộ nhớ cục bộ.",
		};
	}

	async uploadMessageBase64(_actorId: number, _conversationId: string, body: any) {
		const conversationId = String(_conversationId || "general");
		const fileName = this.sanitizeFileName(body?.fileName || `file-${Date.now()}.bin`);
		const outputName = `${Date.now()}-${fileName}`;
		const base64 = String(body?.base64Data || "").replace(/^data:[^;]+;base64,/, "");
		const buffer = Buffer.from(base64, "base64");
		const contentType = body?.contentType || "application/octet-stream";
		const { bucket } = this.getS3Config();

		if (bucket) {
			const key = `uploads/messages/${conversationId}/${outputName}`;
			try {
				await this.getS3Client().send(new PutObjectCommand({
					Bucket: bucket,
					Key: key,
					Body: buffer,
					ContentType: contentType,
				}));
				return {
					fileUrl: this.buildS3Url(key),
					contentType,
					note: "Đã tải tệp lên Amazon S3.",
				};
			} catch (error) {
				const detail = error instanceof Error ? error.message : "Lỗi S3 không xác định";
				console.error("S3 message upload failed:", detail);
				throw new BadRequestException(`Không thể tải tệp tin nhắn lên S3: ${detail}`);
			}
		}

		const outputDir = path.join(process.cwd(), "uploads", "messages", conversationId);
		await fs.mkdir(outputDir, { recursive: true });
		const outputPath = path.join(outputDir, outputName);
		await fs.writeFile(outputPath, buffer);
		const fileUrl = `/uploads/messages/${conversationId}/${outputName}`;
		return {
			fileUrl,
			contentType,
			note: "Đã tải tệp lên bộ nhớ cục bộ.",
		};
	}
}
