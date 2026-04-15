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
exports.MessageController = void 0;
const common_1 = require("@nestjs/common");
const message_service_1 = require("./message.service");
const jwt_auth_guard_1 = require("../../common/auth/jwt-auth.guard");
const current_user_decorator_1 = require("../../common/auth/current-user.decorator");
let MessageController = class MessageController {
    constructor(messageService) {
        this.messageService = messageService;
    }
    getConversationMessages(user, id, limit, beforeId) {
        return this.messageService.listMessages(user.id, id, Number(limit || 30), beforeId);
    }
    sendMessage(user, id, body) {
        return this.messageService.sendMessage(user.id, id, body);
    }
    getMessageUploadUrl(user, id, body) {
        return this.messageService.getMessageUploadUrl(user.id, id, body);
    }
    uploadMessageBase64(user, id, body) {
        return this.messageService.uploadMessageBase64(user.id, id, body);
    }
    searchMessages(user, q) {
        return this.messageService.searchMessages(user.id, q);
    }
    reactMessage(user, messageId, body) {
        return this.messageService.reactMessage(user.id, messageId, body?.type || 'like');
    }
    removeMessageReaction(user, messageId) {
        return this.messageService.removeReaction(user.id, messageId);
    }
    recallMessage(user, messageId) {
        return this.messageService.recallMessage(user.id, messageId);
    }
    forwardMessage(user, messageId, body) {
        return this.messageService.forwardMessage(user.id, messageId, String(body?.targetConversationId));
    }
};
exports.MessageController = MessageController;
__decorate([
    (0, common_1.Get)('conversations/:id/messages'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)('limit')),
    __param(3, (0, common_1.Query)('beforeId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", void 0)
], MessageController.prototype, "getConversationMessages", null);
__decorate([
    (0, common_1.Post)('conversations/:id/messages'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], MessageController.prototype, "sendMessage", null);
__decorate([
    (0, common_1.Post)('conversations/:id/messages/upload-url'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], MessageController.prototype, "getMessageUploadUrl", null);
__decorate([
    (0, common_1.Post)('conversations/:id/messages/upload-base64'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], MessageController.prototype, "uploadMessageBase64", null);
__decorate([
    (0, common_1.Get)('search/messages'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('q')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MessageController.prototype, "searchMessages", null);
__decorate([
    (0, common_1.Post)('messages/:messageId/reaction'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('messageId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], MessageController.prototype, "reactMessage", null);
__decorate([
    (0, common_1.Delete)('messages/:messageId/reaction'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('messageId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MessageController.prototype, "removeMessageReaction", null);
__decorate([
    (0, common_1.Patch)('messages/:messageId/recall'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('messageId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MessageController.prototype, "recallMessage", null);
__decorate([
    (0, common_1.Post)('messages/:messageId/forward'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('messageId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], MessageController.prototype, "forwardMessage", null);
exports.MessageController = MessageController = __decorate([
    (0, common_1.Controller)('chat'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [message_service_1.MessageService])
], MessageController);
//# sourceMappingURL=message.controller.js.map