import { Repository } from "typeorm";
import { Message } from "./message.entity";
import { ConversationService } from "../conversation/conversation.service";
import { UserService } from "../user/user.service";
import { NotificationService } from "../notification/notification.service";
export declare class MessageService {
    private readonly messageRepository;
    private readonly conversationService;
    private readonly userService;
    private readonly notificationService;
    constructor(messageRepository: Repository<Message>, conversationService: ConversationService, userService: UserService, notificationService: NotificationService);
    private mapMessage;
    private sanitizeFileName;
    listMessages(actorId: number, conversationId: string, limit?: number, beforeId?: string): Promise<{
        messages: {
            id: string;
            conversationId: any;
            senderId: any;
            type: any;
            text: any;
            mediaUrl: any;
            fileName: any;
            mimeType: any;
            fileSize: any;
            meta: any;
            reactionCount: any;
            viewerReaction: null;
            createdAt: any;
            updatedAt: any;
            isDeleted: boolean;
        }[];
    }>;
    sendMessage(actorId: number, conversationId: string, body: any): Promise<{
        message: {
            id: string;
            conversationId: any;
            senderId: any;
            type: any;
            text: any;
            mediaUrl: any;
            fileName: any;
            mimeType: any;
            fileSize: any;
            meta: any;
            reactionCount: any;
            viewerReaction: null;
            createdAt: any;
            updatedAt: any;
            isDeleted: boolean;
        };
    }>;
    searchMessages(actorId: number, q: string): Promise<{
        messages: {
            id: string;
            conversationId: any;
            senderId: any;
            type: any;
            text: any;
            mediaUrl: any;
            fileName: any;
            mimeType: any;
            fileSize: any;
            meta: any;
            reactionCount: any;
            viewerReaction: null;
            createdAt: any;
            updatedAt: any;
            isDeleted: boolean;
        }[];
    }>;
    reactMessage(actorId: number, messageId: string, type: string): Promise<{
        message: string;
        chatMessage: {
            id: string;
            conversationId: any;
            senderId: any;
            type: any;
            text: any;
            mediaUrl: any;
            fileName: any;
            mimeType: any;
            fileSize: any;
            meta: any;
            reactionCount: any;
            viewerReaction: null;
            createdAt: any;
            updatedAt: any;
            isDeleted: boolean;
        };
    }>;
    removeReaction(actorId: number, messageId: string): Promise<{
        message: string;
        chatMessage: {
            id: string;
            conversationId: any;
            senderId: any;
            type: any;
            text: any;
            mediaUrl: any;
            fileName: any;
            mimeType: any;
            fileSize: any;
            meta: any;
            reactionCount: any;
            viewerReaction: null;
            createdAt: any;
            updatedAt: any;
            isDeleted: boolean;
        };
    }>;
    recallMessage(actorId: number, messageId: string): Promise<{
        message: string;
        chatMessage: {
            id: string;
            conversationId: any;
            senderId: any;
            type: any;
            text: any;
            mediaUrl: any;
            fileName: any;
            mimeType: any;
            fileSize: any;
            meta: any;
            reactionCount: any;
            viewerReaction: null;
            createdAt: any;
            updatedAt: any;
            isDeleted: boolean;
        };
    }>;
    forwardMessage(actorId: number, messageId: string, targetConversationId: string): Promise<{
        message: string;
        chatMessage: {
            id: string;
            conversationId: any;
            senderId: any;
            type: any;
            text: any;
            mediaUrl: any;
            fileName: any;
            mimeType: any;
            fileSize: any;
            meta: any;
            reactionCount: any;
            viewerReaction: null;
            createdAt: any;
            updatedAt: any;
            isDeleted: boolean;
        };
    }>;
    getMessageUploadUrl(_actorId: number, _conversationId: string, body: any): Promise<{
        uploadUrl: string;
        fileUrl: string;
        expiresIn: number;
        note: string;
    }>;
    uploadMessageBase64(_actorId: number, _conversationId: string, body: any): Promise<{
        fileUrl: string;
        contentType: any;
        note: string;
    }>;
}
