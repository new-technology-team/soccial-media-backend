import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { MessageService } from "./message.service";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { CurrentUser } from "../../common/auth/current-user.decorator";

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class MessageController {
	constructor(private readonly messageService: MessageService) {}

	@Get('conversations/:id/messages')
	getConversationMessages(
		@CurrentUser() user: any,
		@Param('id') id: string,
		@Query('limit') limit?: string,
		@Query('beforeId') beforeId?: string,
	) {
		return this.messageService.listMessages(user.id, id, Number(limit || 30), beforeId);
	}

	@Post('conversations/:id/messages')
	sendMessage(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
		return this.messageService.sendMessage(user.id, id, body);
	}

	@Post('conversations/:id/messages/upload-url')
	getMessageUploadUrl(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
		return this.messageService.getMessageUploadUrl(user.id, id, body);
	}

	@Post('conversations/:id/messages/upload-base64')
	uploadMessageBase64(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
		return this.messageService.uploadMessageBase64(user.id, id, body);
	}

	@Get('search/messages')
	searchMessages(@CurrentUser() user: any, @Query('q') q: string) {
		return this.messageService.searchMessages(user.id, q);
	}

	@Post('messages/:messageId/reaction')
	reactMessage(@CurrentUser() user: any, @Param('messageId') messageId: string, @Body() body: { type: string }) {
		return this.messageService.reactMessage(user.id, messageId, body?.type || 'like');
	}

	@Delete('messages/:messageId/reaction')
	removeMessageReaction(@CurrentUser() user: any, @Param('messageId') messageId: string) {
		return this.messageService.removeReaction(user.id, messageId);
	}

	@Patch('messages/:messageId/recall')
	recallMessage(@CurrentUser() user: any, @Param('messageId') messageId: string) {
		return this.messageService.recallMessage(user.id, messageId);
	}

	@Post('messages/:messageId/forward')
	forwardMessage(
		@CurrentUser() user: any,
		@Param('messageId') messageId: string,
		@Body() body: { targetConversationId: string },
	) {
		return this.messageService.forwardMessage(user.id, messageId, String(body?.targetConversationId));
	}

	@Delete('messages/:messageId')
	deleteMessage(@CurrentUser() user: any, @Param('messageId') messageId: string) {
		return this.messageService.deleteMessage(user.id, messageId);
	}
}