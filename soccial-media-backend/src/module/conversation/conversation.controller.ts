import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guard/jwt-auth.guard';
import { ConversationService } from './conversation.service';
import { MediaService } from '../media/media.service';

@Controller('api/chat')
@UseGuards(JwtAuthGuard)
export class ConversationController {
  constructor(
    private readonly conversationService: ConversationService,
    private readonly mediaService: MediaService,
  ) {}

  @Get('conversations')
  listConversations(@Req() req: any) {
    return this.conversationService.listConversations(req.user.sub);
  }

  @Post('conversations/direct')
  createDirect(
    @Body() body: { userId?: number; targetUserId?: number },
    @Req() req: any,
  ) {
    const targetUserId = Number(body?.userId ?? body?.targetUserId ?? 0);
    if (!targetUserId) {
      throw new BadRequestException('Thieu userId hoac targetUserId');
    }
    return this.conversationService.createDirect(req.user.sub, targetUserId);
  }

  @Post('conversations/group')
  createGroup(
    @Body() body: { name: string; memberIds: number[]; avatarUrl?: string },
    @Req() req: any,
  ) {
    return this.conversationService.createGroup(
      req.user.sub,
      body.name,
      body.memberIds || [],
      body.avatarUrl,
    );
  }

  @Get('conversations/:id')
  getConversationDetail(@Param('id') id: string, @Req() req: any) {
    return this.conversationService.getConversationDetail(id, req.user.sub);
  }

  @Get('conversations/:id/messages')
  getMessages(
    @Param('id') id: string,
    @Req() req: any,
    @Query('limit') limit?: string,
  ) {
    return this.conversationService.getMessages(
      id,
      req.user.sub,
      limit ? parseInt(limit, 10) : 30,
    );
  }

  @Post('conversations/:id/messages')
  sendMessage(
    @Param('id') id: string,
    @Req() req: any,
    @Body()
    body: {
      type?: string;
      text?: string;
      mediaUrl?: string;
      fileName?: string;
      fileSize?: number;
      meta?: Record<string, any> | null;
    },
  ) {
    return this.conversationService.sendMessage(id, req.user.sub, body);
  }

  @Patch('conversations/:id/avatar')
  updateGroupAvatar(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { avatarUrl?: string },
  ) {
    return this.conversationService.updateGroupAvatar(
      id,
      req.user.sub,
      String(body?.avatarUrl || ''),
    );
  }

  /* ===== Message reactions ===== */

  @Post('messages/:messageId/reaction')
  reactMessage(
    @Param('messageId') messageId: string,
    @Req() req: any,
    @Body() body: { type: string },
  ) {
    const reactionType = String(body?.type || '').trim().toLowerCase();
    if (!reactionType) {
      throw new BadRequestException('Thieu loai cam xuc');
    }
    return this.conversationService.reactMessage(messageId, req.user.sub, reactionType);
  }

  @Delete('messages/:messageId/reaction')
  removeMessageReaction(
    @Param('messageId') messageId: string,
    @Req() req: any,
  ) {
    return this.conversationService.removeMessageReaction(messageId, req.user.sub);
  }

  /* ===== Message recall (by messageId, no conversationId needed) ===== */

  @Patch('messages/:messageId/recall')
  recallMessageById(
    @Param('messageId') messageId: string,
    @Req() req: any,
  ) {
    return this.conversationService.recallMessageById(messageId, req.user.sub);
  }

  @Patch('conversations/:id/messages/:messageId/recall')
  recallMessage(
    @Param('id') id: string,
    @Param('messageId') messageId: string,
    @Req() req: any,
    @Body() body: { scope?: 'me' | 'all' },
  ) {
    return this.conversationService.recallMessage(
      id,
      messageId,
      req.user.sub,
      body?.scope === 'all' ? 'all' : 'me',
    );
  }

  @Patch('conversations/:id/seen')
  seen(@Req() req: any, @Param('id') id: string) {
    return this.conversationService.setSeen(id, req.user.sub);
  }

  @Post('conversations/:id/messages/read')
  markRead(@Req() req: any, @Param('id') id: string) {
    return this.conversationService.markConversationRead(id, req.user.sub);
  }

  @Get('conversations/:id/shared')
  getSharedMedia(@Req() req: any, @Param('id') id: string) {
    return this.conversationService.getSharedMedia(id, req.user.sub);
  }

  @Patch('conversations/:id/notifications')
  toggleNotifications(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { enabled: boolean },
  ) {
    return this.conversationService.toggleNotifications(
      id,
      req.user.sub,
      Boolean(body?.enabled),
    );
  }

  @Post('conversations/:id/members')
  addMember(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { userId: number },
  ) {
    return this.conversationService.addMember(
      id,
      req.user.sub,
      Number(body.userId),
    );
  }

  @Delete('conversations/:id/members/:userId')
  removeMember(
    @Req() req: any,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.conversationService.removeMember(
      id,
      req.user.sub,
      Number(userId),
    );
  }

  @Delete('conversations/:id/leave')
  leaveGroup(@Req() req: any, @Param('id') id: string) {
    return this.conversationService.leaveGroup(id, req.user.sub);
  }

  @Patch('conversations/:id/admins')
  updateAdmin(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { userId: number; isAdmin: boolean },
  ) {
    return this.conversationService.updateAdmin(
      id,
      req.user.sub,
      Number(body.userId),
      Boolean(body.isAdmin),
    );
  }

  @Patch('conversations/:id/leader')
  transferLeader(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { userId: number },
  ) {
    return this.conversationService.transferLeader(
      id,
      req.user.sub,
      Number(body.userId),
    );
  }

  @Patch('conversations/:id/deputy')
  setDeputy(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { userId?: number | null },
  ) {
    const value =
      body?.userId === null || body?.userId === undefined
        ? null
        : Number(body.userId);
    return this.conversationService.setDeputy(id, req.user.sub, value);
  }

  @Delete('conversations/:id')
  dissolveGroup(@Req() req: any, @Param('id') id: string) {
    return this.conversationService.dissolveGroup(id, req.user.sub);
  }

  @Post('conversations/:id/messages/upload-base64')
  async uploadMessageBase64(
    @Param('id') id: string,
    @Req() req: any,
    @Body()
    body: {
      fileName?: string;
      contentType?: string;
      base64Data?: string;
    },
  ) {
    const userId = Number(req?.user?.sub || 0);
    if (!userId) throw new BadRequestException('Khong xac dinh duoc user');

    const result = await this.mediaService.uploadBase64(userId, 'message', body);
    return {
      fileUrl: result.fileUrl,
      fileName: String(body?.fileName || result.fileName),
      contentType: String(body?.contentType || 'application/octet-stream'),
      size: result.size,
    };
  }

  @Post('uploads/base64')
  async uploadChatMediaBase64(
    @Req() req: any,
    @Body()
    body: {
      fileName?: string;
      contentType?: string;
      base64Data?: string;
    },
  ) {
    const userId = Number(req?.user?.sub || 0);
    if (!userId) throw new BadRequestException('Khong xac dinh duoc user');

    const result = await this.mediaService.uploadBase64(userId, 'message', body);
    return {
      fileUrl: result.fileUrl,
      fileName: String(body?.fileName || result.fileName),
      contentType: String(body?.contentType || 'application/octet-stream'),
      size: result.size,
    };
  }
}
