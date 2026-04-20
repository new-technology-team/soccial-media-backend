"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const mongodb_1 = require("mongodb");
const typeorm_2 = require("typeorm");
const report_entity_1 = require("./report.entity");
const report_status_enum_1 = require("../../common/enum/report-status.enum");
const user_entity_1 = require("../user/user.entity");
const post_entity_1 = require("../post/post.entity");
const user_role_enum_1 = require("../../common/enum/user-role.enum");
let ReportService = class ReportService {
    constructor(reportRepository, userRepository, postRepository) {
        this.reportRepository = reportRepository;
        this.userRepository = userRepository;
        this.postRepository = postRepository;
    }
    async submitReport(actorId, body) {
        const report = await this.reportRepository.save(this.reportRepository.create({
            status: report_status_enum_1.ReportStatus.PENDING,
            createAt: new Date(),
            updatedAt: new Date(),
            description: body?.reason || '',
            targetId: String(body?.targetId),
            resolutionNote: body?.details || null,
            reviewerId: null,
            reportType: String(body?.targetType || 'POST').toUpperCase(),
            userId: actorId,
        }));
        return {
            message: 'Đã gửi báo cáo',
            report,
        };
    }
    async listReports(actor, status, limit = 100) {
        if (![user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.MODERATOR, 'MODERATOR'].includes(actor.role)) {
            throw new common_1.ForbiddenException('Chỉ kiểm duyệt viên hoặc admin mới có quyền truy cập');
        }
        const rows = await this.reportRepository.find({
            where: status ? { status: status.toUpperCase() } : undefined,
            order: { createAt: 'DESC' },
            take: Math.min(Math.max(Number(limit || 100), 1), 200),
        });
        return { reports: rows };
    }
    async reviewReport(actor, reportId, body) {
        if (![user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.MODERATOR, 'MODERATOR'].includes(actor.role)) {
            throw new common_1.ForbiddenException('Chỉ kiểm duyệt viên hoặc admin mới có quyền truy cập');
        }
        const report = await this.reportRepository.findOne({ where: { reportId } });
        if (!report) {
            throw new common_1.NotFoundException('Không tìm thấy báo cáo');
        }
        report.status = String(body?.status || report.status).toUpperCase();
        report.resolutionNote = body?.resolutionNote || null;
        report.reviewerId = actor.id;
        report.updatedAt = new Date();
        await this.reportRepository.save(report);
        return { message: 'Đã cập nhật trạng thái báo cáo', report };
    }
    async moderatePost(actor, postId, body) {
        if (![user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.MODERATOR, 'MODERATOR'].includes(actor.role)) {
            throw new common_1.ForbiddenException('Chỉ kiểm duyệt viên hoặc admin mới có quyền truy cập');
        }
        const post = await this.postRepository.findOne({ where: { _id: new mongodb_1.ObjectId(postId) } });
        if (!post) {
            throw new common_1.NotFoundException('Không tìm thấy bài viết');
        }
        post.status = body?.status || 'hidden';
        post.updatedAt = new Date();
        await this.postRepository.save(post);
        return { message: 'Đã cập nhật trạng thái bài viết', post };
    }
    async getAdminStats(actor) {
        if (actor.role !== user_role_enum_1.UserRole.ADMIN) {
            throw new common_1.ForbiddenException('Chỉ admin mới có quyền truy cập');
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
    async listUsers(actor, keyword = '', limit = 50) {
        if (![user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.MODERATOR, 'MODERATOR'].includes(actor.role)) {
            throw new common_1.ForbiddenException('Chỉ kiểm duyệt viên hoặc admin mới có quyền truy cập');
        }
        const rows = await this.userRepository.find({ take: Math.min(Math.max(Number(limit || 50), 1), 200) });
        const normalized = String(keyword || '').toLowerCase().trim();
        const users = rows.filter((item) => {
            if (!normalized)
                return true;
            return (String(item.displayName || '').toLowerCase().includes(normalized) ||
                String(item.email || '').toLowerCase().includes(normalized) ||
                String(item.phone || '').toLowerCase().includes(normalized));
        });
        return { users };
    }
    async updateUser(actor, userId, body) {
        if (actor.role !== user_role_enum_1.UserRole.ADMIN) {
            throw new common_1.ForbiddenException('Chỉ admin mới có quyền truy cập');
        }
        const user = await this.userRepository.findOne({ where: { userId } });
        if (!user) {
            throw new common_1.NotFoundException('Không tìm thấy người dùng');
        }
        if (body?.role) {
            user.role = String(body.role).toUpperCase();
        }
        if (body?.accountStatus) {
            user.status = String(body.accountStatus).toUpperCase();
        }
        await this.userRepository.save(user);
        return { message: 'Đã cập nhật người dùng', user };
    }
};
exports.ReportService = ReportService;
exports.ReportService = ReportService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(report_entity_1.Report, 'mariadb')),
    __param(1, (0, typeorm_1.InjectRepository)(user_entity_1.User, 'mariadb')),
    __param(2, (0, typeorm_1.InjectRepository)(post_entity_1.Post, 'mongodb')),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], ReportService);
//# sourceMappingURL=report.service.js.map