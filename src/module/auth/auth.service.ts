
import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UserStatus } from '../../common/enum/user-status.enum';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthOtp } from './auth-otp.entity';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import nodemailer from 'nodemailer';

type PairingState = {
  pairingId: number;
  pairingCode: string;
  secretToken: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'consumed';
  expiresAt: Date;
  approvedUserId?: number;
  accessToken?: string;
  refreshToken?: string;
};

@Injectable()
export class AuthService {
    private static pairingMap = new Map<number, PairingState>();
    private static pairingCounter = 1;

    constructor(
        private userService: UserService,
        private jwtService: JwtService,
        @InjectRepository(AuthOtp, 'mariadb')
        private readonly otpRepository: Repository<AuthOtp>,
    ) { }

    private isEmail(input: string) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
    }

    private normalizeIdentifier(raw: string) {
        const text = String(raw || '').trim();
        if (!text) {
            throw new BadRequestException('Vui lòng nhập email hoặc số điện thoại hợp lệ');
        }

        if (this.isEmail(text)) {
            return text.toLowerCase();
        }

        if (/^[0-9\-+() ]{7,}$/.test(text)) {
            return text.replace(/\s/g, '');
        }

        throw new BadRequestException('Vui lòng nhập email hoặc số điện thoại hợp lệ');
    }

    private createNumericCode(length = 6) {
        return Array.from({ length }, () => Math.floor(Math.random() * 10)).join('');
    }

    private createPairingCode(length = 6) {
        const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        return Array.from({ length }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
    }

    private addMinutes(minutes: number) {
        const d = new Date();
        d.setMinutes(d.getMinutes() + minutes);
        return d;
    }

    private get authFlags() {
        return {
            requireEmailVerification: process.env.AUTH_REQUIRE_EMAIL_VERIFICATION !== 'false',
            exposeDebugCodes:
                process.env.AUTH_EXPOSE_DEBUG_CODES === 'true' ||
                (process.env.NODE_ENV || 'development') !== 'production',
        };
    }

    private async sendOtp(identifier: string, code: string, purpose: 'verify' | 'reset') {
        if (!this.isEmail(identifier)) {
            return {
                sent: false,
                channel: 'sms',
                destination: identifier,
                reason: 'SMS provider chưa được cấu hình trong backend mới',
                error: 'Missing SMS provider',
            };
        }

        const smtpHost = String(process.env.OTP_SMTP_HOST || '').trim();
        const smtpUser = String(process.env.OTP_SMTP_USER || '').trim();
        const smtpPass = String(process.env.OTP_SMTP_PASS || '').trim();
        const smtpFrom = String(process.env.OTP_SMTP_FROM || '').trim();

        if (!smtpHost || !smtpUser || !smtpPass || !smtpFrom) {
            return {
                sent: false,
                channel: 'email',
                destination: identifier,
                reason: 'SMTP chưa cấu hình',
                error: 'Missing SMTP config',
            };
        }

        try {
            const transporter = nodemailer.createTransport({
                host: smtpHost,
                port: Number(process.env.OTP_SMTP_PORT || 587),
                secure: process.env.OTP_SMTP_SECURE === 'true',
                auth: { user: smtpUser, pass: smtpPass },
            });

            await transporter.sendMail({
                from: smtpFrom,
                to: identifier,
                subject: purpose === 'verify' ? 'Ma xac thuc tai khoan' : 'Ma dat lai mat khau',
                text: `Ma OTP cua ban la: ${code}`,
            });

            return {
                sent: true,
                channel: 'email',
                destination: identifier,
                reason: 'sent',
                error: undefined,
            };
        } catch (error: any) {
            return {
                sent: false,
                channel: 'email',
                destination: identifier,
                reason: 'smtp-error',
                error: error?.message || 'SMTP send failed',
            };
        }
    }

    private async saveOtp(identifier: string, code: string, purpose: 'verify' | 'reset', expiresAt: Date) {
        await this.otpRepository.delete({ identifier, purpose });
        await this.otpRepository.save(
            this.otpRepository.create({
                identifier,
                purpose,
                code,
                expiresAt,
                usedAt: null,
                createdAt: new Date(),
            }),
        );
    }

    private async consumeOtp(identifier: string, code: string, purpose: 'verify' | 'reset') {
        const row = await this.otpRepository.findOne({ where: { identifier, purpose, code } });
        if (!row) return false;
        if (row.usedAt) return false;
        if (new Date(row.expiresAt).getTime() <= Date.now()) return false;
        row.usedAt = new Date();
        await this.otpRepository.save(row);
        return true;
    }

    private async issueTokens(user: any) {
        const payload = {
            id: user.userId,
            email: user.email,
            phone: user.phone,
            fullName: user.displayName,
            role: user.role,
            accountStatus: user.status,
            avatarUrl: user.avatarUrl || null,
            isVerified: Boolean(user.isVerified),
        };

        const accessToken = await this.jwtService.signAsync(payload, {
            secret: process.env.JWT_ACCESS_SECRET || 'secretKey',
            expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN || '15m') as any,
        });

        const refreshToken = await this.jwtService.signAsync(payload, {
            secret: process.env.JWT_REFRESH_SECRET || 'refreshSecret',
            expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as any,
        });

        await this.userService.updateRefreshToken(user.userId, refreshToken);

        return {
            accessToken,
            refreshToken,
            user: this.userService.toProfile(user),
        };
    }

    async login(loginDto: LoginDto): Promise<any> {
        const identifier =
            loginDto.emailOrPhone || loginDto.email || loginDto.phone || loginDto.username;

        if (!identifier) {
            throw new BadRequestException('Thiếu thông tin đăng nhập');
        }

        const user = await this.userService.findByEmailOrPhone(identifier) ||
            await this.userService.findOneByUsername(identifier);

        if (!user) {
            throw new UnauthorizedException('Email/số điện thoại hoặc mật khẩu không chính xác');
        }

        if ([UserStatus.HIDDEN, UserStatus.DELETED].includes(user.status)) {
            throw new UnauthorizedException('Tài khoản không còn khả dụng');
        }

        const matched = await this.userService.checkPassword(user, loginDto.password);
        if (!matched) {
            throw new UnauthorizedException('Email/số điện thoại hoặc mật khẩu không chính xác');
        }

        return this.issueTokens(user);
    }

    async register(registerDto: RegisterDto): Promise<any> {
        const rawIdentifier = registerDto.emailOrPhone || registerDto.email || registerDto.phone;

        if (!rawIdentifier || !registerDto.password) {
            throw new BadRequestException('Thiếu thông tin đăng ký');
        }

        const normalized = this.normalizeIdentifier(rawIdentifier);
        const isEmail = this.isEmail(normalized);

        const payload: RegisterDto = {
            ...registerDto,
            email: isEmail ? normalized.toLowerCase() : registerDto.email,
            phone: isEmail ? registerDto.phone : normalized,
            displayName: registerDto.fullName || registerDto.displayName,
            username: registerDto.username || (isEmail ? normalized.split('@')[0] : `user_${Date.now()}`),
        };

        const { requireEmailVerification, exposeDebugCodes } = this.authFlags;
        const newUser = await this.userService.create(payload, { isVerified: !requireEmailVerification });

        if (!requireEmailVerification) {
            return this.issueTokens(newUser);
        }

        const identifier = payload.email || payload.phone;
        const verificationCode = this.createNumericCode(6);
        const expiresAt = this.addMinutes(10);
        await this.saveOtp(identifier!, verificationCode, 'verify', expiresAt);
        const otpDelivery = await this.sendOtp(identifier!, verificationCode, 'verify');

        if (!otpDelivery.sent) {
            if (exposeDebugCodes) {
                return {
                    message: 'Không gửi được OTP thật. Đang dùng mã demo trong môi trường phát triển.',
                    requiresVerification: true,
                    emailOrPhone: identifier,
                    otpSent: false,
                    otpChannel: 'debug',
                    otpReason: otpDelivery.reason,
                    otpError: otpDelivery.error,
                    verificationCode,
                };
            }

            throw new BadRequestException('Không thể gửi OTP. Vui lòng kiểm tra cấu hình Email/SMS và thử lại.');
        }

        return {
            message: 'Đăng ký thành công. Vui lòng xác thực tài khoản bằng mã OTP.',
            requiresVerification: true,
            emailOrPhone: identifier,
            otpSent: otpDelivery.sent,
            otpChannel: otpDelivery.channel,
            otpDestination: otpDelivery.destination,
            otpReason: otpDelivery.reason,
            verificationCode: exposeDebugCodes ? verificationCode : undefined,
        };
    }

    async verifyRegistration(body: { emailOrPhone: string; code: string }) {
        const identifier = this.normalizeIdentifier(body?.emailOrPhone);
        const valid = await this.consumeOtp(identifier, String(body?.code || '').trim(), 'verify');
        if (!valid) {
            throw new BadRequestException('Mã xác thực không hợp lệ hoặc đã hết hạn');
        }

        const user = await this.userService.findByEmailOrPhone(identifier);
        if (!user) {
            throw new NotFoundException('Tài khoản không tồn tại');
        }

        await this.userService.updateVerificationStatus(user.userId, true);
        const refreshed = await this.userService.findOne(user.userId);
        return {
            message: 'Xác thực thành công',
            ...(await this.issueTokens(refreshed || user)),
        };
    }

    async resendVerificationCode(body: { emailOrPhone: string }) {
        const identifier = this.normalizeIdentifier(body?.emailOrPhone);
        const user = await this.userService.findByEmailOrPhone(identifier);
        if (!user) {
            throw new NotFoundException('Tài khoản không tồn tại');
        }

        if (user.isVerified) {
            throw new BadRequestException('Tài khoản đã được xác thực');
        }

        const { exposeDebugCodes } = this.authFlags;
        const verificationCode = this.createNumericCode(6);
        await this.saveOtp(identifier, verificationCode, 'verify', this.addMinutes(10));
        const otpDelivery = await this.sendOtp(identifier, verificationCode, 'verify');

        if (!otpDelivery.sent && exposeDebugCodes) {
            return {
                message: 'Không gửi được OTP thật. Đang dùng mã demo trong môi trường phát triển.',
                otpSent: false,
                otpChannel: 'debug',
                otpReason: otpDelivery.reason,
                otpError: otpDelivery.error,
                verificationCode,
            };
        }

        if (!otpDelivery.sent) {
            throw new BadRequestException('Không thể gửi OTP. Vui lòng kiểm tra cấu hình Email/SMS và thử lại.');
        }

        return {
            message: 'Mã xác thực mới đã được tạo',
            otpSent: true,
            otpChannel: otpDelivery.channel,
            otpDestination: otpDelivery.destination,
            otpReason: otpDelivery.reason,
            verificationCode: exposeDebugCodes ? verificationCode : undefined,
        };
    }

    async forgotPassword(body: { emailOrPhone: string }) {
        const identifier = this.normalizeIdentifier(body?.emailOrPhone);
        const user = await this.userService.findByEmailOrPhone(identifier);
        if (!user) {
            throw new NotFoundException('Tài khoản không tồn tại');
        }

        const { exposeDebugCodes } = this.authFlags;
        const resetCode = this.createNumericCode(6);
        await this.saveOtp(identifier, resetCode, 'reset', this.addMinutes(10));
        const otpDelivery = await this.sendOtp(identifier, resetCode, 'reset');

        if (!otpDelivery.sent && exposeDebugCodes) {
            return {
                message: 'Không gửi được OTP thật. Đang dùng mã demo trong môi trường phát triển.',
                otpSent: false,
                otpChannel: 'debug',
                otpReason: otpDelivery.reason,
                otpError: otpDelivery.error,
                resetCode,
            };
        }

        if (!otpDelivery.sent) {
            throw new BadRequestException('Không thể gửi OTP. Vui lòng kiểm tra cấu hình Email/SMS và thử lại.');
        }

        return {
            message: 'Mã đặt lại mật khẩu đã được gửi',
            otpSent: true,
            otpChannel: otpDelivery.channel,
            otpDestination: otpDelivery.destination,
            otpReason: otpDelivery.reason,
            resetCode: exposeDebugCodes ? resetCode : undefined,
        };
    }

    async resetPassword(body: { emailOrPhone: string; code: string; newPassword: string }) {
        const identifier = this.normalizeIdentifier(body?.emailOrPhone);
        const valid = await this.consumeOtp(identifier, String(body?.code || '').trim(), 'reset');
        if (!valid) {
            throw new BadRequestException('Mã đặt lại mật khẩu không hợp lệ hoặc đã hết hạn');
        }
        await this.userService.updatePasswordByIdentifier(identifier, String(body?.newPassword || ''));
        return { message: 'Đặt lại mật khẩu thành công' };
    }

    async createDesktopPairingRequest() {
        const pairingId = AuthService.pairingCounter++;
        const pairing: PairingState = {
            pairingId,
            pairingCode: this.createPairingCode(6),
            secretToken: crypto.randomBytes(24).toString('hex'),
            status: 'pending',
            expiresAt: this.addMinutes(5),
        };
        AuthService.pairingMap.set(pairingId, pairing);
        return {
            pairingId,
            pairingCode: pairing.pairingCode,
            secretToken: pairing.secretToken,
            status: pairing.status,
            expiresAt: pairing.expiresAt,
            pollIntervalMs: 2000,
        };
    }

    async getDesktopPairingStatus(id: number, secret: string) {
        const pairing = AuthService.pairingMap.get(Number(id));
        if (!pairing || pairing.secretToken !== secret) {
            throw new NotFoundException('Không tìm thấy phiên ghép đăng nhập');
        }

        if (pairing.status === 'pending' && pairing.expiresAt.getTime() <= Date.now()) {
            pairing.status = 'expired';
        }

        if (pairing.status === 'approved' && pairing.accessToken && pairing.refreshToken && pairing.approvedUserId) {
            const user = await this.userService.findOne(pairing.approvedUserId);
            pairing.status = 'consumed';
            return {
                status: 'approved',
                accessToken: pairing.accessToken,
                refreshToken: pairing.refreshToken,
                user: user ? this.userService.toProfile(user) : null,
            };
        }

        return {
            status: pairing.status,
            expiresAt: pairing.expiresAt,
        };
    }

    async approveDesktopPairing(actorId: number, pairingCode: string) {
        const normalizedCode = String(pairingCode || '').trim().toUpperCase();
        const pairing = [...AuthService.pairingMap.values()].find((item) => item.pairingCode === normalizedCode);

        if (!pairing) {
            throw new NotFoundException('Mã đăng nhập máy tính không tồn tại');
        }

        if (pairing.status !== 'pending') {
            throw new BadRequestException(`Phiên ghép không còn hợp lệ (${pairing.status})`);
        }

        if (pairing.expiresAt.getTime() <= Date.now()) {
            pairing.status = 'expired';
            throw new BadRequestException('Mã đăng nhập máy tính đã hết hạn');
        }

        const actor = await this.userService.findOne(actorId);
        if (!actor) {
            throw new NotFoundException('Tài khoản không tồn tại');
        }

        const tokenData = await this.issueTokens(actor);
        pairing.status = 'approved';
        pairing.approvedUserId = actor.userId;
        pairing.accessToken = tokenData.accessToken;
        pairing.refreshToken = tokenData.refreshToken;

        return {
            message: 'Đã xác nhận đăng nhập máy tính từ điện thoại',
            pairingId: pairing.pairingId,
            pairingCode: pairing.pairingCode,
        };
    }

    private sanitizeFileName(name: string) {
        return String(name || 'file')
            .replace(/[^a-zA-Z0-9._-]/g, '-')
            .replace(/-+/g, '-')
            .slice(0, 120);
    }

    async getAvatarUploadUrl(actorId: number, body: { fileName: string; contentType: string }) {
        const safeName = this.sanitizeFileName(body?.fileName || `avatar-${Date.now()}.bin`);
        const relative = `/uploads/avatars/${actorId}/${Date.now()}-${safeName}`;
        return {
            uploadUrl: relative,
            fileUrl: relative,
            expiresIn: 900,
            contentType: body?.contentType || 'application/octet-stream',
            note: 'Local upload URL. Nếu cần S3 presigned URL mình có thể chuyển tiếp.',
        };
    }

    async uploadAvatarBase64(actorId: number, body: { fileName: string; contentType: string; base64Data: string }) {
        const safeName = this.sanitizeFileName(body?.fileName || `avatar-${Date.now()}.bin`);
        const outputDir = path.join(process.cwd(), 'uploads', 'avatars', String(actorId));
        await fs.mkdir(outputDir, { recursive: true });
        const outputName = `${Date.now()}-${safeName}`;
        const outputPath = path.join(outputDir, outputName);
        const base64 = String(body?.base64Data || '').replace(/^data:[^;]+;base64,/, '');
        const buffer = Buffer.from(base64, 'base64');
        await fs.writeFile(outputPath, buffer);
        const fileUrl = `/uploads/avatars/${actorId}/${outputName}`;
        await this.userService.updateProfile(actorId, { avatarUrl: fileUrl });

        return {
            message: 'Tải ảnh đại diện thành công',
            fileUrl,
            contentType: body?.contentType || 'application/octet-stream',
        };
    }

    async me(userId: number) {
        const user = await this.userService.findOne(userId);
        if (!user) {
            throw new NotFoundException('Tài khoản không tồn tại');
        }
        return { user: this.userService.toProfile(user) };
    }

    async updateProfile(userId: number, body: any) {
        const updated = await this.userService.updateProfile(userId, {
            displayName: body.fullName,
            avatarUrl: body.avatarUrl,
            sex: body.gender,
            dateOfBirth: body.dateOfBirth,
        });

        if (!updated) {
            throw new NotFoundException('Tài khoản không tồn tại');
        }

        return {
            message: 'Cập nhật hồ sơ thành công',
            user: this.userService.toProfile(updated),
        };
    }

    async refresh(refreshToken: string) {
        if (!refreshToken) {
            throw new UnauthorizedException('Missing refresh token');
        }

        let decoded: any;
        try {
            decoded = this.jwtService.verify(refreshToken, {
                secret: process.env.JWT_REFRESH_SECRET || 'refreshSecret',
            });
        } catch (_error) {
            throw new UnauthorizedException('Refresh token không hợp lệ');
        }

        const user = await this.userService.findOne(decoded.id);
        if (!user || !user.refreshToken || user.refreshToken !== refreshToken) {
            throw new UnauthorizedException('Refresh token không hợp lệ');
        }

        return this.issueTokens(user);
    }

    async logout(userId: number) {
        await this.userService.updateRefreshToken(userId, null);
        return { message: 'Đăng xuất thành công' };
    }

    async changePassword(userId: number, currentPassword: string, newPassword: string) {
        const user = await this.userService.findOne(userId);
        if (!user) {
            throw new NotFoundException('Tài khoản không tồn tại');
        }

        const matched = await this.userService.checkPassword(user, currentPassword);
        if (!matched) {
            throw new UnauthorizedException('Mật khẩu hiện tại không chính xác');
        }

        await this.userService.updatePassword(userId, newPassword);
        return { message: 'Đổi mật khẩu thành công' };
    }
}
