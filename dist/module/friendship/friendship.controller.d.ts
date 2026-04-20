import { FriendshipService } from "./friendship.service";
import { UserService } from "../user/user.service";
export declare class FriendshipController {
    private readonly friendshipService;
    private readonly userService;
    constructor(friendshipService: FriendshipService, userService: UserService);
    listFriends(user: any): Promise<{
        friends: any[];
    }>;
    findUsers(user: any, q: string): Promise<{
        users: {
            id: number;
            fullName: string;
            avatarUrl: string | null;
            email: string | null;
            phone: string | null;
            role: import("../../common/enum/user-role.enum").UserRole;
            accountStatus: import("../../common/enum/user-status.enum").UserStatus;
        }[];
    }>;
    requestFriend(user: any, body: {
        userId: number;
    }): Promise<{
        message: string;
    }>;
    acceptFriend(user: any, userId: string): Promise<{
        message: string;
    }>;
    deleteFriend(user: any, userId: string): Promise<{
        message: string;
    }>;
}
//# sourceMappingURL=friendship.controller.d.ts.map