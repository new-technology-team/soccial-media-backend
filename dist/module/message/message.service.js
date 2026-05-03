"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const mongodb_1 = require("mongodb");
const typeorm_2 = require("typeorm");
const message_entity_1 = require("./message.entity");
const conversation_service_1 = require("../conversation/conversation.service");
const user_service_1 = require("../user/user.service");
const notification_service_1 = require("../notification/notification.service");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const chat_socket_1 = require("../../common/socket/chat-socket");
let MessageService = class MessageService {
    constructor(messageRepository, conversationService, userService, notificationService) {
        this.messageRepository = messageRepository;
        this.conversationService = conversationService;
        this.userService = userService;
        this.notificationService = notificationService;
        this.allowedMessageReactions = new Set(['smile', 'sad', 'like', 'love', 'wow', 'cry', 'angry']);
    }
    mapMessage(row, viewerUserId) {
        const reactions = (row.reactions || []).map((item) => ({
            userId: Number(item.userId),
            reaction: String(item.type || item.reaction || 'like'),
            createdAt: item.createdAt || null,
        }));
        const viewerReaction = reactions.find((item) => Number(item.userId) === Number(viewerUserId))?.reaction || null;
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
            reactionCount: reactions.length,
            viewerReaction,
            reactions,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            isDeleted: Boolean(row.isRecalled),
        };
    }
    sanitizeFileName(name) {
        return String(name || 'file')
            .replace(/[^a-zA-Z0-9._-]/g, '-')
            .replace(/-+/g, '-')
            .slice(0, 120);
    }
    async listMessages(actorId, conversationId, limit = 30, beforeId) {
        await this.conversationService.ensureMembership(conversationId, actorId);
        const rows = await this.messageRepository.find({
            where: { conversationId },
            order: { createdAt: 'DESC' },
            take: Math.min(Math.max(Number(limit || 30), 1), 100),
        });
        const visible = rows.filter((item) => !(item.deletedForUserIds || []).some((uid) => Number(uid) === Number(actorId)));
        const filtered = beforeId
            ? visible.filter((item) => String(item._id) < beforeId)
            : visible;
        return { messages: filtered.reverse().map((item) => this.mapMessage(item, actorId)) };
    }
    async sendMessage(actorId, conversationId, body) {
        const conversation = await this.conversationService.ensureMembership(conversationId, actorId);
        const type = String(body?.type || 'text');
        if (type === 'text' && !String(body?.text || '').trim()) {
            throw new common_1.BadRequestException('Tin nhắn văn bản không được để trống');
        }
        const now = new Date();
        const created = await this.messageRepository.save(this.messageRepository.create({
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
        }));
        const payload = this.mapMessage(created, actorId);
        await this.conversationService.touchLastMessage(conversationId, {
            id: payload.id,
            senderId: payload.senderId,
            type: payload.type,
            text: payload.text,
            mediaUrl: payload.mediaUrl,
            createdAt: payload.createdAt,
        });
        (0, chat_socket_1.emitToConversation)(conversationId, 'message:new', payload);
        for (const member of conversation.members || []) {
            if (Number(member.userId) === Number(actorId))
                continue;
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
    async searchMessages(actorId, q) {
        const keyword = String(q || '').trim().toLowerCase();
        if (!keyword) {
            throw new common_1.BadRequestException('Thiếu từ khóa tìm kiếm');
        }
        const rows = await this.messageRepository.find();
        const matched = [];
        for (const item of rows) {
            const isJoined = await this.conversationService.ensureMembership(item.conversationId, actorId)
                .then(() => true)
                .catch(() => false);
            if (!isJoined)
                continue;
            if ((item.deletedForUserIds || []).some((uid) => Number(uid) === Number(actorId)))
                continue;
            if (!String(item.text || '').toLowerCase().includes(keyword))
                continue;
            matched.push(this.mapMessage(item, actorId));
        }
        return { messages: matched };
    }
    async reactMessage(actorId, messageId, type) {
        const message = await this.messageRepository.findOne({ where: { _id: new mongodb_1.ObjectId(messageId) } });
        if (!message || message.isRecalled) {
            throw new common_1.NotFoundException('Không tìm thấy tin nhắn');
        }
        await this.conversationService.ensureMembership(message.conversationId, actorId);
        const reactionType = String(type || 'like');
        if (!this.allowedMessageReactions.has(reactionType)) {
            throw new common_1.BadRequestException('Cảm xúc tin nhắn không hợp lệ');
        }
        const reactions = (message.reactions || []).filter((item) => item.userId !== actorId);
        reactions.push({ userId: actorId, type: reactionType, createdAt: new Date() });
        message.reactions = reactions;
        message.updatedAt = new Date();
        const saved = await this.messageRepository.save(message);
        const payload = this.mapMessage(saved);
        (0, chat_socket_1.emitToConversation)(message.conversationId, 'message:reaction', {
            conversationId: message.conversationId,
            message: payload,
        });
        return { message: 'Đã cập nhật tương tác tin nhắn', chatMessage: this.mapMessage(saved, actorId) };
    }
    async removeReaction(actorId, messageId) {
        const message = await this.messageRepository.findOne({ where: { _id: new mongodb_1.ObjectId(messageId) } });
        if (!message || message.isRecalled) {
            throw new common_1.NotFoundException('Không tìm thấy tin nhắn');
        }
        await this.conversationService.ensureMembership(message.conversationId, actorId);
        message.reactions = (message.reactions || []).filter((item) => item.userId !== actorId);
        message.updatedAt = new Date();
        const saved = await this.messageRepository.save(message);
        const payload = this.mapMessage(saved);
        (0, chat_socket_1.emitToConversation)(message.conversationId, 'message:reaction', {
            conversationId: message.conversationId,
            message: payload,
        });
        return { message: 'Đã gỡ tương tác tin nhắn', chatMessage: this.mapMessage(saved, actorId) };
    }
    async recallMessage(actorId, messageId) {
        const message = await this.messageRepository.findOne({ where: { _id: new mongodb_1.ObjectId(messageId) } });
        if (!message) {
            throw new common_1.NotFoundException('Không tìm thấy tin nhắn');
        }
        await this.conversationService.ensureMembership(message.conversationId, actorId);
        if (Number(message.senderId) !== Number(actorId)) {
            throw new common_1.ForbiddenException('Bạn chỉ có thể thu hồi tin nhắn của mình');
        }
        message.isRecalled = true;
        message.updatedAt = new Date();
        const saved = await this.messageRepository.save(message);
        const payload = this.mapMessage(saved, actorId);
        (0, chat_socket_1.emitToConversation)(message.conversationId, 'message:updated', {
            conversationId: message.conversationId,
            message: payload,
        });
        return { message: 'Đã thu hồi tin nhắn', chatMessage: payload };
    }
    async forwardMessage(actorId, messageId, targetConversationId) {
        const message = await this.messageRepository.findOne({ where: { _id: new mongodb_1.ObjectId(messageId) } });
        if (!message || message.isRecalled) {
            throw new common_1.NotFoundException('Không tìm thấy tin nhắn');
        }
        await this.conversationService.ensureMembership(message.conversationId, actorId);
        const targetConversation = await this.conversationService.ensureMembership(targetConversationId, actorId);
        const now = new Date();
        const forwarded = await this.messageRepository.save(this.messageRepository.create({
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
        }));
        const payload = this.mapMessage(forwarded, actorId);
        await this.conversationService.touchLastMessage(targetConversationId, {
            id: payload.id,
            senderId: payload.senderId,
            type: payload.type,
            text: payload.text,
            mediaUrl: payload.mediaUrl,
            createdAt: payload.createdAt,
        });
        (0, chat_socket_1.emitToConversation)(targetConversationId, 'message:new', payload);
        for (const member of targetConversation.members || []) {
            if (Number(member.userId) === Number(actorId))
                continue;
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
    async deleteMessage(actorId, messageId) {
        const message = await this.messageRepository.findOne({ where: { _id: new mongodb_1.ObjectId(messageId) } });
        if (!message) {
            throw new common_1.NotFoundException('Không tìm thấy tin nhắn');
        }
        await this.conversationService.ensureMembership(message.conversationId, actorId);
        if (Number(message.senderId) !== Number(actorId)) {
            throw new common_1.ForbiddenException('Bạn chỉ có thể xóa tin nhắn của mình');
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
    async clearConversationMessages(actorId, conversationId) {
        await this.conversationService.ensureMembership(conversationId, actorId);
        const rows = await this.messageRepository.find({
            where: { conversationId },
        });
        for (const row of rows) {
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
    async pinMessage(actorId, messageId) {
        const message = await this.messageRepository.findOne({ where: { _id: new mongodb_1.ObjectId(messageId) } });
        if (!message) {
            throw new common_1.NotFoundException('Không tìm thấy tin nhắn');
        }
        await this.conversationService.pinMessage(message.conversationId, actorId, messageId);
        return { message: 'Đã ghim tin nhắn' };
    }
    async unpinMessage(actorId, messageId) {
        const message = await this.messageRepository.findOne({ where: { _id: new mongodb_1.ObjectId(messageId) } });
        if (!message) {
            throw new common_1.NotFoundException('Không tìm thấy tin nhắn');
        }
        await this.conversationService.unpinMessage(message.conversationId, actorId, messageId);
        return { message: 'Đã bỏ ghim tin nhắn' };
    }
    async getMessageUploadUrl(_actorId, _conversationId, body) {
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
    async uploadMessageBase64(_actorId, _conversationId, body) {
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
};
exports.MessageService = MessageService;
exports.MessageService = MessageService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(message_entity_1.Message, 'mongodb')),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        conversation_service_1.ConversationService,
        user_service_1.UserService,
        notification_service_1.NotificationService])
], MessageService);
//# sourceMappingURL=message.service.js.map