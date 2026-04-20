import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, Content } from '@google/generative-ai';
import { GEMINI_MODEL, MAX_HISTORY_TURNS, ZCHAT_SYSTEM_PROMPT } from './ai.constants';
import { AiChatDto, ChatHistoryEntryDto } from './dto/ai-chat.dto';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly genAI: GoogleGenerativeAI;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY chưa được cấu hình – AI chat sẽ không hoạt động.');
    }
    this.genAI = new GoogleGenerativeAI(apiKey ?? '');
  }

  /**
   * Gửi tin nhắn đến Gemini và nhận phản hồi.
   * Hỗ trợ lịch sử hội thoại để AI hiểu ngữ cảnh cuộc trò chuyện.
   */
  async chat(dto: AiChatDto): Promise<{ reply: string }> {
    try {
      const model = this.genAI.getGenerativeModel({
        model: GEMINI_MODEL,
        systemInstruction: ZCHAT_SYSTEM_PROMPT,
      });

      // Cắt lịch sử, chỉ giữ N lượt gần nhất để tránh vượt token limit
      const trimmedHistory = this.buildHistory(dto.history ?? []);

      const chat = model.startChat({ history: trimmedHistory });
      const result = await chat.sendMessage(dto.message);
      const reply = result.response.text().trim();

      return { reply };
    } catch (error) {
      this.logger.error('Gemini API error', error instanceof Error ? error.stack : error);
      throw new InternalServerErrorException(
        'Trợ lý AI tạm thời gặp sự cố. Vui lòng thử lại sau.',
      );
    }
  }

  /** Chuyển đổi history từ DTO sang format Content[] của Gemini SDK */
  private buildHistory(history: ChatHistoryEntryDto[]): Content[] {
    // Giữ tối đa MAX_HISTORY_TURNS lượt (mỗi lượt = 1 user + 1 model)
    const sliced = history.slice(-MAX_HISTORY_TURNS * 2);
    return sliced.map((entry) => ({
      role: entry.role,
      parts: [{ text: entry.text }],
    }));
  }
}
