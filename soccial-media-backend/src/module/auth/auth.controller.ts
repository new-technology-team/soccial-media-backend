import {
  Body,
  Controller,
  Post,
  Get,
  Put,
  UseGuards,
  Req,
  HttpCode,
  BadRequestException,
  Res,
  Query,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { OAuth2Client } from 'google-auth-library';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from '../../common/guard/jwt-auth.guard';
import { MediaService } from '../media/media.service';

@Controller('api/auth')
export class AuthController {
  private googleClient: OAuth2Client;

  constructor(
    private authService: AuthService,
    private readonly mediaService: MediaService,
  ) {
    this.googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  }

  @Get('google/id-token/exchange')
  async exchangeGoogleIdToken(@Req() req: any) {
    const idToken = String(req.query.idToken || '').trim();
    if (!idToken) throw new BadRequestException('Thieu idToken');

    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        throw new BadRequestException('Token Google khong hop le');
      }
      return this.authService.handleGoogleLogin({
        email: payload.email,
        fullName: payload.name || payload.email.split('@')[0],
        avatarUrl: payload.picture || null,
      });
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException('Xac thuc Google that bai');
    }
  }

  @Get('check-username')
  checkUsername(@Query('username') username: string) {
    return this.authService.checkUsername(username);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('register')
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('verify-registration')
  verifyRegistration(
    @Body() body: { emailOrPhone: string; code: string },
  ) {
    return this.authService.verifyRegistration(body.emailOrPhone, body.code);
  }

  @Post('resend-verification')
  resendVerification(@Body() body: { emailOrPhone: string }) {
    return this.authService.resendVerificationCode(body.emailOrPhone);
  }

  @Post('forgot-password')
  forgotPassword(@Body() body: { emailOrPhone: string }) {
    return this.authService.forgotPassword(body.emailOrPhone);
  }

  @Post('reset-password')
  resetPassword(
    @Body() body: { emailOrPhone: string; code: string; newPassword: string },
  ) {
    return this.authService.resetPassword(
      body.emailOrPhone,
      body.code,
      body.newPassword,
    );
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() body: { refreshToken: string }) {
    return this.authService.refreshToken(body.refreshToken);
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleLogin() {
    // Redirect to Google
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: any, @Res() res: any) {
    const googleUser = req.user
    const result = await this.authService.handleGoogleLogin(googleUser)
    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8088'
    const params = new URLSearchParams({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    })
    res.redirect(`${FRONTEND_URL}/auth/social-callback?${params.toString()}`)
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Req() req: any) {
    const user = await this.authService.getMe(req.user.sub);
    return { user };
  }

  @Put('me')
  @UseGuards(JwtAuthGuard)
  async updateMe(@Req() req: any, @Body() updateProfileDto: UpdateProfileDto) {
    const user = await this.authService.updateMe(req.user.sub, updateProfileDto);
    return { message: 'Cap nhat ho so thanh cong', user };
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  changePassword(
    @Req() req: any,
    @Body() body: { currentPassword: string; newPassword: string },
  ) {
    return this.authService.changePassword(
      req.user.sub,
      body.currentPassword,
      body.newPassword,
    );
  }

  @Post('delete-account')
  @UseGuards(JwtAuthGuard)
  deleteAccount(@Req() req: any, @Body() body: { currentPassword: string }) {
    return this.authService.deleteAccount(req.user.sub, body.currentPassword);
  }

  @Post('avatar-upload-base64')
  @UseGuards(JwtAuthGuard)
  async uploadAvatarBase64(
    @Req() req: any,
    @Body()
    body: {
      fileName?: string;
      contentType?: string;
      base64Data?: string;
    },
  ) {
    const userId = Number(req?.user?.sub || 0);
    if (!userId) {
      throw new BadRequestException('Khong xac dinh duoc user');
    }
    const result = await this.mediaService.uploadBase64(userId, 'avatar', body);
    return { fileUrl: result.fileUrl };
  }

  @Post('cover-upload-base64')
  @UseGuards(JwtAuthGuard)
  async uploadCoverBase64(
    @Req() req: any,
    @Body()
    body: {
      fileName?: string;
      contentType?: string;
      base64Data?: string;
    },
  ) {
    const userId = Number(req?.user?.sub || 0);
    if (!userId) {
      throw new BadRequestException('Khong xac dinh duoc user');
    }
    const result = await this.mediaService.uploadBase64(userId, 'cover', body);

    // Persist coverUrl to user record so it survives refresh/logout
    const user = await this.authService.updateCoverUrl(userId, result.fileUrl);

    return { fileUrl: result.fileUrl, user };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  logout() {
    return { message: 'Đăng xuất thành công' };
  }
}
