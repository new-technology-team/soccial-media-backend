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
exports.ConversationController = void 0;
const common_1 = require("@nestjs/common");
const conversation_service_1 = require("./conversation.service");
const jwt_auth_guard_1 = require("../../common/auth/jwt-auth.guard");
const current_user_decorator_1 = require("../../common/auth/current-user.decorator");
let ConversationController = class ConversationController {
    constructor(conversationService) {
        this.conversationService = conversationService;
    }
    listConversations(user) {
        return this.conversationService.listConversations(user.id);
    }
    createDirect(user, body) {
        return this.conversationService.createDirect(user.id, Number(body.userId));
    }
    createGroup(user, body) {
        return this.conversationService.createGroup(user.id, body?.name, body?.avatarUrl, body?.memberIds || []);
    }
    getDetail(user, id) {
        return this.conversationService.getConversationDetail(id, user.id);
    }
    seen(user, id) {
        return this.conversationService.setSeen(id, user.id);
    }
    toggleNotifications(user, id, body) {
        return this.conversationService.toggleNotifications(id, user.id, Boolean(body?.enabled));
    }
    addMember(user, id, body) {
        return this.conversationService.addMember(id, user.id, Number(body.userId));
    }
    removeMember(user, id, userId) {
        return this.conversationService.removeMember(id, user.id, Number(userId));
    }
    leaveGroup(user, id) {
        return this.conversationService.leaveGroup(id, user.id);
    }
    updateAdmin(user, id, body) {
        return this.conversationService.updateAdmin(id, user.id, Number(body.userId), Boolean(body.isAdmin));
    }
    transferLeader(user, id, body) {
        return this.conversationService.transferLeader(id, user.id, Number(body.userId));
    }
    setDeputy(user, id, body) {
        const value = body?.userId === null || body?.userId === undefined ? null : Number(body.userId);
        return this.conversationService.setDeputy(id, user.id, value);
    }
    dissolveGroup(user, id) {
        return this.conversationService.dissolveGroup(id, user.id);
    }
};
exports.ConversationController = ConversationController;
__decorate([
    (0, common_1.Get)('conversations'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ConversationController.prototype, "listConversations", null);
__decorate([
    (0, common_1.Post)('conversations/direct'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ConversationController.prototype, "createDirect", null);
__decorate([
    (0, common_1.Post)('conversations/group'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ConversationController.prototype, "createGroup", null);
__decorate([
    (0, common_1.Get)('conversations/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ConversationController.prototype, "getDetail", null);
__decorate([
    (0, common_1.Patch)('conversations/:id/seen'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ConversationController.prototype, "seen", null);
__decorate([
    (0, common_1.Patch)('conversations/:id/notifications'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], ConversationController.prototype, "toggleNotifications", null);
__decorate([
    (0, common_1.Post)('conversations/:id/members'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], ConversationController.prototype, "addMember", null);
__decorate([
    (0, common_1.Delete)('conversations/:id/members/:userId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], ConversationController.prototype, "removeMember", null);
__decorate([
    (0, common_1.Delete)('conversations/:id/leave'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ConversationController.prototype, "leaveGroup", null);
__decorate([
    (0, common_1.Patch)('conversations/:id/admins'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], ConversationController.prototype, "updateAdmin", null);
__decorate([
    (0, common_1.Patch)('conversations/:id/leader'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], ConversationController.prototype, "transferLeader", null);
__decorate([
    (0, common_1.Patch)('conversations/:id/deputy'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], ConversationController.prototype, "setDeputy", null);
__decorate([
    (0, common_1.Delete)('conversations/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ConversationController.prototype, "dissolveGroup", null);
exports.ConversationController = ConversationController = __decorate([
    (0, common_1.Controller)('chat'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [conversation_service_1.ConversationService])
], ConversationController);
//# sourceMappingURL=conversation.controller.js.map