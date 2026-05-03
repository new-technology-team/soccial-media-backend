'use client'

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, Eye, EyeOff, Lock, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { api } from '@/lib/api'
import { useAuthStore } from '@/lib/store/auth-store'
import styles from '../auth.module.css'

export default function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const setAuth = useAuthStore((state) => state.setAuth)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    emailOrPhone: '',
    password: '',
  })

  useEffect(() => {
    const reason = searchParams.get('reason')
    if (reason === 'session-expired') {
      setError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.')
    }
  }, [searchParams])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const res = await api.login({ emailOrPhone: formData.emailOrPhone, password: formData.password })
      setAuth({
        accessToken: res.access_token,
        refreshToken: res.refresh_token,
        user: { ...res.user, role: 'USER', accountStatus: 'ACTIVE' },
      })
      navigate('/feed')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Email hoặc mật khẩu không hợp lệ. Vui lòng thử lại.'
      setError(message)
      if (message.toLowerCase().includes('xác thực')) {
        navigate(`/auth/verify-otp?identifier=${encodeURIComponent(formData.emailOrPhone)}`)
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={styles.loginWrap}>
      <div className={styles.panel}> 
        <header>
          <h2 className={styles.heading}>Chào mừng trở lại</h2>
          <p className={styles.subheading}>Đăng nhập để tiếp tục sử dụng tài khoản của bạn</p>
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
          <div className={styles.field}>
            <label htmlFor="emailOrPhone">
              Số điện thoại hoặc Email
            </label>
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
                className={`${styles.input} ${styles.inputMuted}`}
                required
              />
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor="password">
              Mật khẩu
            </label>
            <div className={styles.inputWrap}>
              <Lock size={18} className={styles.inputIcon} />
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                disabled={isLoading}
                className={`${styles.input} ${styles.inputMuted}`}
                required
              />
              <button type="button" onClick={() => setShowPassword((prev) => !prev)} className={styles.eyeBtn}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div className={styles.forgot}>
              <Link to="/auth/forgot-password">Quên mật khẩu?</Link>
            </div>
          </div>

          <button type="submit" className={styles.submit} disabled={isLoading}>
            {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>

          <div className={styles.divider}>
            <span>Hoặc đăng nhập bằng</span>
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
            Chưa có tài khoản?{' '}
            <Link to="/auth/signup">
              Đăng ký ngay
            </Link>
          </p>

          <p className={styles.switchTextSecondary}>
            Là quản trị viên? <Link to="/auth/admin-login">Đăng nhập admin</Link>
          </p>
        </form>
      </div>

      <aside className={styles.loginNotes}>
        <p>
          Đăng nhập để truy cập tin nhắn, thông báo và cá nhân hóa bảng tin theo sở thích của bạn.
        </p>
      </aside>
    </div>
  )
}
