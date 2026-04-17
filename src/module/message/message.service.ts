import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ObjectId } from "mongodb";
import { Repository } from "typeorm";
import { Message } from "./message.entity";
import { ConversationService } from "../conversation/conversation.service";
import { UserService } from "../user/user.service";
import { NotificationService } from "../notification/notification.service";
import * as fs from 'fs/promises';
import * as path from 'path';
import { emitToConversation } from "../../common/socket/chat-socket";

@Injectable()
export class MessageService {
	constructor(
		@InjectRepository(Message, 'mongodb')
		private readonly messageRepository: Repository<Message>,
		private readonly conversationService: ConversationService,
		private readonly userService: UserService,
		private readonly notificationService: NotificationService,
	) {}

	private mapMessage(row: any) {
		return {
			id: String(row._id),
			conversationId: row.conversationId,
			senderId: row.senderId,
			type: row.type,
			text: row.isRecalled ? 'Tin nhắn đã được thu hồi' : row.text || null,
			mediaUrl: row.isRecalled ? null : row.mediaUrl || null,
			fileName: row.fileName || null,
			mimeType: row.mimeType || null,
			fileSize: row.fileSize || null,
			meta: row.meta || null,
			reactionCount: (row.reactions || []).length,
			viewerReaction: null,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
			isDeleted: Boolean(row.isRecalled),
		};
	}

	private sanitizeFileName(name: string) {
		return String(name || 'file')
			.replace(/[^a-zA-Z0-9._-]/g, '-')
			.replace(/-+/g, '-')
			.slice(0, 120);
	}

	async listMessages(actorId: number, conversationId: string, limit = 30, beforeId?: string) {
		await this.conversationService.ensureMembership(conversationId, actorId);
		const rows = await this.messageRepository.find({
			where: { conversationId } as any,
			order: { createdAt: 'DESC' },
			take: Math.min(Math.max(Number(limit || 30), 1), 100),
		});

		const visible = rows.filter(
			(item: any) => !(item.deletedForUserIds || []).some((uid: number) => Number(uid) === Number(actorId)),
		);

		const filtered = beforeId
			? visible.filter((item: any) => String(item._id) < beforeId)
			: visible;

		return { messages: filtered.reverse().map((item) => this.mapMessage(item)) };
	}

	async sendMessage(actorId: number, conversationId: string, body: any) {
		const conversation = await this.conversationService.ensureMembership(conversationId, actorId);

		const type = String(body?.type || 'text');
		if (type === 'text' && !String(body?.text || '').trim()) {
			throw new BadRequestException('Tin nhắn văn bản không được để trống');
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
				meta: body?.sticker ? { sticker: body.sticker } : null,
				reactions: [],
				createdAt: now,
				updatedAt: now,
				isRecalled: false,
				deletedForUserIds: [],
			}),
		);

		const payload = this.mapMessage(created);
		await this.conversationService.touchLastMessage(conversationId, {
			id: payload.id,
			senderId: payload.senderId,
			type: payload.type,
			text: payload.text,
			mediaUrl: payload.mediaUrl,
			createdAt: payload.createdAt,
		});
		emitToConversation(conversationId, 'message:new', payload);

		for (const member of conversation.members || []) {
			if (Number(member.userId) === Number(actorId)) continue;
			await this.notificationService.createNotification({
				userId: member.userId,
				type: 'message',
				title: 'Tin nhắn mới',
				body: payload.text || 'Bạn nhận được một tin nhắn đa phương tiện',
				meta: { conversationId, messageId: payload.id },
			});
		}

		return { message: payload };
	}

	async searchMessages(actorId: number, q: string) {
		const keyword = String(q || '').trim().toLowerCase();
		if (!keyword) {
			throw new BadRequestException('Thiếu từ khóa tìm kiếm');
		}

		const rows = await this.messageRepository.find();
		const matched: any[] = [];

		for (const item of rows as any[]) {
			const isJoined = await this.conversationService.ensureMembership(item.conversationId, actorId)
				.then(() => true)
				.catch(() => false);

			if (!isJoined) continue;
			if ((item.deletedForUserIds || []).some((uid: number) => Number(uid) === Number(actorId))) continue;
			if (!String(item.text || '').toLowerCase().includes(keyword)) continue;
			matched.push(item);
		}

		return { messages: matched.map((row) => this.mapMessage(row)) };
	}

	async reactMessage(actorId: number, messageId: string, type: string) {
		const message = await this.messageRepository.findOne({ where: { _id: new ObjectId(messageId) as any } });
		if (!message || message.isRecalled) {
			throw new NotFoundException('Không tìm thấy tin nhắn');
		}

		await this.conversationService.ensureMembership(message.conversationId, actorId);
		const reactions = (message.reactions || []).filter((item: any) => item.userId !== actorId);
		reactions.push({ userId: actorId, type: type || 'like', createdAt: new Date() });
		message.reactions = reactions;
		message.updatedAt = new Date();
		const saved = await this.messageRepository.save(message);
		const payload = this.mapMessage(saved);
		emitToConversation(message.conversationId, 'message:reaction', {
			conversationId: message.conversationId,
			message: payload,
		});
		return { message: 'Đã cập nhật tương tác tin nhắn', chatMessage: payload };
	}

	async removeReaction(actorId: number, messageId: string) {
		const message = await this.messageRepository.findOne({ where: { _id: new ObjectId(messageId) as any } });
		if (!message || message.isRecalled) {
			throw new NotFoundException('Không tìm thấy tin nhắn');
		}
		await this.conversationService.ensureMembership(message.conversationId, actorId);
		message.reactions = (message.reactions || []).filter((item: any) => item.userId !== actorId);
		message.updatedAt = new Date();
		const saved = await this.messageRepository.save(message);
		const payload = this.mapMessage(saved);
		emitToConversation(message.conversationId, 'message:reaction', {
			conversationId: message.conversationId,
			message: payload,
		});
		return { message: 'Đã gỡ tương tác tin nhắn', chatMessage: payload };
	}

	async recallMessage(actorId: number, messageId: string) {
		const message = await this.messageRepository.findOne({ where: { _id: new ObjectId(messageId) as any } });
		if (!message) {
			throw new NotFoundException('Không tìm thấy tin nhắn');
		}

		await this.conversationService.ensureMembership(message.conversationId, actorId);
		if (Number(message.senderId) !== Number(actorId)) {
			throw new ForbiddenException('Bạn chỉ có thể thu hồi tin nhắn của mình');
		}

		message.isRecalled = true;
		message.updatedAt = new Date();
		const saved = await this.messageRepository.save(message);
		const payload = this.mapMessage(saved);
		emitToConversation(message.conversationId, 'message:updated', {
			conversationId: message.conversationId,
			message: payload,
		});
		return { message: 'Đã thu hồi tin nhắn', chatMessage: payload };
	}

	async forwardMessage(actorId: number, messageId: string, targetConversationId: string) {
		const message = await this.messageRepository.findOne({ where: { _id: new ObjectId(messageId) as any } });
		if (!message || message.isRecalled) {
			throw new NotFoundException('Không tìm thấy tin nhắn');
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
				createdAt: now,
				updatedAt: now,
				isRecalled: false,
				deletedForUserIds: [],
			}),
		);

		const payload = this.mapMessage(forwarded);
		await this.conversationService.touchLastMessage(targetConversationId, {
			id: payload.id,
			senderId: payload.senderId,
			type: payload.type,
			text: payload.text,
			mediaUrl: payload.mediaUrl,
			createdAt: payload.createdAt,
		});
		emitToConversation(targetConversationId, 'message:new', payload);

		for (const member of targetConversation.members || []) {
			if (Number(member.userId) === Number(actorId)) continue;
			await this.notificationService.createNotification({
				userId: member.userId,
				type: 'message',
				title: 'Tin nhắn được chuyển tiếp',
				body: payload.text || 'Bạn nhận được một tin nhắn đa phương tiện',
				meta: { conversationId: targetConversationId, messageId: payload.id },
			});
		}

		return { message: 'Đã chuyển tiếp tin nhắn', chatMessage: payload };
	}

	async deleteMessage(actorId: number, messageId: string) {
		const message = await this.messageRepository.findOne({ where: { _id: new ObjectId(messageId) as any } });
		if (!message) {
			throw new NotFoundException('Không tìm thấy tin nhắn');
		}

		await this.conversationService.ensureMembership(message.conversationId, actorId);
		if (Number(message.senderId) !== Number(actorId)) {
			throw new ForbiddenException('Bạn chỉ có thể xóa tin nhắn của mình');
		}

		const deletedForUserIds = Array.isArray(message.deletedForUserIds) ? [...message.deletedForUserIds] : [];
		if (!deletedForUserIds.some((uid) => Number(uid) === Number(actorId))) {
			deletedForUserIds.push(actorId);
		}
		message.deletedForUserIds = deletedForUserIds;
		message.updatedAt = new Date();
		await this.messageRepository.save(message);

		return { message: 'Đã xóa tin nhắn ở phía bạn' };
	}

	async clearConversationMessages(actorId: number, conversationId: string) {
		await this.conversationService.ensureMembership(conversationId, actorId);
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

		return { message: 'Đã xóa đoạn chat ở phía bạn' };
	}

	async pinMessage(actorId: number, messageId: string) {
		const message = await this.messageRepository.findOne({ where: { _id: new ObjectId(messageId) as any } });
		if (!message) {
			throw new NotFoundException('Không tìm thấy tin nhắn');
		}
		await this.conversationService.pinMessage(message.conversationId, actorId, messageId);
		return { message: 'Đã ghim tin nhắn' };
	}

	async unpinMessage(actorId: number, messageId: string) {
		const message = await this.messageRepository.findOne({ where: { _id: new ObjectId(messageId) as any } });
		if (!message) {
			throw new NotFoundException('Không tìm thấy tin nhắn');
		}
		await this.conversationService.unpinMessage(message.conversationId, actorId, messageId);
		return { message: 'Đã bỏ ghim tin nhắn' };
	}

	async getMessageUploadUrl(_actorId: number, _conversationId: string, body: any) {
		const conversationId = String(_conversationId || 'general');
		const fileName = this.sanitizeFileName(body?.fileName || `file-${Date.now()}`);
		const outputName = `${Date.now()}-${fileName}`;
		const relative = `/uploads/messages/${conversationId}/${outputName}`;
		return {
			uploadUrl: relative,
			fileUrl: relative,
			expiresIn: 900,
			note: 'Local upload URL ready.',
		};
	}

	async uploadMessageBase64(_actorId: number, _conversationId: string, body: any) {
		const conversationId = String(_conversationId || 'general');
		const fileName = this.sanitizeFileName(body?.fileName || `file-${Date.now()}.bin`);
		const outputDir = path.join(process.cwd(), 'uploads', 'messages', conversationId);
		await fs.mkdir(outputDir, { recursive: true });
		const outputName = `${Date.now()}-${fileName}`;
		const outputPath = path.join(outputDir, outputName);
		const base64 = String(body?.base64Data || '').replace(/^data:[^;]+;base64,/, '');
		const buffer = Buffer.from(base64, 'base64');
		await fs.writeFile(outputPath, buffer);
		const fileUrl = `/uploads/messages/${conversationId}/${outputName}`;
		return {
			fileUrl,
			contentType: body?.contentType || 'application/octet-stream',
			note: 'Uploaded to local storage.',
		};
	}
}