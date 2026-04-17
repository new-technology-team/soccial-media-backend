import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ObjectId } from "mongodb";
import { Repository } from "typeorm";
import { Report } from "./report.entity";
import { ReportStatus } from "../../common/enum/report-status.enum";
import { ReportType } from "../../common/enum/report-type.enum";
import { User } from "../user/user.entity";
import { Post } from "../post/post.entity";
import { UserRole } from "../../common/enum/user-role.enum";

@Injectable()
export class ReportService {
	constructor(
		@InjectRepository(Report, 'mariadb')
		private readonly reportRepository: Repository<Report>,
		@InjectRepository(User, 'mariadb')
		private readonly userRepository: Repository<User>,
		@InjectRepository(Post, 'mongodb')
		private readonly postRepository: Repository<Post>,
	) {}

	async submitReport(actorId: number, body: any) {
		const report = await this.reportRepository.save(
			this.reportRepository.create({
				status: ReportStatus.PENDING,
				createAt: new Date(),
				updatedAt: new Date(),
				description: body?.reason || '',
				targetId: String(body?.targetId),
				resolutionNote: body?.details || null,
				reviewerId: null,
				reportType: String(body?.targetType || 'POST').toUpperCase() as ReportType,
				userId: actorId,
			}),
		);

		return {
			message: 'Đã gửi báo cáo',
			report,
		};
	}

	async listReports(actor: any, status?: string, limit = 100) {
		if (![UserRole.ADMIN, UserRole.MODERATOR as any, 'MODERATOR'].includes(actor.role)) {
			throw new ForbiddenException('Chỉ kiểm duyệt viên hoặc admin mới có quyền truy cập');
		}

		const rows = await this.reportRepository.find({
			where: status ? { status: status.toUpperCase() as ReportStatus } : undefined,
			order: { createAt: 'DESC' },
			take: Math.min(Math.max(Number(limit || 100), 1), 200),
		});

		return { reports: rows };
	}

	async reviewReport(actor: any, reportId: number, body: any) {
		if (![UserRole.ADMIN, UserRole.MODERATOR as any, 'MODERATOR'].includes(actor.role)) {
			throw new ForbiddenException('Chỉ kiểm duyệt viên hoặc admin mới có quyền truy cập');
		}

		const report = await this.reportRepository.findOne({ where: { reportId } });
		if (!report) {
			throw new NotFoundException('Không tìm thấy báo cáo');
		}

		report.status = String(body?.status || report.status).toUpperCase() as ReportStatus;
		report.resolutionNote = body?.resolutionNote || null;
		report.reviewerId = actor.id;
		report.updatedAt = new Date();
		await this.reportRepository.save(report);

		return { message: 'Đã cập nhật trạng thái báo cáo', report };
	}

	async moderatePost(actor: any, postId: string, body: any) {
		if (![UserRole.ADMIN, UserRole.MODERATOR as any, 'MODERATOR'].includes(actor.role)) {
			throw new ForbiddenException('Chỉ kiểm duyệt viên hoặc admin mới có quyền truy cập');
		}

		const post = await this.postRepository.findOne({ where: { _id: new ObjectId(postId) as any } as any });
		if (!post) {
			throw new NotFoundException('Không tìm thấy bài viết');
		}

		(post as any).status = body?.status || 'hidden';
		(post as any).updatedAt = new Date();
		await this.postRepository.save(post);

		return { message: 'Đã cập nhật trạng thái bài viết', post };
	}

	async getAdminStats(actor: any) {
		if (actor.role !== UserRole.ADMIN) {
			throw new ForbiddenException('Chỉ admin mới có quyền truy cập');
		}

		const [users, reports, posts] = await Promise.all([
			this.userRepository.count(),
			this.reportRepository.count(),
			this.postRepository.count(),
		]);

		return {
			stats: {
				users,
				reports,
				posts,
			},
		};
	}

	async listUsers(actor: any, keyword = '', limit = 50) {
		if (![UserRole.ADMIN, UserRole.MODERATOR as any, 'MODERATOR'].includes(actor.role)) {
			throw new ForbiddenException('Chỉ kiểm duyệt viên hoặc admin mới có quyền truy cập');
		}

		const rows = await this.userRepository.find({ take: Math.min(Math.max(Number(limit || 50), 1), 200) });
		const normalized = String(keyword || '').toLowerCase().trim();
		const users = rows.filter((item) => {
			if (!normalized) return true;
			return (
				String(item.displayName || '').toLowerCase().includes(normalized) ||
				String(item.email || '').toLowerCase().includes(normalized) ||
				String(item.phone || '').toLowerCase().includes(normalized)
			);
		});

		return { users };
	}

	async updateUser(actor: any, userId: number, body: any) {
		if (actor.role !== UserRole.ADMIN) {
			throw new ForbiddenException('Chỉ admin mới có quyền truy cập');
		}

		const user = await this.userRepository.findOne({ where: { userId } });
		if (!user) {
			throw new NotFoundException('Không tìm thấy người dùng');
		}

		if (body?.role) {
			(user as any).role = String(body.role).toUpperCase();
		}
		if (body?.accountStatus) {
			(user as any).status = String(body.accountStatus).toUpperCase();
		}

		await this.userRepository.save(user);
		return { message: 'Đã cập nhật người dùng', user };
	}
}  