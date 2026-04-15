import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ReportService } from "./report.service";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { CurrentUser } from "../../common/auth/current-user.decorator";

@Controller('social')
@UseGuards(JwtAuthGuard)
export class ReportController {
	constructor(private readonly reportService: ReportService) {}

	@Post('reports')
	submitReport(@CurrentUser() user: any, @Body() body: any) {
		return this.reportService.submitReport(user.id, body);
	}

	@Get('moderation/reports')
	getModerationReports(@CurrentUser() user: any, @Query('status') status?: string, @Query('limit') limit?: string) {
		return this.reportService.listReports(user, status, Number(limit || 100));
	}

	@Patch('moderation/reports/:id')
	reviewModerationReport(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
		return this.reportService.reviewReport(user, Number(id), body);
	}

	@Patch('moderation/posts/:postId')
	moderateFeedPost(@CurrentUser() user: any, @Param('postId') postId: string, @Body() body: any) {
		return this.reportService.moderatePost(user, postId, body);
	}

	@Get('admin/stats')
	getAdminStats(@CurrentUser() user: any) {
		return this.reportService.getAdminStats(user);
	}

	@Get('admin/users')
	getModerationUsers(@CurrentUser() user: any, @Query('q') q?: string, @Query('limit') limit?: string) {
		return this.reportService.listUsers(user, q, Number(limit || 50));
	}

	@Patch('admin/users/:userId')
	updateModerationUserById(@CurrentUser() user: any, @Param('userId') userId: string, @Body() body: any) {
		return this.reportService.updateUser(user, Number(userId), body);
	}
}