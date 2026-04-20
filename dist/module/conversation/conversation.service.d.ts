import { Repository } from "typeorm";
import { Conversation } from "./conversation.entity";
import { UserService } from "../user/user.service";
import { FriendshipService } from "../friendship/friendship.service";
export declare class ConversationService {
    private readonly conversationRepository;
    private readonly userService;
    private readonly friendshipService;
    constructor(conversationRepository: Repository<Conversation>, userService: UserService, friendshipService: FriendshipService);
    private mapConversation;
    private normalizeRole;
    private getMemberByUserId;
    private isLeader;
    private isLeaderOrDeputy;
    private enforceSingleLeaderSingleDeputy;
    listConversations(userId: number): Promise<{
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
            pinnedMessageIds: any;
            unreadCount: number;
            role: string;
            notificationsEnabled: boolean;
        }[];
    }>;
    createDirect(actorId: number, targetUserId: number): Promise<{
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
            pinnedMessageIds: any;
            unreadCount: number;
            role: string;
            notificationsEnabled: boolean;
        };
    }>;
    createGroup(actorId: number, name: string, avatarUrl: string | undefined, memberIds: number[]): Promise<{
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
            pinnedMessageIds: any;
            unreadCount: number;
            role: string;
            notificationsEnabled: boolean;
        };
    }>;
    getConversationById(conversationId: string): Promise<Conversation | null>;
    ensureMembership(conversationId: string, userId: number): Promise<Conversation>;
    getConversationDetail(conversationId: string, userId: number): Promise<{
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
            pinnedMessageIds: any;
            unreadCount: number;
            role: string;
            notificationsEnabled: boolean;
        };
    }>;
    setSeen(conversationId: string, userId: number): Promise<{
        message: string;
    }>;
    toggleNotifications(conversationId: string, userId: number, enabled: boolean): Promise<{
        message: string;
    }>;
    addMember(conversationId: string, actorId: number, userId: number): Promise<{
        message: string;
    }>;
    removeMember(conversationId: string, actorId: number, targetUserId: number): Promise<{
        message: string;
    }>;
    leaveGroup(conversationId: string, actorId: number): Promise<{
        message: string;
    }>;
    transferLeader(conversationId: string, actorId: number, targetUserId: number): Promise<{
        message: string;
    }>;
    setDeputy(conversationId: string, actorId: number, targetUserId: number | null): Promise<{
        message: string;
    }>;
    updateAdmin(conversationId: string, actorId: number, userId: number, isAdmin: boolean): Promise<{
        message: string;
    }>;
    dissolveGroup(conversationId: string, actorId: number): Promise<{
        message: string;
    }>;
    touchLastMessage(conversationId: string, payload: any): Promise<void>;
    pinMessage(conversationId: string, userId: number, messageId: string): Promise<{
        message: string;
    }>;
    unpinMessage(conversationId: string, userId: number, messageId: string): Promise<{
        message: string;
    }>;
}
//# sourceMappingURL=conversation.service.d.ts.map