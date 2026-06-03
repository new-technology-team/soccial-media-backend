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
import { promises as fs } from 'fs';
import { extname, join } from 'path';
import { JwtAuthGuard } from '../../common/guard/jwt-auth.guard';
import { ConversationService } from './conversation.service';

@Controller('api/chat')
@UseGuards(JwtAuthGuard)
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

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
    const base64Raw = String(body?.base64Data || '').trim();
    if (!base64Raw) {
      throw new BadRequestException('Thieu base64Data');
    }

    const base64Payload = base64Raw.includes(',')
      ? base64Raw.split(',').pop() || ''
      : base64Raw;
    const buffer = Buffer.from(base64Payload, 'base64');
    if (!buffer.length) {
      throw new BadRequestException('Du lieu file khong hop le');
    }
    if (buffer.length > 15 * 1024 * 1024) {
      throw new BadRequestException('Kich thuoc file qua lon (toi da 15MB)');
    }

    const requestedExt = extname(String(body?.fileName || '')).toLowerCase();
    const contentType = String(body?.contentType || '').toLowerCase();
    const safeExt =
      requestedExt ||
      (contentType.includes('png')
        ? '.png'
        : contentType.includes('webp')
          ? '.webp'
          : contentType.includes('gif')
            ? '.gif'
            : contentType.includes('jpeg') || contentType.includes('jpg')
              ? '.jpg'
              : contentType.includes('pdf')
                ? '.pdf'
                : contentType.includes('json')
                  ? '.json'
                  : contentType.includes('zip')
                    ? '.zip'
                    : contentType.includes('mp4')
                      ? '.mp4'
                      : '.bin');

    const userId = Number(req?.user?.sub || 0);
    if (!userId) {
      throw new BadRequestException('Khong xac dinh duoc user');
    }

    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${safeExt}`;
    const relativeDir = join('uploads', 'messages', String(userId));
    const absoluteDir = join(process.cwd(), relativeDir);
    await fs.mkdir(absoluteDir, { recursive: true });
    await fs.writeFile(join(absoluteDir, fileName), buffer);

    return {
      fileUrl: `/${relativeDir.replace(/\\/g, '/')}/${fileName}`,
      fileName: String(body?.fileName || fileName),
      contentType: contentType || 'application/octet-stream',
      size: buffer.length,
    };
  }
}
