import {
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

@Controller('api/chat')
@UseGuards(JwtAuthGuard)
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Get('conversations')
  listConversations(@Req() req: any) {
    return this.conversationService.listConversations(req.user.sub);
  }

  @Post('conversations/direct')
  createDirect(@Body() body: { userId: number }, @Req() req: any) {
    return this.conversationService.createDirect(req.user.sub, body.userId);
  }

  @Post('conversations/group')
  createGroup(
    @Body() body: { name: string; memberIds: number[] },
    @Req() req: any,
  ) {
    return this.conversationService.createGroup(
      req.user.sub,
      body.name,
      body.memberIds || [],
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
    @Body() body: { type?: string; text?: string; mediaUrl?: string },
  ) {
    return this.conversationService.sendMessage(id, req.user.sub, body);
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
}
