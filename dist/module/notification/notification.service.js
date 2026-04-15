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
exports.NotificationService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const notification_entity_1 = require("./notification.entity");
let NotificationService = class NotificationService {
    notificationRepository;
    constructor(notificationRepository) {
        this.notificationRepository = notificationRepository;
    }
    async createNotification(payload) {
        return this.notificationRepository.save(this.notificationRepository.create({
            userId: Number(payload.userId),
            type: payload.type,
            title: payload.title,
            body: payload.body,
            meta: payload.meta || null,
            isRead: false,
            createdAt: new Date(),
        }));
    }
    async listByUser(userId, limit = 50) {
        const rows = await this.notificationRepository.find({
            where: { userId: Number(userId) },
            order: { createdAt: 'DESC' },
            take: Math.min(Math.max(Number(limit || 50), 1), 200),
        });
        return {
            notifications: rows.map((item) => ({
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
    async markRead(userId, id) {
        const row = await this.notificationRepository.findOne({ where: { _id: new typeorm_2.ObjectId(id) } });
        if (row && Number(row.userId) === Number(userId)) {
            row.isRead = true;
            await this.notificationRepository.save(row);
        }
        return { message: 'Đã đánh dấu đã đọc' };
    }
    async markAllRead(userId) {
        const rows = await this.notificationRepository.find({ where: { userId: Number(userId) } });
        for (const row of rows) {
            row.isRead = true;
            await this.notificationRepository.save(row);
        }
        return { message: 'Đã đánh dấu toàn bộ đã đọc' };
    }
};
exports.NotificationService = NotificationService;
exports.NotificationService = NotificationService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(notification_entity_1.Notification, 'mongodb')),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], NotificationService);
//# sourceMappingURL=notification.service.js.map