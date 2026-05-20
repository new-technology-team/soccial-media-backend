'use client'

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, ShieldCheck } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { api } from '@/api/client'
import { useAuthStore } from '@/contexts/auth-store'
import styles from '../auth.module.css'

export default function VerifyOtpPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const setAuth = useAuthStore((state) => state.setAuth)
  const initialIdentifier = useMemo(() => searchParams.get('identifier') || '', [searchParams])
  const initialCode = useMemo(() => searchParams.get('code') || '', [searchParams])

  const [emailOrPhone, setEmailOrPhone] = useState(initialIdentifier)
  const [code, setCode] = useState(initialCode)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!emailOrPhone.trim() || !code.trim()) {
      setError('Vui lòng nhĂ¡º­p đầy đĂ¡»§ email/số điĂ¡»‡n thoại và mã OTP.')
      return
    }

    setIsSubmitting(true)
    try {
      const payload = await api.verifyRegistration({
        emailOrPhone: emailOrPhone.trim(),
        code: code.trim(),
      })
      setAuth({
        accessToken: payload.access_token,
        refreshToken: payload.refresh_token,
        user: { ...payload.user, role: 'USER', accountStatus: 'ACTIVE' },
      })
      navigate('/feed')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xác thĂ¡»±c OTP thĂ¡º¥t bại. Vui lòng thĂ¡»  lại.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResend = async () => {
    setError('')
    setSuccess('')
    if (!emailOrPhone.trim()) {
      setError('Vui lòng nhĂ¡º­p email/số điĂ¡»‡n thoại để gĂ¡» i lại mã OTP.')
      return
    }

    setIsResending(true)
    try {
      const response = await api.resendVerification(emailOrPhone.trim())
      const devCode = response.verificationCode ? ` (Mã dev: ${response.verificationCode})` : ''
      setSuccess(`${response.message || 'ĐĂ£ gĂ¡» i lại mã OTP.'}${devCode}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể gĂ¡» i lại mã OTP.')
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className={styles.panel}>
      <header>
        <h2 className={styles.heading}>Xác thĂ¡»±c OTP</h2>
        <p className={styles.subheading}>NhĂ¡º­p mã OTP đã gĂ¡» i đến email/số điĂ¡»‡n thoại của bạn</p>
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
          <label htmlFor="identifier">Email hoặc SĂ¡»‘ điĂ¡»‡n thoại</label>
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
            required
          />
        </div>

        <button type="submit" className={styles.submit} disabled={isSubmitting}>
          {isSubmitting ? 'Ä ang xác thĂ¡»±c...' : 'Xác thĂ¡»±c và đăng nhĂ¡º­p'}
        </button>

        <button type="button" className={styles.submitGhost} disabled={isResending} onClick={handleResend}>
          {isResending ? 'Ä ang gĂ¡» i lại mã...' : 'GĂ¡»­i lại mã OTP'}
        </button>

        <p className={styles.switchText}>
          Quay lại <Link to="/auth/login">Ä ăng nhĂ¡º­p</Link>
        </p>
      </form>
    </div>
  )
}

