import { BadRequestException, Body, Controller, Get, Param, Post, Put, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';

@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) { }

    private getApiBaseUrl() {
        return String(process.env.API_PUBLIC_URL || process.env.BACKEND_PUBLIC_URL || 'http://localhost:5000/api').replace(/\/$/, '');
    }

    private getGoogleCallbackUrl() {
        return String(process.env.GOOGLE_CALLBACK_URL || `${this.getApiBaseUrl()}/auth/google/callback`);
    }

    private getSocialAuthUrl(provider: 'google') {
        const explicitUrl = String(process.env.GOOGLE_AUTH_URL || '').trim();
        if (explicitUrl) return explicitUrl;

        const clientId = String(process.env.GOOGLE_CLIENT_ID || '').trim();
        if (!clientId) return '';

        const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: this.getGoogleCallbackUrl(),
            response_type: 'code',
            scope: 'openid email profile',
            prompt: 'select_account',
            state: 'google',
        });
        return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    }

    private redirectToSocialProvider(provider: 'google', response: Response, redirectOnError?: string) {
        const url = this.getSocialAuthUrl(provider);
        if (!url) {
            if (redirectOnError) {
                const separator = redirectOnError.includes('?') ? '&' : '?';
                return response.redirect(`${redirectOnError}${separator}socialError=missing-config`);
            }

            const envName = 'GOOGLE_CLIENT_ID hoặc GOOGLE_AUTH_URL';
            throw new BadRequestException(`Chưa cấu hình ${envName} cho đăng nhập ${provider}`);
        }

        return response.redirect(url);
    }

    private redirectWithAuthPayload(response: Response, payload: any) {
        const frontendUrl = String(process.env.FRONTEND_URL || process.env.WEB_PUBLIC_URL || 'http://localhost:8088').replace(/\/$/, '');
        const params = new URLSearchParams({
            accessToken: payload.accessToken,
            refreshToken: payload.refreshToken,
            user: JSON.stringify(payload.user),
        });
        return response.redirect(`${frontendUrl}/auth/social-callback#${params.toString()}`);
    }

    private redirectSocialError(response: Response, provider: 'google', error: unknown) {
        const frontendUrl = String(process.env.FRONTEND_URL || process.env.WEB_PUBLIC_URL || 'http://localhost:8088').replace(/\/$/, '');
        const message = error instanceof Error ? error.message : 'callback-failed';
        const params = new URLSearchParams({
            socialError: 'callback',
            socialProvider: provider,
            socialDetail: message.slice(0, 160),
        });
        return response.redirect(`${frontendUrl}/auth/login?${params.toString()}`);
    }

    @Post('login')
    login(@Body() loginDto: LoginDto) {
        return this.authService.login(loginDto);
    }

    @Get('google')
    loginWithGoogle(@Res() response: Response, @Query('redirectOnError') redirectOnError?: string) {
        return this.redirectToSocialProvider('google', response, redirectOnError);
    }

    @Get('google/callback')
    async googleCallback(@Query('code') code: string, @Res() response: Response) {
        try {
            const payload = await this.authService.loginWithGoogleCode(String(code || ''));
            return this.redirectWithAuthPayload(response, payload);
        } catch (error) {
            return this.redirectSocialError(response, 'google', error);
        }
    }

    @Get('google/exchange')
    async googleExchange(@Query('code') code: string) {
        return this.authService.loginWithGoogleCode(String(code || ''));
    }

    @Get('google/id-token')
    async googleIdTokenCallback(@Query('idToken') idToken: string, @Res() response: Response) {
        try {
            const payload = await this.authService.loginWithGoogleIdToken(String(idToken || ''));
            return this.redirectWithAuthPayload(response, payload);
        } catch (error) {
            return this.redirectSocialError(response, 'google', error);
        }
    }

    @Get('google/id-token/exchange')
    async googleIdTokenExchange(@Query('idToken') idToken: string) {
        return this.authService.loginWithGoogleIdToken(String(idToken || ''));
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
