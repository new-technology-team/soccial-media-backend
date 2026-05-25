import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ObjectId } from "mongodb";
import { Repository } from "typeorm";
import { Report } from "./report.entity";
import { ReportStatus } from "../../common/enum/report-status.enum";
import { ReportType } from "../../common/enum/report-type.enum";
import { User } from "../user/user.entity";
import { Post } from "../post/post.entity";
import { Comment } from "../comment/comment.entity";
import { UserRole } from "../../common/enum/user-role.enum";
import { UserStatus } from "../../common/enum/user-status.enum";
import { AuditLog } from "../audit-log/audit-log.entity";

function toClientUser(user: any) {
	return {
		id: user?.userId,
		username: user?.username || null,
		email: user?.email || null,
		phone: user?.phone || null,
		fullName: user?.displayName || user?.fullName || '',
		avatarUrl: user?.avatarUrl || null,
		role: String(user?.role || '').toLowerCase(),
		accountStatus: String(user?.status || user?.accountStatus || '').toLowerCase(),
		isVerified: Boolean(user?.isVerified),
		lockedUntil: user?.lockedUntil || null,
		warningCount: Number(user?.warningCount || 0),
		restrictionReason: user?.restrictionReason || null,
	};
}

function roleOf(actor: any) {
	return String(actor?.role || '').toUpperCase();
}

function isAdmin(actor: any) {
	return roleOf(actor) === UserRole.ADMIN;
}

function isModerator(actor: any) {
	return roleOf(actor) === UserRole.MODERATOR;
}

@Injectable()
export class ReportService {
	constructor(
		@InjectRepository(Report, 'mariadb')
		private readonly reportRepository: Repository<Report>,
		@InjectRepository(User, 'mariadb')
		private readonly userRepository: Repository<User>,
		@InjectRepository(Post, 'mongodb')
		private readonly postRepository: Repository<Post>,
		@InjectRepository(Comment, 'mongodb')
		private readonly commentRepository: Repository<Comment>,
		@InjectRepository(AuditLog, 'mariadb')
		private readonly auditLogRepository: Repository<AuditLog>,
	) {}

	private assertAdmin(actor: any) {
		if (!isAdmin(actor)) {
			throw new ForbiddenException('Chỉ admin mới có quyền truy cập');
		}
	}

	private assertStaff(actor: any) {
		if (!isAdmin(actor) && !isModerator(actor)) {
			throw new ForbiddenException('Chỉ admin hoặc kiểm duyệt viên mới có quyền truy cập');
		}
	}

	private async audit(actor: any, action: string, targetType: string, targetId?: string | number | null, description?: string | null) {
		await this.auditLogRepository.save(this.auditLogRepository.create({
			actorId: actor?.id ? Number(actor.id) : null,
			actorRole: roleOf(actor) || 'UNKNOWN',
			action,
			targetType,
			targetId: targetId === undefined || targetId === null ? null : String(targetId),
			description: description || null,
			createdAt: new Date(),
		}));
	}

	private normalizeReportStatus(status: string | undefined, fallback = ReportStatus.PENDING) {
		const raw = String(status || fallback).toUpperCase();
		if (raw === 'REVIEWED') return ReportStatus.IN_REVIEW;
		if (!Object.values(ReportStatus).includes(raw as ReportStatus)) {
			throw new BadRequestException('Trạng thái báo cáo không hợp lệ');
		}
		return raw as ReportStatus;
	}

	private normalizeUserStatus(status: string | undefined, fallback = UserStatus.ACTIVE) {
		const raw = String(status || fallback).toUpperCase();
		if (!Object.values(UserStatus).includes(raw as UserStatus)) {
			throw new BadRequestException('Trạng thái tài khoản không hợp lệ');
		}
		return raw as UserStatus;
	}

	async submitReport(actorId: number, body: any) {
		const reason = body?.reason || 'Khác';
		const report = await this.reportRepository.save(
			this.reportRepository.create({
				status: ReportStatus.PENDING,
				createAt: new Date(),
				updatedAt: new Date(),
				description: body?.details || body?.description || reason,
				targetId: String(body?.targetId),
				resolutionNote: null,
				reviewerId: null,
				assignedTo: null,
				resolvedBy: null,
				reason,
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
		this.assertStaff(actor);

		const rows = await this.reportRepository.find({
			where: status ? { status: this.normalizeReportStatus(status) } : undefined,
			order: { createAt: 'DESC' },
			take: Math.min(Math.max(Number(limit || 100), 1), 200),
		});

		return { reports: rows };
	}

	async getReport(actor: any, reportId: number) {
		this.assertStaff(actor);
		const report = await this.reportRepository.findOne({ where: { reportId } });
		if (!report) throw new NotFoundException('Không tìm thấy báo cáo');
		return { report };
	}

	async reviewReport(actor: any, reportId: number, body: any) {
		this.assertStaff(actor);

		const report = await this.reportRepository.findOne({ where: { reportId } });
		if (!report) {
			throw new NotFoundException('Không tìm thấy báo cáo');
		}

		report.status = this.normalizeReportStatus(body?.status, report.status);
		report.resolutionNote = body?.resolutionNote || null;
		report.reviewerId = actor.id;
		if ([ReportStatus.RESOLVED, ReportStatus.REJECTED].includes(report.status)) {
			report.resolvedBy = actor.id;
		}
		report.updatedAt = new Date();
		await this.reportRepository.save(report);
		await this.audit(actor, 'Cập nhật trạng thái báo cáo', 'REPORT', reportId, report.resolutionNote);

		return { message: 'Đã cập nhật trạng thái báo cáo', report };
	}

	async moderatePost(actor: any, postId: string, body: any) {
		this.assertStaff(actor);

		const post = await this.postRepository.findOne({ where: { _id: new ObjectId(postId) as any } as any });
		if (!post) {
			throw new NotFoundException('Không tìm thấy bài viết');
		}

		(post as any).status = body?.status || 'hidden';
		(post as any).updatedAt = new Date();
		await this.postRepository.save(post);
		await this.audit(actor, 'Kiểm duyệt bài viết', 'POST', postId, body?.resolutionNote || `Trạng thái: ${(post as any).status}`);

		return { message: 'Đã cập nhật trạng thái bài viết', post };
	}

	async getAdminStats(actor: any) {
		this.assertAdmin(actor);

		const [users, posts, comments, reportRows, postRows, commentRows] = await Promise.all([
			this.userRepository.count(),
			this.postRepository.count(),
			this.commentRepository.count(),
			this.reportRepository.find({} as any),
			this.postRepository.find({ order: { createdAt: 'DESC' } } as any),
			this.commentRepository.find({} as any),
		]);

		const totalReactions = [...(postRows as any[]), ...(commentRows as any[])].reduce((sum, item) => sum + Number(item?.reactions?.length || 0), 0);
		const pendingReports = (reportRows as any[]).filter((item) => String(item?.status || '').toUpperCase() === ReportStatus.PENDING).length;
		const resolvedReports = (reportRows as any[]).filter((item) => String(item?.status || '').toUpperCase() === ReportStatus.RESOLVED).length;

		return {
			stats: {
				totalUsers: users,
				totalPosts: posts,
				totalComments: comments,
				totalReactions,
				pendingReports,
				resolvedReports,
				totalCalls: 0,
				systemActivities: await this.auditLogRepository.count(),
			},
		};
	}

	async listUsers(actor: any, keyword = '', limit = 50) {
		this.assertStaff(actor);

		const rows = await this.userRepository.find({ take: Math.min(Math.max(Number(limit || 50), 1), 200) });
		const normalized = String(keyword || '').toLowerCase().trim();
		const users = rows.filter((item) => {
			if (!normalized) return true;
			return (
				String(item.displayName || '').toLowerCase().includes(normalized) ||
				String(item.email || '').toLowerCase().includes(normalized) ||
				String(item.phone || '').toLowerCase().includes(normalized)
			);
		}).map((item) => toClientUser(item));

		return { users };
	}

	async updateUser(actor: any, userId: number, body: any) {
		this.assertAdmin(actor);

		const user = await this.userRepository.findOne({ where: { userId } });
		if (!user) {
			throw new NotFoundException('Không tìm thấy người dùng');
		}

		if (body?.role) {
			(user as any).role = String(body.role).toUpperCase();
		}
		if (body?.accountStatus) {
			(user as any).status = this.normalizeUserStatus(body.accountStatus);
		}
		if (body?.lockedUntil !== undefined) {
			(user as any).lockedUntil = body.lockedUntil ? new Date(body.lockedUntil) : null;
		}
		if (body?.restrictionReason !== undefined) {
			(user as any).restrictionReason = body.restrictionReason || null;
		}

		await this.userRepository.save(user);
		await this.audit(actor, 'Cập nhật người dùng', 'USER', userId, body?.reason || body?.restrictionReason || null);
		return { message: 'Đã cập nhật người dùng', user: toClientUser(user) };
	}

	async getAdminDashboard(actor: any) {
		this.assertAdmin(actor);
		const [stats, users, reports] = await Promise.all([
			this.getAdminStats(actor),
			this.listUsers(actor, '', 8),
			this.listReports(actor, undefined, 8),
		]);
		return { ...stats, recentUsers: users.users, recentReports: reports.reports };
	}

	async getModeratorDashboard(actor: any) {
		this.assertStaff(actor);
		const [reports, users] = await Promise.all([
			this.listReports(actor, undefined, 12),
			this.listUsers(actor, '', 12),
		]);
		return {
			reports: reports.reports,
			reportedUsers: users.users.filter((item: any) => ['restricted', 'warning', 'temp_locked', 'locked'].includes(String(item.accountStatus))),
			stats: {
				pendingReports: reports.reports.filter((item: any) => item.status === ReportStatus.PENDING).length,
				inReviewReports: reports.reports.filter((item: any) => item.status === ReportStatus.IN_REVIEW).length,
				resolvedReports: reports.reports.filter((item: any) => item.status === ReportStatus.RESOLVED).length,
			},
		};
	}

	async listModerators(actor: any) {
		this.assertAdmin(actor);
		const rows = await this.userRepository.find({ where: { role: UserRole.MODERATOR } });
		return { moderators: rows.map(toClientUser) };
	}

	async createModerator(actor: any, body: any) {
		this.assertAdmin(actor);
		const username = String(body?.username || '').trim();
		const password = String(body?.password || '').trim();
		if (!username || !password) throw new BadRequestException('Tên đăng nhập và mật khẩu là bắt buộc');
		const existing = await this.userRepository.findOne({ where: { username } });
		if (existing) throw new BadRequestException('Tên đăng nhập đã tồn tại');
		const bcrypt = await import('bcryptjs');
		const moderator = await this.userRepository.save(this.userRepository.create({
			username,
			displayName: body?.displayName || 'Kiểm duyệt viên',
			email: body?.email || null,
			phone: body?.phone || null,
			password: await bcrypt.hash(password, 10),
			avatarUrl: '',
			isVerified: true,
			refreshToken: null,
			role: UserRole.MODERATOR,
			status: UserStatus.ACTIVE,
			warningCount: 0,
			restrictionReason: null,
			lockedUntil: null,
		}));
		await this.audit(actor, 'Tạo kiểm duyệt viên', 'USER', moderator.userId, username);
		return { message: 'Đã tạo kiểm duyệt viên', moderator: toClientUser(moderator) };
	}

	async deleteUser(actor: any, userId: number) {
		this.assertAdmin(actor);
		const user = await this.userRepository.findOne({ where: { userId } });
		if (!user) throw new NotFoundException('Không tìm thấy người dùng');
		user.status = UserStatus.DELETED;
		await this.userRepository.save(user);
		await this.audit(actor, 'Xóa tài khoản', 'USER', userId, user.username || user.displayName);
		return { message: 'Đã xóa tài khoản', user: toClientUser(user) };
	}

	async updateModeratorPermissions(actor: any, userId: number, body: any) {
		this.assertAdmin(actor);
		const user = await this.userRepository.findOne({ where: { userId } });
		if (!user) throw new NotFoundException('Không tìm thấy kiểm duyệt viên');
		user.role = body?.role ? String(body.role).toUpperCase() as UserRole : UserRole.MODERATOR;
		if (body?.accountStatus) user.status = this.normalizeUserStatus(body.accountStatus);
		await this.userRepository.save(user);
		await this.audit(actor, 'Phân quyền kiểm duyệt viên', 'USER', userId, JSON.stringify(body || {}));
		return { message: 'Đã cập nhật quyền kiểm duyệt viên', moderator: toClientUser(user) };
	}

	async assignReport(actor: any, reportId: number, body: any) {
		this.assertAdmin(actor);
		const report = await this.reportRepository.findOne({ where: { reportId } });
		if (!report) throw new NotFoundException('Không tìm thấy báo cáo');
		report.assignedTo = Number(body?.assignedTo || body?.moderatorId || 0) || null;
		report.status = ReportStatus.IN_REVIEW;
		report.updatedAt = new Date();
		await this.reportRepository.save(report);
		await this.audit(actor, 'Phân công báo cáo', 'REPORT', reportId, `Giao cho #${report.assignedTo}`);
		return { message: 'Đã phân công báo cáo', report };
	}

	async listAuditLogs(actor: any, limit = 100) {
		this.assertAdmin(actor);
		const logs = await this.auditLogRepository.find({ order: { createdAt: 'DESC' }, take: Math.min(Math.max(Number(limit || 100), 1), 300) });
		return { logs };
	}

	async warnUser(actor: any, userId: number, reason?: string) {
		this.assertStaff(actor);
		const user = await this.userRepository.findOne({ where: { userId } });
		if (!user) throw new NotFoundException('Không tìm thấy người dùng');
		user.warningCount = Number(user.warningCount || 0) + 1;
		user.status = UserStatus.WARNING;
		user.restrictionReason = reason || 'Cảnh cáo bởi kiểm duyệt viên';
		await this.userRepository.save(user);
		await this.audit(actor, 'Cảnh cáo người dùng', 'USER', userId, user.restrictionReason);
		return { message: 'Đã cảnh cáo người dùng', user: toClientUser(user) };
	}

	async restrictUser(actor: any, userId: number, reason?: string) {
		this.assertStaff(actor);
		const user = await this.userRepository.findOne({ where: { userId } });
		if (!user) throw new NotFoundException('Không tìm thấy người dùng');
		user.status = UserStatus.RESTRICTED;
		user.restrictionReason = reason || 'Hạn chế bởi kiểm duyệt viên';
		await this.userRepository.save(user);
		await this.audit(actor, 'Hạn chế tài khoản', 'USER', userId, user.restrictionReason);
		return { message: 'Đã hạn chế tài khoản', user: toClientUser(user) };
	}

	async tempLockUser(actor: any, userId: number, reason?: string) {
		this.assertStaff(actor);
		const user = await this.userRepository.findOne({ where: { userId } });
		if (!user) throw new NotFoundException('Không tìm thấy người dùng');
		user.status = UserStatus.TEMP_LOCKED;
		user.lockedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
		user.restrictionReason = reason || 'Tạm khóa bởi kiểm duyệt viên';
		await this.userRepository.save(user);
		await this.audit(actor, 'Tạm khóa tài khoản', 'USER', userId, user.restrictionReason);
		return { message: 'Đã tạm khóa tài khoản', user: toClientUser(user) };
	}
}  
