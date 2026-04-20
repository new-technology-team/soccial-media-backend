import { AiService } from './ai.service';
import { AiChatDto } from './dto/ai-chat.dto';
/**
 * Controller: POST /api/social/ai/support
 * Frontend gọi endpoint này để chat với AI trợ lý ZChat.
 * Yêu cầu người dùng đã đăng nhập (JWT).
 */
export declare class AiController {
    private readonly aiService;
    constructor(aiService: AiService);
    support(dto: AiChatDto): Promise<{
        reply: string;
    }>;
}
//# sourceMappingURL=ai.controller.d.ts.map