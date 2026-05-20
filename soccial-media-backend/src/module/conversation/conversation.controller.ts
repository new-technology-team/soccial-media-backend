import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Req, Query } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { JwtAuthGuard } from '../../common/guard/jwt-auth.guard';

@Controller('api/chat')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Get('conversations')
  @UseGuards(JwtAuthGuard)
  listConversations(@Req() req: any) {
    return this.conversationService.listConversations(req.user.sub);
  }

  @Post('conversations/direct')
  @UseGuards(JwtAuthGuard)
  createDirect(@Body() body: { userId: number }, @Req() req: any) {
    return this.conversationService.createDirect(req.user.sub, body.userId);
  }

  @Post('conversations/group')
  @UseGuards(JwtAuthGuard)
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

  @Get('conversations/:id/messages')
  @UseGuards(JwtAuthGuard)
  getMessages(@Param('id') id: string, @Req() req: any, @Query('limit') limit?: string) {
    return this.conversationService.getMessages(
      id,
      req.user.sub,
      limit ? parseInt(limit, 10) : 30,
    );
  }

	@Patch('conversations/:id/seen')
	seen(@CurrentUser() user: any, @Param('id') id: string) {
		return this.conversationService.setSeen(id, user.id);
	}

	@Patch('conversations/:id/notifications')
	toggleNotifications(
		@CurrentUser() user: any,
		@Param('id') id: string,
		@Body() body: { enabled: boolean },
	) {
		return this.conversationService.toggleNotifications(id, user.id, Boolean(body?.enabled));
	}

	@Post('conversations/:id/members')
	addMember(@CurrentUser() user: any, @Param('id') id: string, @Body() body: { userId: number }) {
		return this.conversationService.addMember(id, user.id, Number(body.userId));
	}

	@Delete('conversations/:id/members/:userId')
	removeMember(@CurrentUser() user: any, @Param('id') id: string, @Param('userId') userId: string) {
		return this.conversationService.removeMember(id, user.id, Number(userId));
	}

	@Delete('conversations/:id/leave')
	leaveGroup(@CurrentUser() user: any, @Param('id') id: string) {
		return this.conversationService.leaveGroup(id, user.id);
	}

	@Patch('conversations/:id/admins')
	updateAdmin(
		@CurrentUser() user: any,
		@Param('id') id: string,
		@Body() body: { userId: number; isAdmin: boolean },
	) {
		return this.conversationService.updateAdmin(id, user.id, Number(body.userId), Boolean(body.isAdmin));
	}

	@Patch('conversations/:id/leader')
	transferLeader(
		@CurrentUser() user: any,
		@Param('id') id: string,
		@Body() body: { userId: number },
	) {
		return this.conversationService.transferLeader(id, user.id, Number(body.userId));
	}

	@Patch('conversations/:id/deputy')
	setDeputy(
		@CurrentUser() user: any,
		@Param('id') id: string,
		@Body() body: { userId?: number | null },
	) {
		const value = body?.userId === null || body?.userId === undefined ? null : Number(body.userId);
		return this.conversationService.setDeputy(id, user.id, value);
	}

	@Delete('conversations/:id')
	dissolveGroup(@CurrentUser() user: any, @Param('id') id: string) {
		return this.conversationService.dissolveGroup(id, user.id);
	}
}