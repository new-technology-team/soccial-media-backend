import { Repository } from "typeorm";
import { Friendship } from "./friendship.entity";
import { UserService } from "../user/user.service";
import { NotificationService } from "../notification/notification.service";
export declare class FriendshipService {
    private readonly friendshipRepository;
    private readonly userService;
    private readonly notificationService;
    constructor(friendshipRepository: Repository<Friendship>, userService: UserService, notificationService: NotificationService);
    private key;
    isAcceptedFriend(userA: number, userB: number): Promise<boolean>;
    getAcceptedFriendIds(userId: number): Promise<Set<number>>;
    listFriends(userId: number): Promise<{
        friends: any[];
    }>;
    requestFriend(actorId: number, targetUserId: number, actorName: string): Promise<{
        message: string;
    }>;
    acceptFriend(actorId: number, requesterIdOrFriendshipId: number, actorName: string): Promise<{
        message: string;
    }>;
    deleteFriend(actorId: number, friendUserId: number): Promise<{
        message: string;
    }>;
}
//# sourceMappingURL=friendship.service.d.ts.map