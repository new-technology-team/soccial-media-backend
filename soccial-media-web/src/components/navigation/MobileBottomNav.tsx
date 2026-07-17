'use client'

import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  House,
  Compass,
  Users,
  MessageSquareText,
  Bell,
  User,
} from 'lucide-react'
import { cn } from '@/utils'
import { useAuthStore } from '@/contexts/auth-store'
import { useChatStore } from '@/contexts/chat-store'

/* ==========================================================
   MobileBottomNav — Thanh navigation dưới cùng (mobile)
   - Hiện trên màn hình < 1024px
   - 5 tab chính + FAB button ở giữa
   - Badge cho notifications & messages
   ========================================================== */
export default function MobileBottomNav() {
  const { pathname, search } = useLocation()
  const user = useAuthStore((s) => s.user)
  const conversations = useChatStore((s) => s.conversations)

  const unreadMessages = conversations.reduce(
    (sum, conv) => sum + (conv.unreadCount || 0),
    0
  )

  const isActive = (href: string) => {
    if (href === '/profile') {
      return pathname.startsWith('/profile/') && !pathname.startsWith('/profile/edit')
    }
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  const tabs = [
    { icon: House, label: 'Trang chủ', href: '/feed' },
    { icon: Compass, label: 'Khám phá', href: '/explore' },
    { icon: Users, label: 'Bạn bè', href: '/friends' },
    {
      icon: MessageSquareText,
      label: 'Tin nhắn',
      href: '/messages',
      badge: unreadMessages,
    },
    { icon: Bell, label: 'Thông báo', href: '/notifications' },
    {
      icon: User,
      label: 'Hồ sơ',
      href: user ? `/profile/${user.id}` : '/auth/login?next=/profile',
    },
  ]

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50',
        'lg:hidden',
        'h-[var(--bottom-nav-height)]',
        'bg-background/80 backdrop-blur-xl',
        'border-t border-border',
        'safe-area-inset-bottom'
      )}
      aria-label="Điều hướng di động"
    >
      <div className="flex items-center justify-around h-full px-2 relative">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const active = isActive(tab.href)
          const showBadge = tab.badge !== undefined && tab.badge > 0

          return (
            <Link
              key={tab.href}
              to={tab.href}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5',
                'relative py-1.5 px-2 min-w-[48px] min-h-[48px] rounded-xl',
                'transition-colors duration-150',
                active
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              aria-label={tab.label}
              aria-current={active ? 'page' : undefined}
            >
              <div className="relative">
                <Icon size={22} strokeWidth={active ? 2.5 : 1.75} />
                {showBadge && (
                  <span className="absolute -top-1.5 -right-2 flex min-w-[16px] h-[16px] items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground px-1 leading-none">
                    {tab.badge! > 99 ? '99+' : tab.badge}
                  </span>
                )}
                {active && (
                  <motion.div
                    layoutId="mobile-nav-indicator"
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-primary"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </div>
              <span
                className={cn(
                  'text-[10px] font-medium leading-none',
                  active ? 'text-primary font-semibold' : 'text-muted-foreground'
                )}
              >
                {tab.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
