import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import * as bcryptjs from 'bcryptjs';
import { PostService } from '../post/post.service';
import { CommentService } from '../comment/comment.service';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private postService: PostService,
    private commentService: CommentService,
  ) {}

  async validateUser(identifier: string, password: string) {
    // Try username first, then email, then phone
    let user = await this.userService.findOneByUsername(identifier);
    if (!user) {
      user = await this.userService.findOneByEmail(identifier);
    }
    if (!user) {
      user = await this.userService.findOneByPhone(identifier);
    }
    if (!user) return null;

    const isPasswordValid = await bcryptjs.compare(password, user.password);
    if (!isPasswordValid) return null;
    return {
      userId: user.userId,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      role: user.role,
    };
  }

  async login(loginDto: LoginDto) {
    const identifier = loginDto.emailOrPhone;
    const user = await this.validateUser(identifier, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không đúng');
    }

    const payload = { sub: user.userId, username: user.username };
    const accessToken = await this.jwtService.signAsync(payload);
    const refreshToken = await this.jwtService.signAsync(payload, {
      secret:
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'secretKey',
      expiresIn: '7d',
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.userId,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        role: user.role,
      },
    };
  }

  async register(registerDto: RegisterDto) {
    // Handle emailOrPhone from mobile app
    const emailOrPhone = registerDto.emailOrPhone || registerDto.email || '';
    const isEmail = emailOrPhone.includes('@');

    const email = isEmail
      ? emailOrPhone
      : `${emailOrPhone.replace(/\D/g, '')}@phone.local`;
    const username =
      registerDto.username ||
      (isEmail ? emailOrPhone.split('@')[0] : `user_${Date.now()}`);

    const existingByEmail = await this.userService.findOneByEmail(email);
    if (existingByEmail) {
      throw new ConflictException('Email đã được sử dụng');
    }

    const existingByUsername =
      await this.userService.findOneByUsername(username);
    if (existingByUsername) {
      throw new ConflictException('Tên đăng nhập đã được sử dụng');
    }

    const hashedPassword = await bcryptjs.hash(registerDto.password, 10);
    const newUser = await this.userService.create({
      username,
      email,
      password: hashedPassword,
      fullName: registerDto.fullName,
      phone: isEmail ? registerDto.phone || '' : emailOrPhone,
    });

    const payload = { sub: newUser.userId, username: newUser.username };
    const accessToken = await this.jwtService.signAsync(payload);
    const refreshToken = await this.jwtService.signAsync(payload, {
      secret:
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'secretKey',
      expiresIn: '7d',
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: newUser.userId,
        username: newUser.username,
        email: newUser.email,
        fullName: newUser.fullName,
        avatarUrl: newUser.avatarUrl,
        role: newUser.role,
      },
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret:
          process.env.JWT_REFRESH_SECRET ||
          process.env.JWT_SECRET ||
          'secretKey',
      });

      const user = await this.userService.findOne(payload.sub);
      if (!user) {
        throw new UnauthorizedException('Token không hợp lệ');
      }

      const newPayload = { sub: user.userId, username: user.username };
      const accessToken = await this.jwtService.signAsync(newPayload);
      const newRefreshToken = await this.jwtService.signAsync(newPayload, {
        secret:
          process.env.JWT_REFRESH_SECRET ||
          process.env.JWT_SECRET ||
          'secretKey',
        expiresIn: '7d',
      });

      return {
        access_token: accessToken,
        refresh_token: newRefreshToken,
      };
    } catch {
      throw new UnauthorizedException(
        'Refresh token không hợp lệ hoặc đã hết hạn',
      );
    }
  }

  async getMe(userId: number) {
    const user = await this.userService.findOne(userId);
    if (!user) {
      throw new UnauthorizedException('Người dùng không tồn tại');
    }

    return {
      id: user.userId,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      sex: user.sex,
      dateOfBirth: user.dateOfBirth
        ? String(user.dateOfBirth).split('T')[0]
        : null,
      phone: user.phone,
      role: user.role,
    };
  }

  async updateMe(
    userId: number,
    data: {
      fullName?: string;
      avatarUrl?: string;
      dateOfBirth?: string | null;
      gender?: string | null;
    },
  ) {
    const user = await this.userService.findOne(userId);
    if (!user) {
      throw new UnauthorizedException('Người dùng không tồn tại');
    }

    const normalizeGender = (value?: string | null) => {
      const lower = String(value || '')
        .trim()
        .toLowerCase();

      if (['male', 'nam', 'm'].includes(lower)) return 1;
      if (['female', 'nu', 'n', 'f'].includes(lower)) return 2;
      if (['other', 'khac', 'o'].includes(lower)) return 0;
      return undefined;
    };

    const sex = normalizeGender(data.gender);

    const updated = await this.userService.update(userId, {
      fullName: data.fullName,
      avatarUrl: data.avatarUrl,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
      sex,
    });

    try {
      await this.postService.syncAuthorProfile(
        updated.userId,
        updated.fullName,
        updated.avatarUrl || '',
      );
      await this.commentService.syncAuthorProfile(
        updated.userId,
        updated.fullName,
        updated.avatarUrl || '',
      );
    } catch {
      /* ignore sync errors */
    }

    return {
      id: updated.userId,
      username: updated.username,
      email: updated.email,
      fullName: updated.fullName,
      avatarUrl: updated.avatarUrl,
      sex: updated.sex,
      dateOfBirth: updated.dateOfBirth
        ? String(updated.dateOfBirth).split('T')[0]
        : null,
      phone: updated.phone,
      role: updated.role,
    };
  }

  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.userService.findOne(userId);
    if (!user) {
      throw new UnauthorizedException('Người dùng không tồn tại');
    }

    const isValid = await bcryptjs.compare(currentPassword, user.password);
    if (!isValid) {
      throw new UnauthorizedException('Mật khẩu hiện tại không đúng');
    }

    const hashed = await bcryptjs.hash(newPassword, 10);
    await this.userService.update(userId, { password: hashed });
  }
}
