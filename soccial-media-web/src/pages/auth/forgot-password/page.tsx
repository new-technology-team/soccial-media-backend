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
      const debugCode = response.resetCode ? ` Mã dev: ${response.resetCode}` : ''
      setSuccess(`${response.message || 'ĐĂ£ gĂ¡» i mã OTP.'}${debugCode}`)
      setStep('reset')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể gĂ¡» i mã OTP. Vui lòng thĂ¡»  lại.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (formData.newPassword !== formData.confirmPassword) {
      setError('MĂ¡º­t khẩu xác nhĂ¡º­n không khĂ¡»›p')
      return
    }

    setIsLoading(true)

    try {
      const response = await api.resetPassword({
        emailOrPhone: formData.emailOrPhone,
        code: formData.code,
        newPassword: formData.newPassword,
      })
      setSuccess(response.message || 'Ä ặt lại mĂ¡º­t khẩu thành công')
      setStep('request')
      setFormData((prev) => ({
        ...prev,
        code: '',
        newPassword: '',
        confirmPassword: '',
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ä ặt lại mĂ¡º­t khẩu thĂ¡º¥t bại. Vui lòng thĂ¡»  lại.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={styles.panel}>
      <header>
        <h2 className={styles.heading}>Quên mĂ¡º­t khẩu</h2>
        <p className={styles.subheading}>Khôi phĂ¡»¥c tài khoĂ¡º£n trong 2 bưĂ¡»›c an toàn</p>
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
            <label htmlFor="emailOrPhone">SĂ¡»‘ điĂ¡»‡n thoại hoặc Email</label>
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
                className={styles.input}
                required
              />
            </div>
          </div>

          <button type="submit" className={styles.submit} disabled={isLoading}>
            {isLoading ? 'Ä ang gĂ¡» i mã...' : 'GĂ¡»­i mã xác thĂ¡»±c'}
          </button>

          <p className={styles.switchText}>
            ĐĂ£ nhĂ¡»› mĂ¡º­t khẩu? <Link to="/auth/login">Ä ăng nhĂ¡º­p</Link>
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
                placeholder="NhĂ¡º­p mã 6 sĂ¡»‘"
                value={formData.code}
                onChange={handleChange}
                disabled={isLoading}
                className={styles.input}
                required
              />
            </div>
          </div>

          <div className={styles.fieldUpper}>
            <label htmlFor="newPassword">MĂ¡º­t khẩu mĂ¡»›i</label>
            <div className={styles.inputWrap}>
              <Lock size={18} className={styles.inputIcon} />
              <input
                id="newPassword"
                name="newPassword"
                type="password"
                placeholder="NhĂ¡º­p mĂ¡º­t khẩu mĂ¡»›i"
                value={formData.newPassword}
                onChange={handleChange}
                disabled={isLoading}
                className={styles.input}
                required
              />
            </div>
          </div>

          <div className={styles.fieldUpper}>
            <label htmlFor="confirmPassword">Xác nhĂ¡º­n mĂ¡º­t khẩu</label>
            <div className={styles.inputWrap}>
              <KeyRound size={18} className={styles.inputIcon} />
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="NhĂ¡º­p lại mĂ¡º­t khẩu"
                value={formData.confirmPassword}
                onChange={handleChange}
                disabled={isLoading}
                className={styles.input}
                required
              />
            </div>
          </div>

          <button type="submit" className={styles.submit} disabled={isLoading}>
            {isLoading ? 'Ä ang cĂ¡º­p nhĂ¡º­t...' : 'Ä ặt lại mĂ¡º­t khẩu'}
          </button>

          <div className={styles.socialGrid}>
            <button
              type="button"
              className={styles.socialBtn}
              onClick={() => setStep('request')}
              disabled={isLoading}
            >
              GĂ¡»­i lại mã
            </button>
            <Link to="/auth/login" className={styles.socialBtn}>
              Quay lại đăng nhĂ¡º­p
            </Link>
          </div>
        </form>
      )}
    </div>
  )
}

