import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CallLog, CallMode, CallStatus, CallType } from "./call-log.entity";
import { NotificationService } from "../notification/notification.service";

export type RecordCallInput = {
	conversationId: string;
	initiatorId: number;
	participantIds: number[];
	callType: CallType;
	mode: CallMode;
	status: CallStatus;
	startedAt?: string | number | Date;
	answeredAt?: string | number | Date | null;
	endedAt?: string | number | Date | null;
	durationSec?: number;
	participantStatuses?: Array<{
		userId: number;
		joinedAt?: string | number | Date | null;
		leftAt?: string | number | Date | null;
		durationSec?: number;
		role?: 'caller' | 'receiver' | 'member';
	}>;
	withName?: string;
};

const toDate = (value?: string | number | Date | null): Date | null => {
	if (value === undefined || value === null) return null;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
};

@Injectable()
export class CallService {
	constructor(
		@InjectRepository(CallLog, 'mongodb')
		private readonly callRepository: Repository<CallLog>,
		private readonly notificationService: NotificationService,
	) {}

	async recordCall(reporterId: number, input: RecordCallInput) {
		try {
			const startedAt = toDate(input.startedAt) || new Date();
			const answeredAt = toDate(input.answeredAt);
			const endedAt = toDate(input.endedAt) || new Date();
			const participantIds = Array.isArray(input.participantIds)
				? Array.from(new Set(input.participantIds.map((id) => Number(id)).filter((id) => id > 0)))
				: [];
			const participantStatuses = Array.isArray(input.participantStatuses) && input.participantStatuses.length
				? input.participantStatuses.map((item) => ({
					userId: Number(item.userId || 0),
					joinedAt: toDate(item.joinedAt),
					leftAt: toDate(item.leftAt),
					durationSec: Math.max(0, Number(item.durationSec || 0)),
					role: item.role || (Number(item.userId) === Number(input.initiatorId || reporterId) ? 'caller' : 'member'),
				})).filter((item) => item.userId > 0)
				: participantIds.map((userId) => ({
					userId,
					joinedAt: answeredAt,
					leftAt: endedAt,
					durationSec: Math.max(0, Number(input.durationSec || 0)),
					role: userId === Number(input.initiatorId || reporterId) ? 'caller' : (input.mode === 'group' ? 'member' : 'receiver') as 'caller' | 'receiver' | 'member',
				}));

			const log = await this.callRepository.save(
				this.callRepository.create({
					conversationId: String(input.conversationId || ''),
					initiatorId: Number(input.initiatorId || reporterId),
					participantIds,
					participantStatuses,
					callType: input.callType === 'video' ? 'video' : 'voice',
					mode: input.mode === 'group' ? 'group' : 'private',
					status: input.status,
					startedAt,
					answeredAt,
					endedAt,
					durationSec: Math.max(0, Number(input.durationSec || 0)),
					createdAt: new Date(),
				}),
			);

			// Cuộc gọi nhỡ / không phản hồi → tạo thông báo cho người được gọi (không phải người gọi).
			if ((input.status === 'missed' || input.status === 'no_answer') && input.initiatorId) {
				const callee = participantIds.filter((id) => id !== Number(input.initiatorId));
				const label = input.callType === 'video' ? 'video' : 'thoại';
				for (const userId of callee) {
					await this.notificationService.createNotification({
						userId,
						type: 'call_missed',
						title: 'Cuộc gọi nhỡ',
						body: input.withName
							? `Bạn có cuộc gọi ${label} nhỡ từ ${input.withName}`
							: `Bạn có một cuộc gọi ${label} nhỡ`,
						meta: {
							conversationId: input.conversationId,
							callType: input.callType,
							mode: input.mode,
							initiatorId: input.initiatorId,
						},
					});
				}
			}

			return { id: String((log as any)._id) };
		} catch (error) {
			throw new InternalServerErrorException('Không thể lưu lịch sử cuộc gọi');
		}
	}

	private serialize(item: any) {
		return {
			id: String(item._id),
			conversationId: item.conversationId,
			initiatorId: item.initiatorId,
			participantIds: item.participantIds || [],
			participantStatuses: item.participantStatuses || [],
			callType: item.callType,
			mode: item.mode,
			status: item.status,
			startedAt: item.startedAt instanceof Date ? item.startedAt.toISOString() : item.startedAt,
			answeredAt: item.answeredAt instanceof Date ? item.answeredAt.toISOString() : item.answeredAt || null,
			endedAt: item.endedAt instanceof Date ? item.endedAt.toISOString() : item.endedAt || null,
			durationSec: item.durationSec || 0,
			createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : item.createdAt,
		};
	}

	async listByUser(userId: number, limit = 50) {
		try {
			const safeLimit = Math.min(Math.max(Number(limit || 50), 1), 200);
			const rows = (await this.callRepository.find()) as any[];
			const mine = rows
				.filter((item) => Array.isArray(item.participantIds) && item.participantIds.map(Number).includes(Number(userId)))
				.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
				.slice(0, safeLimit);
			return { calls: mine.map((item) => this.serialize(item)) };
		} catch (error) {
			throw new InternalServerErrorException('Không thể tải lịch sử cuộc gọi');
		}
	}

	async listByConversation(conversationId: string, limit = 50) {
		try {
			const safeLimit = Math.min(Math.max(Number(limit || 50), 1), 200);
			const rows = (await this.callRepository.find({ where: { conversationId: String(conversationId) } as any })) as any[];
			const sorted = rows
				.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
				.slice(0, safeLimit);
			return { calls: sorted.map((item) => this.serialize(item)) };
		} catch (error) {
			throw new InternalServerErrorException('Không thể tải lịch sử cuộc gọi');
		}
	}
}
