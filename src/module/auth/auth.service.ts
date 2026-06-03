import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcryptjs from 'bcryptjs';
import { Repository } from 'typeorm';
import { PostService } from '../post/post.service';
import { CommentService } from '../comment/comment.service';
import { UserService } from '../user/user.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthOtp } from './auth-otp.entity';

type AuthUserLike = {
  userId: number;
  username: string;
  email: string;
  fullName: string;
  avatarUrl?: string | null;
  role?: string | null;
  status?: string | null;
  phone?: string | null;
};

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(AuthOtp, 'mariadb')
    private readonly authOtpRepo: Repository<AuthOtp>,
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly postService: PostService,
    private readonly commentService: CommentService,
  ) {}

  private normalizeIdentifier(raw: string) {
    const value = String(raw || '').trim();
    if (!value) return '';
    if (value.includes('@')) return value.toLowerCase();
    return value.replace(/\s+/g, '');
  }

  private isEmailIdentifier(identifier: string) {
    return String(identifier || '').includes('@');
  }

  private async findUserByIdentifier(emailOrPhone: string) {
    const identifier = this.normalizeIdentifier(emailOrPhone);
    if (!identifier) return null;

    if (this.isEmailIdentifier(identifier)) {
      return this.userService.findOneByEmail(identifier);
    }

    const [byPhone, byEmail, byUsername] = await Promise.all([
      this.userService.findOneByPhone(identifier),
      this.userService.findOneByEmail(
        `${identifier.replace(/\D/g, '')}@phone.local`,
      ),
      this.userService.findOneByUsername(identifier),
    ]);

    return byPhone || byEmail || byUsername || null;
  }

  private toAuthUser(user: AuthUserLike) {
    return {
      id: user.userId,
      userId: user.userId,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl || '',
      role: user.role || 'USER',
      phone: user.phone || '',
      isVerified: true,
      accountStatus: String(user.status || 'ACTIVE').toLowerCase(),
    };
  }

  private async issueTokens(user: AuthUserLike) {
    const payload = { sub: user.userId, username: user.username };
    const accessToken = await this.jwtService.signAsync(payload);
    const refreshToken = await this.jwtService.signAsync(payload, {
      secret:
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'secretKey',
      expiresIn: '7d',
    });
    return { accessToken, refreshToken };
  }

  private async buildAuthResponse(user: AuthUserLike) {
    const { accessToken, refreshToken } = await this.issueTokens(user);
    const authUser = this.toAuthUser(user);

    // Keep both snake_case and camelCase for compatibility (mobile + web).
    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      accessToken,
      refreshToken,
      user: authUser,
    };
  }

  private generateOtpCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  private async issueOtp(identifier: string, purpose: string) {
    const normalizedIdentifier = this.normalizeIdentifier(identifier);
    if (!normalizedIdentifier) {
      throw new BadRequestException('Identifier khong hop le');
    }

    const code = this.generateOtpCode();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);

    await this.authOtpRepo.save(
      this.authOtpRepo.create({
        identifier: normalizedIdentifier,
        purpose,
        code,
        createdAt: now,
        expiresAt,
        usedAt: null,
      }),
    );

    return code;
  }

  private async consumeOtp(
    identifier: string,
    purpose: string,
    code: string,
    allowDevFallback = false,
  ) {
    const normalizedIdentifier = this.normalizeIdentifier(identifier);
    const normalizedCode = String(code || '').trim();
    if (!normalizedIdentifier || !normalizedCode) return false;

    const now = new Date();
    const record = await this.authOtpRepo
      .createQueryBuilder('otp')
      .where('otp.identifier = :identifier', { identifier: normalizedIdentifier })
      .andWhere('otp.purpose = :purpose', { purpose })
      .andWhere('otp.code = :code', { code: normalizedCode })
      .andWhere('otp.usedAt IS NULL')
      .andWhere('otp.expiresAt > :now', { now })
      .orderBy('otp.id', 'DESC')
      .getOne();

    if (!record) {
      if (allowDevFallback && process.env.NODE_ENV !== 'production') {
        return normalizedCode === '000000';
      }
      return false;
    }

    record.usedAt = now;
    await this.authOtpRepo.save(record);
    return true;
  }

  async validateUser(identifier: string, password: string) {
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
    if (String(user.status || '').toUpperCase() !== 'ACTIVE') return null;
    return user;
  }

  async login(loginDto: LoginDto) {
    const identifier = loginDto.emailOrPhone;
    const user = await this.validateUser(identifier, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không đúng');
    }

    return this.buildAuthResponse(user);
  }

  async register(registerDto: RegisterDto) {
    const emailOrPhone = registerDto.emailOrPhone || registerDto.email || '';
    const isEmail = emailOrPhone.includes('@');

    const email = isEmail
      ? emailOrPhone.trim().toLowerCase()
      : `${emailOrPhone.replace(/\D/g, '')}@phone.local`;
    const username =
      registerDto.username ||
      (isEmail
        ? emailOrPhone.split('@')[0]
        : `user_${Date.now()}_${Math.floor(Math.random() * 1000)}`);

    const existingByEmail = await this.userService.findOneByEmail(email);
    if (existingByEmail) {
      throw new ConflictException('Email đã được sử dụng');
    }

    const existingByUsername = await this.userService.findOneByUsername(username);
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
      dateOfBirth: registerDto.dateOfBirth || undefined,
      sex: Number.isFinite(Number(registerDto.sex))
        ? Number(registerDto.sex)
        : 0,
    });

    return this.buildAuthResponse(newUser);
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

      return this.buildAuthResponse(user);
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
    if (String(user.status || '').toUpperCase() !== 'ACTIVE') {
      throw new UnauthorizedException('Tai khoan da bi vo hieu');
    }

    return this.toAuthUser({
      ...user,
      status: user.status,
      phone: user.phone,
    } as AuthUserLike);
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
    if (String(user.status || '').toUpperCase() !== 'ACTIVE') {
      throw new UnauthorizedException('Tai khoan da bi vo hieu');
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

    return this.toAuthUser({
      ...updated,
      status: updated.status,
      phone: updated.phone,
    } as AuthUserLike);
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
    if (String(user.status || '').toUpperCase() !== 'ACTIVE') {
      throw new UnauthorizedException('Tai khoan da bi vo hieu');
    }

    const isValid = await bcryptjs.compare(currentPassword, user.password);
    if (!isValid) {
      throw new UnauthorizedException('Mật khẩu hiện tại không đúng');
    }

    const hashed = await bcryptjs.hash(newPassword, 10);
    await this.userService.update(userId, { password: hashed });
    return { message: 'Doi mat khau thanh cong' };
  }

  async deleteAccount(userId: number, currentPassword: string) {
    const user = await this.userService.findOne(userId);
    if (!user) {
      throw new UnauthorizedException('Người dùng không tồn tại');
    }
    if (String(user.status || '').toUpperCase() !== 'ACTIVE') {
      throw new UnauthorizedException('Tai khoan da bi vo hieu');
    }

    const isValid = await bcryptjs.compare(currentPassword, user.password);
    if (!isValid) {
      throw new UnauthorizedException('Mật khẩu hiện tại không đúng');
    }

    await this.userService.deactivateAccount(userId);
    return { message: 'Tai khoan da duoc xoa' };
  }

  async resendVerificationCode(emailOrPhone: string) {
    const identifier = this.normalizeIdentifier(emailOrPhone);
    if (!identifier) {
      throw new BadRequestException('Email hoac so dien thoai khong hop le');
    }

    const code = await this.issueOtp(identifier, 'register');
    return {
      message: 'Da gui ma xac thuc',
      otpSent: true,
      otpChannel: this.isEmailIdentifier(identifier) ? 'email' : 'sms',
      otpDestination: identifier,
      verificationCode: process.env.NODE_ENV === 'production' ? undefined : code,
    };
  }

  async verifyRegistration(emailOrPhone: string, code: string) {
    const identifier = this.normalizeIdentifier(emailOrPhone);
    if (!identifier) {
      throw new BadRequestException('Email hoac so dien thoai khong hop le');
    }

    const ok = await this.consumeOtp(identifier, 'register', code, true);
    if (!ok) {
      throw new UnauthorizedException('Ma xac thuc khong hop le hoac da het han');
    }

    const user = await this.findUserByIdentifier(identifier);
    if (!user) {
      throw new NotFoundException('Khong tim thay tai khoan de xac thuc');
    }

    return this.buildAuthResponse(user);
  }

  async forgotPassword(emailOrPhone: string) {
    const identifier = this.normalizeIdentifier(emailOrPhone);
    if (!identifier) {
      throw new BadRequestException('Email hoac so dien thoai khong hop le');
    }

    const user = await this.findUserByIdentifier(identifier);
    if (!user) {
      // Keep generic response for security.
      return {
        message: 'Neu tai khoan ton tai, ma dat lai mat khau da duoc gui',
        otpSent: true,
      };
    }

    const code = await this.issueOtp(identifier, 'reset_password');
    return {
      message: 'Da gui ma dat lai mat khau',
      otpSent: true,
      otpChannel: this.isEmailIdentifier(identifier) ? 'email' : 'sms',
      otpDestination: identifier,
      resetCode: process.env.NODE_ENV === 'production' ? undefined : code,
    };
  }

  async resetPassword(
    emailOrPhone: string,
    code: string,
    newPassword: string,
  ) {
    const identifier = this.normalizeIdentifier(emailOrPhone);
    if (!identifier) {
      throw new BadRequestException('Email hoac so dien thoai khong hop le');
    }

    if (String(newPassword || '').length < 6) {
      throw new BadRequestException('Mat khau moi phai co it nhat 6 ky tu');
    }

    const user = await this.findUserByIdentifier(identifier);
    if (!user) {
      throw new NotFoundException('Khong tim thay tai khoan');
    }

    const ok = await this.consumeOtp(identifier, 'reset_password', code, true);
    if (!ok) {
      throw new UnauthorizedException(
        'Ma dat lai mat khau khong hop le hoac da het han',
      );
    }

    const hashed = await bcryptjs.hash(newPassword, 10);
    await this.userService.update(user.userId, { password: hashed });

    return { message: 'Dat lai mat khau thanh cong' };
  }
}
