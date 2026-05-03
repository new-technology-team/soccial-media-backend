import { Injectable, Logger } from '@nestjs/common'
import * as nodemailer from 'nodemailer'

@Injectable()
export class MailService {
  private logger = new Logger('MailService')
  private transporter: nodemailer.Transporter | null

  constructor() {
    // Initialize email transporter with environment variables or default config
    this.initializeTransporter()
  }

  private initializeTransporter() {
    const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com'
    const smtpPort = parseInt(process.env.SMTP_PORT || '587')
    const smtpUser = process.env.SMTP_USER || ''
    const smtpPassword = process.env.SMTP_PASSWORD || ''
    const smtpFrom = process.env.SMTP_FROM || 'noreply@zzchat.com'

    try {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPassword,
        },
      })

      this.logger.log(`Mail service initialized with SMTP host: ${smtpHost}`)
    } catch (error) {
      this.logger.warn('Failed to initialize mail transporter', error)
      this.transporter = null
    }
  }

  async sendWelcomeEmail(email: string, fullName: string): Promise<boolean> {
    if (!this.transporter) {
      this.logger.warn('Mail transporter not configured, skipping email')
      return false
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
      })

      this.logger.log(`Welcome email sent to ${email}`)
      return true
    } catch (error) {
      this.logger.error(`Failed to send welcome email to ${email}`, error)
      return false
    }
  }

  async sendVerificationEmail(email: string, code: string): Promise<boolean> {
    if (!this.transporter) {
      this.logger.warn('Mail transporter not configured, skipping email')
      return false
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
      })

      this.logger.log(`Verification email sent to ${email}`)
      return true
    } catch (error) {
      this.logger.error(`Failed to send verification email to ${email}`, error)
      return false
    }
  }

  async sendPasswordResetEmail(email: string, resetCode: string): Promise<boolean> {
    if (!this.transporter) {
      this.logger.warn('Mail transporter not configured, skipping email')
      return false
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
      })

      this.logger.log(`Password reset email sent to ${email}`)
      return true
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${email}`, error)
      return false
    }
  }

  async sendNotificationEmail(
    email: string,
    subject: string,
    message: string,
    actionUrl?: string
  ): Promise<boolean> {
    if (!this.transporter) {
      this.logger.warn('Mail transporter not configured, skipping email')
      return false
    }

    try {
      let html = `
        <h1>${subject}</h1>
        <p>${message}</p>
      `

      if (actionUrl) {
        html += `<a href="${actionUrl}" style="display: inline-block; padding: 10px 20px; background-color: #2196F3; color: white; text-decoration: none; border-radius: 4px;">Xem chi tiết</a>`
      }

      await this.transporter.sendMail({
        from: process.env.SMTP_FROM || 'noreply@zzchat.com',
        to: email,
        subject: `ZZChat - ${subject}`,
        html,
      })

      this.logger.log(`Notification email sent to ${email}`)
      return true
    } catch (error) {
      this.logger.error(`Failed to send notification email to ${email}`, error)
      return false
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.transporter) {
      return false
    }

    try {
      await this.transporter.verify()
      this.logger.log('Mail service connection verified')
      return true
    } catch (error) {
      this.logger.error('Mail service connection failed', error)
      return false
    }
  }
}
