'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, ArrowLeft, ShieldCheck } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { api } from '@/api/client'
import { useAuthStore } from '@/contexts/auth-store'
import styles from '../auth.module.css'

export default function VerifyOtpPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const setAuth = useAuthStore((state) => state.setAuth)
  const initialIdentifier = useMemo(() => searchParams.get('identifier') || '', [searchParams])

  const [emailOrPhone, setEmailOrPhone] = useState(initialIdentifier)
  const [code, setCode] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)
  const cooldownTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current !== null) clearInterval(cooldownTimerRef.current)
    }
  }, [])

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
      setSuccess('')

    if (!emailOrPhone.trim() || !code.trim()) {
      setError('Vui lòng nhập đầy đủ email/số điện thoại và mã OTP.')
      return
    }

    setIsSubmitting(true)
    try {
      const payload = await api.verifyRegistration({
        emailOrPhone: emailOrPhone.trim(),
        code: code.trim(),
      })
      setAuth(payload)
      navigate('/feed')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xác thực OTP thất bại. Vui lòng thử lại.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResend = async () => {
    setError('')
    setSuccess('')
    if (!emailOrPhone.trim()) {
      setError('Vui lòng nhập email/số điện thoại để gửi lại mã OTP.')
      return
    }

    setIsResending(true)
    try {
      const response = await api.resendVerificationCode(emailOrPhone.trim())
      setSuccess(response.message || 'Đã gửi lại mã OTP.')
      setResendCooldown(60)
      if (cooldownTimerRef.current !== null) clearInterval(cooldownTimerRef.current)
      cooldownTimerRef.current = window.setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(cooldownTimerRef.current!)
            cooldownTimerRef.current = null
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể gửi lại mã OTP.')
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className={styles.panel}>
      <header>
        <h2 className={styles.heading}>Xác thực OTP</h2>
        <p className={styles.subheading}>Nhập mã OTP đã gửi đến email/số điện thoại của bạn</p>
      </header>

      <div className={styles.alertSpace}>
        {error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {success ? (
          <Alert>
            <ShieldCheck className="h-4 w-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        ) : null}
      </div>

      <form onSubmit={handleVerify} className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="identifier">Email hoặc Số điện thoại</label>
          <input
            id="identifier"
            name="identifier"
            type="text"
            value={emailOrPhone}
            onChange={(event) => setEmailOrPhone(event.target.value)}
            className={`${styles.input} ${styles.inputMuted}`}
            required
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="otpCode">Mã OTP</label>
          <input
            id="otpCode"
            name="otpCode"
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            className={`${styles.input} ${styles.inputMuted}`}
            autoFocus
            required
          />
        </div>

        <button type="submit" className={styles.submit} disabled={isSubmitting}>
          {isSubmitting ? 'Đang xác thực...' : 'Xác thực và đăng nhập'}
        </button>

        <button type="button" className={styles.submitGhost} disabled={isResending || resendCooldown > 0} onClick={handleResend}>
          {isResending ? 'Đang gửi lại mã...' : resendCooldown > 0 ? `Gửi lại (${resendCooldown}s)` : 'Gửi lại mã OTP'}
        </button>

        <button type="button" className={styles.backButton} onClick={() => navigate('/auth/login')}>
          <ArrowLeft size={16} />
          Quay lại đăng nhập
        </button>
      </form>
    </div>
  )
}
