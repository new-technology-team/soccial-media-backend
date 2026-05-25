import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Friendship } from "./friendship.entity";
import { FriendshipStatus } from "../../common/enum/friendship-status.enum";
import { UserService } from "../user/user.service";
import { NotificationService } from "../notification/notification.service";
import { BlockedUser } from "./blocked-user.entity";

@Injectable()
export class FriendshipService {
	constructor(
		@InjectRepository(Friendship, 'mariadb')
		private readonly friendshipRepository: Repository<Friendship>,
		@InjectRepository(BlockedUser, 'mariadb')
		private readonly blockedUserRepository: Repository<BlockedUser>,
		private readonly userService: UserService,
		private readonly notificationService: NotificationService,
	) {}

	private key(userA: number, userB: number) {
		return userA < userB ? [userA, userB] : [userB, userA];
	}

	async isAcceptedFriend(userA: number, userB: number) {
		if (userA === userB) {
			return true;
		}
		const [a, b] = this.key(userA, userB);
		const row = await this.friendshipRepository.findOne({ where: { userId1: a, userId2: b } });
		return row?.status === FriendshipStatus.ACCEPTED;
	}

	async getAcceptedFriendIds(userId: number) {
		const rows = await this.friendshipRepository.find({
			where: [
				{ userId1: userId, status: FriendshipStatus.ACCEPTED },
				{ userId2: userId, status: FriendshipStatus.ACCEPTED },
			],
		});

		const friendIds = new Set<number>();
		for (const row of rows) {
			friendIds.add(row.userId1 === userId ? row.userId2 : row.userId1);
		}

		return friendIds;
	}

	async isBlockedBetween(userA: number, userB: number) {
		if (!userA || !userB || userA === userB) return false;
		const row = await this.blockedUserRepository.findOne({
			where: [
				{ blockerId: userA, blockedUserId: userB },
				{ blockerId: userB, blockedUserId: userA },
			],
		});
		return Boolean(row);
	}

	async isBlockedBy(actorId: number, targetUserId: number) {
		if (!actorId || !targetUserId || actorId === targetUserId) return false;
		const row = await this.blockedUserRepository.findOne({
			where: { blockerId: actorId, blockedUserId: targetUserId },
		});
		return Boolean(row);
	}

	async listFriends(userId: number) {
		const rows = await this.friendshipRepository.find({
			where: [
				{ userId1: userId },
				{ userId2: userId },
			],
		});

		const friends: any[] = [];
		for (const row of rows) {
			const friendId = row.userId1 === userId ? row.userId2 : row.userId1;
			const user = await this.userService.findOne(friendId);
			if (!user) continue;
			friends.push({
				id: user.userId,
				fullName: user.displayName,
				email: user.email,
				phone: user.phone,
				avatarUrl: user.avatarUrl,
				isVerified: Boolean(user.isVerified),
				role: user.role,
				accountStatus: user.status,
				status: row.status === FriendshipStatus.ACCEPTED ? 'accepted' : 'pending',
				requestedByMe: Number(row.requesterId || 0) === Number(userId),
				createdAt: row.createdAt,
			});
		}

		return { friends };
	}

	async requestFriend(actorId: number, targetUserId: number, actorName: string) {
		if (actorId === targetUserId) {
			throw new BadRequestException('Không thể kết bạn với chính mình');
		}

		const target = await this.userService.findOne(targetUserId);
		if (!target) {
			throw new NotFoundException('Người dùng không tồn tại');
		}

		const [a, b] = this.key(actorId, targetUserId);
		let row = await this.friendshipRepository.findOne({ where: { userId1: a, userId2: b } });
		if (!row) {
			row = this.friendshipRepository.create({
				userId1: a,
				userId2: b,
				status: FriendshipStatus.PENDING,
				conversationId: '',
				requesterId: actorId,
				createdAt: new Date(),
			});
		} else {
			if (row.status === FriendshipStatus.ACCEPTED) {
				return { message: 'Hai bạn đã là bạn bè' };
			}
			row.status = FriendshipStatus.PENDING;
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

	async acceptFriend(actorId: number, requesterIdOrFriendshipId: number, actorName: string) {
		const [a, b] = this.key(actorId, requesterIdOrFriendshipId);
		let row = await this.friendshipRepository.findOne({ where: { userId1: a, userId2: b } });
		if (!row) {
			row = await this.friendshipRepository.findOne({ where: { id: requesterIdOrFriendshipId } });
		}
		if (!row || row.status !== FriendshipStatus.PENDING) {
			throw new BadRequestException('Không tìm thấy yêu cầu kết bạn chờ xử lý');
		}

		const participantIds = [Number(row.userId1), Number(row.userId2)];
		if (!participantIds.includes(Number(actorId))) {
			throw new BadRequestException('Yêu cầu kết bạn không hợp lệ');
		}

		const requesterHint = Number(requesterIdOrFriendshipId);
		const effectiveRequesterId = Number(
			row.requesterId ||
			(participantIds.includes(requesterHint) ? requesterHint : participantIds.find((id) => id !== Number(actorId)))
		);

		if (!participantIds.includes(effectiveRequesterId) || Number(actorId) === effectiveRequesterId) {
			throw new BadRequestException('Yêu cầu kết bạn không hợp lệ');
		}

		row.status = FriendshipStatus.ACCEPTED;
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

	async deleteFriend(actorId: number, friendUserId: number) {
		const [a, b] = this.key(actorId, friendUserId);
		await this.friendshipRepository.delete({ userId1: a, userId2: b });
		return { message: 'Đã xóa bạn' };
	}

	async blockUser(actorId: number, targetUserId: number) {
		if (!targetUserId || actorId === targetUserId) {
			throw new BadRequestException('Không thể chặn chính mình');
		}

		const target = await this.userService.findOne(targetUserId);
		if (!target) {
			throw new NotFoundException('Người dùng không tồn tại');
		}

		const existing = await this.blockedUserRepository.findOne({
			where: { blockerId: actorId, blockedUserId: targetUserId },
		});
		if (!existing) {
			await this.blockedUserRepository.save(this.blockedUserRepository.create({
				blockerId: actorId,
				blockedUserId: targetUserId,
				createdAt: new Date(),
			}));
		}

		return { message: 'Đã chặn người dùng' };
	}

	async unblockUser(actorId: number, targetUserId: number) {
		await this.blockedUserRepository.delete({ blockerId: actorId, blockedUserId: targetUserId });
		return { message: 'Đã bỏ chặn người dùng' };
	}
}
