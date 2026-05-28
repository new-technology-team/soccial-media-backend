import { Body, Controller, Post, Get, Req, UseGuards } from "@nestjs/common";
import { AiService } from "./ai.service";
import { ChatAnalysisService } from "./chat-analysis.service";
import { AiChatDto } from "./dto/ai-chat.dto";
import { SummarizeChatDto } from "./dto/summarize-chat.dto";
import { SuggestRepliesDto } from "./dto/suggest-replies.dto";
import { AnalyzeSentimentDto } from "./dto/analyze-sentiment.dto";
import { TranslateMessageDto } from "./dto/translate-message.dto";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { CurrentUser } from "../../common/auth/current-user.decorator";

/**
 * Controller: POST /api/social/ai/support
 * Frontend gọi endpoint này để chat với AI trợ lý ZChat.
 * Yêu cầu người dùng đã đăng nhập (JWT).
 */
@Controller("social/ai")
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly chatAnalysisService: ChatAnalysisService,
  ) {}

  // Feature 1: Hỏi đáp tài liệu nội bộ
  @UseGuards(JwtAuthGuard)
  @Post("support")
  async support(@Body() dto: AiChatDto, @CurrentUser() user: any) {
    return this.aiService.chat(dto, user.id);
  }

  // Feature 1.1: Lấy lịch sử hỏi đáp
  @UseGuards(JwtAuthGuard)
  @Get("history")
  async getHistory(@CurrentUser() user: any) {
    return this.aiService.getHistory(user.id);
  }

  // Feature 2: Tóm tắt lịch sử nhắn tin
  @UseGuards(JwtAuthGuard)
  @Post("summarize")
  async summarizeChatContext(@Body() dto: SummarizeChatDto) {
    // Dữ liệu truyền vào từ Frontend có thể sau khi fetch từ MongoDB hoặc
    // Bạn cũng có thể triển khai lấy Mongoose Messages model trực tiếp tại ChatAnalysisService trong tương lai
    return this.chatAnalysisService.summarizeChat(dto.messages);
  }

  // Feature 3: Gợi ý trả lời nhanh
  // POST /ai/suggest-replies
  @UseGuards(JwtAuthGuard)
  @Post("suggest-replies")
  async suggestReplies(@Body() dto: SuggestRepliesDto) {
    return this.chatAnalysisService.suggestReplies(
      dto.messages,
      dto.currentUserName,
    );
  }

  // Feature 4: Phân tích cảm xúc
  // POST /ai/analyze-sentiment
  @UseGuards(JwtAuthGuard)
  @Post("analyze-sentiment")
  async analyzeSentiment(@Body() dto: AnalyzeSentimentDto) {
    return this.chatAnalysisService.analyzeSentiment(dto.messages);
  }

  // Thêm endpoint
  @UseGuards(JwtAuthGuard)
  @Post("translate")
  async translateMessage(@Body() dto: TranslateMessageDto) {
    return this.chatAnalysisService.translateMessage(
      dto.text,
      dto.targetLanguage,
    );
  }
}
