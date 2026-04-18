import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiChatDto } from './dto/ai-chat.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';

/**
 * Controller: POST /api/social/ai/support
 * Frontend gọi endpoint này để chat với AI trợ lý ZChat.
 * Yêu cầu người dùng đã đăng nhập (JWT).
 */
@Controller('social/ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @UseGuards(JwtAuthGuard)
  @Post('support')
  async support(@Body() dto: AiChatDto) {
    return this.aiService.chat(dto);
  }
}
