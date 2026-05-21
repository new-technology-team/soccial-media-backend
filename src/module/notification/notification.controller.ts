import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../../common/guard/jwt-auth.guard';

@Controller('api/social')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get('notifications')
  @UseGuards(JwtAuthGuard)
  async listNotifications(@Req() req: any) {
    const notifications = await this.notificationService.findByUser(
      req.user.sub,
    );
    return {
      notifications: notifications.map((n) => ({
        id: String(n._id),
        userId: n.userId,
        title: n.title,
        body: n.content,
        link: n.link,
        isRead: n.isRead,
        is_read: n.isRead,
        createdAt: n.createdAt?.toISOString?.() ?? new Date().toISOString(),
      })),
    };
  }

  @Patch('notifications/:id/read')
  @UseGuards(JwtAuthGuard)
  markRead(@Param('id') id: string) {
    return this.notificationService.markRead(id);
  }

  @Patch('notifications/read-all')
  @UseGuards(JwtAuthGuard)
  markAllRead(@Req() req: any) {
    return this.notificationService.markAllRead(req.user.sub);
  }
}
