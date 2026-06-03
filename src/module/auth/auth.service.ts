import { BadRequestException, Injectable, ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UserStatus } from '../../common/enum/user-status.enum';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import nodemailer from 'nodemailer';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { emitSocialEvent } from '../../common/socket/chat-socket';
import { SystemSettingService } from '../system-setting/system-setting.service';

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

type OtpCacheEntry = {
    codeHash: string;
    expiresAt: number;
};

@Injectable()
export class AuthService {
    private static pairingMap = new Map<number, PairingState>();
    private static pairingCounter = 1;
    private static otpCache = new Map<string, OtpCacheEntry>();
    private static rateCache = new Map<string, { count: number; resetAt: number }>();

    constructor(
        private userService: UserService,
        private jwtService: JwtService,
        private systemSettingService: SystemSettingService,
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

    private normalizePhoneForSms(raw: string) {
        const digitsOrPlus = String(raw || '').trim().replace(/[^\d+]/g, '');

        if (/^\+84\d{8,10}$/.test(digitsOrPlus)) {
            return digitsOrPlus;
        }

        if (/^84\d{8,10}$/.test(digitsOrPlus)) {
            return `+${digitsOrPlus}`;
        }

        if (/^0\d{8,10}$/.test(digitsOrPlus)) {
            return `+84${digitsOrPlus.slice(1)}`;
        }

        if (/^\+\d{8,15}$/.test(digitsOrPlus)) {
            return digitsOrPlus;
        }

        throw new BadRequestException('Số điện thoại cần đúng định dạng, ví dụ 0901234567 hoặc +84901234567.');
    }

    private createNumericCode(length = 6) {
        return Array.from({ length }, () => Math.floor(Math.random() * 10)).join('');
    }

    private createPairingCode(length = 6) {
        const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        return Array.from({ length }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
    }

    private getGoogleCallbackUrl() {
        return String(process.env.GOOGLE_CALLBACK_URL || `${String(process.env.API_PUBLIC_URL || process.env.BACKEND_PUBLIC_URL || 'http://localhost:5000/api').replace(/\/$/, '')}/auth/google/callback`);
    }

    private addMinutes(minutes: number) {
        const d = new Date();
        d.setMinutes(d.getMinutes() + minutes);
        return d;
    }

    private async getAuthFlags() {
        const { settings } = await this.systemSettingService.getAdminSettings();
        return {
            requireEmailVerification: settings.otp && process.env.AUTH_REQUIRE_EMAIL_VERIFICATION !== 'false',
            exposeDebugCodes: process.env.AUTH_EXPOSE_DEBUG_CODES === 'true',
            exposeOtpErrors:
                process.env.AUTH_EXPOSE_OTP_ERRORS === 'true' ||
                (process.env.NODE_ENV || 'development') !== 'production',
            allowRegistration: settings.register,
            shortAdminSession: settings.session,
            maintenance: settings.maintenance,
            rateLimit: settings.rate,
        };
    }

    private buildOtpFailureMessage(delivery: { channel?: string; reason?: string; error?: string }) {
        const base = 'Không thể gửi OTP thật. Vui lòng kiểm tra cấu hình Email/SMS và thử lại.';
        const exposeOtpErrors =
            process.env.AUTH_EXPOSE_OTP_ERRORS === 'true' ||
            (process.env.NODE_ENV || 'development') !== 'production';
        if (!exposeOtpErrors) return base;

        const detail = [delivery.channel, delivery.reason, delivery.error].filter(Boolean).join(' - ');
        return detail ? `${base} Chi tiết: ${detail}` : base;
    }

    private async assertRateAllowed(scope: string, identifier: string, maxAttempts = 10) {
        const { rateLimit } = await this.getAuthFlags();
        if (!rateLimit) return;
        const key = `${scope}:${this.normalizeIdentifier(identifier || 'unknown')}`;
        const now = Date.now();
        const row = AuthService.rateCache.get(key);
        if (!row || row.resetAt <= now) {
            AuthService.rateCache.set(key, { count: 1, resetAt: now + 60_000 });
            return;
        }
        row.count += 1;
        if (row.count > maxAttempts) {
            throw new BadRequestException('Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.');
        }
    }

    private async sendSmsOtp(identifier: string, code: string, purpose: 'verify' | 'reset') {
        const accountSid = String(process.env.TWILIO_ACCOUNT_SID || process.env.OTP_SMS_ACCOUNT_SID || '').trim();
        const authToken = String(process.env.TWILIO_AUTH_TOKEN || process.env.OTP_SMS_AUTH_TOKEN || '').trim();
        const from = String(process.env.TWILIO_FROM || process.env.OTP_SMS_FROM || '').trim();
        const to = this.normalizePhoneForSms(identifier);

        if (!accountSid || !authToken || !from) {
            return {
                sent: false,
                channel: 'sms',
                destination: to,
                reason: 'SMS provider chưa được cấu hình',
                error: 'Missing Twilio config',
            };
        }

        const message =
            purpose === 'verify'
                ? `Ma xac thuc ZZChat cua ban la: ${code}. Ma co hieu luc trong 10 phut.`
                : `Ma dat lai mat khau ZZChat cua ban la: ${code}. Ma co hieu luc trong 10 phut.`;

        try {
            const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
            const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
                method: 'POST',
                headers: {
                    Authorization: `Basic ${credentials}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({ To: to, From: from, Body: message }).toString(),
            });
            const data = (await response.json().catch(() => ({}))) as { message?: string; sid?: string };

            if (!response.ok) {
                return {
                    sent: false,
                    channel: 'sms',
                    destination: to,
                    reason: 'sms-error',
                    error: data.message || `Twilio HTTP ${response.status}`,
                };
            }

            return {
                sent: true,
                channel: 'sms',
                destination: to,
                reason: data.sid || 'sent',
                error: undefined,
            };
        } catch (error: any) {
            return {
                sent: false,
                channel: 'sms',
                destination: to,
                reason: 'sms-error',
                error: error?.message || 'SMS send failed',
            };
        }
    }

    private async sendOtp(identifier: string, code: string, purpose: 'verify' | 'reset') {
        if (!this.isEmail(identifier)) {
            return this.sendSmsOtp(identifier, code, purpose);
        }

        const smtpHost = String(process.env.OTP_SMTP_HOST || process.env.SMTP_HOST || '').trim();
        const smtpUser = String(process.env.OTP_SMTP_USER || process.env.SMTP_USER || '').trim();
        const smtpPass = String(
            process.env.OTP_SMTP_PASS ||
            process.env.SMTP_PASS ||
            process.env.OTP_SMTP_PASSWORD ||
            process.env.SMTP_PASSWORD ||
            '',
        ).trim();
        const smtpFrom = String(process.env.OTP_SMTP_FROM || process.env.SMTP_FROM || smtpUser || '').trim();
        const smtpPort = Number(process.env.OTP_SMTP_PORT || process.env.SMTP_PORT || 587);
        const smtpSecure = String(process.env.OTP_SMTP_SECURE || process.env.SMTP_SECURE || '') === 'true' || smtpPort === 465;

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
                port: smtpPort,
                secure: smtpSecure,
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

    private getOtpCacheKey(identifier: string, purpose: 'verify' | 'reset') {
        return `${purpose}:${identifier}`;
    }

    private hashOtp(identifier: string, purpose: 'verify' | 'reset', code: string) {
        const secret = process.env.OTP_CACHE_SECRET || process.env.JWT_ACCESS_SECRET || 'secretKey';
        return crypto
            .createHmac('sha256', secret)
            .update(`${purpose}:${identifier}:${code}`)
            .digest('hex');
    }

    private pruneExpiredOtp() {
        const now = Date.now();
        for (const [key, value] of AuthService.otpCache.entries()) {
            if (value.expiresAt <= now) AuthService.otpCache.delete(key);
        }
    }

    private async saveOtp(identifier: string, code: string, purpose: 'verify' | 'reset', expiresAt: Date) {
        this.pruneExpiredOtp();
        AuthService.otpCache.set(this.getOtpCacheKey(identifier, purpose), {
            codeHash: this.hashOtp(identifier, purpose, code),
            expiresAt: expiresAt.getTime(),
        });
    }

    private async consumeOtp(identifier: string, code: string, purpose: 'verify' | 'reset') {
        const key = this.getOtpCacheKey(identifier, purpose);
        const row = AuthService.otpCache.get(key);
        if (!row) return false;
        AuthService.otpCache.delete(key);
        if (row.expiresAt <= Date.now()) return false;
        const expected = Buffer.from(row.codeHash, 'hex');
        const actual = Buffer.from(this.hashOtp(identifier, purpose, code), 'hex');
        return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
    }

    private async deleteOtp(identifier: string, purpose: 'verify' | 'reset') {
        AuthService.otpCache.delete(this.getOtpCacheKey(identifier, purpose));
    }

    private async issueTokens(user: any) {
        const { shortAdminSession } = await this.getAuthFlags();
        const isStaff = ['ADMIN', 'MODERATOR'].includes(String(user.role || '').toUpperCase());
        const accessExpiresIn = shortAdminSession && isStaff
            ? (process.env.JWT_ADMIN_SHORT_ACCESS_EXPIRES_IN || '5m')
            : (process.env.JWT_ACCESS_EXPIRES_IN || '15m');
        const refreshExpiresIn = shortAdminSession && isStaff
            ? (process.env.JWT_ADMIN_SHORT_REFRESH_EXPIRES_IN || '30m')
            : (process.env.JWT_REFRESH_EXPIRES_IN || '7d');
        const payload = {
            id: user.userId,
            email: user.email,
            phone: user.phone,
            fullName: user.displayName,
            role: user.role,
            accountStatus: user.status,
            avatarUrl: user.avatarUrl || null,
            isVerified: Boolean(user.isVerified),
            permissions: typeof user.permissions === 'string'
                ? user.permissions.split(',').map((item: string) => item.trim()).filter(Boolean)
                : [],
        };

        const accessToken = await this.jwtService.signAsync(payload, {
            secret: process.env.JWT_ACCESS_SECRET || 'secretKey',
            expiresIn: accessExpiresIn as any,
        });

        const refreshToken = await this.jwtService.signAsync(payload, {
            secret: process.env.JWT_REFRESH_SECRET || 'refreshSecret',
            expiresIn: refreshExpiresIn as any,
        });

        await this.userService.updateRefreshToken(user.userId, refreshToken);

        return {
            accessToken,
            refreshToken,
            user: this.userService.toProfile(user),
        };
    }

    private async findOrCreateSocialUser(profile: { email: string; name?: string; avatarUrl?: string | null }) {
        const email = profile.email.trim().toLowerCase();
        if (!email) {
            throw new BadRequestException('Không lấy được email từ tài khoản mạng xã hội.');
        }

        const existing = await this.userService.findByEmailOrPhone(email);
        if (existing) {
            if (!existing.isVerified) {
                await this.userService.updateVerificationStatus(existing.userId, true);
                return this.userService.findOne(existing.userId) || existing;
            }
            return existing;
        }

        const flags = await this.getAuthFlags();
        if (!flags.allowRegistration || flags.maintenance) {
            throw new ForbiddenException('Đăng ký mới đang tạm đóng.');
        }

        return this.userService.create(
            {
                emailOrPhone: email,
                email,
                password: '',
                displayName: profile.name || email.split('@')[0],
                username: `${email.split('@')[0]}_${Date.now()}`,
                sex: null as any,
                dateOfBirth: null as any,
                phone: null as any,
                avatarUrl: profile.avatarUrl || undefined,
            },
            { isVerified: true },
        );
    }

    async loginWithGoogleCode(code: string) {
        const clientId = String(process.env.GOOGLE_CLIENT_ID || '').trim();
        const clientSecret = String(process.env.GOOGLE_CLIENT_SECRET || '').trim();
        const redirectUri = this.getGoogleCallbackUrl();

        if (!clientId || !clientSecret) {
            throw new BadRequestException('Chưa cấu hình GOOGLE_CLIENT_ID hoặc GOOGLE_CLIENT_SECRET.');
        }

        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code',
            }).toString(),
        });
        const tokenData = (await tokenResponse.json().catch(() => ({}))) as {
            access_token?: string;
            error_description?: string;
        };

        if (!tokenResponse.ok || !tokenData.access_token) {
            throw new BadRequestException(tokenData.error_description || 'Không thể xác thực Google.');
        }

        const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const profile = (await profileResponse.json().catch(() => ({}))) as {
            email?: string;
            name?: string;
            picture?: string;
        };

        if (!profileResponse.ok || !profile.email) {
            throw new BadRequestException('Không lấy được thông tin tài khoản Google.');
        }

        const user = await this.findOrCreateSocialUser({
            email: profile.email,
            name: profile.name,
            avatarUrl: profile.picture,
        });
        return this.issueTokens(user);
    }

    async loginWithGoogleIdToken(idToken: string) {
        const clientId = String(process.env.GOOGLE_CLIENT_ID || '').trim();
        if (!clientId) {
            throw new BadRequestException('Chưa cấu hình GOOGLE_CLIENT_ID.');
        }

        const tokenResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
        const profile = (await tokenResponse.json().catch(() => ({}))) as {
            aud?: string;
            email?: string;
            name?: string;
            picture?: string;
            error_description?: string;
        };

        if (!tokenResponse.ok || profile.aud !== clientId || !profile.email) {
            throw new BadRequestException(profile.error_description || 'Google id_token không hợp lệ.');
        }

        const user = await this.findOrCreateSocialUser({
            email: profile.email,
            name: profile.name,
            avatarUrl: profile.picture,
        });
        return this.issueTokens(user);
    }

    async login(loginDto: LoginDto): Promise<any> {
        const identifier =
            loginDto.emailOrPhone || loginDto.email || loginDto.phone || loginDto.username;

        if (!identifier) {
            throw new BadRequestException('Thiếu thông tin đăng nhập');
        }
        await this.assertRateAllowed('login', identifier, 12);

        const user = await this.userService.findByEmailOrPhone(identifier) ||
            await this.userService.findOneByUsername(identifier);

        if (!user) {
            throw new UnauthorizedException('Email/số điện thoại hoặc mật khẩu không chính xác');
        }

        const lockedStatuses = [UserStatus.BLOCKED, UserStatus.HIDDEN, UserStatus.DELETED, UserStatus.LOCKED];
        const isTempLocked = user.status === UserStatus.TEMP_LOCKED &&
            (!user.lockedUntil || new Date(user.lockedUntil).getTime() > Date.now());
        if (lockedStatuses.includes(user.status) || isTempLocked) {
            throw new UnauthorizedException('Tài khoản không còn khả dụng');
        }

        const flags = await this.getAuthFlags();
        if (flags.maintenance && String(user.role || '').toUpperCase() !== 'ADMIN') {
            throw new ForbiddenException('Hệ thống đang bảo trì. Vui lòng quay lại sau.');
        }

        const matched = await this.userService.checkPassword(user, loginDto.password);
        if (!matched) {
            throw new UnauthorizedException('Email/số điện thoại hoặc mật khẩu không chính xác');
        }

        if (flags.requireEmailVerification && !Boolean(user.isVerified)) {
            throw new UnauthorizedException('Tài khoản chưa xác thực OTP. Vui lòng xác thực trước khi đăng nhập.');
        }

        return this.issueTokens(user);
    }

    async register(registerDto: RegisterDto): Promise<any> {
        const rawIdentifier = registerDto.emailOrPhone || registerDto.email || registerDto.phone;

        if (!rawIdentifier || !registerDto.password) {
            throw new BadRequestException('Thiếu thông tin đăng ký');
        }
        await this.assertRateAllowed('register', rawIdentifier, 6);
        const flags = await this.getAuthFlags();
        if (!flags.allowRegistration || flags.maintenance) {
            throw new ForbiddenException('Đăng ký mới đang tạm đóng.');
        }

        const normalized = this.normalizeIdentifier(rawIdentifier);
        const isEmail = this.isEmail(normalized);

        const payload: RegisterDto = {
            ...registerDto,
            email: isEmail ? normalized.toLowerCase() : registerDto.email,
            phone: isEmail ? registerDto.phone : normalized,
            displayName: registerDto.fullName || registerDto.displayName,
            sex:
                registerDto.sex ??
                ({ male: 1, female: 0, other: 2 } as Record<string, number>)[String(registerDto.gender || '')],
            username: registerDto.username || (isEmail ? normalized.split('@')[0] : `user_${Date.now()}`),
        };

        const { requireEmailVerification, exposeDebugCodes } = flags;
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

            await this.deleteOtp(identifier!, 'verify');
            await this.userService.deleteUnverifiedUser(newUser.userId);
            throw new BadRequestException(this.buildOtpFailureMessage(otpDelivery));
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
        await this.assertRateAllowed('resend-otp', identifier, 5);
        const user = await this.userService.findByEmailOrPhone(identifier);
        if (!user) {
            throw new NotFoundException('Tài khoản không tồn tại');
        }

        if (user.isVerified) {
            throw new BadRequestException('Tài khoản đã được xác thực');
        }

        const { exposeDebugCodes } = await this.getAuthFlags();
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
            throw new BadRequestException(this.buildOtpFailureMessage(otpDelivery));
        }

        return {
            message: 'Mã xác thực mới đã được gửi',
            otpSent: true,
            otpChannel: otpDelivery.channel,
            otpDestination: otpDelivery.destination,
            otpReason: otpDelivery.reason,
            verificationCode: exposeDebugCodes ? verificationCode : undefined,
        };
    }

    async forgotPassword(body: { emailOrPhone: string }) {
        const identifier = this.normalizeIdentifier(body?.emailOrPhone);
        await this.assertRateAllowed('forgot-password', identifier, 5);
        const user = await this.userService.findByEmailOrPhone(identifier);
        if (!user) {
            throw new NotFoundException('Tài khoản không tồn tại');
        }

        const { exposeDebugCodes } = await this.getAuthFlags();
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
            throw new BadRequestException(this.buildOtpFailureMessage(otpDelivery));
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
        await this.assertRateAllowed('reset-password', identifier, 5);
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

    private getS3Config() {
        const bucket = process.env.AWS_S3_BUCKET || process.env.AWS_BUCKET_NAME || process.env.S3_BUCKET || '';
        const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-southeast-1';
        return { bucket, region };
    }

    private getS3Client() {
        const { region } = this.getS3Config();
        return new S3Client({
            region,
            credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
                ? {
                    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                    sessionToken: process.env.AWS_SESSION_TOKEN || undefined,
                }
                : undefined,
        });
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
        const outputName = `${Date.now()}-${safeName}`;
        const base64 = String(body?.base64Data || '').replace(/^data:[^;]+;base64,/, '');
        const buffer = Buffer.from(base64, 'base64');
        const contentType = body?.contentType || 'application/octet-stream';
        const { bucket, region } = this.getS3Config();

        let fileUrl: string;
        if (bucket) {
            const key = `uploads/avatars/${actorId}/${outputName}`;
            try {
                await this.getS3Client().send(new PutObjectCommand({
                    Bucket: bucket,
                    Key: key,
                    Body: buffer,
                    ContentType: contentType,
                }));
                fileUrl = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
            } catch (error) {
                const detail = error instanceof Error ? error.message : 'Lỗi S3 không xác định';
                console.error('S3 avatar upload failed:', detail);
                throw new BadRequestException(`Không thể tải ảnh đại diện lên S3: ${detail}`);
            }
        } else {
            const outputDir = path.join(process.cwd(), 'uploads', 'avatars', String(actorId));
            await fs.mkdir(outputDir, { recursive: true });
            await fs.writeFile(path.join(outputDir, outputName), buffer);
            fileUrl = `/uploads/avatars/${actorId}/${outputName}`;
        }

        const user = await this.userService.updateProfile(actorId, { avatarUrl: fileUrl });
        emitSocialEvent('user:avatar-updated', {
            userId: actorId,
            avatarUrl: fileUrl,
            user: user ? this.userService.toProfile(user) : null,
        });

        return {
            message: 'Tải ảnh đại diện thành công',
            avatarUrl: fileUrl,
            mediaUrl: fileUrl,
            fileUrl,
            user: user ? this.userService.toProfile(user) : null,
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
