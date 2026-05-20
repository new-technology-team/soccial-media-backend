'use client'

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, Eye, EyeOff, Lock, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { api } from '@/api/client'
import { useAuthStore } from '@/contexts/auth-store'
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
      setError('Phiên đăng nhĂ¡º­p đã hết hạn. Vui lòng đăng nhĂ¡º­p lại để tiếp tĂ¡»¥c.')
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
      const message = err instanceof Error ? err.message : 'Email hoặc mĂ¡º­t khẩu không hợp lĂ¡»‡. Vui lòng thá»  lại.'
      setError(message)
      if (message.toLowerCase().includes('xác thĂ¡»±c')) {
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
          <h2 className={styles.heading}>Chào mĂ¡»ừng trĂ¡» lại</h2>
          <p className={styles.subheading}>Ä ăng nhĂ¡º­p để tiếp tĂ¡»¥c sá»  dĂ¡»¥ng tài khoĂ¡º£n của bạn</p>
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
              Số điĂ¡»‡n thoại hoặc Email
            </label>
            <div className={styles.inputWrap}>
              <Smartphone size={18} className={styles.inputIcon} />
              <input
                id="emailOrPhone"
                name="emailOrPhone"
                type="text"
                placeholder="NhĂ¡º­p số điĂ¡»‡n thoại hoặc email"
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
              MĂ¡º­t khẩu
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
              <Link to="/auth/forgot-password">Quên mĂ¡º­t khẩu?</Link>
            </div>
          </div>

          <button type="submit" className={styles.submit} disabled={isLoading}>
            {isLoading ? 'Ä ang đăng nhĂ¡º­p...' : 'Ä ăng nhĂ¡º­p'}
          </button>

          <div className={styles.divider}>
            <span>Hoặc đăng nhĂ¡º­p bằng</span>
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
            Chưa có tài khoĂ¡º£n?{' '}
            <Link to="/auth/signup">
              Ä ăng ký ngay
            </Link>
          </p>

          <p className={styles.switchTextSecondary}>
            Là quĂ¡º£n trĂ¡»‹ viên? <Link to="/auth/admin-login">Ä ăng nhĂ¡º­p admin</Link>
          </p>
        </form>
      </div>

      <aside className={styles.loginNotes}>
        <p>
          Ä ăng nhĂ¡º­p để truy cĂ¡º­p tin nhĂ¡º¯n, thông báo và cá nhân hóa bĂ¡º£ng tin theo sĂ¡» thĂch của bạn.
        </p>
      </aside>
    </div>
  )
}
