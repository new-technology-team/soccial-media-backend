'use client'

import { useLocation } from 'react-router-dom'
import Navbar from '@/components/navigation/navbar'
import RouteGuard from '@/components/navigation/route-guard'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const hideMainNavbar = pathname.startsWith('/admin') || pathname.startsWith('/auth/admin-login')

  return (
    <>
      {!hideMainNavbar ? <Navbar /> : null}
      <main>
        <RouteGuard>{children}</RouteGuard>
      </main>
    </>
  )
}
