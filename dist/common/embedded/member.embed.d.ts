import { ConversationRole } from "../enum/conversation-role.enum";
export declare class Member {
    userId: number;
    displayName: string;
    avatarUrl: string;
    roleInConversation: ConversationRole;
    constructor(userId: number, displayName: string, avatarUrl: string, roleInConversation: ConversationRole);
}
