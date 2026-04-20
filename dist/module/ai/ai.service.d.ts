import { ConfigService } from '@nestjs/config';
import { AiChatDto } from './dto/ai-chat.dto';
export declare class AiService {
    private readonly config;
    private readonly logger;
    private readonly genAI;
    constructor(config: ConfigService);
    /**
     * Gửi tin nhắn đến Gemini và nhận phản hồi.
     * Hỗ trợ lịch sử hội thoại để AI hiểu ngữ cảnh cuộc trò chuyện.
     */
    chat(dto: AiChatDto): Promise<{
        reply: string;
    }>;
    /** Chuyển đổi history từ DTO sang format Content[] của Gemini SDK */
    private buildHistory;
}
//# sourceMappingURL=ai.service.d.ts.map