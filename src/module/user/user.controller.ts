import { Body, Controller, Get, Param, Put, Query, UseGuards } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UserService } from "./user.service";
import { PostService } from "../post/post.service";
import { Friendship } from "../friendship/friendship.entity";
import { BlockedUser } from "../friendship/blocked-user.entity";
import { FriendshipStatus } from "../../common/enum/friendship-status.enum";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { CurrentUser } from "../../common/auth/current-user.decorator";

@Controller('social')
export class UserController {
    constructor(
        private userService: UserService,
        private postService: PostService,
        @InjectRepository(Friendship, 'mariadb')
        private readonly friendshipRepo: Repository<Friendship>,
        @InjectRepository(BlockedUser, 'mariadb')
        private readonly blockedUserRepo: Repository<BlockedUser>,
    ) { }

    @UseGuards(JwtAuthGuard)
    @Get('settings')
    async getSettings(@CurrentUser() user: any) {
        const profile = await this.userService.findOne(user.id);
        return {
            settings: {
                privacyLastSeen: Boolean(profile?.privacyLastSeen),
                privacyProfilePhoto: Boolean(profile?.privacyProfilePhoto),
                allowFriendRequests: Boolean(profile?.allowFriendRequests),
                notificationMessages: Boolean(profile?.notificationMessages),
                notificationCalls: Boolean(profile?.notificationCalls),
                updatedAt: new Date(),
            },
        };
    }

    @UseGuards(JwtAuthGuard)
    @Get('users/search')
    async searchUsers(@CurrentUser() user: any, @Query('q') q: string) {
        const users = await this.userService.searchUsers(q || '', user.id);
        return {
            users: users.map((u) => ({
                userId: u.userId,
                displayName: u.displayName,
                avatarUrl: u.avatarUrl || null,
                role: u.role,
            })),
        };
    }

    @UseGuards(JwtAuthGuard)
    @Get('users/:id/profile')
    async getUserPublicProfile(@CurrentUser() user: any, @Param('id') id: string) {
        const targetId = Number(id);
        const currentId = Number(user.id);

        const profile = await this.userService.findOne(targetId);
        if (!profile) {
            return { user: null, relationship: { status: 'none', friendshipId: null, requestedByMe: false, isBlockedByMe: false, isBlockedMe: false } };
        }

        const userDto = {
            userId: profile.userId,
            displayName: profile.displayName,
            avatarUrl: profile.avatarUrl || null,
            role: profile.role,
            isVerified: profile.isVerified,
            lastActiveAt: profile.lastActiveAt || null,
        };

        if (targetId === currentId) {
            return { user: userDto, relationship: { status: 'self', friendshipId: null, requestedByMe: false, isBlockedByMe: false, isBlockedMe: false } };
        }

        const [a, b] = currentId < targetId ? [currentId, targetId] : [targetId, currentId];
        const friendship = await this.friendshipRepo.findOne({ where: { userId1: a, userId2: b } });
        const blockedByMe = await this.blockedUserRepo.findOne({ where: { blockerId: currentId, blockedUserId: targetId } });
        const blockedMe = await this.blockedUserRepo.findOne({ where: { blockerId: targetId, blockedUserId: currentId } });

        let status = 'none';
        if (friendship?.status === FriendshipStatus.ACCEPTED) {
            status = 'friends';
        } else if (friendship?.status === FriendshipStatus.PENDING) {
            status = friendship.requesterId === currentId ? 'pending_sent' : 'pending_received';
        }

        return {
            user: userDto,
            relationship: {
                status,
                friendshipId: friendship?.id ?? null,
                requestedByMe: friendship?.requesterId === currentId,
                isBlockedByMe: Boolean(blockedByMe),
                isBlockedMe: Boolean(blockedMe),
            },
        };
    }

    @UseGuards(JwtAuthGuard)
    @Get('users/:id')
    async getUserProfile(@CurrentUser() user: any, @Param('id') id: string) {
        const profile = await this.userService.findOne(Number(id));
        if (!profile) {
            return { user: null };
        }
        return {
            user: {
                userId: profile.userId,
                displayName: profile.displayName,
                avatarUrl: profile.avatarUrl || null,
                role: profile.role,
                isVerified: profile.isVerified,
                lastActiveAt: profile.lastActiveAt || null,
            },
        };
    }

    @UseGuards(JwtAuthGuard)
    @Put('users/profile')
    async updateUserProfile(@CurrentUser() user: any, @Body() body: any) {
        await this.userService.updateProfile(user.id, {
            displayName: body?.displayName,
            avatarUrl: body?.avatarUrl,
            sex: body?.sex,
            dateOfBirth: body?.dateOfBirth,
        });
        const updated = await this.userService.findOne(user.id);
        return {
            message: 'Cập nhật hồ sơ thành công',
            user: {
                userId: updated?.userId,
                displayName: updated?.displayName,
                avatarUrl: updated?.avatarUrl || null,
                role: updated?.role,
            },
        };
    }

    @UseGuards(JwtAuthGuard)
    @Get('users/:id/posts')
    async getUserPosts(@CurrentUser() user: any, @Param('id') id: string, @Query('limit') limit?: string) {
        return this.postService.listUserPosts(Number(id), user.id, Number(limit || 20));
    }

    @UseGuards(JwtAuthGuard)
    @Put('settings')
    async saveSettings(@CurrentUser() user: any, @Body() body: any) {
        const current = await this.userService.findOne(user.id);
        if (!current) {
            return { message: 'Không tìm thấy tài khoản' };
        }
        await this.userService.updateSettings(user.id, {
            privacyLastSeen: body?.privacyLastSeen,
            privacyProfilePhoto: body?.privacyProfilePhoto,
            allowFriendRequests: body?.allowFriendRequests,
            notificationMessages: body?.notificationMessages,
            notificationCalls: body?.notificationCalls,
        });

        const updated = await this.userService.findOne(user.id);
        return {
            message: 'Cập nhật cài đặt thành công',
            settings: {
                privacyLastSeen: Boolean(updated?.privacyLastSeen),
                privacyProfilePhoto: Boolean(updated?.privacyProfilePhoto),
                allowFriendRequests: Boolean(updated?.allowFriendRequests),
                notificationMessages: Boolean(updated?.notificationMessages),
                notificationCalls: Boolean(updated?.notificationCalls),
                updatedAt: new Date(),
            },
        };
    }


}