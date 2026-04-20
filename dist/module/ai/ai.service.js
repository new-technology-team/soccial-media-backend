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
var AiService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const generative_ai_1 = require("@google/generative-ai");
const ai_constants_1 = require("./ai.constants");
let AiService = AiService_1 = class AiService {
    constructor(config) {
        this.config = config;
        this.logger = new common_1.Logger(AiService_1.name);
        const apiKey = this.config.get('GEMINI_API_KEY');
        if (!apiKey) {
            this.logger.warn('GEMINI_API_KEY chưa được cấu hình – AI chat sẽ không hoạt động.');
        }
        this.genAI = new generative_ai_1.GoogleGenerativeAI(apiKey ?? '');
    }
    /**
     * Gửi tin nhắn đến Gemini và nhận phản hồi.
     * Hỗ trợ lịch sử hội thoại để AI hiểu ngữ cảnh cuộc trò chuyện.
     */
    async chat(dto) {
        try {
            const model = this.genAI.getGenerativeModel({
                model: ai_constants_1.GEMINI_MODEL,
                systemInstruction: ai_constants_1.ZCHAT_SYSTEM_PROMPT,
            });
            // Cắt lịch sử, chỉ giữ N lượt gần nhất để tránh vượt token limit
            const trimmedHistory = this.buildHistory(dto.history ?? []);
            const chat = model.startChat({ history: trimmedHistory });
            const result = await chat.sendMessage(dto.message);
            const reply = result.response.text().trim();
            return { reply };
        }
        catch (error) {
            this.logger.error('Gemini API error', error instanceof Error ? error.stack : error);
            throw new common_1.InternalServerErrorException('Trợ lý AI tạm thời gặp sự cố. Vui lòng thử lại sau.');
        }
    }
    /** Chuyển đổi history từ DTO sang format Content[] của Gemini SDK */
    buildHistory(history) {
        // Giữ tối đa MAX_HISTORY_TURNS lượt (mỗi lượt = 1 user + 1 model)
        const sliced = history.slice(-ai_constants_1.MAX_HISTORY_TURNS * 2);
        return sliced.map((entry) => ({
            role: entry.role,
            parts: [{ text: entry.text }],
        }));
    }
};
exports.AiService = AiService;
exports.AiService = AiService = AiService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], AiService);
//# sourceMappingURL=ai.service.js.map