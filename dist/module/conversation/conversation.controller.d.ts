import { ConversationService } from "./conversation.service";
export declare class ConversationController {
    private readonly conversationService;
    constructor(conversationService: ConversationService);
    listConversations(user: any): Promise<{
        conversations: {
            id: string;
            type: any;
            name: any;
            avatarUrl: any;
            createdBy: any;
            createdAt: any;
            updatedAt: any;
            members: any;
            lastMessage: any;
            unreadCount: number;
            role: any;
            notificationsEnabled: boolean;
        }[];
    }>;
    createDirect(user: any, body: {
        userId: number;
    }): Promise<{
        conversation: {
            id: string;
            type: any;
            name: any;
            avatarUrl: any;
            createdBy: any;
            createdAt: any;
            updatedAt: any;
            members: any;
            lastMessage: any;
            unreadCount: number;
            role: any;
            notificationsEnabled: boolean;
        };
    }>;
    createGroup(user: any, body: {
        name: string;
        avatarUrl?: string;
        memberIds: number[];
    }): Promise<{
        conversation: {
            id: string;
            type: any;
            name: any;
            avatarUrl: any;
            createdBy: any;
            createdAt: any;
            updatedAt: any;
            members: any;
            lastMessage: any;
            unreadCount: number;
            role: any;
            notificationsEnabled: boolean;
        };
    }>;
    getDetail(user: any, id: string): Promise<{
        conversation: {
            id: string;
            type: any;
            name: any;
            avatarUrl: any;
            createdBy: any;
            createdAt: any;
            updatedAt: any;
            members: any;
            lastMessage: any;
            unreadCount: number;
            role: any;
            notificationsEnabled: boolean;
        };
    }>;
    seen(user: any, id: string): Promise<{
        message: string;
    }>;
    toggleNotifications(user: any, id: string, body: {
        enabled: boolean;
    }): Promise<{
        message: string;
    }>;
    addMember(user: any, id: string, body: {
        userId: number;
    }): Promise<{
        message: string;
    }>;
    removeMember(user: any, id: string, userId: string): Promise<{
        message: string;
    }>;
    updateAdmin(user: any, id: string, body: {
        userId: number;
        isAdmin: boolean;
    }): Promise<{
        message: string;
    }>;
}
