'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/contexts/auth-store'

const isRestrictedPath = (pathname: string) => pathname.startsWith('/admin') || pathname.startsWith('/moderator')
const guestAllowedPrefixes = ['/', '/feed', '/explore', '/posts', '/ai-chat', '/auth']
const moderatorRoutePermissions: Array<{ prefix: string; permission: string }> = [
  { prefix: '/moderator/posts', permission: 'manage_posts' },
  { prefix: '/moderator/users', permission: 'manage_users' },
  { prefix: '/moderator/reports', permission: 'manage_reports' },
  { prefix: '/moderator/dashboard', permission: 'manage_reports' },
]
const MODERATOR_BLOCKED_PREFIXES = ['/settings', '/profile/edit']

const firstAllowedModeratorPath = (permissions?: string[]) => {
  if (!permissions?.length || permissions.includes('manage_reports')) return '/moderator/dashboard'
  if (permissions.includes('manage_posts')) return '/moderator/posts'
  if (permissions.includes('manage_users')) return '/moderator/users'
  return '/feed'
}

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
    const role = (user?.role || '').toLowerCase()

    // Block moderators from user-only pages
    if (role === 'moderator' && MODERATOR_BLOCKED_PREFIXES.some((p) => pathname.startsWith(p))) {
      return false
    }

    if (!isRestrictedPath(pathname)) return true
    if (!user) return false

    if (pathname.startsWith('/admin')) {
      return role === 'admin'
    }

    if (role === 'admin') return true
    if (role !== 'moderator') return false

    const required = moderatorRoutePermissions.find((item) => pathname.startsWith(item.prefix))?.permission
    if (!required) return true
    if (!user.permissions?.length) return true
    return user.permissions.includes(required)
  }, [pathname, user])

  useEffect(() => {
    if (!mounted) return

    const isStaffPath = isRestrictedPath(pathname)
    const loginTarget = isStaffPath ? '/auth/admin-login' : '/auth/login'

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
      const role = (user?.role || '').toLowerCase()
      navigate(role === 'moderator' ? firstAllowedModeratorPath(user.permissions) : '/feed', { replace: true })
    }
  }, [hasPermission, mounted, pathname, navigate, user])

  if (!mounted) return null
  if (!user && !isGuestAllowedPath(pathname)) return null
  if (isRestrictedPath(pathname) && !hasPermission) return null

  return <>{children}</>
}

