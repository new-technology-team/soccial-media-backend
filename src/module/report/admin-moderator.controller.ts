import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { ReportService } from './report.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class AdminModeratorController {
  constructor(private readonly reportService: ReportService) {}

  @Get('admin/dashboard')
  getAdminDashboard(@CurrentUser() user: any) {
    return this.reportService.getAdminDashboard(user);
  }

  @Get('admin/users')
  getAdminUsers(@CurrentUser() user: any, @Query('q') q?: string, @Query('limit') limit?: string) {
    return this.reportService.listUsers(user, q, Number(limit || 200));
  }

  @Get('admin/users/:id')
  getAdminUser(@CurrentUser() user: any, @Param('id') id: string) {
    return this.reportService.listUsers(user, String(id), 1);
  }

  @Patch('admin/users/:id/status')
  updateAdminUserStatus(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    return this.reportService.updateUser(user, Number(id), body);
  }

  @Delete('admin/users/:id')
  deleteAdminUser(@CurrentUser() user: any, @Param('id') id: string) {
    return this.reportService.deleteUser(user, Number(id));
  }

  @Get('admin/moderators')
  getModerators(@CurrentUser() user: any) {
    return this.reportService.listModerators(user);
  }

  @Post('admin/moderators')
  createModerator(@CurrentUser() user: any, @Body() body: any) {
    return this.reportService.createModerator(user, body);
  }

  @Delete('admin/moderators/:id')
  deleteModerator(@CurrentUser() user: any, @Param('id') id: string) {
    return this.reportService.deleteUser(user, Number(id));
  }

  @Patch('admin/moderators/:id/permissions')
  updateModeratorPermissions(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    return this.reportService.updateModeratorPermissions(user, Number(id), body);
  }

  @Get('admin/reports')
  getAdminReports(@CurrentUser() user: any, @Query('status') status?: string) {
    return this.reportService.listReports(user, status, 200);
  }

  @Patch('admin/reports/:id/assign')
  assignReport(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    return this.reportService.assignReport(user, Number(id), body);
  }

  @Get('admin/statistics')
  getStatistics(@CurrentUser() user: any) {
    return this.reportService.getAdminStats(user);
  }

  @Get('admin/audit-logs')
  getAuditLogs(@CurrentUser() user: any, @Query('limit') limit?: string) {
    return this.reportService.listAuditLogs(user, Number(limit || 100));
  }

  @Get('admin/settings')
  getAdminSettings(@CurrentUser() user: any) {
    return this.reportService.getSystemSettings(user);
  }

  @Patch('admin/settings')
  updateAdminSettings(@CurrentUser() user: any, @Body() body: any) {
    return this.reportService.updateSystemSettings(user, body);
  }

  @Get('moderator/dashboard')
  getModeratorDashboard(@CurrentUser() user: any) {
    return this.reportService.getModeratorDashboard(user);
  }

  @Get('moderator/reports')
  getModeratorReports(@CurrentUser() user: any, @Query('status') status?: string) {
    return this.reportService.listReports(user, status, 200);
  }

  @Get('moderator/reports/:id')
  getModeratorReport(@CurrentUser() user: any, @Param('id') id: string) {
    return this.reportService.getReport(user, Number(id));
  }

  @Patch('moderator/reports/:id/assign')
  assignModeratorReport(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    return this.reportService.assignReport(user, Number(id), body);
  }

  @Patch('moderator/reports/:id/status')
  updateModeratorReportStatus(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    return this.reportService.reviewReport(user, Number(id), body);
  }

  @Patch('moderator/posts/:id/hide')
  hideModeratorPost(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    return this.reportService.moderatePost(user, id, { ...body, status: 'hidden' });
  }

  @Delete('moderator/posts/:id')
  deleteModeratorPost(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    return this.reportService.moderatePost(user, id, { ...body, status: 'deleted' });
  }

  @Patch('moderator/users/:id/warn')
  warnModeratorUser(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    return this.reportService.warnUser(user, Number(id), body?.reason);
  }

  @Patch('moderator/users/:id/restrict')
  restrictModeratorUser(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    return this.reportService.restrictUser(user, Number(id), body?.reason);
  }

  @Patch('moderator/users/:id/temp-lock')
  tempLockModeratorUser(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    return this.reportService.tempLockUser(user, Number(id), body?.reason);
  }

  @Patch('moderator/users/:id/restore')
  restoreModeratorUser(@CurrentUser() user: any, @Param('id') id: string) {
    return this.reportService.restoreUser(user, Number(id));
  }

  @Get('moderator/users')
  getModeratorUsers(@CurrentUser() user: any, @Query('q') q?: string, @Query('limit') limit?: string) {
    return this.reportService.listUsers(user, q, Number(limit || 50));
  }
}
