'use client'

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, CalendarDays, Lock, Phone, ShieldCheck, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { api } from '@/lib/api'
import styles from '../auth.module.css'

export default function SignupPage() {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    displayName: '',
    emailOrPhone: '',
    dateOfBirth: '',
    gender: '',
    password: '',
    confirmPassword: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Mật khẩu không khớp')
      return
    }

    setIsLoading(true)

    try {
      const response = await api.register({
        fullName: formData.displayName,
        emailOrPhone: formData.emailOrPhone,
        dateOfBirth: formData.dateOfBirth || undefined,
        gender: formData.gender || undefined,
        password: formData.password,
      })

      if (response.requiresVerification) {
        const identifier = encodeURIComponent(response.emailOrPhone || formData.emailOrPhone)
        const codeQuery = response.verificationCode ? `&code=${encodeURIComponent(response.verificationCode)}` : ''
        navigate(`/auth/verify-otp?identifier=${identifier}${codeQuery}`)
      } else {
        navigate('/auth/login')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tạo tài khoản. Vui lòng thử lại.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={styles.panel}>
      <header>
        <h2 className={styles.heading}>Đăng ký tài khoản</h2>
        <p className={styles.subheading}>Bắt đầu hành trình kết nối của bạn</p>
      </header>

      <div className={styles.alertSpace}>
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.fieldUpper}>
          <label htmlFor="displayName">
              Họ và tên
          </label>
          <div className={styles.inputWrap}>
            <User size={18} className={styles.inputIcon} />
            <input
              id="displayName"
              name="displayName"
              type="text"
              placeholder="Nguyễn Văn A"
              value={formData.displayName}
              onChange={handleChange}
              disabled={isLoading}
              className={styles.input}
              required
            />
          </div>
        </div>

        <div className={styles.fieldUpper}>
          <label htmlFor="emailOrPhone">
              Số điện thoại hoặc Email
          </label>
          <div className={styles.inputWrap}>
            <Phone size={18} className={styles.inputIcon} />
            <input
              id="emailOrPhone"
              name="emailOrPhone"
              type="text"
              placeholder="090 123 4567"
              value={formData.emailOrPhone}
              onChange={handleChange}
              disabled={isLoading}
              className={styles.input}
              required
            />
          </div>
        </div>

        <div className={styles.twoCols}>
          <div className={styles.fieldUpper}>
            <label htmlFor="dateOfBirth">
              Ngày sinh
            </label>
            <div className={styles.inputWrap}>
              <CalendarDays size={18} className={styles.inputIcon} />
              <input
                id="dateOfBirth"
                name="dateOfBirth"
                type="date"
                value={formData.dateOfBirth}
                onChange={handleChange}
                disabled={isLoading}
                className={`${styles.input} ${styles.inputMuted}`}
              />
            </div>
          </div>

          <div className={styles.fieldUpper}>
            <label htmlFor="gender">
              Giới tính
            </label>
            <select
              id="gender"
              name="gender"
              value={formData.gender}
              onChange={handleChange}
              disabled={isLoading}
              className={`${styles.select} ${styles.inputMuted}`}
            >
              <option value="">Chọn giới tính</option>
              <option value="male">Nam</option>
              <option value="female">Nữ</option>
              <option value="other">Khác</option>
            </select>
          </div>

        </div>

        <div className={styles.twoCols}>
          <div className={styles.fieldUpper}>
            <label htmlFor="password">
                Mật khẩu
            </label>
            <div className={styles.inputWrap}>
              <Lock size={18} className={styles.inputIcon} />
              <input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                disabled={isLoading}
                className={styles.input}
                required
              />
            </div>
          </div>

          <div className={styles.fieldUpper}>
            <label htmlFor="confirmPassword">
                Xác nhận
            </label>
            <div className={styles.inputWrap}>
              <ShieldCheck size={18} className={styles.inputIcon} />
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={handleChange}
                disabled={isLoading}
                className={styles.input}
                required
              />
            </div>
          </div>
        </div>

        <button type="submit" className={styles.submit} disabled={isLoading}>
          {isLoading ? 'Đang tạo tài khoản...' : 'Đăng ký'}
        </button>

        <div className={styles.divider}>
          <span>Hoặc đăng ký bằng</span>
        </div>

        <div className={styles.socialGrid}>
          <Button variant="outline" className={styles.socialBtn} disabled={isLoading}>
            Google
          </Button>
          <Button variant="outline" className={styles.socialBtn} disabled={isLoading}>
            Apple
          </Button>
        </div>

        <p className={styles.switchText}>
          Đã có tài khoản?{' '}
          <Link to="/auth/login">
            Đăng nhập
          </Link>
        </p>
      </form>
    </div>
  )
}
