"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var AuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const user_service_1 = require("../user/user.service");
const jwt_1 = require("@nestjs/jwt");
const user_status_enum_1 = require("../../common/enum/user-status.enum");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const auth_otp_entity_1 = require("./auth-otp.entity");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
const nodemailer_1 = __importDefault(require("nodemailer"));
let AuthService = class AuthService {
    static { AuthService_1 = this; }
    userService;
    jwtService;
    otpRepository;
    static pairingMap = new Map();
    static pairingCounter = 1;
    constructor(userService, jwtService, otpRepository) {
        this.userService = userService;
        this.jwtService = jwtService;
        this.otpRepository = otpRepository;
    }
    isEmail(input) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
    }
    normalizeIdentifier(raw) {
        const text = String(raw || '').trim();
        if (!text) {
            throw new common_1.BadRequestException('Vui lòng nhập email hoặc số điện thoại hợp lệ');
        }
        if (this.isEmail(text)) {
            return text.toLowerCase();
        }
        if (/^[0-9\-+() ]{7,}$/.test(text)) {
            return text.replace(/\s/g, '');
        }
        throw new common_1.BadRequestException('Vui lòng nhập email hoặc số điện thoại hợp lệ');
    }
    createNumericCode(length = 6) {
        return Array.from({ length }, () => Math.floor(Math.random() * 10)).join('');
    }
    createPairingCode(length = 6) {
        const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        return Array.from({ length }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
    }
    addMinutes(minutes) {
        const d = new Date();
        d.setMinutes(d.getMinutes() + minutes);
        return d;
    }
    get authFlags() {
        return {
            requireEmailVerification: process.env.AUTH_REQUIRE_EMAIL_VERIFICATION !== 'false',
            exposeDebugCodes: process.env.AUTH_EXPOSE_DEBUG_CODES === 'true' ||
                (process.env.NODE_ENV || 'development') !== 'production',
        };
    }
    async sendOtp(identifier, code, purpose) {
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
            const transporter = nodemailer_1.default.createTransport({
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
        }
        catch (error) {
            return {
                sent: false,
                channel: 'email',
                destination: identifier,
                reason: 'smtp-error',
                error: error?.message || 'SMTP send failed',
            };
        }
    }
    async saveOtp(identifier, code, purpose, expiresAt) {
        await this.otpRepository.delete({ identifier, purpose });
        await this.otpRepository.save(this.otpRepository.create({
            identifier,
            purpose,
            code,
            expiresAt,
            usedAt: null,
            createdAt: new Date(),
        }));
    }
    async consumeOtp(identifier, code, purpose) {
        const row = await this.otpRepository.findOne({ where: { identifier, purpose, code } });
        if (!row)
            return false;
        if (row.usedAt)
            return false;
        if (new Date(row.expiresAt).getTime() <= Date.now())
            return false;
        row.usedAt = new Date();
        await this.otpRepository.save(row);
        return true;
    }
    async issueTokens(user) {
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
            expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN || '15m'),
        });
        const refreshToken = await this.jwtService.signAsync(payload, {
            secret: process.env.JWT_REFRESH_SECRET || 'refreshSecret',
            expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d'),
        });
        await this.userService.updateRefreshToken(user.userId, refreshToken);
        return {
            accessToken,
            refreshToken,
            user: this.userService.toProfile(user),
        };
    }
    async login(loginDto) {
        const identifier = loginDto.emailOrPhone || loginDto.email || loginDto.phone || loginDto.username;
        if (!identifier) {
            throw new common_1.BadRequestException('Thiếu thông tin đăng nhập');
        }
        const user = await this.userService.findByEmailOrPhone(identifier) ||
            await this.userService.findOneByUsername(identifier);
        if (!user) {
            throw new common_1.UnauthorizedException('Email/số điện thoại hoặc mật khẩu không chính xác');
        }
        if ([user_status_enum_1.UserStatus.HIDDEN, user_status_enum_1.UserStatus.DELETED].includes(user.status)) {
            throw new common_1.UnauthorizedException('Tài khoản không còn khả dụng');
        }
        const matched = await this.userService.checkPassword(user, loginDto.password);
        if (!matched) {
            throw new common_1.UnauthorizedException('Email/số điện thoại hoặc mật khẩu không chính xác');
        }
        return this.issueTokens(user);
    }
    async register(registerDto) {
        const rawIdentifier = registerDto.emailOrPhone || registerDto.email || registerDto.phone;
        if (!rawIdentifier || !registerDto.password) {
            throw new common_1.BadRequestException('Thiếu thông tin đăng ký');
        }
        const normalized = this.normalizeIdentifier(rawIdentifier);
        const isEmail = this.isEmail(normalized);
        const payload = {
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
        await this.saveOtp(identifier, verificationCode, 'verify', expiresAt);
        const otpDelivery = await this.sendOtp(identifier, verificationCode, 'verify');
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
            throw new common_1.BadRequestException('Không thể gửi OTP. Vui lòng kiểm tra cấu hình Email/SMS và thử lại.');
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
    async verifyRegistration(body) {
        const identifier = this.normalizeIdentifier(body?.emailOrPhone);
        const valid = await this.consumeOtp(identifier, String(body?.code || '').trim(), 'verify');
        if (!valid) {
            throw new common_1.BadRequestException('Mã xác thực không hợp lệ hoặc đã hết hạn');
        }
        const user = await this.userService.findByEmailOrPhone(identifier);
        if (!user) {
            throw new common_1.NotFoundException('Tài khoản không tồn tại');
        }
        await this.userService.updateVerificationStatus(user.userId, true);
        const refreshed = await this.userService.findOne(user.userId);
        return {
            message: 'Xác thực thành công',
            ...(await this.issueTokens(refreshed || user)),
        };
    }
    async resendVerificationCode(body) {
        const identifier = this.normalizeIdentifier(body?.emailOrPhone);
        const user = await this.userService.findByEmailOrPhone(identifier);
        if (!user) {
            throw new common_1.NotFoundException('Tài khoản không tồn tại');
        }
        if (user.isVerified) {
            throw new common_1.BadRequestException('Tài khoản đã được xác thực');
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
            throw new common_1.BadRequestException('Không thể gửi OTP. Vui lòng kiểm tra cấu hình Email/SMS và thử lại.');
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
    async forgotPassword(body) {
        const identifier = this.normalizeIdentifier(body?.emailOrPhone);
        const user = await this.userService.findByEmailOrPhone(identifier);
        if (!user) {
            throw new common_1.NotFoundException('Tài khoản không tồn tại');
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
            throw new common_1.BadRequestException('Không thể gửi OTP. Vui lòng kiểm tra cấu hình Email/SMS và thử lại.');
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
    async resetPassword(body) {
        const identifier = this.normalizeIdentifier(body?.emailOrPhone);
        const valid = await this.consumeOtp(identifier, String(body?.code || '').trim(), 'reset');
        if (!valid) {
            throw new common_1.BadRequestException('Mã đặt lại mật khẩu không hợp lệ hoặc đã hết hạn');
        }
        await this.userService.updatePasswordByIdentifier(identifier, String(body?.newPassword || ''));
        return { message: 'Đặt lại mật khẩu thành công' };
    }
    async createDesktopPairingRequest() {
        const pairingId = AuthService_1.pairingCounter++;
        const pairing = {
            pairingId,
            pairingCode: this.createPairingCode(6),
            secretToken: crypto.randomBytes(24).toString('hex'),
            status: 'pending',
            expiresAt: this.addMinutes(5),
        };
        AuthService_1.pairingMap.set(pairingId, pairing);
        return {
            pairingId,
            pairingCode: pairing.pairingCode,
            secretToken: pairing.secretToken,
            status: pairing.status,
            expiresAt: pairing.expiresAt,
            pollIntervalMs: 2000,
        };
    }
    async getDesktopPairingStatus(id, secret) {
        const pairing = AuthService_1.pairingMap.get(Number(id));
        if (!pairing || pairing.secretToken !== secret) {
            throw new common_1.NotFoundException('Không tìm thấy phiên ghép đăng nhập');
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
    async approveDesktopPairing(actorId, pairingCode) {
        const normalizedCode = String(pairingCode || '').trim().toUpperCase();
        const pairing = [...AuthService_1.pairingMap.values()].find((item) => item.pairingCode === normalizedCode);
        if (!pairing) {
            throw new common_1.NotFoundException('Mã đăng nhập máy tính không tồn tại');
        }
        if (pairing.status !== 'pending') {
            throw new common_1.BadRequestException(`Phiên ghép không còn hợp lệ (${pairing.status})`);
        }
        if (pairing.expiresAt.getTime() <= Date.now()) {
            pairing.status = 'expired';
            throw new common_1.BadRequestException('Mã đăng nhập máy tính đã hết hạn');
        }
        const actor = await this.userService.findOne(actorId);
        if (!actor) {
            throw new common_1.NotFoundException('Tài khoản không tồn tại');
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
    sanitizeFileName(name) {
        return String(name || 'file')
            .replace(/[^a-zA-Z0-9._-]/g, '-')
            .replace(/-+/g, '-')
            .slice(0, 120);
    }
    async getAvatarUploadUrl(actorId, body) {
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
    async uploadAvatarBase64(actorId, body) {
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
    async me(userId) {
        const user = await this.userService.findOne(userId);
        if (!user) {
            throw new common_1.NotFoundException('Tài khoản không tồn tại');
        }
        return { user: this.userService.toProfile(user) };
    }
    async updateProfile(userId, body) {
        const updated = await this.userService.updateProfile(userId, {
            displayName: body.fullName,
            avatarUrl: body.avatarUrl,
            sex: body.gender,
            dateOfBirth: body.dateOfBirth,
        });
        if (!updated) {
            throw new common_1.NotFoundException('Tài khoản không tồn tại');
        }
        return {
            message: 'Cập nhật hồ sơ thành công',
            user: this.userService.toProfile(updated),
        };
    }
    async refresh(refreshToken) {
        if (!refreshToken) {
            throw new common_1.UnauthorizedException('Missing refresh token');
        }
        let decoded;
        try {
            decoded = this.jwtService.verify(refreshToken, {
                secret: process.env.JWT_REFRESH_SECRET || 'refreshSecret',
            });
        }
        catch (_error) {
            throw new common_1.UnauthorizedException('Refresh token không hợp lệ');
        }
        const user = await this.userService.findOne(decoded.id);
        if (!user || !user.refreshToken || user.refreshToken !== refreshToken) {
            throw new common_1.UnauthorizedException('Refresh token không hợp lệ');
        }
        return this.issueTokens(user);
    }
    async logout(userId) {
        await this.userService.updateRefreshToken(userId, null);
        return { message: 'Đăng xuất thành công' };
    }
    async changePassword(userId, currentPassword, newPassword) {
        const user = await this.userService.findOne(userId);
        if (!user) {
            throw new common_1.NotFoundException('Tài khoản không tồn tại');
        }
        const matched = await this.userService.checkPassword(user, currentPassword);
        if (!matched) {
            throw new common_1.UnauthorizedException('Mật khẩu hiện tại không chính xác');
        }
        await this.userService.updatePassword(userId, newPassword);
        return { message: 'Đổi mật khẩu thành công' };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, typeorm_1.InjectRepository)(auth_otp_entity_1.AuthOtp, 'mariadb')),
    __metadata("design:paramtypes", [user_service_1.UserService,
        jwt_1.JwtService,
        typeorm_2.Repository])
], AuthService);
//# sourceMappingURL=auth.service.js.map