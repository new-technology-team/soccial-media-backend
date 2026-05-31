import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { CallService, RecordCallInput } from "./call.service";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { CurrentUser } from "../../common/auth/current-user.decorator";

@Controller('social')
@UseGuards(JwtAuthGuard)
export class CallController {
	constructor(private readonly callService: CallService) {}

	@Post('calls')
	recordCall(@CurrentUser() user: any, @Body() body: RecordCallInput) {
		return this.callService.recordCall(user.id, body);
	}

	@Get('calls')
	listMyCalls(@CurrentUser() user: any, @Query('limit') limit?: string) {
		return this.callService.listByUser(user.id, Number(limit || 50));
	}

	@Get('conversations/:id/calls')
	listConversationCalls(@Param('id') id: string, @Query('limit') limit?: string) {
		return this.callService.listByConversation(id, Number(limit || 50));
	}
}
