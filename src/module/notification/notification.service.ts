import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ObjectId } from "mongodb";
import { Repository } from "typeorm";
import { Notification } from "./notification.entity";
import { emitToUser } from "../../common/socket/chat-socket";

@Injectable()
export class NotificationService {
	constructor(
		@InjectRepository(Notification, 'mongodb')
		private readonly notificationRepository: Repository<Notification>,
	) {}

	async createNotification(payload: {
		userId: number;
		type: string;
		title: string;
		body: string;
		meta?: any;
	}) {
		const notification = await this.notificationRepository.save(
			this.notificationRepository.create({
				userId: Number(payload.userId),
				type: payload.type,
				title: payload.title,
				body: payload.body,
				meta: payload.meta || null,
				isRead: false,
				createdAt: new Date(),
			}),
		);
		emitToUser(Number(payload.userId), 'notification:new', {
			id: String((notification as any)._id),
			userId: Number(payload.userId),
			type: payload.type,
			title: payload.title,
			body: payload.body,
			meta: payload.meta || null,
			isRead: false,
			createdAt: (notification as any).createdAt,
		});
		return notification;
	}

	async listByUser(userId: number, limit = 50) {
		try {
			const safeLimit = Math.min(Math.max(Number(limit || 50), 1), 200);
			const rows = await this.notificationRepository.find({
				where: { userId: Number(userId) } as any,
			});

			const sorted = (rows as any[])
				.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
				.slice(0, safeLimit);

			return {
				notifications: sorted.map((item: any) => ({
					id: String(item._id),
					userId: item.userId,
					type: item.type,
					title: item.title,
					body: item.body ?? '',
					meta: item.meta || null,
					meta_json: item.meta ? JSON.stringify(item.meta) : null,
					is_read: item.isRead ? 1 : 0,
					created_at: item.createdAt instanceof Date ? item.createdAt.toISOString() : String(item.createdAt),
				})),
			};
		} catch (error) {
			throw new InternalServerErrorException('Không thể tải thông báo');
		}
	}

	async markRead(userId: number, id: string) {
		try {
			const row = await this.notificationRepository.findOne({ where: { _id: new ObjectId(id) as any } });
			if (row && Number(row.userId) === Number(userId)) {
				row.isRead = true;
				await this.notificationRepository.save(row);
			}
		} catch {
			// non-critical: ignore DB errors for read marking
		}
		return { message: 'Đã đánh dấu đã đọc' };
	}

	async markUnread(userId: number, id: string) {
		try {
			const row = await this.notificationRepository.findOne({ where: { _id: new ObjectId(id) as any } });
			if (row && Number(row.userId) === Number(userId)) {
				row.isRead = false;
				await this.notificationRepository.save(row);
			}
		} catch {
			// non-critical: ignore DB errors for read marking
		}
		return { message: 'Đã đánh dấu chưa đọc' };
	}

	async markAllRead(userId: number) {
		try {
			const rows = await this.notificationRepository.find({ where: { userId: Number(userId) } as any });
			for (const row of rows as any[]) {
				row.isRead = true;
				await this.notificationRepository.save(row);
			}
		} catch {
			// non-critical: ignore DB errors for bulk read marking
		}
		return { message: 'Đã đánh dấu toàn bộ đã đọc' };
	}

	async deleteNotification(userId: number, id: string) {
		try {
			const row = await this.notificationRepository.findOne({ where: { _id: new ObjectId(id) as any } });
			if (row && Number(row.userId) === Number(userId)) {
				await this.notificationRepository.remove(row);
			}
		} catch {
			// non-critical: ignore DB errors for deletion
		}
		return { message: 'Đã xóa thông báo' };
	}
}
