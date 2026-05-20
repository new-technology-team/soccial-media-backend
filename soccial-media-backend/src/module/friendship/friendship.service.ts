import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Friendship } from './friendship.entity';
import { FriendshipStatus } from '../../common/enum/friendship-status.enum';
import { UserService } from '../user/user.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class FriendshipService {
  constructor(
    @InjectRepository(Friendship, 'mariadb')
    private readonly friendshipRepo: Repository<Friendship>,
    private readonly userService: UserService,
    private readonly notificationService: NotificationService,
  ) {}

  async sendRequest(userId: number, targetUserId: number) {
    if (userId === targetUserId) {
      throw new BadRequestException('Cannot send friend request to yourself');
    }

    const existing = await this.friendshipRepo.findOne({
      where: [
        { userId1: userId, userId2: targetUserId },
        { userId1: targetUserId, userId2: userId },
      ],
    });

    if (existing) {
      if (existing.status === FriendshipStatus.ACCEPTED) {
        throw new BadRequestException('Already friends');
      }
      if (existing.status === FriendshipStatus.PENDING) {
        throw new BadRequestException('Request already sent');
      }
    }

    const friendship = this.friendshipRepo.create({
      userId1: userId,
      userId2: targetUserId,
      status: FriendshipStatus.PENDING,
      conversationId: '',
      createdAt: new Date(),
    });

    const saved = await this.friendshipRepo.save(friendship);

    const targetUser = await this.userService.findOne(targetUserId);
    const requester = await this.userService.findOne(userId);
    if (targetUser && requester) {
      await this.notificationService.create({
        userId: targetUserId,
        title: 'Yêu cầu kết bạn',
        content: `${requester.fullName} đã gửi lời mời kết bạn`,
        link: `/friends`,
      });
    }

    return { message: 'Friend request sent', friendshipId: saved.id };
  }

  async acceptRequest(userId: number, requesterUserId: number) {
    const friendship = await this.friendshipRepo.findOne({
      where: { userId1: requesterUserId, userId2: userId, status: FriendshipStatus.PENDING },
    });

    if (!friendship) {
      throw new NotFoundException('Friend request not found');
    }

    friendship.status = FriendshipStatus.ACCEPTED;
    await this.friendshipRepo.save(friendship);

    const requester = await this.userService.findOne(requesterUserId);
    const acceptor = await this.userService.findOne(userId);
    if (requester && acceptor) {
      await this.notificationService.create({
        userId: requesterUserId,
        title: 'Chấp nhận kết bạn',
        content: `${acceptor.fullName} đã chấp nhận lời mời kết bạn`,
        link: `/friends`,
      });
    }

    return { message: 'Friend request accepted' };
  }

  async rejectRequest(userId: number, requesterUserId: number) {
    const friendship = await this.friendshipRepo.findOne({
      where: { userId1: requesterUserId, userId2: userId, status: FriendshipStatus.PENDING },
    });

    if (!friendship) {
      throw new NotFoundException('Friend request not found');
    }

    friendship.status = FriendshipStatus.REJECTED;
    await this.friendshipRepo.save(friendship);
    return { message: 'Friend request rejected' };
  }

  async removeFriend(userId: number, friendUserId: number) {
    const friendship = await this.friendshipRepo.findOne({
      where: [
        { userId1: userId, userId2: friendUserId },
        { userId1: friendUserId, userId2: userId },
      ],
    });

    if (!friendship) {
      throw new NotFoundException('Friendship not found');
    }

    await this.friendshipRepo.remove(friendship);
    return { message: 'Friend removed' };
  }

  async listFriends(userId: number) {
    const friendships = await this.friendshipRepo.find({
      where: [
        { userId1: userId, status: FriendshipStatus.ACCEPTED },
        { userId2: userId, status: FriendshipStatus.ACCEPTED },
      ],
    });

    const friendIds = friendships.map(f =>
      f.userId1 === userId ? f.userId2 : f.userId1,
    );

    const users = await this.userService.findByIds(friendIds);
    const userMap = new Map(users.map(u => [u.userId, u]));

    return friendships.map(f => {
      const friendId = f.userId1 === userId ? f.userId2 : f.userId1;
      const friend = userMap.get(friendId);
      return {
        id: friendId,
        fullName: friend?.fullName || 'Người dùng',
        avatarUrl: friend?.avatarUrl || null,
        status: f.status,
      };
    });
  }

  async listPendingRequests(userId: number) {
    const friendships = await this.friendshipRepo.find({
      where: { userId2: userId, status: FriendshipStatus.PENDING },
    });

    const requesterIds = friendships.map(f => f.userId1);
    if (requesterIds.length === 0) return [];

    const users = await this.userService.findByIds(requesterIds);
    const userMap = new Map(users.map(u => [u.userId, u]));

    return friendships.map(f => {
      const requester = userMap.get(f.userId1);
      return {
        id: f.userId1,
        fullName: requester?.fullName || 'Người dùng',
        avatarUrl: requester?.avatarUrl || null,
      };
    });
  }

  async searchUsers(keyword: string, limit = 20) {
    const users = await this.userService.search(keyword, limit);
    return users.map(u => ({
      id: u.userId,
      username: u.username,
      full_name: u.fullName,
      email: u.email,
      phone: u.phone,
      avatar_url: u.avatarUrl,
      is_verified: 0,
    }));
  }

  async getUserProfile(viewerId: number, targetUserId: number) {
    const user = await this.userService.findOne(targetUserId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const friendship =
      viewerId === targetUserId
        ? null
        : await this.friendshipRepo.findOne({
            where: [
              { userId1: viewerId, userId2: targetUserId },
              { userId1: targetUserId, userId2: viewerId },
            ],
          });

    let relationshipStatus:
      | 'self'
      | 'none'
      | 'pending_sent'
      | 'pending_received'
      | 'friends' = viewerId === targetUserId ? 'self' : 'none';

    if (friendship?.status === FriendshipStatus.ACCEPTED) {
      relationshipStatus = 'friends';
    } else if (friendship?.status === FriendshipStatus.PENDING) {
      relationshipStatus =
        friendship.userId1 === viewerId ? 'pending_sent' : 'pending_received';
    }

    return {
      user: {
        id: user.userId,
        username: user.username,
        email: user.email,
        phone: user.phone,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl || null,
        dateOfBirth: user.dateOfBirth || null,
        gender: user.sex === 1 ? 'Nam' : user.sex === 2 ? 'Nữ' : null,
      },
      relationship: {
        status: relationshipStatus,
        friendshipId: friendship?.id || null,
        requestedByMe: friendship?.userId1 === viewerId,
      },
    };
  }
}
