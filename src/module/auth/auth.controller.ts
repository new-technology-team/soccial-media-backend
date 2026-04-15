
import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';

@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) { }

    @Post('login')
    login(@Body() loginDto: LoginDto) {
        return this.authService.login(loginDto);
    }

    @Post('register')
    register(@Body() registerDto: RegisterDto) {
        return this.authService.register(registerDto);
    }

    @Post('verify-registration')
    verifyRegistration(@Body() body: { emailOrPhone: string; code: string }) {
        return this.authService.verifyRegistration(body);
    }

    @Post('resend-verification')
    resendVerification(@Body() body: { emailOrPhone: string }) {
        return this.authService.resendVerificationCode(body);
    }

    @Post('forgot-password')
    forgotPassword(@Body() body: { emailOrPhone: string }) {
        return this.authService.forgotPassword(body);
    }

    @Post('reset-password')
    resetPassword(@Body() body: { emailOrPhone: string; code: string; newPassword: string }) {
        return this.authService.resetPassword(body);
    }

    @Post('desktop-login/request')
    createDesktopPairingRequest() {
        return this.authService.createDesktopPairingRequest();
    }

    @Get('desktop-login/request/:id')
    getDesktopPairingStatus(@Param('id') id: string, @Query('secret') secret: string) {
        return this.authService.getDesktopPairingStatus(Number(id), String(secret || ''));
    }

    @UseGuards(JwtAuthGuard)
    @Post('desktop-login/approve')
    approveDesktopPairing(@CurrentUser() user: any, @Body() body: { pairingCode: string }) {
        return this.authService.approveDesktopPairing(user.id, body?.pairingCode);
    }

    @Post('refresh')
    refresh(@Body() body: { refreshToken: string }) {
        return this.authService.refresh(body?.refreshToken);
    }

    @UseGuards(JwtAuthGuard)
    @Get('me')
    me(@CurrentUser() user: any) {
        return this.authService.me(user.id);
    }

    @UseGuards(JwtAuthGuard)
    @Put('me')
    updateProfile(@CurrentUser() user: any, @Body() body: any) {
        return this.authService.updateProfile(user.id, body);
    }

    @UseGuards(JwtAuthGuard)
    @Post('change-password')
    changePassword(@CurrentUser() user: any, @Body() body: { currentPassword: string; newPassword: string }) {
        return this.authService.changePassword(user.id, body?.currentPassword, body?.newPassword);
    }

    @UseGuards(JwtAuthGuard)
    @Post('logout')
    logout(@CurrentUser() user: any) {
        return this.authService.logout(user.id);
    }

    @UseGuards(JwtAuthGuard)
    @Post('avatar-upload-url')
    avatarUploadUrl(@CurrentUser() user: any, @Body() body: { fileName: string; contentType: string }) {
        return this.authService.getAvatarUploadUrl(user.id, body);
    }

    @UseGuards(JwtAuthGuard)
    @Post('avatar-upload-base64')
    avatarUploadBase64(
        @CurrentUser() user: any,
        @Body() body: { fileName: string; contentType: string; base64Data: string },
    ) {
        return this.authService.uploadAvatarBase64(user.id, body);
    }
}
