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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MailService = void 0;
const common_1 = require("@nestjs/common");
const nodemailer = __importStar(require("nodemailer"));
let MailService = class MailService {
    constructor() {
        this.logger = new common_1.Logger('MailService');
        // Initialize email transporter with environment variables or default config
        this.initializeTransporter();
    }
    initializeTransporter() {
        const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
        const smtpPort = parseInt(process.env.SMTP_PORT || '587');
        const smtpUser = process.env.SMTP_USER || '';
        const smtpPassword = process.env.SMTP_PASSWORD || '';
        const smtpFrom = process.env.SMTP_FROM || 'noreply@zzchat.com';
        try {
            this.transporter = nodemailer.createTransport({
                host: smtpHost,
                port: smtpPort,
                secure: smtpPort === 465,
                auth: {
                    user: smtpUser,
                    pass: smtpPassword,
                },
            });
            this.logger.log(`Mail service initialized with SMTP host: ${smtpHost}`);
        }
        catch (error) {
            this.logger.warn('Failed to initialize mail transporter', error);
            this.transporter = null;
        }
    }
    async sendWelcomeEmail(email, fullName) {
        if (!this.transporter) {
            this.logger.warn('Mail transporter not configured, skipping email');
            return false;
        }
        try {
            await this.transporter.sendMail({
                from: process.env.SMTP_FROM || 'noreply@zzchat.com',
                to: email,
                subject: 'Chào mừng đến với ZZChat',
                html: `
          <h1>Chào mừng ${fullName}!</h1>
          <p>Cảm ơn bạn đã đăng ký tài khoản ZZChat.</p>
          <p>Bạn có thể bắt đầu kết nối với bạn bè và chia sẻ những khoảnh khắc đặc biệt ngay hôm nay.</p>
          <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth/login">Đăng nhập ZZChat</a>
        `,
            });
            this.logger.log(`Welcome email sent to ${email}`);
            return true;
        }
        catch (error) {
            this.logger.error(`Failed to send welcome email to ${email}`, error);
            return false;
        }
    }
    async sendVerificationEmail(email, code) {
        if (!this.transporter) {
            this.logger.warn('Mail transporter not configured, skipping email');
            return false;
        }
        try {
            await this.transporter.sendMail({
                from: process.env.SMTP_FROM || 'noreply@zzchat.com',
                to: email,
                subject: 'Mã xác thực ZZChat',
                html: `
          <h1>Xác thực tài khoản của bạn</h1>
          <p>Mã xác thực của bạn là:</p>
          <h2 style="color: #4CAF50; font-size: 32px; letter-spacing: 2px;">${code}</h2>
          <p>Mã này có hiệu lực trong 10 phút.</p>
          <p>Nếu bạn không yêu cầu, vui lòng bỏ qua email này.</p>
        `,
            });
            this.logger.log(`Verification email sent to ${email}`);
            return true;
        }
        catch (error) {
            this.logger.error(`Failed to send verification email to ${email}`, error);
            return false;
        }
    }
    async sendPasswordResetEmail(email, resetCode) {
        if (!this.transporter) {
            this.logger.warn('Mail transporter not configured, skipping email');
            return false;
        }
        try {
            await this.transporter.sendMail({
                from: process.env.SMTP_FROM || 'noreply@zzchat.com',
                to: email,
                subject: 'Đặt lại mật khẩu ZZChat',
                html: `
          <h1>Đặt lại mật khẩu của bạn</h1>
          <p>Mã đặt lại mật khẩu của bạn là:</p>
          <h2 style="color: #FF6B6B; font-size: 32px; letter-spacing: 2px;">${resetCode}</h2>
          <p>Mã này có hiệu lực trong 1 giờ.</p>
          <p>Nếu bạn không yêu cầu, vui lòng bỏ qua email này.</p>
          <p style="color: #999; font-size: 12px;">Không chia sẻ mã này cho ai khác.</p>
        `,
            });
            this.logger.log(`Password reset email sent to ${email}`);
            return true;
        }
        catch (error) {
            this.logger.error(`Failed to send password reset email to ${email}`, error);
            return false;
        }
    }
    async sendNotificationEmail(email, subject, message, actionUrl) {
        if (!this.transporter) {
            this.logger.warn('Mail transporter not configured, skipping email');
            return false;
        }
        try {
            let html = `
        <h1>${subject}</h1>
        <p>${message}</p>
      `;
            if (actionUrl) {
                html += `<a href="${actionUrl}" style="display: inline-block; padding: 10px 20px; background-color: #2196F3; color: white; text-decoration: none; border-radius: 4px;">Xem chi tiết</a>`;
            }
            await this.transporter.sendMail({
                from: process.env.SMTP_FROM || 'noreply@zzchat.com',
                to: email,
                subject: `ZZChat - ${subject}`,
                html,
            });
            this.logger.log(`Notification email sent to ${email}`);
            return true;
        }
        catch (error) {
            this.logger.error(`Failed to send notification email to ${email}`, error);
            return false;
        }
    }
    async testConnection() {
        if (!this.transporter) {
            return false;
        }
        try {
            await this.transporter.verify();
            this.logger.log('Mail service connection verified');
            return true;
        }
        catch (error) {
            this.logger.error('Mail service connection failed', error);
            return false;
        }
    }
};
exports.MailService = MailService;
exports.MailService = MailService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], MailService);
//# sourceMappingURL=mail.service.js.map