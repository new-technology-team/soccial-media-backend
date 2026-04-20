"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FriendshipService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const friendship_entity_1 = require("./friendship.entity");
const friendship_status_enum_1 = require("../../common/enum/friendship-status.enum");
const user_service_1 = require("../user/user.service");
const notification_service_1 = require("../notification/notification.service");
let FriendshipService = class FriendshipService {
    constructor(friendshipRepository, userService, notificationService) {
        this.friendshipRepository = friendshipRepository;
        this.userService = userService;
        this.notificationService = notificationService;
    }
    key(userA, userB) {
        return userA < userB ? [userA, userB] : [userB, userA];
    }
    async isAcceptedFriend(userA, userB) {
        if (userA === userB) {
            return true;
        }
        const [a, b] = this.key(userA, userB);
        const row = await this.friendshipRepository.findOne({ where: { userId1: a, userId2: b } });
        return row?.status === friendship_status_enum_1.FriendshipStatus.ACCEPTED;
    }
    async getAcceptedFriendIds(userId) {
        const rows = await this.friendshipRepository.find({
            where: [
                { userId1: userId, status: friendship_status_enum_1.FriendshipStatus.ACCEPTED },
                { userId2: userId, status: friendship_status_enum_1.FriendshipStatus.ACCEPTED },
            ],
        });
        const friendIds = new Set();
        for (const row of rows) {
            friendIds.add(row.userId1 === userId ? row.userId2 : row.userId1);
        }
        return friendIds;
    }
    async listFriends(userId) {
        const rows = await this.friendshipRepository.find({
            where: [
                { userId1: userId },
                { userId2: userId },
            ],
        });
        const friends = [];
        for (const row of rows) {
            const friendId = row.userId1 === userId ? row.userId2 : row.userId1;
            const user = await this.userService.findOne(friendId);
            if (!user)
                continue;
            friends.push({
                id: user.userId,
                fullName: user.displayName,
                email: user.email,
                phone: user.phone,
                avatarUrl: user.avatarUrl,
                isVerified: Boolean(user.isVerified),
                role: user.role,
                accountStatus: user.status,
                status: row.status === friendship_status_enum_1.FriendshipStatus.ACCEPTED ? 'accepted' : 'pending',
                requestedByMe: Number(row.requesterId || 0) === Number(userId),
                createdAt: row.createdAt,
            });
        }
        return { friends };
    }
    async requestFriend(actorId, targetUserId, actorName) {
        if (actorId === targetUserId) {
            throw new common_1.BadRequestException('Không thể kết bạn với chính mình');
        }
        const target = await this.userService.findOne(targetUserId);
        if (!target) {
            throw new common_1.NotFoundException('Người dùng không tồn tại');
        }
        const [a, b] = this.key(actorId, targetUserId);
        let row = await this.friendshipRepository.findOne({ where: { userId1: a, userId2: b } });
        if (!row) {
            row = this.friendshipRepository.create({
                userId1: a,
                userId2: b,
                status: friendship_status_enum_1.FriendshipStatus.PENDING,
                conversationId: '',
                requesterId: actorId,
                createdAt: new Date(),
            });
        }
        else {
            if (row.status === friendship_status_enum_1.FriendshipStatus.ACCEPTED) {
                return { message: 'Hai bạn đã là bạn bè' };
            }
            row.status = friendship_status_enum_1.FriendshipStatus.PENDING;
            row.requesterId = actorId;
        }
        await this.friendshipRepository.save(row);
        await this.notificationService.createNotification({
            userId: targetUserId,
            type: 'friend-request',
            title: 'Yêu cầu kết bạn mới',
            body: `${actorName || 'Có người'} đã gửi lời mời kết bạn`,
            meta: { requesterId: actorId },
        });
        return { message: 'Đã gửi yêu cầu kết bạn' };
    }
    async acceptFriend(actorId, requesterIdOrFriendshipId, actorName) {
        const [a, b] = this.key(actorId, requesterIdOrFriendshipId);
        let row = await this.friendshipRepository.findOne({ where: { userId1: a, userId2: b } });
        if (!row) {
            row = await this.friendshipRepository.findOne({ where: { id: requesterIdOrFriendshipId } });
        }
        if (!row || row.status !== friendship_status_enum_1.FriendshipStatus.PENDING) {
            throw new common_1.BadRequestException('Không tìm thấy yêu cầu kết bạn chờ xử lý');
        }
        const participantIds = [Number(row.userId1), Number(row.userId2)];
        if (!participantIds.includes(Number(actorId))) {
            throw new common_1.BadRequestException('Yêu cầu kết bạn không hợp lệ');
        }
        const requesterHint = Number(requesterIdOrFriendshipId);
        const effectiveRequesterId = Number(row.requesterId ||
            (participantIds.includes(requesterHint) ? requesterHint : participantIds.find((id) => id !== Number(actorId))));
        if (!participantIds.includes(effectiveRequesterId) || Number(actorId) === effectiveRequesterId) {
            throw new common_1.BadRequestException('Yêu cầu kết bạn không hợp lệ');
        }
        row.status = friendship_status_enum_1.FriendshipStatus.ACCEPTED;
        row.requesterId = effectiveRequesterId;
        await this.friendshipRepository.save(row);
        await this.notificationService.createNotification({
            userId: effectiveRequesterId,
            type: 'friend-accepted',
            title: 'Lời mời kết bạn đã được chấp nhận',
            body: `${actorName || 'Một người dùng'} đã chấp nhận lời mời của bạn`,
            meta: { accepterId: actorId },
        });
        return { message: 'Đã chấp nhận lời mời kết bạn' };
    }
    async deleteFriend(actorId, friendUserId) {
        const [a, b] = this.key(actorId, friendUserId);
        await this.friendshipRepository.delete({ userId1: a, userId2: b });
        return { message: 'Đã xóa bạn' };
    }
};
exports.FriendshipService = FriendshipService;
exports.FriendshipService = FriendshipService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(friendship_entity_1.Friendship, 'mariadb')),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        user_service_1.UserService,
        notification_service_1.NotificationService])
], FriendshipService);
//# sourceMappingURL=friendship.service.js.map