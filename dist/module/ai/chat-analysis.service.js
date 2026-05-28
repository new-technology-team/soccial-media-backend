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
var ChatAnalysisService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatAnalysisService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const google_genai_1 = require("@langchain/google-genai");
const prompts_1 = require("@langchain/core/prompts");
const output_parsers_1 = require("@langchain/core/output_parsers");
const ai_constants_1 = require("./ai.constants");
let ChatAnalysisService = ChatAnalysisService_1 = class ChatAnalysisService {
    constructor(config) {
        this.config = config;
        this.logger = new common_1.Logger(ChatAnalysisService_1.name);
        const apiKey = this.config.get("GEMINI_API_KEY") || "";
        if (!apiKey) {
            this.logger.warn("GEMINI_API_KEY chưa được cấu hình – ChatAnalysisService sẽ không hoạt động.");
        }
        this.chatModel = new google_genai_1.ChatGoogleGenerativeAI({
            apiKey: apiKey,
            model: ai_constants_1.GEMINI_MODEL, // Sử dụng Gemini (VD: gemini-1.5-pro chuẩn hóa ở ai.constants.ts)
            temperature: 0.2, // Giảm temperature để tóm tắt chính xác và ít bịa đặt
        });
    }
    /**
     * Feature 2: Tóm tắt tin nhắn lịch sử
     * Phân tích và tóm tắt lại cuộc hội thoại dựa trên một danh sách các tin nhắn được cung cấp.
     * Thường số lượng tin nhắn này được fetch từ MongoDB của module Messages/Conversations.
     */
    async summarizeChat(messages) {
        if (!messages || messages.length === 0) {
            return { summary: "Không có đoạn chat nào để tóm tắt." };
        }
        try {
            const promptTemplate = prompts_1.PromptTemplate.fromTemplate(`
Bạn là một chuyên gia phân tích và tóm tắt dữ liệu hội thoại chat.
Dưới đây là một đoạn hội thoại giữa các thành viên. Hãy tóm tắt ngắn gọn các thông tin sau:
1. Nội dung chính của cuộc trò chuyện.
2. Các quyết định được đưa ra (nếu có).
3. Các công việc cần làm tiếp theo hoặc thông tin quan trọng cần lưu ý (nếu có).

Hãy tóm tắt ngắn gọn, dễ đọc bằng tiếng Việt, dưới dạng gạch đầu dòng nếu cần thiết.

NỘI DUNG HỘI THOẠI:
{chat_history}

TÓM TẮT CỦA BẠN:
      `);
            // Tiền xử lý lịch sử tin nhắn thành văn bản dễ đọc
            const formattedHistory = messages
                .map((m) => `[${m.timestamp ? new Date(m.timestamp).toLocaleTimeString() : "N/A"}] ${m.sender}: ${m.content}`)
                .join("\n");
            this.logger.debug(`Đang tiến hành tóm tắt cuộc hội thoại (${messages.length} tin nhắn)...`);
            // LangChain Expression Language (LCEL) chain
            const chain = promptTemplate
                .pipe(this.chatModel)
                .pipe(new output_parsers_1.StringOutputParser());
            const summary = await chain.invoke({
                chat_history: formattedHistory,
            });
            return { summary };
        }
        catch (error) {
            this.logger.error("Lỗi khi ứng dụng tóm tắt tin nhắn (ChatAnalysis):", error instanceof Error ? error.stack : error);
            throw new common_1.InternalServerErrorException("Đã xảy ra lỗi trong quá trình phân tích và tóm tắt tin nhắn.");
        }
    }
};
exports.ChatAnalysisService = ChatAnalysisService;
exports.ChatAnalysisService = ChatAnalysisService = ChatAnalysisService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], ChatAnalysisService);
//# sourceMappingURL=chat-analysis.service.js.map