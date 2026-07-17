'use client'

import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import ModeratorNav from '@/components/navigation/moderator-nav'
import RouteGuard from '@/components/navigation/route-guard'
import { Toaster } from '@/components/ui/toaster'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const isAdminArea = pathname.startsWith('/admin')
  const isModeratorArea = pathname.startsWith('/moderator')
  const isAuthPage = pathname.startsWith('/auth')
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  return (
    <>
      {/* Offline banner */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-100 dark:bg-amber-900/80 text-amber-900 dark:text-amber-100 px-4 py-2 text-center text-sm font-semibold">
          Bạn đang offline — kiểm tra kết nối mạng
        </div>
      )}

      {/* Auth pages — no layout wrapper */}
      {isAuthPage || isAdminArea ? (
        <RouteGuard>{children}</RouteGuard>
      ) : isModeratorArea ? (
        /* Moderator area — sidebar nav + content */
        <div className="flex min-h-screen bg-background">
          <ModeratorNav />
          <div className="flex-1 min-w-0">
            <RouteGuard>{children}</RouteGuard>
          </div>
        </div>
      ) : (
        /* Main app — layout handled by MainLayout in routes */
        <RouteGuard>{children}</RouteGuard>
      )}

      <Toaster />
    </>
  )
}
