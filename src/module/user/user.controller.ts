import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guard/jwt-auth.guard';
import { UserService } from './user.service';

@Controller('user')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private userService: UserService) {}

  @Get('settings')
  async getSettings(@Req() req: any) {
    const profile = await this.userService.findOne(req.user.sub);
    return {
      settings: {
        privacyLastSeen: Boolean(profile?.privacyLastSeen ?? true),
        privacyProfilePhoto: Boolean(profile?.privacyProfilePhoto ?? true),
        allowFriendRequests: Boolean(profile?.allowFriendRequests ?? true),
        notificationMessages: Boolean(profile?.notificationMessages ?? true),
        notificationCalls: Boolean(profile?.notificationCalls ?? true),
        updatedAt: new Date(),
      },
    };
  }

  @Put('settings')
  async saveSettings(@Req() req: any, @Body() body: any) {
    const current = await this.userService.findOne(req.user.sub);
    if (!current) {
      return { message: 'Không tìm thấy tài khoản' };
    }

    await this.userService.updateSettings(req.user.sub, {
      privacyLastSeen: body?.privacyLastSeen,
      privacyProfilePhoto: body?.privacyProfilePhoto,
      allowFriendRequests: body?.allowFriendRequests,
      notificationMessages: body?.notificationMessages,
      notificationCalls: body?.notificationCalls,
    });

    const updated = await this.userService.findOne(req.user.sub);
    return {
      message: 'Cập nhật cài đặt thành công',
      settings: {
        privacyLastSeen: Boolean(updated?.privacyLastSeen ?? true),
        privacyProfilePhoto: Boolean(updated?.privacyProfilePhoto ?? true),
        allowFriendRequests: Boolean(updated?.allowFriendRequests ?? true),
        notificationMessages: Boolean(updated?.notificationMessages ?? true),
        notificationCalls: Boolean(updated?.notificationCalls ?? true),
        updatedAt: new Date(),
      },
    };
  }
}
