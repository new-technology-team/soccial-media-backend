import { OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AiChatDto } from "./dto/ai-chat.dto";
export declare class AiService implements OnModuleInit {
    private readonly config;
    private readonly logger;
    private chatModel;
    private isReady;
    constructor(config: ConfigService);
    onModuleInit(): Promise<void>;
    /**
     * Feature 1: Gửi tin nhắn đến Gemini trực tiếp (không cần ChromaDB/RAG)
     */
    chat(dto: AiChatDto): Promise<{
        reply: string;
    }>;
    /**
     * Chuyển đổi lịch sử hội thoại thành định dạng LangChain messages
     */
    private buildHistoryMessages;
    /**
     * Stub: ingestKnowledgeBase – giữ lại để tương thích API, có thể implement sau
     */
    ingestKnowledgeBase(_texts: string[], _metadatas?: Record<string, any>[]): Promise<boolean>;
}
//# sourceMappingURL=ai.service.d.ts.map