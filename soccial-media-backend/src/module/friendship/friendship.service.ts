import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Friendship } from './friendship.entity';
import { FriendshipStatus } from '../../common/enum/friendship-status.enum';
import { UserService } from '../user/user.service';
import { NotificationService } from '../notification/notification.service';
import { UserBlock } from '../user/user-block.entity';

@Injectable()
export class FriendshipService {
  constructor(
    @InjectRepository(Friendship, 'mariadb')
    private readonly friendshipRepo: Repository<Friendship>,
    @InjectRepository(UserBlock, 'mariadb')
    private readonly userBlockRepo: Repository<UserBlock>,
    private readonly userService: UserService,
    private readonly notificationService: NotificationService,
  ) {}

  private async getBlockFlags(viewerId: number, targetUserId: number) {
    if (viewerId === targetUserId) {
      return {
        isBlockedByMe: false,
        isBlockedMe: false,
      };
    }

    const [blockedByMe, blockedMe] = await Promise.all([
      this.userBlockRepo.findOne({
        where: {
          blockerUserId: viewerId,
          blockedUserId: targetUserId,
        },
      }),
      this.userBlockRepo.findOne({
        where: {
          blockerUserId: targetUserId,
          blockedUserId: viewerId,
        },
      }),
    ]);

    return {
      isBlockedByMe: Boolean(blockedByMe),
      isBlockedMe: Boolean(blockedMe),
    };
  }

  async sendRequest(userId: number, targetUserId: number) {
    if (userId === targetUserId) {
      throw new BadRequestException('Cannot send friend request to yourself');
    }

    const { isBlockedByMe, isBlockedMe } = await this.getBlockFlags(
      userId,
      targetUserId,
    );
    if (isBlockedByMe) {
      throw new BadRequestException(
        'Ban dang chan nguoi dung nay. Hay bo chan truoc khi ket ban',
      );
    }
    if (isBlockedMe) {
      throw new BadRequestException(
        'Khong the gui loi moi ket ban toi nguoi dung nay',
      );
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
      where: {
        userId1: requesterUserId,
        userId2: userId,
        status: FriendshipStatus.PENDING,
      },
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
      where: {
        userId1: requesterUserId,
        userId2: userId,
        status: FriendshipStatus.PENDING,
      },
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

  async blockUser(userId: number, targetUserId: number) {
    if (Number(userId) === Number(targetUserId)) {
      throw new BadRequestException('Khong the tu chan chinh minh');
    }

    const target = await this.userService.findOne(targetUserId);
    if (!target) {
      throw new NotFoundException('User not found');
    }

    const exists = await this.userBlockRepo.findOne({
      where: {
        blockerUserId: userId,
        blockedUserId: targetUserId,
      },
    });
    if (exists) {
      return { message: 'Da chan nguoi dung nay' };
    }

    await this.userBlockRepo.save(
      this.userBlockRepo.create({
        blockerUserId: userId,
        blockedUserId: targetUserId,
        createdAt: new Date(),
      }),
    );

    const friendship = await this.friendshipRepo.findOne({
      where: [
        { userId1: userId, userId2: targetUserId },
        { userId1: targetUserId, userId2: userId },
      ],
    });
    if (friendship) {
      await this.friendshipRepo.remove(friendship);
    }

    return { message: 'Da chan tin nhan tu nguoi dung nay' };
  }

  async unblockUser(userId: number, targetUserId: number) {
    const block = await this.userBlockRepo.findOne({
      where: {
        blockerUserId: userId,
        blockedUserId: targetUserId,
      },
    });
    if (!block) {
      return { message: 'Nguoi dung nay chua bi chan' };
    }
    await this.userBlockRepo.remove(block);
    return { message: 'Da bo chan nguoi dung' };
  }

  async isUserBlocked(viewerId: number, targetUserId: number) {
    const block = await this.userBlockRepo.findOne({
      where: {
        blockerUserId: viewerId,
        blockedUserId: targetUserId,
      },
    });
    return { isBlocked: Boolean(block) };
  }

  async listFriends(userId: number) {
    const accepted = await this.friendshipRepo.find({
      where: [
        { userId1: userId, status: FriendshipStatus.ACCEPTED },
        { userId2: userId, status: FriendshipStatus.ACCEPTED },
      ],
    });

    const pendingReceived = await this.friendshipRepo.find({
      where: { userId2: userId, status: FriendshipStatus.PENDING },
    });
    const pendingSent = await this.friendshipRepo.find({
      where: { userId1: userId, status: FriendshipStatus.PENDING },
    });

    const allIds = [
      ...accepted.map((f) => (f.userId1 === userId ? f.userId2 : f.userId1)),
      ...pendingReceived.map((f) => f.userId1),
      ...pendingSent.map((f) => f.userId2),
    ];

    const users = await this.userService.findByIds(allIds);
    const userMap = new Map(users.map((u) => [u.userId, u]));

    const friendId = (f: Friendship) => (f.userId1 === userId ? f.userId2 : f.userId1);

    return [
      ...accepted.map((f) => {
        const id = friendId(f);
        const friend = userMap.get(id);
        return {
          id,
          fullName: friend?.fullName || 'Người dùng',
          avatarUrl: friend?.avatarUrl || null,
          status: 'accepted',
          requestedByMe: false,
        };
      }),
      ...pendingReceived.map((f) => {
        const requester = userMap.get(f.userId1);
        return {
          id: f.userId1,
          fullName: requester?.fullName || 'Người dùng',
          avatarUrl: requester?.avatarUrl || null,
          status: 'pending',
          requestedByMe: false,
        };
      }),
      ...pendingSent.map((f) => {
        const target = userMap.get(f.userId2);
        return {
          id: f.userId2,
          fullName: target?.fullName || 'Người dùng',
          avatarUrl: target?.avatarUrl || null,
          status: 'pending',
          requestedByMe: true,
        };
      }),
    ];
  }

  async listPendingRequests(userId: number) {
    const received = await this.friendshipRepo.find({
      where: { userId2: userId, status: FriendshipStatus.PENDING },
    });

    const sent = await this.friendshipRepo.find({
      where: { userId1: userId, status: FriendshipStatus.PENDING },
    });

    const allIds = [
      ...received.map((f) => f.userId1),
      ...sent.map((f) => f.userId2),
    ];

    if (allIds.length === 0) return [];

    const users = await this.userService.findByIds(allIds);
    const userMap = new Map(users.map((u) => [u.userId, u]));

    return [
      ...received.map((f) => {
        const requester = userMap.get(f.userId1);
        return {
          id: f.userId1,
          fullName: requester?.fullName || 'Người dùng',
          avatarUrl: requester?.avatarUrl || null,
          status: 'pending' as const,
          requestedByMe: false,
        };
      }),
      ...sent.map((f) => {
        const target = userMap.get(f.userId2);
        return {
          id: f.userId2,
          fullName: target?.fullName || 'Người dùng',
          avatarUrl: target?.avatarUrl || null,
          status: 'pending' as const,
          requestedByMe: true,
        };
      }),
    ];
  }

  async searchUsers(keyword: string, limit = 20) {
    const users = await this.userService.search(keyword, limit);
    return users.map((u) => ({
      id: u.userId,
      username: u.username,
      full_name: u.fullName,
      email: u.email,
      phone: u.phone,
      avatar_url: u.avatarUrl,
      bio: u.bio || null,
      location: u.location || null,
      is_verified: 0,
    }));
  }

  async getUserProfileByUsername(viewerId: number, username: string) {
    const user = await this.userService.findOneByUsername(username);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.getUserProfile(viewerId, user.userId);
  }

  async getUserProfile(viewerId: number, targetUserId: number) {
    const user = await this.userService.findOne(targetUserId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const blockFlags = await this.getBlockFlags(viewerId, targetUserId);

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
        coverUrl: user.coverUrl || null,
        dateOfBirth: user.dateOfBirth || null,
        gender: user.sex === 1 ? 'Nam' : user.sex === 2 ? 'Nữ' : null,
        bio: user.bio || null,
        location: user.location || null,
      },
      relationship: {
        status: relationshipStatus,
        friendshipId: friendship?.id || null,
        requestedByMe: friendship?.userId1 === viewerId,
        isBlockedByMe: blockFlags.isBlockedByMe,
        isBlockedMe: blockFlags.isBlockedMe,
      },
    };
  }
}
