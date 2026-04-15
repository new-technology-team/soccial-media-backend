import { MessageService } from "./message.service";
export declare class MessageController {
    private readonly messageService;
    constructor(messageService: MessageService);
    getConversationMessages(user: any, id: string, limit?: string, beforeId?: string): Promise<{
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
    sendMessage(user: any, id: string, body: any): Promise<{
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
    getMessageUploadUrl(user: any, id: string, body: any): Promise<{
        uploadUrl: string;
        fileUrl: string;
        expiresIn: number;
        note: string;
    }>;
    uploadMessageBase64(user: any, id: string, body: any): Promise<{
        fileUrl: string;
        contentType: any;
        note: string;
    }>;
    searchMessages(user: any, q: string): Promise<{
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
    reactMessage(user: any, messageId: string, body: {
        type: string;
    }): Promise<{
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
    removeMessageReaction(user: any, messageId: string): Promise<{
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
    recallMessage(user: any, messageId: string): Promise<{
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
    forwardMessage(user: any, messageId: string, body: {
        targetConversationId: string;
    }): Promise<{
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
}
//# sourceMappingURL=message.controller.d.ts.map