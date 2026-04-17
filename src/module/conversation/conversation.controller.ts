import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ConversationService } from "./conversation.service";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { CurrentUser } from "../../common/auth/current-user.decorator";

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ConversationController {
	constructor(private readonly conversationService: ConversationService) {}

	@Get('conversations')
	listConversations(@CurrentUser() user: any) {
		return this.conversationService.listConversations(user.id);
	}

	@Post('conversations/direct')
	createDirect(@CurrentUser() user: any, @Body() body: { userId: number }) {
		return this.conversationService.createDirect(user.id, Number(body.userId));
	}

	@Post('conversations/group')
	createGroup(@CurrentUser() user: any, @Body() body: { name: string; avatarUrl?: string; memberIds: number[] }) {
		return this.conversationService.createGroup(user.id, body?.name, body?.avatarUrl, body?.memberIds || []);
	}

	@Get('conversations/:id')
	getDetail(@CurrentUser() user: any, @Param('id') id: string) {
		return this.conversationService.getConversationDetail(id, user.id);
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

	@Patch('conversations/:id/admins')
	updateAdmin(
		@CurrentUser() user: any,
		@Param('id') id: string,
		@Body() body: { userId: number; isAdmin: boolean },
	) {
		return this.conversationService.updateAdmin(id, user.id, Number(body.userId), Boolean(body.isAdmin));
	}

	@Delete('conversations/:id')
	dissolveGroup(@CurrentUser() user: any, @Param('id') id: string) {
		return this.conversationService.dissolveGroup(id, user.id);
	}
}