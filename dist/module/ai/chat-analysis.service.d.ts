import { ConfigService } from "@nestjs/config";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
export interface TranslateResult {
    translatedText: string;
    detectedLanguage: string;
    detectedLanguageName: string;
    targetLanguage: string;
    isSameLanguage: boolean;
}
export interface SentimentResult {
    sentiment: "positive" | "neutral" | "negative";
    score: number;
    detail: string;
    emotions: string[];
}
export interface ChatMessageSummaryInput {
    sender: string;
    content: string;
    timestamp?: Date | string;
}
export declare class ChatAnalysisService {
    private readonly config;
    private readonly chatModel;
    private readonly stableModel;
    private readonly logger;
    constructor(config: ConfigService, // ✅ Inject model thường cho summarize và suggestReplies
    chatModel: ChatGoogleGenerativeAI, stableModel: ChatGoogleGenerativeAI);
    /**
     * Feature 2: Tóm tắt tin nhắn lịch sử
     * Phân tích và tóm tắt lại cuộc hội thoại dựa trên một danh sách các tin nhắn được cung cấp.
     * Thường số lượng tin nhắn này được fetch từ MongoDB của module Messages/Conversations.
     */
    summarizeChat(messages: ChatMessageSummaryInput[]): Promise<{
        summary: string;
    }>;
    /**
     * Feature 3: Smart Reply — Gợi ý 3 câu trả lời nhanh
     * Dựa vào lịch sử hội thoại gần nhất, gợi ý các câu trả lời
     * phù hợp ngữ cảnh cho người dùng hiện tại.
     */
    suggestReplies(messages: ChatMessageSummaryInput[], currentUserName: string): Promise<{
        suggestions: string[];
    }>;
    /**
     * Feature 4: Sentiment Analysis — Phân tích cảm xúc hội thoại
     * Phân tích cảm xúc tổng thể của đoạn hội thoại và trả về JSON có cấu trúc.
     */
    analyzeSentiment(messages: ChatMessageSummaryInput[]): Promise<SentimentResult>;
    /**
     * Parse JSON từ Gemini — xử lý các trường hợp Gemini trả về không chuẩn
     */
    private parseSentimentJson;
    /**
     * Feature 5: Translate — Dịch tin nhắn sang ngôn ngữ khác
     * Dịch nội dung tin nhắn, tự động nhận diện ngôn ngữ gốc,
     * giữ nguyên emoji, tên riêng và format đặc biệt.
     */
    translateMessage(text: string, targetLanguage: string): Promise<TranslateResult>;
    /**
     * Parse JSON từ Gemini — xử lý các trường hợp format không chuẩn
     */
    private parseTranslateJson;
}
//# sourceMappingURL=chat-analysis.service.d.ts.map