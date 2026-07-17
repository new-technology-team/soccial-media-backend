'use client'

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { request } from '@/api/client'
import { useAuthStore } from '@/contexts/auth-store'
import type { User } from '@/types'
import styles from '../auth.module.css'

const backendCallbackBase = '/api/auth'

const getParamSource = () => {
  const queryParams = new URLSearchParams(window.location.search)
  const hashText = window.location.hash.replace(/^#/, '')
  const hashQuery = hashText.includes('?') ? hashText.slice(hashText.indexOf('?') + 1) : hashText
  const hashParams = new URLSearchParams(hashQuery)
  const merged = new URLSearchParams(hashParams)

  queryParams.forEach((value, key) => merged.set(key, value))
  return merged
}

const getProvider = (params: URLSearchParams) => {
  return 'google'
}

export default function SocialCallbackPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const params = getParamSource()
      const accessToken = params.get('accessToken')
      const refreshToken = params.get('refreshToken')
      const userText = params.get('user')

      if (accessToken && refreshToken) {
        try {
          if (userText) {
            const user = JSON.parse(userText) as User
            setAuth({ accessToken, refreshToken, user })
            sessionStorage.removeItem('zchat-social-provider')
            navigate(user.role === 'admin' ? '/admin/dashboard' : '/feed', { replace: true })
            return
          }

          // No user in URL → fetch from backend
          const me = await request<{ user: User }>('/auth/me', { method: 'GET' }, accessToken)
          if (cancelled) return
          setAuth({ accessToken, refreshToken, user: me.user })
          sessionStorage.removeItem('zchat-social-provider')
          navigate(me.user.role === 'admin' ? '/admin/dashboard' : '/feed', { replace: true })
          return
        } catch {
          if (cancelled) return
          navigate('/auth/login?socialError=callback&socialDetail=invalid-payload', { replace: true })
        }
        return
      }

      const code = params.get('code')
      if (code) {
        const provider = getProvider(params)
        try {
          const payload = await request<{ accessToken: string; refreshToken: string; user: User }>(
            `/auth/google/exchange?code=${encodeURIComponent(code)}`,
            { method: 'GET' }
          )
          if (cancelled) return
          setAuth(payload)
          sessionStorage.removeItem('zchat-social-provider')
          navigate(payload.user.role === 'admin' ? '/admin/dashboard' : '/feed', { replace: true })
        } catch {
          if (cancelled) return
          navigate(`/auth/login?socialError=callback&socialDetail=${encodeURIComponent(`exchange-failed:${provider}`)}`, { replace: true })
        }
        return
      }

      const idToken = params.get('id_token') || params.get('credential')
      if (idToken) {
        const provider = getProvider(params)
        try {
          const payload = await request<{ accessToken: string; refreshToken: string; user: User }>(
            `/auth/google/id-token/exchange?idToken=${encodeURIComponent(idToken)}`,
            { method: 'GET' }
          )
          if (cancelled) return
          setAuth(payload)
          sessionStorage.removeItem('zchat-social-provider')
          navigate(payload.user.role === 'admin' ? '/admin/dashboard' : '/feed', { replace: true })
        } catch {
          if (cancelled) return
          navigate(`/auth/login?socialError=callback&socialDetail=${encodeURIComponent(`exchange-failed:${provider}`)}`, { replace: true })
        }
        return
      }

      const error = params.get('error')
      const savedProvider = sessionStorage.getItem('zchat-social-provider')
      const alreadyRetried = sessionStorage.getItem('zchat-social-retry') === 'true'
      if (!error && savedProvider && !alreadyRetried && [...params.keys()].length === 0) {
        sessionStorage.setItem('zchat-social-retry', 'true')
        window.location.replace(`${backendCallbackBase}/${savedProvider}`)
        return
      }

      sessionStorage.removeItem('zchat-social-retry')
      const receivedKeys = [...params.keys()].filter(Boolean).slice(0, 6).join(',')
      const detail = error || (receivedKeys ? `missing-payload:${receivedKeys}` : 'missing-payload:no-query')
      navigate(`/auth/login?socialError=callback&socialDetail=${encodeURIComponent(detail)}`, {
        replace: true,
      })
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [navigate, setAuth])

  return (
    <div className={styles.panel}>
      <header>
        <h2 className={styles.heading}>Đang đăng nhập</h2>
        <p className={styles.subheading}>Vui lòng chờ trong giây lát...</p>
      </header>
      <div className={styles.alertSpace}>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Hệ thống đang hoàn tất đăng nhập mạng xã hội.</AlertDescription>
        </Alert>
      </div>
    </div>
  )
}
