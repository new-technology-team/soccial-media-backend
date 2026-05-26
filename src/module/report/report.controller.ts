import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ReportService } from "./report.service";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { RolesGuard } from "../../common/auth/roles.guard";
import { Roles } from "../../common/auth/roles.decorator";
import { CurrentUser } from "../../common/auth/current-user.decorator";

@Controller('social')
@UseGuards(JwtAuthGuard)
export class ReportController {
	constructor(private readonly reportService: ReportService) {}

	@Post('reports')
	submitReport(@CurrentUser() user: any, @Body() body: any) {
		return this.reportService.submitReport(user.id, body);
	}

	@UseGuards(RolesGuard)
	@Roles('ADMIN', 'MODERATOR')
	@Get('moderation/reports')
	getModerationReports(@CurrentUser() user: any, @Query('status') status?: string, @Query('limit') limit?: string) {
		return this.reportService.listReports(user, status, Number(limit || 100));
	}

	@UseGuards(RolesGuard)
	@Roles('ADMIN', 'MODERATOR')
	@Patch('moderation/reports/:id')
	reviewModerationReport(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
		return this.reportService.reviewReport(user, Number(id), body);
	}

	@UseGuards(RolesGuard)
	@Roles('ADMIN', 'MODERATOR')
	@Patch('moderation/posts/:postId')
	moderateFeedPost(@CurrentUser() user: any, @Param('postId') postId: string, @Body() body: any) {
		return this.reportService.moderatePost(user, postId, body);
	}

	@UseGuards(RolesGuard)
	@Roles('ADMIN')
	@Get('admin/stats')
	getAdminStats(@CurrentUser() user: any) {
		return this.reportService.getAdminStats(user);
	}

	@UseGuards(RolesGuard)
	@Roles('ADMIN')
	@Get('admin/users')
	getModerationUsers(@CurrentUser() user: any, @Query('q') q?: string, @Query('limit') limit?: string) {
		return this.reportService.listUsers(user, q, Number(limit || 50));
	}

	@UseGuards(RolesGuard)
	@Roles('ADMIN')
	@Patch('admin/users/:userId')
	updateModerationUserById(@CurrentUser() user: any, @Param('userId') userId: string, @Body() body: any) {
		return this.reportService.updateUser(user, Number(userId), body);
	}
}