'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/lib/store/auth-store'

const isRestrictedPath = (pathname: string) => pathname.startsWith('/admin') || pathname.startsWith('/moderator')

const guestAllowedPrefixes = ['/', '/feed', '/explore', '/posts', '/ai-chat', '/auth']

const isGuestAllowedPath = (pathname: string) => {
  if (pathname === '/') return true
  return guestAllowedPrefixes.some((prefix) => prefix !== '/' && pathname.startsWith(prefix))
}

export default function RouteGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const user = useAuthStore((state) => state.user)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const hasPermission = useMemo(() => {
    if (!isRestrictedPath(pathname)) return true
    if (!user) return false

    if (pathname.startsWith('/admin')) {
      return user.role === 'admin'
    }

    return user.role === 'admin' || user.role === 'moderator'
  }, [pathname, user])

  useEffect(() => {
    if (!mounted) return

    const isAdminPath = pathname.startsWith('/admin')
    const loginTarget = isAdminPath ? '/auth/admin-login' : '/auth/login'

    if (!user && !isGuestAllowedPath(pathname)) {
      navigate(`${loginTarget}?next=${encodeURIComponent(pathname)}`, { replace: true })
      return
    }

    if (!isRestrictedPath(pathname)) return

    if (!user) {
      navigate(`${loginTarget}?next=${encodeURIComponent(pathname)}`, { replace: true })
      return
    }

    if (!hasPermission) {
      navigate('/feed', { replace: true })
    }
  }, [hasPermission, mounted, pathname, navigate, user])

  if (!mounted) return null
  if (!user && !isGuestAllowedPath(pathname)) return null
  if (isRestrictedPath(pathname) && !hasPermission) return null

  return <>{children}</>
}
