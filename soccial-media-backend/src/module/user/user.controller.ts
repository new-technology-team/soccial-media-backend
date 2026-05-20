import { Controller } from '@nestjs/common';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
    constructor(private userService: UserService) { }

    @UseGuards(JwtAuthGuard)
    @Get('settings')
    async getSettings(@CurrentUser() user: any) {
        const profile = await this.userService.findOne(user.id);
        return {
            settings: {
                privacyLastSeen: Boolean(profile?.privacyLastSeen),
                privacyProfilePhoto: Boolean(profile?.privacyProfilePhoto),
                allowFriendRequests: Boolean(profile?.allowFriendRequests),
                notificationMessages: Boolean(profile?.notificationMessages),
                notificationCalls: Boolean(profile?.notificationCalls),
                updatedAt: new Date(),
            },
        };
    }

    @UseGuards(JwtAuthGuard)
    @Put('settings')
    async saveSettings(@CurrentUser() user: any, @Body() body: any) {
        const current = await this.userService.findOne(user.id);
        if (!current) {
            return { message: 'Không tìm thấy tài khoản' };
        }
        await this.userService.updateSettings(user.id, {
            privacyLastSeen: body?.privacyLastSeen,
            privacyProfilePhoto: body?.privacyProfilePhoto,
            allowFriendRequests: body?.allowFriendRequests,
            notificationMessages: body?.notificationMessages,
            notificationCalls: body?.notificationCalls,
        });

        const updated = await this.userService.findOne(user.id);
        return {
            message: 'Cập nhật cài đặt thành công',
            settings: {
                privacyLastSeen: Boolean(updated?.privacyLastSeen),
                privacyProfilePhoto: Boolean(updated?.privacyProfilePhoto),
                allowFriendRequests: Boolean(updated?.allowFriendRequests),
                notificationMessages: Boolean(updated?.notificationMessages),
                notificationCalls: Boolean(updated?.notificationCalls),
                updatedAt: new Date(),
            },
        };
    }


}