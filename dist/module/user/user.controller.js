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
exports.UserController = void 0;
const common_1 = require("@nestjs/common");
const user_service_1 = require("./user.service");
const jwt_auth_guard_1 = require("../../common/auth/jwt-auth.guard");
const current_user_decorator_1 = require("../../common/auth/current-user.decorator");
let UserController = class UserController {
    constructor(userService) {
        this.userService = userService;
    }
    async getSettings(user) {
        const profile = await this.userService.findOne(user.id);
        return {
            settings: {
                privacyLastSeen: Boolean(profile?.privacyLastSeen),
                privacyProfilePhoto: Boolean(profile?.privacyProfilePhoto),
                allowFriendRequests: Boolean(profile?.allowFriendRequests),
                notificationMessages: Boolean(profile?.notificationMessages),
                notificationCalls: Boolean(profile?.notificationCalls),
                updatedAt: new Date(),
            },
        };
    }
    async saveSettings(user, body) {
        const current = await this.userService.findOne(user.id);
        if (!current) {
            return { message: 'Không tìm thấy tài khoản' };
        }
        await this.userService.updateSettings(user.id, {
            privacyLastSeen: body?.privacyLastSeen,
            privacyProfilePhoto: body?.privacyProfilePhoto,
            allowFriendRequests: body?.allowFriendRequests,
            notificationMessages: body?.notificationMessages,
            notificationCalls: body?.notificationCalls,
        });
        const updated = await this.userService.findOne(user.id);
        return {
            message: 'Cập nhật cài đặt thành công',
            settings: {
                privacyLastSeen: Boolean(updated?.privacyLastSeen),
                privacyProfilePhoto: Boolean(updated?.privacyProfilePhoto),
                allowFriendRequests: Boolean(updated?.allowFriendRequests),
                notificationMessages: Boolean(updated?.notificationMessages),
                notificationCalls: Boolean(updated?.notificationCalls),
                updatedAt: new Date(),
            },
        };
    }
};
exports.UserController = UserController;
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)('settings'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UserController.prototype, "getSettings", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Put)('settings'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], UserController.prototype, "saveSettings", null);
exports.UserController = UserController = __decorate([
    (0, common_1.Controller)('social'),
    __metadata("design:paramtypes", [user_service_1.UserService])
], UserController);
//# sourceMappingURL=user.controller.js.map