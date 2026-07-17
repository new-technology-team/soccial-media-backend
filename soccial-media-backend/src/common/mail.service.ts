import { Injectable } from '@nestjs/common'
import * as nodemailer from 'nodemailer'

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter | null = null

  constructor() {
    const user = process.env.SMTP_USER
    const pass = process.env.SMTP_PASS

    if (user && pass) {
      this.transporter = nodemailer.createTransport({
        service: process.env.SMTP_SERVICE || 'gmail',
        auth: { user, pass },
      })
    }
  }

  async sendOtpEmail(to: string, code: string, purpose: string) {
    if (!this.transporter) {
      console.warn(`[Mail] SMTP not configured. Skipping email to ${to}. OTP: ${code}`)
      return { message: 'OTP generated (SMTP not configured)', code }
    }

    const subject =
      purpose === 'reset_password'
        ? 'ZChat - Mã đặt lại mật khẩu'
        : purpose === 'verify_registration'
          ? 'ZChat - Mã xác nhận đăng ký'
          : 'ZChat - Mã xác thực'

    const from = process.env.SMTP_FROM || '"ZChat" <noreply@zchat.com>'

    try {
      await this.transporter.sendMail({
        from,
        to,
        subject,
        html: `
          <div style="font-family: Arial; max-width: 480px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #2563eb;">ZChat</h2>
            <p>Mã xác thực của bạn là:</p>
            <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; padding: 16px; background: #f3f4f6; border-radius: 8px; margin: 16px 0;">
              ${code}
            </div>
            <p style="color: #6b7280; font-size: 14px;">Mã có hiệu lực trong 10 phút.</p>
          </div>
        `,
      })
      return { message: 'Email sent' }
    } catch (error) {
      console.error('[Mail] Failed to send email:', error.message)
      return { message: 'Failed to send email', error: error.message }
    }
  }
}
