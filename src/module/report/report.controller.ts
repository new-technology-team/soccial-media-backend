import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
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

	@Get('admin/dashboard')
	getAdminDashboardLegacy(@CurrentUser() user: any) {
		return this.reportService.getAdminDashboard(user);
	}

	@Get('admin/moderators')
	getModeratorsLegacy(@CurrentUser() user: any) {
		return this.reportService.listModerators(user);
	}

	@Post('admin/moderators')
	createModeratorLegacy(@CurrentUser() user: any, @Body() body: any) {
		return this.reportService.createModerator(user, body);
	}

	@Delete('admin/moderators/:id')
	deleteModeratorLegacy(@CurrentUser() user: any, @Param('id') id: string) {
		return this.reportService.deleteUser(user, Number(id));
	}

	@Patch('admin/moderators/:id/permissions')
	updateModeratorPermissionsLegacy(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
		return this.reportService.updateModeratorPermissions(user, Number(id), body);
	}

	@Get('admin/reports')
	getAdminReportsLegacy(@CurrentUser() user: any, @Query('status') status?: string) {
		return this.reportService.listReports(user, status, 200);
	}

	@Patch('admin/reports/:id/assign')
	assignReportLegacy(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
		return this.reportService.assignReport(user, Number(id), body);
	}

	@Get('admin/statistics')
	getAdminStatisticsLegacy(@CurrentUser() user: any) {
		return this.reportService.getAdminStats(user);
	}

	@Get('admin/audit-logs')
	getAuditLogsLegacy(@CurrentUser() user: any, @Query('limit') limit?: string) {
		return this.reportService.listAuditLogs(user, Number(limit || 100));
	}

	@Get('moderator/dashboard')
	getModeratorDashboardLegacy(@CurrentUser() user: any) {
		return this.reportService.getModeratorDashboard(user);
	}

	@Get('moderator/reports/:id')
	getModeratorReportLegacy(@CurrentUser() user: any, @Param('id') id: string) {
		return this.reportService.getReport(user, Number(id));
	}

	@Patch('moderator/reports/:id/status')
	updateModeratorReportStatusLegacy(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
		return this.reportService.reviewReport(user, Number(id), body);
	}

	@Patch('moderator/posts/:id/hide')
	hideModeratorPostLegacy(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
		return this.reportService.moderatePost(user, id, { ...body, status: 'hidden' });
	}

	@Delete('moderator/posts/:id')
	deleteModeratorPostLegacy(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
		return this.reportService.moderatePost(user, id, { ...body, status: 'deleted' });
	}

	@Patch('moderator/users/:id/warn')
	warnModeratorUserLegacy(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
		return this.reportService.warnUser(user, Number(id), body?.reason);
	}

	@Patch('moderator/users/:id/restrict')
	restrictModeratorUserLegacy(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
		return this.reportService.restrictUser(user, Number(id), body?.reason);
	}

	@Patch('moderator/users/:id/temp-lock')
	tempLockModeratorUserLegacy(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
		return this.reportService.tempLockUser(user, Number(id), body?.reason);
	}
}
