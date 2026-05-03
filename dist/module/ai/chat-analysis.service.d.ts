import { ConfigService } from "@nestjs/config";
export interface ChatMessageSummaryInput {
    sender: string;
    content: string;
    timestamp?: Date | string;
}
export declare class ChatAnalysisService {
    private readonly config;
    private readonly logger;
    private chatModel;
    constructor(config: ConfigService);
    /**
     * Feature 2: Tóm tắt tin nhắn lịch sử
     * Phân tích và tóm tắt lại cuộc hội thoại dựa trên một danh sách các tin nhắn được cung cấp.
     * Thường số lượng tin nhắn này được fetch từ MongoDB của module Messages/Conversations.
     */
    summarizeChat(messages: ChatMessageSummaryInput[]): Promise<{
        summary: string;
    }>;
}
//# sourceMappingURL=chat-analysis.service.d.ts.map