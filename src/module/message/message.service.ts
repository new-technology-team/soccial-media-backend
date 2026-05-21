import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { InjectRepository } from "@nestjs/typeorm";
import { ObjectId } from "mongodb";
import { Repository } from "typeorm";
import { Message } from "./message.entity";
import { ConversationService } from "../conversation/conversation.service";
import { UserService } from "../user/user.service";
import { NotificationService } from "../notification/notification.service";
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
	) {}

	private mapMessage(row: any, viewerUserId?: number, conversation?: any) {
		const senderId = Number(row.senderId || 0);
		const senderMember = (conversation?.members || []).find((item: any) => Number(item.userId) === senderId);
		const senderName = row.senderName || row.meta?.senderName || senderMember?.fullName || `Người dùng #${senderId}`;
		const senderAvatar = row.senderAvatar || row.meta?.senderAvatar || senderMember?.avatarUrl || null;
		const reactions = (row.reactions || []).map((item: any) => ({
			userId: Number(item.userId),
			reaction: String(item.type || item.reaction || "like"),
			createdAt: item.createdAt || null,
		}));
		const viewerReaction = reactions.find((item: any) => Number(item.userId) === Number(viewerUserId))?.reaction || null;

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
			reactionCount: reactions.length,
			viewerReaction,
			reactions,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
			isDeleted: Boolean(row.isRecalled),
		};
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
				}
				: undefined,
		});
	}

	private buildS3Url(key: string) {
		const { bucket, region } = this.getS3Config();
		return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
	}

	async listMessages(actorId: number, conversationId: string, limit = 30, beforeId?: string) {
		const conversation = await this.conversationService.ensureMembership(conversationId, actorId);
		const rows = await this.messageRepository.find({
			where: { conversationId } as any,
			order: { createdAt: "DESC" },
			take: Math.min(Math.max(Number(limit || 30), 1), 100),
		});

		const visible = rows.filter(
			(item: any) => !(item.deletedForUserIds || []).some((uid: number) => Number(uid) === Number(actorId)),
		);

		const filtered = beforeId
			? visible.filter((item: any) => String(item._id) < beforeId)
			: visible;

		return { messages: filtered.reverse().map((item) => this.mapMessage(item, actorId, conversation)) };
	}

	async sendMessage(actorId: number, conversationId: string, body: any) {
		const conversation = await this.conversationService.ensureMembership(conversationId, actorId);

		const type = String(body?.type || "text");
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
				meta: body?.sticker ? { sticker: body.sticker } : null,
				reactions: [],
				createdAt: now,
				updatedAt: now,
				isRecalled: false,
				deletedForUserIds: [],
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
		});
		emitToConversation(conversationId, "message:new", payload);

		for (const member of conversation.members || []) {
			if (Number(member.userId) === Number(actorId)) continue;
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

		message.isRecalled = true;
		message.updatedAt = new Date();
		const saved = await this.messageRepository.save(message);
		const payload = this.mapMessage(saved, actorId, conversation);
		emitToConversation(message.conversationId, "message:updated", {
			conversationId: message.conversationId,
			message: payload,
		});
		return { message: "Đã thu hồi tin nhắn", chatMessage: payload };
	}

	async forwardMessage(actorId: number, messageId: string, targetConversationId: string) {
		const message = await this.messageRepository.findOne({ where: { _id: new ObjectId(messageId) as any } });
		if (!message || message.isRecalled) {
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
				createdAt: now,
				updatedAt: now,
				isRecalled: false,
				deletedForUserIds: [],
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
			if (Number(member.userId) === Number(actorId)) continue;
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

	async deleteMessage(actorId: number, messageId: string) {
		const message = await this.messageRepository.findOne({ where: { _id: new ObjectId(messageId) as any } });
		if (!message) {
			throw new NotFoundException("Không tìm thấy tin nhắn");
		}

		await this.conversationService.ensureMembership(message.conversationId, actorId);
		if (Number(message.senderId) !== Number(actorId)) {
			throw new ForbiddenException("Bạn chỉ có thể xóa tin nhắn của mình");
		}

		const deletedForUserIds = Array.isArray(message.deletedForUserIds) ? [...message.deletedForUserIds] : [];
		if (!deletedForUserIds.some((uid) => Number(uid) === Number(actorId))) {
			deletedForUserIds.push(actorId);
		}
		message.deletedForUserIds = deletedForUserIds;
		message.updatedAt = new Date();
		await this.messageRepository.save(message);

		return { message: "Đã xóa tin nhắn ở phía bạn" };
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

		return { message: "Đã xóa đoạn chat ở phía bạn" };
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
				console.warn("Không thể tải tệp tin nhắn lên S3, chuyển sang bộ nhớ cục bộ:", error instanceof Error ? error.message : error);
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
