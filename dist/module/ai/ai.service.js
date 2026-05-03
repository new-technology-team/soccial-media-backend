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
const google_genai_1 = require("@langchain/google-genai");
const messages_1 = require("@langchain/core/messages");
const ai_constants_1 = require("./ai.constants");
let AiService = AiService_1 = class AiService {
    constructor(config) {
        this.config = config;
        this.logger = new common_1.Logger(AiService_1.name);
        this.isReady = false;
        const apiKey = this.config.get("GEMINI_API_KEY") || "";
        if (!apiKey) {
            this.logger.warn("GEMINI_API_KEY chưa được cấu hình – AI sẽ không hoạt động.");
        }
        else {
            this.chatModel = new google_genai_1.ChatGoogleGenerativeAI({
                apiKey: apiKey,
                model: ai_constants_1.GEMINI_MODEL,
                temperature: 0.7,
            });
        }
    }
    async onModuleInit() {
        const apiKey = this.config.get("GEMINI_API_KEY") || "";
        if (!apiKey) {
            this.logger.warn("GEMINI_API_KEY không được đặt – bỏ qua khởi tạo AI.");
            return;
        }
        try {
            // Kiểm tra kết nối Gemini bằng cách gửi request nhỏ
            await this.chatModel.invoke([new messages_1.HumanMessage("ping")]);
            this.isReady = true;
            this.logger.log(`AI Service khởi tạo thành công (model: ${ai_constants_1.GEMINI_MODEL}).`);
        }
        catch (e) {
            this.logger.error("Lỗi khởi tạo AI Service (Gemini):", e);
            // Vẫn đặt isReady = true để thử từng request thực tế
            // (ping thất bại không có nghĩa là mọi request đều thất bại)
            this.isReady = true;
        }
    }
    /**
     * Feature 1: Gửi tin nhắn đến Gemini trực tiếp (không cần ChromaDB/RAG)
     */
    async chat(dto) {
        if (!this.chatModel) {
            throw new common_1.InternalServerErrorException("GEMINI_API_KEY chưa được cấu hình trên server. Vui lòng liên hệ quản trị viên.");
        }
        try {
            // Xây dựng message list: System + History + User message hiện tại
            const messages = [
                new messages_1.SystemMessage(ai_constants_1.ZCHAT_SYSTEM_PROMPT),
                ...this.buildHistoryMessages(dto.history ?? []),
                new messages_1.HumanMessage(dto.message),
            ];
            const response = await this.chatModel.invoke(messages);
            const reply = typeof response.content === "string"
                ? response.content
                : Array.isArray(response.content)
                    ? response.content
                        .map((c) => (typeof c === "string" ? c : c.text ?? ""))
                        .join("")
                    : String(response.content);
            return { reply };
        }
        catch (error) {
            this.logger.error("AI chat error", error instanceof Error ? error.stack : error);
            throw new common_1.InternalServerErrorException("Trợ lý AI tạm thời gặp sự cố. Vui lòng thử lại sau.");
        }
    }
    /**
     * Chuyển đổi lịch sử hội thoại thành định dạng LangChain messages
     */
    buildHistoryMessages(history) {
        const sliced = history.slice(-ai_constants_1.MAX_HISTORY_TURNS * 2);
        return sliced.map((entry) => {
            if (entry.role === "user") {
                return new messages_1.HumanMessage(entry.text);
            }
            else {
                return new messages_1.AIMessage(entry.text);
            }
        });
    }
    /**
     * Stub: ingestKnowledgeBase – giữ lại để tương thích API, có thể implement sau
     */
    async ingestKnowledgeBase(_texts, _metadatas) {
        this.logger.warn("ingestKnowledgeBase được gọi nhưng RAG chưa được cấu hình. Bỏ qua.");
        return false;
    }
};
exports.AiService = AiService;
exports.AiService = AiService = AiService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], AiService);
//# sourceMappingURL=ai.service.js.map