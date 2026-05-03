import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { GEMINI_MODEL } from "./ai.constants";

export interface ChatMessageSummaryInput {
  sender: string;
  content: string;
  timestamp?: Date | string;
}

@Injectable()
export class ChatAnalysisService {
  private readonly logger = new Logger(ChatAnalysisService.name);
  private chatModel: ChatGoogleGenerativeAI;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>("GEMINI_API_KEY") || "";
    if (!apiKey) {
      this.logger.warn(
        "GEMINI_API_KEY chưa được cấu hình – ChatAnalysisService sẽ không hoạt động.",
      );
    }

    this.chatModel = new ChatGoogleGenerativeAI({
      apiKey: apiKey,
      model: GEMINI_MODEL, // Sử dụng Gemini (VD: gemini-1.5-pro chuẩn hóa ở ai.constants.ts)
      temperature: 0.2, // Giảm temperature để tóm tắt chính xác và ít bịa đặt
    });
  }

  /**
   * Feature 2: Tóm tắt tin nhắn lịch sử
   * Phân tích và tóm tắt lại cuộc hội thoại dựa trên một danh sách các tin nhắn được cung cấp.
   * Thường số lượng tin nhắn này được fetch từ MongoDB của module Messages/Conversations.
   */
  async summarizeChat(
    messages: ChatMessageSummaryInput[],
  ): Promise<{ summary: string }> {
    if (!messages || messages.length === 0) {
      return { summary: "Không có đoạn chat nào để tóm tắt." };
    }

    try {
      const promptTemplate = PromptTemplate.fromTemplate(`
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
        .map(
          (m) =>
            `[${m.timestamp ? new Date(m.timestamp).toLocaleTimeString() : "N/A"}] ${m.sender}: ${m.content}`,
        )
        .join("\n");

      this.logger.debug(
        `Đang tiến hành tóm tắt cuộc hội thoại (${messages.length} tin nhắn)...`,
      );

      // LangChain Expression Language (LCEL) chain
      const chain = promptTemplate
        .pipe(this.chatModel)
        .pipe(new StringOutputParser());

      const summary = await chain.invoke({
        chat_history: formattedHistory,
      });

      return { summary };
    } catch (error) {
      this.logger.error(
        "Lỗi khi ứng dụng tóm tắt tin nhắn (ChatAnalysis):",
        error instanceof Error ? error.stack : error,
      );
      throw new InternalServerErrorException(
        "Đã xảy ra lỗi trong quá trình phân tích và tóm tắt tin nhắn.",
      );
    }
  }
}
