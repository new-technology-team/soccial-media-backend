import { Controller, Get, Param, Patch, Query, UseGuards } from "@nestjs/common";
import { NotificationService } from "./notification.service";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { CurrentUser } from "../../common/auth/current-user.decorator";

@Controller('social')
@UseGuards(JwtAuthGuard)
export class NotificationController {
	constructor(private readonly notificationService: NotificationService) {}

	@Get('notifications')
	getNotifications(@CurrentUser() user: any, @Query('limit') limit?: string) {
		return this.notificationService.listByUser(user.id, Number(limit || 50));
	}

	@Patch('notifications/:id/read')
	readNotification(@CurrentUser() user: any, @Param('id') id: string) {
		return this.notificationService.markRead(user.id, id);
	}

	@Patch('notifications/read-all')
	readAll(@CurrentUser() user: any) {
		return this.notificationService.markAllRead(user.id);
	}
}