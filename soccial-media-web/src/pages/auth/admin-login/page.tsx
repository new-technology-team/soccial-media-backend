'use client'

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, Eye, EyeOff, Lock, Shield } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { api } from '@/api/client'
import { useAuthStore } from '@/contexts/auth-store'
import styles from '../auth.module.css'

export default function AdminLoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const setAuth = useAuthStore((state) => state.setAuth)
  const clearAuth = useAuthStore((state) => state.clearAuth)
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
      setError('Phiên đăng nhĂ¡º­p admin đã hết hạn. Vui lòng đăng nhĂ¡º­p lại.')
    }
  }, [searchParams])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const res = await api.login({ emailOrPhone: formData.emailOrPhone, password: formData.password })
      if ((res.user as Record<string, unknown>).role !== 'ADMIN') {
        clearAuth()
        setError('Tài khoĂ¡º£n này không có quyĂ¡»n truy cĂ¡º­p khu vĂ¡»±c quĂ¡º£n trĂ¡»‹ admin.')
        return
      }

      setAuth({
        accessToken: res.access_token,
        refreshToken: res.refresh_token,
        user: { ...res.user, role: 'ADMIN', accountStatus: 'ACTIVE' },
      })
      const nextPath = searchParams.get('next') || '/admin/dashboard'
      navigate(nextPath)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thông tin đăng nhĂ¡º­p admin không hợp lĂ¡»‡.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={styles.loginWrap}>
      <div className={`${styles.panel} ${styles.adminPanel}`}>
        <header>
          <p className={styles.adminBadge}>Admin Only</p>
          <h2 className={styles.heading}>Đăng nhĂ¡º­p quĂ¡º£n trĂ¡»‹</h2>
          <p className={styles.subheading}>Khu vĂ¡»±c dành riêng cho tài khoĂ¡º£n admin hĂ¡»‡ thống</p>
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
            <label htmlFor="emailOrPhone">Email hoặc SĐT admin</label>
            <div className={styles.inputWrap}>
              <Shield size={18} className={styles.inputIcon} />
              <input
                id="emailOrPhone"
                name="emailOrPhone"
                type="text"
                placeholder="admin@zchat.local"
                value={formData.emailOrPhone}
                onChange={handleChange}
                disabled={isLoading}
                className={`${styles.input} ${styles.inputMuted}`}
                required
              />
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor="password">MĂ¡º­t khẩu</label>
            <div className={styles.inputWrap}>
              <Lock size={18} className={styles.inputIcon} />
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Ă¢€¢Ă¢€¢Ă¢€¢Ă¢€¢Ă¢€¢Ă¢€¢Ă¢€¢Ă¢€¢"
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
          </div>

          <button type="submit" className={styles.submit} disabled={isLoading}>
            {isLoading ? 'Đang đăng nhĂ¡º­p...' : 'Vào khu quĂ¡º£n trĂ¡»‹'}
          </button>

          <p className={styles.switchText}>
            Đăng nhĂ¡º­p ngưĂ¡»i dùng thưĂ¡»ng? <Link to="/auth/login">ĐĂ¡»•i sang đăng nhĂ¡º­p ngưĂ¡»i dùng</Link>
          </p>
        </form>
      </div>

      <aside className={styles.loginNotes}>
        <p>Trang này dành riêng cho quĂ¡º£n trĂ¡»‹ viên. HĂ¡»‡ thĂ¡»‘ng sẽ chặn nĂ¡º¿u tài khoĂ¡º£n không phĂ¡º£i vai trò admin.</p>
      </aside>
    </div>
  )
}

