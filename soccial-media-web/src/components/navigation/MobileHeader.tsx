'use client'

import { Link, useLocation } from 'react-router-dom'
import { Bell, MessageSquareText } from 'lucide-react'
import { cn } from '@/utils'
import { useAuthStore } from '@/contexts/auth-store'
import { useChatStore } from '@/contexts/chat-store'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

/* ==========================================================
   MobileHeader — Header đơn giản cho mobile
   - Logo + Notifications bell + Messages icon
   - Ẩn trên desktop
   ========================================================== */
export default function MobileHeader() {
  const { pathname } = useLocation()
  const user = useAuthStore((s) => s.user)
  const conversations = useChatStore((s) => s.conversations)

  const unreadMessages = conversations.reduce(
    (sum, conv) => sum + (conv.unreadCount || 0),
    0
  )

  // Ẩn trên trang messages (có header riêng)
  if (pathname.startsWith('/messages')) return null

  return (
    <header
      className={cn(
        'sticky top-0 z-30',
        'lg:hidden',
        'h-14',
        'bg-background/80 backdrop-blur-xl',
        'border-b border-border',
        'flex items-center justify-between',
        'px-4'
      )}
    >
      {/* Logo */}
      <Link to="/feed" className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <span className="text-white font-bold text-sm">Z</span>
        </div>
        <span className="font-bold text-base">ZChat</span>
      </Link>

      {/* Right actions */}
      <div className="flex items-center gap-1">
        <Link
          to="/notifications"
          className="p-2 rounded-full hover:bg-accent/10 text-muted-foreground hover:text-foreground transition-colors relative"
          aria-label="Thông báo"
        >
          <Bell size={20} />
        </Link>
        <Link
          to="/messages"
          className="p-2 rounded-full hover:bg-accent/10 text-muted-foreground hover:text-foreground transition-colors relative"
          aria-label="Tin nhắn"
        >
          <MessageSquareText size={20} />
          {unreadMessages > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary text-[9px] font-bold text-primary-foreground flex items-center justify-center leading-none">
              {unreadMessages > 9 ? '9+' : unreadMessages}
            </span>
          )}
        </Link>
        <Link
          to={user ? `/profile/${user.id}` : '/auth/login'}
          className="ml-1"
        >
          <Avatar className="w-8 h-8">
            <AvatarImage src={user?.avatarUrl || undefined} alt={user?.fullName || 'User'} />
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {(user?.fullName || 'U').charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </Link>
      </div>
    </header>
  )
}
