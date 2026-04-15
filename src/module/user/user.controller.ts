import { Body, Controller, Get, Post, Put, UseGuards } from "@nestjs/common";
import { UserService } from "./user.service";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { CurrentUser } from "../../common/auth/current-user.decorator";

@Controller('social')
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

    @Post('ai/support')
    aiSupport(@Body() body: { message: string }) {
        const input = String(body?.message || '').trim();
        return {
            message: 'AI support demo response',
            data: {
                original: input,
                suggestion:
                    'Bạn có thể kiểm tra lại từ khóa tìm kiếm, trạng thái kết nối và quyền truy cập tài khoản trước khi thao tác.',
            },
        };
    }
}