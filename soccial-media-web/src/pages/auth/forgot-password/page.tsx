'use client'

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, CheckCircle2, KeyRound, Lock, ShieldCheck, Smartphone } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { api } from '@/api/client'
import styles from '../auth.module.css'

type Step = 'request' | 'reset'

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>('request')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [formData, setFormData] = useState({
    emailOrPhone: '',
    code: '',
    newPassword: '',
    confirmPassword: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }))
  }

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setIsLoading(true)

    try {
      const response = await api.forgotPassword(formData.emailOrPhone)
      setSuccess(response.message || 'Đã gửi mã OTP.')
      setStep('reset')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể gửi mã OTP. Vui lòng thử lại.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (formData.newPassword !== formData.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp')
      return
    }

    setIsLoading(true)

    try {
      const response = await api.resetPassword({
        emailOrPhone: formData.emailOrPhone,
        code: formData.code,
        newPassword: formData.newPassword,
      })
      setSuccess(response.message || 'Đặt lại mật khẩu thành công')
      setStep('request')
      setFormData((prev) => ({
        ...prev,
        code: '',
        newPassword: '',
        confirmPassword: '',
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đặt lại mật khẩu thất bại. Vui lòng thử lại.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={styles.panel}>
      <header>
        <h2 className={styles.heading}>Quên mật khẩu</h2>
        <p className={styles.subheading}>Khôi phục tài khoản trong 2 bước an toàn</p>
      </header>

      <div className={styles.alertSpace}>
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}
      </div>

      {step === 'request' ? (
        <form onSubmit={handleRequestCode} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="emailOrPhone">Số điện thoại hoặc Email</label>
            <div className={styles.inputWrap}>
              <Smartphone size={18} className={styles.inputIcon} />
              <input
                id="emailOrPhone"
                name="emailOrPhone"
                type="text"
                placeholder="Nhập số điện thoại hoặc email"
                value={formData.emailOrPhone}
                onChange={handleChange}
                disabled={isLoading}
                className={styles.input}
                required
              />
            </div>
          </div>

          <button type="submit" className={styles.submit} disabled={isLoading}>
            {isLoading ? 'Đang gửi mã...' : 'Gửi mã xác thực'}
          </button>

          <p className={styles.switchText}>
            Đã nhớ mật khẩu? <Link to="/auth/login">Đăng nhập</Link>
          </p>
        </form>
      ) : (
        <form onSubmit={handleResetPassword} className={styles.form}>
          <div className={styles.fieldUpper}>
            <label htmlFor="code">Mã OTP</label>
            <div className={styles.inputWrap}>
              <ShieldCheck size={18} className={styles.inputIcon} />
              <input
                id="code"
                name="code"
                type="text"
                placeholder="Nhập mã 6 số"
                value={formData.code}
                onChange={handleChange}
                disabled={isLoading}
                className={styles.input}
                required
              />
            </div>
          </div>

          <div className={styles.fieldUpper}>
            <label htmlFor="newPassword">Mật khẩu mới</label>
            <div className={styles.inputWrap}>
              <Lock size={18} className={styles.inputIcon} />
              <input
                id="newPassword"
                name="newPassword"
                type="password"
                placeholder="Nhập mật khẩu mới"
                value={formData.newPassword}
                onChange={handleChange}
                disabled={isLoading}
                className={styles.input}
                required
              />
            </div>
          </div>

          <div className={styles.fieldUpper}>
            <label htmlFor="confirmPassword">Xác nhận mật khẩu</label>
            <div className={styles.inputWrap}>
              <KeyRound size={18} className={styles.inputIcon} />
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="Nhập lại mật khẩu"
                value={formData.confirmPassword}
                onChange={handleChange}
                disabled={isLoading}
                className={styles.input}
                required
              />
            </div>
          </div>

          <button type="submit" className={styles.submit} disabled={isLoading}>
            {isLoading ? 'Đang cập nhật...' : 'Đặt lại mật khẩu'}
          </button>

          <div className={styles.socialGrid}>
            <button
              type="button"
              className={styles.socialBtn}
              onClick={() => setStep('request')}
              disabled={isLoading}
            >
              Gửi lại mã
            </button>
            <Link to="/auth/login" className={styles.socialBtn}>
              Quay lại đăng nhập
            </Link>
          </div>
        </form>
      )}
    </div>
  )
}
