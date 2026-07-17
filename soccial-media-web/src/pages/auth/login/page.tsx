'use client'

import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, Chrome, Eye, EyeOff, Lock, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { api, request } from '@/api/client'
import { useAuthStore } from '@/contexts/auth-store'
import type { AuthPayload } from '@/types'
import styles from '../auth.module.css'
import { API_BASE } from '@/config/api'

export default function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const setAuth = useAuthStore((state) => state.setAuth)
  const clearAuth = useAuthStore((state) => state.clearAuth)
  const googleScriptLoaded = useRef(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    emailOrPhone: '',
    password: '',
  })

  const handleGoogleCredential = async (credential: string) => {
    setIsGoogleLoading(true)
    setError('')
    clearAuth()

    try {
      const payload = await request<AuthPayload>(
        `/auth/google/id-token/exchange?idToken=${encodeURIComponent(credential)}`,
        { method: 'GET' }
      )
      setAuth(payload)
      navigate(payload.user.role === 'admin' ? '/admin/dashboard' : '/feed', { replace: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể hoàn tất đăng nhập mạng xã hội. Vui lòng thử lại.'
      setError(message)
    } finally {
      setIsGoogleLoading(false)
    }
  }

  const loadGoogleIdentityScript = async () => {
    if (typeof window === 'undefined') return false
    if ((window as any).google?.accounts?.id) return true
    if (googleScriptLoaded.current) return false

    googleScriptLoaded.current = true
    return await new Promise<boolean>((resolve) => {
      const existing = document.querySelector('script[data-google-gis="true"]') as HTMLScriptElement | null
      if (existing) {
        existing.addEventListener('load', () => resolve(Boolean((window as any).google?.accounts?.id)), { once: true })
        existing.addEventListener('error', () => resolve(false), { once: true })
        return
      }

      const script = document.createElement('script')
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.defer = true
      script.dataset.googleGis = 'true'
      script.onload = () => resolve(Boolean((window as any).google?.accounts?.id))
      script.onerror = () => resolve(false)
      document.head.appendChild(script)
    })
  }

  const handleGoogleLogin = () => {
    setIsGoogleLoading(true)
    setError('')
    // Redirect to backend Google OAuth
    window.location.href = `${API_BASE}/auth/google`
  }

  useEffect(() => {
    clearAuth()

    if (searchParams.get('reason') === 'session-expired') {
      setError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.')
      return
    }

    const socialProvider = searchParams.get('socialProvider')
    const socialError = searchParams.get('socialError')
    if (socialError === 'missing-config' && socialProvider) {
      setError(
        `Đăng nhập ${socialProvider === 'google' ? 'Google' : 'mạng xã hội'} chưa được cấu hình. Vui lòng thêm OAuth Client ID ở backend.`
      )
      return
    }

    if (socialError === 'callback') {
      setError('Không thể hoàn tất đăng nhập mạng xã hội. Vui lòng thử lại.')
    }
  }, [clearAuth, searchParams])

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [event.target.name]: event.target.value,
    }))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsLoading(true)
    setError('')
    clearAuth()

    try {
      const payload = await api.login(formData.emailOrPhone.trim(), formData.password)
      setAuth(payload)
      const role = (payload.user.role || '').toLowerCase()
      if (role === 'admin') {
        navigate('/admin/dashboard')
        return
      }
      if (role === 'moderator') {
        navigate('/moderator/dashboard')
        return
      }
      navigate('/feed')
    } catch (err) {
      clearAuth()
      const message = err instanceof Error ? err.message : 'Email/số điện thoại hoặc mật khẩu không hợp lệ.'
      setError(message)
      if (message.toLowerCase().includes('xác thực')) {
        navigate(`/auth/verify-otp?identifier=${encodeURIComponent(formData.emailOrPhone.trim())}`)
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
          {error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
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
                className={`${styles.input} ${styles.inputMuted}`}
                autoComplete="username"
                required
              />
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor="password">Mật khẩu</label>
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
                autoComplete="current-password"
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
            <Button
              type="button"
              variant="outline"
              className={styles.socialBtn}
              disabled={isLoading || isGoogleLoading}
              onClick={() => void handleGoogleLogin()}
            >
              <Chrome size={17} />
              {isGoogleLoading ? 'Đang xác thực...' : 'Google'}
            </Button>
          </div>

          <p className={styles.switchText}>
            Chưa có tài khoản? <Link to="/auth/signup">Đăng ký ngay</Link>
          </p>

          <p className={styles.switchTextSecondary}>
            Là admin/kiểm duyệt viên? <Link to="/auth/admin-login">Đăng nhập vận hành</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
