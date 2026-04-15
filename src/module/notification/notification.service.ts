import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ObjectId, Repository } from "typeorm";
import { Notification } from "./notification.entity";

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
		return this.notificationRepository.save(
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
	}

	async listByUser(userId: number, limit = 50) {
		const rows = await this.notificationRepository.find({
			where: { userId: Number(userId) } as any,
			order: { createdAt: 'DESC' },
			take: Math.min(Math.max(Number(limit || 50), 1), 200),
		});

		return {
			notifications: rows.map((item: any) => ({
				id: String(item._id),
				userId: item.userId,
				type: item.type,
				title: item.title,
				body: item.body,
				meta: item.meta || null,
				isRead: Boolean(item.isRead),
				createdAt: item.createdAt,
			})),
		};
	}

	async markRead(userId: number, id: string) {
		const row = await this.notificationRepository.findOne({ where: { _id: new ObjectId(id) as any } });
		if (row && Number(row.userId) === Number(userId)) {
			row.isRead = true;
			await this.notificationRepository.save(row);
		}
		return { message: 'Đã đánh dấu đã đọc' };
	}

	async markAllRead(userId: number) {
		const rows = await this.notificationRepository.find({ where: { userId: Number(userId) } as any });
		for (const row of rows as any[]) {
			row.isRead = true;
			await this.notificationRepository.save(row);
		}
		return { message: 'Đã đánh dấu toàn bộ đã đọc' };
	}
}