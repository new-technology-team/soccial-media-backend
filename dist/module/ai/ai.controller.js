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
exports.AiController = void 0;
const common_1 = require("@nestjs/common");
const ai_service_1 = require("./ai.service");
const chat_analysis_service_1 = require("./chat-analysis.service");
const ai_chat_dto_1 = require("./dto/ai-chat.dto");
const summarize_chat_dto_1 = require("./dto/summarize-chat.dto");
const jwt_auth_guard_1 = require("../../common/auth/jwt-auth.guard");
/**
 * Controller: POST /api/social/ai/support
 * Frontend gọi endpoint này để chat với AI trợ lý ZChat.
 * Yêu cầu người dùng đã đăng nhập (JWT).
 */
let AiController = class AiController {
    constructor(aiService, chatAnalysisService) {
        this.aiService = aiService;
        this.chatAnalysisService = chatAnalysisService;
    }
    // Feature 1: Hỏi đáp tài liệu nội bộ
    async support(dto) {
        return this.aiService.chat(dto);
    }
    // Feature 2: Tóm tắt lịch sử nhắn tin
    async summarizeChatContext(dto) {
        // Dữ liệu truyền vào từ Frontend có thể sau khi fetch từ MongoDB hoặc
        // Bạn cũng có thể triển khai lấy Mongoose Messages model trực tiếp tại ChatAnalysisService trong tương lai
        return this.chatAnalysisService.summarizeChat(dto.messages);
    }
};
exports.AiController = AiController;
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)("support"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ai_chat_dto_1.AiChatDto]),
    __metadata("design:returntype", Promise)
], AiController.prototype, "support", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)("summarize"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [summarize_chat_dto_1.SummarizeChatDto]),
    __metadata("design:returntype", Promise)
], AiController.prototype, "summarizeChatContext", null);
exports.AiController = AiController = __decorate([
    (0, common_1.Controller)("social/ai"),
    __metadata("design:paramtypes", [ai_service_1.AiService,
        chat_analysis_service_1.ChatAnalysisService])
], AiController);
//# sourceMappingURL=ai.controller.js.map