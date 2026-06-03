import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ObjectId } from "mongodb";
import { In, Repository } from "typeorm";
import { Report } from "./report.entity";
import { ReportStatus } from "../../common/enum/report-status.enum";
import { ReportType } from "../../common/enum/report-type.enum";
import { User } from "../user/user.entity";
import { Post } from "../post/post.entity";
import { Comment } from "../comment/comment.entity";
import { UserRole } from "../../common/enum/user-role.enum";
import { UserStatus } from "../../common/enum/user-status.enum";
import { AuditLog } from "../audit-log/audit-log.entity";
import { Notification } from "../notification/notification.entity";
import { clearChatUserRevocation, emitSocialEvent, emitToUser, revokeChatUserSessions } from "../../common/socket/chat-socket";
import { SystemSettingService } from "../system-setting/system-setting.service";

function toClientUser(user: any) {
	const permissions = typeof user?.permissions === 'string'
		? user.permissions.split(',').map((item: string) => item.trim()).filter(Boolean)
		: Array.isArray(user?.permissions) ? user.permissions : [];
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
		permissions,
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

const DEFAULT_MODERATOR_PERMISSIONS = [
	'manage_posts',
	'manage_reports',
	'manage_comments',
	'manage_users',
];

function normalizePermissions(value: any, fallback: string[] = []) {
	const raw = Array.isArray(value)
		? value
		: typeof value === 'string'
			? value.split(',')
			: fallback;
	return Array.from(new Set(raw.map((item: any) => String(item || '').trim()).filter(Boolean)));
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
		@InjectRepository(Notification, 'mongodb')
		private readonly notificationRepository: Repository<Notification>,
		private readonly systemSettingService: SystemSettingService,
	) {}

	private async notifyModerationAction(userId: number, title: string, body: string, meta: any = {}) {
		const notification = await this.notificationRepository.save(
			this.notificationRepository.create({
				userId: Number(userId),
				type: 'moderation',
				title,
				body,
				meta,
				isRead: false,
				createdAt: new Date(),
			}),
		);
		emitToUser(Number(userId), 'notification:new', {
			id: String((notification as any)._id),
			userId: Number(userId),
			type: 'moderation',
			title,
			body,
			meta,
			isRead: false,
			createdAt: (notification as any).createdAt,
		});
	}

	private emitUserChanged(user: any, actor: any, action = 'updated') {
		const payload = {
			user: toClientUser(user),
			userId: Number(user?.userId || user?.id || 0),
			actorId: actor?.id || null,
			action,
			updatedAt: new Date().toISOString(),
		};
		emitSocialEvent('user:updated', payload);
		emitSocialEvent('user:moderation-updated', payload);
		if (payload.userId) emitToUser(payload.userId, 'user:updated', payload);
	}

	private async enrichReports(rows: any[]): Promise<any[]> {
		const userIds = new Set<number>();
		rows.forEach((r) => {
			if (r.userId) userIds.add(Number(r.userId));
			if (r.reviewerId) userIds.add(Number(r.reviewerId));
			if (r.assignedTo) userIds.add(Number(r.assignedTo));
		});
		const userMap = new Map<number, string>();
		if (userIds.size > 0) {
			const users = await this.userRepository.find({ where: { userId: In([...userIds]) } });
			users.forEach((u) => userMap.set(u.userId, u.displayName || u.username || `#${u.userId}`));
		}
		return rows.map((r) => ({
			...r,
			reporterName: r.userId ? (userMap.get(Number(r.userId)) || null) : null,
			reviewerName: r.reviewerId ? (userMap.get(Number(r.reviewerId)) || null) : null,
			assigneeName: r.assignedTo ? (userMap.get(Number(r.assignedTo)) || null) : null,
		}));
	}

	private async fetchTargetContent(reportType: string, targetId: string): Promise<string | null> {
		try {
			if (!targetId) return null;
			if (reportType === 'post') {
				const post = await this.postRepository.findOne({ where: { _id: new ObjectId(targetId) as any } as any });
				return post?.content || null;
			}
			if (reportType === 'comment') {
				const comment = await this.commentRepository.findOne({ where: { _id: new ObjectId(targetId) as any } as any });
				return (comment as any)?.content || (comment as any)?.text || null;
			}
		} catch {
			// targetId may not be a valid ObjectId
		}
		return null;
	}

	private assertAdmin(actor: any) {
		if (!isAdmin(actor)) {
			throw new ForbiddenException('Chỉ admin mới có quyền truy cập');
		}
	}

	private assertStaff(actor: any, permission?: string) {
		if (!isAdmin(actor) && !isModerator(actor)) {
			throw new ForbiddenException('Chỉ admin hoặc kiểm duyệt viên mới có quyền truy cập');
		}
	}

	private assertPermission(actor: any, permission: string) {
		if (isAdmin(actor)) return;
		if (!isModerator(actor)) {
			throw new ForbiddenException('Only staff can access this resource');
		}
		const permissions = normalizePermissions(actor?.permissions, []);
		if (permissions.length > 0 && !permissions.includes(permission)) {
			throw new ForbiddenException('Moderator does not have permission for this action');
		}
	}

	private revokeUserSession(userId: number, reason: string) {
		revokeChatUserSessions(userId, reason);
	}

	private async audit(actor: any, action: string, targetType: string, targetId?: string | number | null, description?: string | null) {
		const { settings } = await this.systemSettingService.getAdminSettings();
		if (!settings.logging) return;
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

	private normalizeReportType(value: string | undefined) {
		const raw = String(value || 'POST').toUpperCase();
		if (!Object.values(ReportType).includes(raw as ReportType)) {
			throw new BadRequestException('Loại báo cáo không hợp lệ');
		}
		return raw as ReportType;
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
				reportType: this.normalizeReportType(body?.targetType),
				userId: actorId,
			}),
		);
		emitSocialEvent('report:created', { report, actorId });
		emitSocialEvent('report:queueUpdated', { report, actorId });
		const { settings } = await this.systemSettingService.getAdminSettings();
		if (settings.notify) {
			emitSocialEvent('report:priorityCreated', { report, actorId });
		}

		return {
			message: 'Đã gửi báo cáo',
			report,
		};
	}

	async listReports(actor: any, status?: string, limit = 100) {
		this.assertStaff(actor);
		this.assertPermission(actor, 'manage_reports');

		const rows = await this.reportRepository.find({
			where: status ? { status: this.normalizeReportStatus(status) } : undefined,
			order: { createAt: 'DESC' },
			take: Math.min(Math.max(Number(limit || 100), 1), 200),
		});

		const enriched = await this.enrichReports(rows);
		return { reports: enriched };
	}

	async getReport(actor: any, reportId: number) {
		this.assertStaff(actor);
		this.assertPermission(actor, 'manage_reports');
		const report = await this.reportRepository.findOne({ where: { reportId } });
		if (!report) throw new NotFoundException('Không tìm thấy báo cáo');
		const [enriched] = await this.enrichReports([report]);
		const targetContent = await this.fetchTargetContent(
			String(report.reportType || ''),
			String(report.targetId || ''),
		);
		return { report: { ...enriched, targetContent } };
	}

	async reviewReport(actor: any, reportId: number, body: any) {
		this.assertStaff(actor);
		this.assertPermission(actor, 'manage_reports');

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

		if (report.status === ReportStatus.IN_REVIEW) {
			emitSocialEvent('report:reviewing', { report, actorId: actor?.id || null });
		}
		if (report.status === ReportStatus.RESOLVED) {
			emitSocialEvent('report:resolved', { report, actorId: actor?.id || null });
		}
		emitSocialEvent('report:queueUpdated', { report, actorId: actor?.id || null });
		emitSocialEvent('report:updated', { report, actorId: actor?.id || null });
		return { message: 'Đã cập nhật trạng thái báo cáo', report };
	}

	async moderatePost(actor: any, postId: string, body: any) {
		this.assertStaff(actor);
		this.assertPermission(actor, 'manage_posts');

		if (!ObjectId.isValid(postId)) {
			throw new BadRequestException('ID bài viết không hợp lệ');
		}

		const post = await this.postRepository.findOne({ where: { _id: new ObjectId(postId) as any } as any });
		if (!post) {
			throw new NotFoundException('Không tìm thấy bài viết');
		}

		(post as any).status = body?.status || 'hidden';
		(post as any).updatedAt = new Date();
		await this.postRepository.save(post);
		const author = await this.userRepository.findOne({ where: { userId: Number((post as any).authorId || 0) } });
		emitSocialEvent('post:updated', {
			post: {
				id: String((post as any)._id || postId),
				authorId: (post as any).authorId,
				authorName: author?.displayName || 'Người dùng',
				authorAvatar: author?.avatarUrl || null,
				content: (post as any).content || '',
				mediaUrl: (post as any).mediaUrl || null,
				visibility: (post as any).visibility || 'public',
				status: (post as any).status || 'hidden',
				reactionCount: ((post as any).reactions || []).length,
				commentCount: Number((post as any).commentCount || 0),
				viewerReaction: null,
				createdAt: (post as any).createdAt,
				updatedAt: (post as any).updatedAt,
			},
			actorId: actor?.id || null,
		});
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
		this.assertPermission(actor, 'manage_users');

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
		this.emitUserChanged(user, actor, 'updated');
		if ([UserStatus.BLOCKED, UserStatus.DELETED, UserStatus.LOCKED, UserStatus.TEMP_LOCKED].includes(user.status)) {
			this.revokeUserSession(userId, user.status);
		}
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
		this.assertPermission(actor, 'manage_reports');
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
			permissions: DEFAULT_MODERATOR_PERMISSIONS.join(','),
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
		this.emitUserChanged(user, actor, 'deleted');
		this.revokeUserSession(userId, UserStatus.DELETED);
		return { message: 'Đã xóa tài khoản', user: toClientUser(user) };
	}

	async updateModeratorPermissions(actor: any, userId: number, body: any) {
		this.assertAdmin(actor);
		const user = await this.userRepository.findOne({ where: { userId } });
		if (!user) throw new NotFoundException('Không tìm thấy kiểm duyệt viên');
		user.role = body?.role ? String(body.role).toUpperCase() as UserRole : UserRole.MODERATOR;
		if (body?.accountStatus) user.status = this.normalizeUserStatus(body.accountStatus);
		if (body?.permissions !== undefined) {
			user.permissions = normalizePermissions(body.permissions, DEFAULT_MODERATOR_PERMISSIONS).join(',');
		}
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
		const [enriched] = await this.enrichReports([report]);
		emitSocialEvent('report:queueUpdated', { report: enriched, actorId: actor?.id || null });
		emitSocialEvent('report:updated', { report: enriched, actorId: actor?.id || null });
		if (report.assignedTo) {
			emitToUser(report.assignedTo, 'report:assigned', { report: enriched });
		}
		return { message: 'Đã phân công báo cáo', report: enriched };
	}

	async listAuditLogs(actor: any, limit = 100) {
		this.assertAdmin(actor);
		const logs = await this.auditLogRepository.find({ order: { createdAt: 'DESC' }, take: Math.min(Math.max(Number(limit || 100), 1), 300) });
		return { logs };
	}

	async getSystemSettings(actor: any) {
		this.assertAdmin(actor);
		const { settings, updatedAt } = await this.systemSettingService.getAdminSettings();
		return {
			settings,
			updatedAt,
		};
	}

	async updateSystemSettings(actor: any, body: any) {
		this.assertAdmin(actor);
		const next = await this.systemSettingService.updateAdminSettings(body?.settings || body || {});
		await this.audit(actor, 'Cập nhật cấu hình hệ thống', 'SYSTEM_SETTING', 'admin_console', JSON.stringify(next));
		return { message: 'Đã cập nhật cấu hình hệ thống', settings: next };
	}

	async warnUser(actor: any, userId: number, reason?: string) {
		this.assertStaff(actor);
		this.assertPermission(actor, 'manage_users');
		const user = await this.userRepository.findOne({ where: { userId } });
		if (!user) throw new NotFoundException('Không tìm thấy người dùng');
		user.warningCount = Number(user.warningCount || 0) + 1;
		user.status = UserStatus.WARNING;
		user.restrictionReason = reason || 'Cảnh cáo bởi kiểm duyệt viên';
		await this.userRepository.save(user);
		await this.audit(actor, 'Cảnh cáo người dùng', 'USER', userId, user.restrictionReason);
		await this.notifyModerationAction(userId, 'Tài khoản của bạn đã bị cảnh cáo', user.restrictionReason, { action: 'warn' });
		this.emitUserChanged(user, actor, 'warn');
		return { message: 'Đã cảnh cáo người dùng', user: toClientUser(user) };
	}

	async restrictUser(actor: any, userId: number, reason?: string) {
		this.assertStaff(actor);
		this.assertPermission(actor, 'manage_users');
		const user = await this.userRepository.findOne({ where: { userId } });
		if (!user) throw new NotFoundException('Không tìm thấy người dùng');
		user.status = UserStatus.RESTRICTED;
		user.restrictionReason = reason || 'Hạn chế bởi kiểm duyệt viên';
		await this.userRepository.save(user);
		await this.audit(actor, 'Hạn chế tài khoản', 'USER', userId, user.restrictionReason);
		await this.notifyModerationAction(userId, 'Tài khoản của bạn đã bị hạn chế', user.restrictionReason, { action: 'restrict' });
		this.emitUserChanged(user, actor, 'restrict');
		return { message: 'Đã hạn chế tài khoản', user: toClientUser(user) };
	}

	async tempLockUser(actor: any, userId: number, reason?: string) {
		this.assertStaff(actor);
		this.assertPermission(actor, 'manage_users');
		const user = await this.userRepository.findOne({ where: { userId } });
		if (!user) throw new NotFoundException('Không tìm thấy người dùng');
		user.status = UserStatus.TEMP_LOCKED;
		user.lockedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
		user.restrictionReason = reason || 'Tạm khóa bởi kiểm duyệt viên';
		await this.userRepository.save(user);
		await this.audit(actor, 'Tạm khóa tài khoản', 'USER', userId, user.restrictionReason);
		await this.notifyModerationAction(userId, 'Tài khoản của bạn đã bị tạm khóa', `${user.restrictionReason}. Thời hạn khóa đến ${user.lockedUntil.toLocaleString('vi-VN')}.`, { action: 'temp_lock', lockedUntil: user.lockedUntil });
		this.emitUserChanged(user, actor, 'temp_lock');
		this.revokeUserSession(userId, UserStatus.TEMP_LOCKED);
		return { message: 'Đã tạm khóa tài khoản', user: toClientUser(user) };
	}

	async restoreUser(actor: any, userId: number) {
		this.assertStaff(actor);
		this.assertPermission(actor, 'manage_users');
		const user = await this.userRepository.findOne({ where: { userId } });
		if (!user) throw new NotFoundException('Không tìm thấy người dùng');
		user.status = UserStatus.ACTIVE;
		user.lockedUntil = null as any;
		user.restrictionReason = null as any;
		await this.userRepository.save(user);
		await this.audit(actor, 'Khôi phục tài khoản', 'USER', userId, 'Khôi phục bởi kiểm duyệt viên');
		await this.notifyModerationAction(userId, 'Tài khoản của bạn đã được khôi phục', 'Tài khoản đã trở lại trạng thái hoạt động bình thường.', { action: 'restore' });
		clearChatUserRevocation(userId);
		this.emitUserChanged(user, actor, 'restore');
		return { message: 'Đã khôi phục tài khoản', user: toClientUser(user) };
	}
}  
