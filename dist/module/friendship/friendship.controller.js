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
exports.FriendshipController = void 0;
const common_1 = require("@nestjs/common");
const friendship_service_1 = require("./friendship.service");
const jwt_auth_guard_1 = require("../../common/auth/jwt-auth.guard");
const current_user_decorator_1 = require("../../common/auth/current-user.decorator");
const user_service_1 = require("../user/user.service");
let FriendshipController = class FriendshipController {
    constructor(friendshipService, userService) {
        this.friendshipService = friendshipService;
        this.userService = userService;
    }
    listFriends(user) {
        return this.friendshipService.listFriends(user.id);
    }
    async findUsers(user, q) {
        const rows = await this.userService.searchUsers(String(q || '').trim(), user.id);
        return {
            users: rows.map((item) => ({
                id: item.userId,
                fullName: item.displayName,
                avatarUrl: item.avatarUrl,
                email: item.email,
                phone: item.phone,
                role: item.role,
                accountStatus: item.status,
            })),
        };
    }
    requestFriend(user, body) {
        return this.friendshipService.requestFriend(user.id, Number(body.userId), user.fullName);
    }
    acceptFriend(user, userId) {
        return this.friendshipService.acceptFriend(user.id, Number(userId), user.fullName);
    }
    deleteFriend(user, userId) {
        return this.friendshipService.deleteFriend(user.id, Number(userId));
    }
};
exports.FriendshipController = FriendshipController;
__decorate([
    (0, common_1.Get)('friends'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], FriendshipController.prototype, "listFriends", null);
__decorate([
    (0, common_1.Get)('users/search'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('q')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], FriendshipController.prototype, "findUsers", null);
__decorate([
    (0, common_1.Post)('friends/request'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], FriendshipController.prototype, "requestFriend", null);
__decorate([
    (0, common_1.Post)('friends/:userId/accept'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], FriendshipController.prototype, "acceptFriend", null);
__decorate([
    (0, common_1.Delete)('friends/:userId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], FriendshipController.prototype, "deleteFriend", null);
exports.FriendshipController = FriendshipController = __decorate([
    (0, common_1.Controller)('social'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [friendship_service_1.FriendshipService,
        user_service_1.UserService])
], FriendshipController);
//# sourceMappingURL=friendship.controller.js.map