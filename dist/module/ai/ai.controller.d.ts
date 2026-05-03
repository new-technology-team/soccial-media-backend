import { AiService } from "./ai.service";
import { ChatAnalysisService } from "./chat-analysis.service";
import { AiChatDto } from "./dto/ai-chat.dto";
import { SummarizeChatDto } from "./dto/summarize-chat.dto";
/**
 * Controller: POST /api/social/ai/support
 * Frontend gọi endpoint này để chat với AI trợ lý ZChat.
 * Yêu cầu người dùng đã đăng nhập (JWT).
 */
export declare class AiController {
    private readonly aiService;
    private readonly chatAnalysisService;
    constructor(aiService: AiService, chatAnalysisService: ChatAnalysisService);
    support(dto: AiChatDto): Promise<{
        reply: string;
    }>;
    summarizeChatContext(dto: SummarizeChatDto): Promise<{
        summary: string;
    }>;
}
//# sourceMappingURL=ai.controller.d.ts.map