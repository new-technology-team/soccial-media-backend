'use client'

import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertCircle, AtSign, CalendarDays, Chrome, Lock, Mail, ShieldCheck, User } from 'lucide-react'
import { CheckCircle, Loader2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { api } from '@/api/client'
import { useAuthStore } from '@/contexts/auth-store'
import { startSocialAuth } from '../social-auth'
import styles from '../auth.module.css'

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const phoneRegex = /^(0|\+84)[0-9]{8,10}$/

const normalizePhoneOrEmail = (value: string) => {
  const trimmed = value.trim()
  return emailRegex.test(trimmed) ? trimmed.toLowerCase() : trimmed.replace(/[\s.-]/g, '')
}

export default function SignupPage() {
  const navigate = useNavigate()
  const clearAuth = useAuthStore((state) => state.clearAuth)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)
  const [checkingUsername, setCheckingUsername] = useState(false)
  const [formData, setFormData] = useState({
    displayName: '',
    username: '',
    emailOrPhone: '',
    dateOfBirth: '',
    gender: '',
    password: '',
    confirmPassword: '',
  })

  useEffect(() => {
    clearAuth()
  }, [clearAuth])

  useEffect(() => {
    const u = formData.username.trim().toLowerCase()
    if (u.length < 3) {
      setUsernameAvailable(null)
      setCheckingUsername(false)
      return
    }
    if (!/^[a-zA-Z0-9._]+$/.test(u)) {
      setUsernameAvailable(null)
      setCheckingUsername(false)
      return
    }
    setCheckingUsername(true)
    const timer = setTimeout(async () => {
      try {
        const result = await api.checkUsername(u)
        setUsernameAvailable(result.available)
      } catch {
        setUsernameAvailable(null)
      } finally {
        setCheckingUsername(false)
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [formData.username])

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
    setTouched((prev) => ({ ...prev, [name]: true }))
  }

  const validateField = (name: string, data = formData) => {
    const displayName = data.displayName.trim()
    const identifier = normalizePhoneOrEmail(data.emailOrPhone)
    const username = data.username.trim().toLowerCase()

    if (name === 'displayName' && (displayName.length < 2 || displayName.length > 50)) {
      return 'Họ và tên cần từ 2 đến 50 ký tự.'
    }

    if (name === 'displayName' && !/^[\p{L}\s'.-]+$/u.test(displayName)) {
      return 'Họ và tên chỉ nên chứa chữ cái và khoảng trắng.'
    }

    if (name === 'username' && (username.length < 3 || username.length > 30)) {
      return 'Tên đăng nhập phải từ 3 đến 30 ký tự.'
    }

    if (name === 'username' && !/^[a-zA-Z0-9._]+$/.test(username)) {
      return 'Tên đăng nhập chỉ chứa chữ, số, dấu chấm và gạch dưới.'
    }

    if (name === 'emailOrPhone' && !emailRegex.test(identifier) && !phoneRegex.test(identifier)) {
      return 'Vui lòng nhập email hợp lệ hoặc số điện thoại Việt Nam hợp lệ.'
    }

    if (name === 'dateOfBirth' && !data.dateOfBirth) {
      return 'Vui lòng chọn ngày sinh.'
    }

    if (name === 'dateOfBirth') {
      const birthday = new Date(data.dateOfBirth)
      const today = new Date()
      const age = today.getFullYear() - birthday.getFullYear()
      const hadBirthday =
        today.getMonth() > birthday.getMonth() ||
        (today.getMonth() === birthday.getMonth() && today.getDate() >= birthday.getDate())
      const realAge = hadBirthday ? age : age - 1

      if (Number.isNaN(birthday.getTime()) || birthday > today || realAge < 13) {
        return 'Ngày sinh chưa hợp lệ. Người dùng cần từ 13 tuổi trở lên.'
      }
    }

    if (name === 'gender' && !data.gender) {
      return 'Vui lòng chọn giới tính.'
    }

    if (name === 'password' && data.password.length < 8) {
      return 'Mật khẩu cần ít nhất 8 ký tự.'
    }

    if (name === 'password' && (!/[A-Za-z]/.test(data.password) || !/[0-9]/.test(data.password))) {
      return 'Mật khẩu nên có cả chữ và số.'
    }

    if (name === 'confirmPassword' && data.password !== data.confirmPassword) {
      return 'Mật khẩu xác nhận không khớp.'
    }

    return ''
  }

  const fieldErrors = {
    displayName: validateField('displayName'),
    username: validateField('username'),
    emailOrPhone: validateField('emailOrPhone'),
    dateOfBirth: validateField('dateOfBirth'),
    gender: validateField('gender'),
    password: validateField('password'),
    confirmPassword: validateField('confirmPassword'),
  }

  const validateForm = () => Object.values(fieldErrors).find(Boolean) || ''

  const markTouched = (name: string) => {
    setTouched((prev) => ({ ...prev, [name]: true }))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    clearAuth()

    const validationError = validateForm()
    if (validationError) {
      setTouched({
        displayName: true,
        username: true,
        emailOrPhone: true,
        dateOfBirth: true,
        gender: true,
        password: true,
        confirmPassword: true,
      })
      setError(validationError)
      return
    }

    setIsLoading(true)

    try {
      const identifier = normalizePhoneOrEmail(formData.emailOrPhone)
      const response = await api.register({
        username: formData.username.trim().toLowerCase(),
        fullName: formData.displayName.trim(),
        emailOrPhone: identifier,
        dateOfBirth: formData.dateOfBirth,
        gender: formData.gender,
        password: formData.password,
      })

      if (response.requiresVerification) {
        navigate(`/auth/verify-otp?identifier=${encodeURIComponent(response.emailOrPhone || identifier)}`)
      } else {
        navigate('/auth/login')
      }
    } catch (err) {
      clearAuth()
      setError(err instanceof Error ? err.message : 'Không thể tạo tài khoản. Vui lòng thử lại.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={styles.panel}>
      <header>
        <h2 className={styles.heading}>Đăng ký tài khoản</h2>
        <p className={styles.subheading}>Tạo tài khoản để nhắn tin và kết nối an toàn</p>
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
          <label htmlFor="displayName">Họ và tên</label>
          <div className={styles.inputWrap}>
            <User size={18} className={styles.inputIcon} />
            <input
              id="displayName"
              name="displayName"
              type="text"
              placeholder="Nguyễn Văn A"
              value={formData.displayName}
              onChange={handleChange}
              onBlur={() => markTouched('displayName')}
              disabled={isLoading}
              className={styles.input}
              autoComplete="name"
              required
            />
          </div>
          {touched.displayName && fieldErrors.displayName ? (
            <p className={styles.fieldError}>{fieldErrors.displayName}</p>
          ) : null}
        </div>

        <div className={styles.field}>
          <label htmlFor="username">Tên đăng nhập</label>
          <div className={styles.inputWrap}>
            <AtSign size={18} className={styles.inputIcon} />
            <input
              id="username"
              name="username"
              type="text"
              placeholder="nguyen.van.a"
              value={formData.username}
              onChange={handleChange}
              onBlur={() => markTouched('username')}
              disabled={isLoading}
              className={styles.input}
              autoComplete="off"
              required
            />
            {checkingUsername && <Loader2 size={16} className="animate-spin text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2" />}
            {!checkingUsername && usernameAvailable === true && touched.username && !fieldErrors.username && (
              <CheckCircle size={16} className="text-green-500 absolute right-3 top-1/2 -translate-y-1/2" />
            )}
            {!checkingUsername && usernameAvailable === false && touched.username && (
              <XCircle size={16} className="text-red-500 absolute right-3 top-1/2 -translate-y-1/2" />
            )}
          </div>
          {touched.username && fieldErrors.username ? (
            <p className={styles.fieldError}>{fieldErrors.username}</p>
          ) : null}
          {touched.username && !fieldErrors.username && usernameAvailable === false ? (
            <p className={styles.fieldError}>Tên đăng nhập đã được sử dụng.</p>
          ) : null}
        </div>

        <div className={styles.field}>
          <label htmlFor="emailOrPhone">Email</label>
          <div className={styles.inputWrap}>
            <Mail size={18} className={styles.inputIcon} />
            <input
              id="emailOrPhone"
              name="emailOrPhone"
              type="email"
              placeholder="email@example.com"
              value={formData.emailOrPhone}
              onChange={handleChange}
              onBlur={() => markTouched('emailOrPhone')}
              disabled={isLoading}
              className={styles.input}
              autoComplete="username"
              required
            />
          </div>
          {touched.emailOrPhone && fieldErrors.emailOrPhone ? (
            <p className={styles.fieldError}>{fieldErrors.emailOrPhone}</p>
          ) : null}
        </div>

        <div className={styles.twoCols}>
          <div className={styles.field}>
            <label htmlFor="dateOfBirth">Ngày sinh</label>
            <div className={styles.inputWrap}>
              <CalendarDays size={18} className={styles.inputIcon} />
              <input
                id="dateOfBirth"
                name="dateOfBirth"
                type="date"
                value={formData.dateOfBirth}
                onChange={handleChange}
                onBlur={() => markTouched('dateOfBirth')}
                disabled={isLoading}
                className={`${styles.input} ${styles.inputMuted}`}
                required
              />
            </div>
            {touched.dateOfBirth && fieldErrors.dateOfBirth ? (
              <p className={styles.fieldError}>{fieldErrors.dateOfBirth}</p>
            ) : null}
          </div>

          <div className={styles.field}>
            <label htmlFor="gender">Giới tính</label>
            <select
              id="gender"
              name="gender"
              value={formData.gender}
              onChange={handleChange}
              onBlur={() => markTouched('gender')}
              disabled={isLoading}
              className={`${styles.select} ${styles.inputMuted}`}
              required
            >
              <option value="">Chọn giới tính</option>
              <option value="male">Nam</option>
              <option value="female">Nữ</option>
              <option value="other">Khác</option>
            </select>
            {touched.gender && fieldErrors.gender ? <p className={styles.fieldError}>{fieldErrors.gender}</p> : null}
          </div>
        </div>

        <div className={styles.twoCols}>
          <div className={styles.field}>
            <label htmlFor="password">Mật khẩu</label>
            <div className={styles.inputWrap}>
              <Lock size={18} className={styles.inputIcon} />
              <input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                onBlur={() => markTouched('password')}
                disabled={isLoading}
                className={styles.input}
                autoComplete="new-password"
                required
              />
            </div>
            {touched.password && fieldErrors.password ? (
              <p className={styles.fieldError}>{fieldErrors.password}</p>
            ) : null}
          </div>

          <div className={styles.field}>
            <label htmlFor="confirmPassword">Xác nhận</label>
            <div className={styles.inputWrap}>
              <ShieldCheck size={18} className={styles.inputIcon} />
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={handleChange}
                onBlur={() => markTouched('confirmPassword')}
                disabled={isLoading}
                className={styles.input}
                autoComplete="new-password"
                required
              />
            </div>
            {touched.confirmPassword && fieldErrors.confirmPassword ? (
              <p className={styles.fieldError}>{fieldErrors.confirmPassword}</p>
            ) : null}
          </div>
        </div>

        <button type="submit" className={styles.submit} disabled={isLoading}>
          {isLoading ? 'Đang tạo tài khoản...' : 'Đăng ký'}
        </button>

        <div className={styles.divider}>
          <span>Hoặc đăng ký bằng</span>
        </div>

        <div className={styles.socialGrid}>
          <Button
            type="button"
            variant="outline"
            className={styles.socialBtn}
            disabled={isLoading}
            onClick={() => startSocialAuth('google')}
          >
            <Chrome size={17} />
            Google
          </Button>
        </div>

        <p className={styles.switchText}>
          Đã có tài khoản? <Link to="/auth/login">Đăng nhập</Link>
        </p>
      </form>
    </div>
  )
}
