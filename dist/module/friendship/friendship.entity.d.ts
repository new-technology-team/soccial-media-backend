import { FriendshipStatus } from "../../common/enum/friendship-status.enum";
export declare class Friendship {
    id: number;
    userId1: number;
    userId2: number;
    status: FriendshipStatus;
    conversationId: string;
    requesterId: number | null;
    createdAt: Date;
}
//# sourceMappingURL=friendship.entity.d.ts.map