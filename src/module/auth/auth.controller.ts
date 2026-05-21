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
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from '../../common/guard/jwt-auth.guard';
import { promises as fs } from 'fs';
import { extname, join } from 'path';

@Controller('api/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('register')
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() body: { refreshToken: string }) {
    return this.authService.refreshToken(body.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@Req() req: any) {
    return this.authService.getMe(req.user.sub);
  }

  @Put('me')
  @UseGuards(JwtAuthGuard)
  updateMe(@Req() req: any, @Body() body: any) {
    return this.authService.updateMe(req.user.sub, body);
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
    const base64Raw = String(body?.base64Data || '').trim();
    if (!base64Raw) {
      throw new BadRequestException('Thieu base64Data');
    }

    const base64Payload = base64Raw.includes(',')
      ? base64Raw.split(',').pop() || ''
      : base64Raw;

    const buffer = Buffer.from(base64Payload, 'base64');
    if (!buffer.length) {
      throw new BadRequestException('Du lieu anh khong hop le');
    }
    if (buffer.length > 6 * 1024 * 1024) {
      throw new BadRequestException('Kich thuoc anh qua lon (toi da 6MB)');
    }

    const requestedExt = extname(String(body?.fileName || '')).toLowerCase();
    const extFromContentType = String(body?.contentType || '')
      .toLowerCase()
      .includes('png')
      ? '.png'
      : '.jpg';
    const fileExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(requestedExt)
      ? requestedExt
      : extFromContentType;

    const userId = Number(req?.user?.sub || 0);
    if (!userId) {
      throw new BadRequestException('Khong xac dinh duoc user');
    }

    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${fileExt}`;
    const relativeDir = join('uploads', 'avatars', String(userId));
    const absoluteDir = join(process.cwd(), relativeDir);
    await fs.mkdir(absoluteDir, { recursive: true });

    const absolutePath = join(absoluteDir, fileName);
    await fs.writeFile(absolutePath, buffer);

    const fileUrl = `/${relativeDir.replace(/\\/g, '/')}/${fileName}`;
    return { fileUrl };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  logout() {
    return { message: 'Đăng xuất thành công' };
  }
}
