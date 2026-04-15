import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Friendship } from "./friendship.entity";
import { FriendshipStatus } from "../../common/enum/friendship-status.enum";
import { UserService } from "../user/user.service";
import { NotificationService } from "../notification/notification.service";

@Injectable()
export class FriendshipService {
	constructor(
		@InjectRepository(Friendship, 'mariadb')
		private readonly friendshipRepository: Repository<Friendship>,
		private readonly userService: UserService,
		private readonly notificationService: NotificationService,
	) {}

	private key(userA: number, userB: number) {
		return userA < userB ? [userA, userB] : [userB, userA];
	}

	async listFriends(userId: number) {
		const rows = await this.friendshipRepository.find({
			where: [
				{ userId1: userId, status: FriendshipStatus.ACCEPTED },
				{ userId2: userId, status: FriendshipStatus.ACCEPTED },
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
				status: row.status,
				requestedByMe: false,
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
				createdAt: new Date(),
			});
		} else {
			row.status = FriendshipStatus.PENDING;
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

	async acceptFriend(actorId: number, requesterId: number, actorName: string) {
		const [a, b] = this.key(actorId, requesterId);
		const row = await this.friendshipRepository.findOne({ where: { userId1: a, userId2: b } });
		if (!row || row.status !== FriendshipStatus.PENDING) {
			throw new BadRequestException('Không tìm thấy yêu cầu kết bạn chờ xử lý');
		}

		row.status = FriendshipStatus.ACCEPTED;
		await this.friendshipRepository.save(row);

		await this.notificationService.createNotification({
			userId: requesterId,
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
}