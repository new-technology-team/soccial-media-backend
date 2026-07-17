'use client'

import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  House,
  Compass,
  Bell,
  MessageSquareText,
  Users,
  Bookmark,
  Bot,
  User,
  Settings,
  SquarePen,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Sun,
  Globe,
  Pencil,
} from 'lucide-react'
import { cn } from '@/utils'
import { useAuthStore } from '@/contexts/auth-store'
import { useChatStore } from '@/contexts/chat-store'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

/* ---- Types ---- */
interface NavItem {
  icon: React.ElementType
  label: string
  href: string
  badge?: number
  private?: boolean
}

/* ---- Constants ---- */
const NAV_ITEMS: NavItem[] = [
  { icon: House, label: 'Trang chủ', href: '/feed' },
  { icon: Compass, label: 'Khám phá', href: '/explore' },
  { icon: Bell, label: 'Thông báo', href: '/notifications' },
  { icon: MessageSquareText, label: 'Tin nhắn', href: '/messages' },
  { icon: Users, label: 'Bạn bè', href: '/friends' },
  { icon: Bookmark, label: 'Đã lưu', href: '/feed?saved=1' },
  { icon: Bot, label: 'AI Chat', href: '/ai-chat' },
  { icon: User, label: 'Hồ sơ', href: '/profile' },
]

const BOTTOM_ITEMS: NavItem[] = [{ icon: Settings, label: 'Cài đặt', href: '/settings' }]

/* ==========================================================
   LeftSidebar — Navigation bên trái (kiểu Twitter/X)
   - Collapsed: icon-only, tooltip on hover
   - Expanded: icon + label, pin/unpin toggle
   - User avatar ở bottom → mở compact account popover
   ========================================================== */
export default function LeftSidebar() {
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const conversations = useChatStore((s) => s.conversations)

  const [expanded, setExpanded] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [showPopover, setShowPopover] = useState(false)
  const [isTablet, setIsTablet] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px) and (max-width: 1023px)')
    const handler = (e: MediaQueryListEvent | MediaQueryList) => setIsTablet(e.matches)
    handler(mql)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  const isExpanded = (expanded || pinned) && !isTablet
  const sidebarWidth = isTablet ? 72 : isExpanded ? 260 : 72

  // Unread messages count
  const unreadMessages = conversations.reduce(
    (sum, conv) => sum + (conv.unreadCount || 0),
    0
  )

  // Active route check
  const isActive = (href: string) => {
    if (href === '/profile') return pathname.startsWith('/profile/')
    if (href.includes('?')) {
      const [base, q] = href.split('?')
      return pathname === base && search.includes(q)
    }
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  const getProfileHref = () => {
    if (!user) return '/auth/login?next=/profile'
    return `/profile/${user.username || user.id}`
  }

  // Close popover on outside click / escape
  useEffect(() => {
    if (!showPopover) return
    const handleClick = (e: PointerEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowPopover(false)
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowPopover(false)
    }
    window.addEventListener('pointerdown', handleClick)
    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('pointerdown', handleClick)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [showPopover])

  const handleLogout = () => {
    clearAuth()
    setShowPopover(false)
    navigate('/auth/login')
  }

  const handleCreatePost = () => {
    setShowPopover(false)
    navigate('/feed?compose=1')
  }

  // Sidebar item renderer
  const renderNavItem = (item: NavItem) => {
    if (item.private && !user) return null

    const Icon = item.icon
    const href = item.href === '/profile' ? getProfileHref() : item.href
    const active = isActive(item.href)
    const badgeCount = item.href === '/messages' ? unreadMessages : item.badge || 0
    const showBadge = badgeCount > 0

    const linkContent = (
      <div
        className={cn(
          'group flex items-center gap-3 rounded-xl transition-all duration-200 cursor-pointer',
          isExpanded ? 'px-3 py-2.5 w-full' : 'w-12 h-12 justify-center mx-auto',
          active
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-accent/10 hover:text-foreground'
        )}
        onClick={() => {
          if (item.href === '/profile' && !user) {
            navigate('/auth/login?next=/profile')
          }
        }}
      >
        <div className="relative shrink-0">
          <Icon size={22} strokeWidth={active ? 2.5 : 1.75} />
          {showBadge && (
            <span className="absolute -top-1.5 -right-1.5 flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground px-1 leading-none">
              {badgeCount > 99 ? '99+' : badgeCount}
            </span>
          )}
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.span
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              className="text-sm font-medium whitespace-nowrap"
            >
              {item.label}
              {showBadge && (
                <span className="ml-2 text-xs text-muted-foreground">
                  ({badgeCount})
                </span>
              )}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    )

    if (!isExpanded) {
      return (
        <Tooltip key={item.href} delayDuration={300}>
          <TooltipTrigger asChild>
            <Link to={href} aria-label={item.label}>
              {linkContent}
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" className="ml-2">
            <p>{item.label}</p>
          </TooltipContent>
        </Tooltip>
      )
    }

    return (
      <Link key={item.href} to={href} aria-label={item.label}>
        {linkContent}
      </Link>
    )
  }

  return (
    <TooltipProvider delayDuration={300}>
      <motion.aside
        className={cn(
          'h-full shrink-0 z-10',
          'hidden md:flex flex-col',
          'bg-background border-r border-border'
        )}
        animate={{ width: sidebarWidth }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        onMouseEnter={() => !isTablet && !pinned && setExpanded(true)}
        onMouseLeave={() => !isTablet && !pinned && setExpanded(false)}
      >
        {/* ===== HEADER: Logo + Pin ===== */}
        <div className={cn('flex items-center shrink-0', isExpanded ? 'px-4 h-[64px]' : 'justify-center h-[64px]')}>
          <AnimatePresence mode="wait">
            {isExpanded ? (
              <motion.div
                key="expanded-logo"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-between w-full"
              >
                <Link to="/feed" className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                    <span className="text-white font-bold text-sm">Z</span>
                  </div>
                  <span className="font-bold text-lg">ZChat</span>
                </Link>
                <button
                  type="button"
                  onClick={() => setPinned(!pinned)}
                  className="p-1.5 rounded-lg hover:bg-accent/10 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={pinned ? 'Unpin sidebar' : 'Pin sidebar'}
                >
                  {pinned ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="collapsed-logo"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <Link to="/feed" aria-label="ZChat Home">
                  <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                    <span className="text-white font-bold text-base">Z</span>
                  </div>
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ===== NAVIGATION ITEMS ===== */}
        <nav className="flex-1 overflow-y-auto hide-scrollbar px-2 py-2 space-y-1">
          {NAV_ITEMS.map(renderNavItem)}
        </nav>

        {/* ===== BOTTOM: Settings + User Avatar + Account Popover ===== */}
        <div className="shrink-0 px-2 pb-3 space-y-1 border-t border-border pt-2">
          {BOTTOM_ITEMS.map(renderNavItem)}

          {/* User avatar → opens compact account popover */}
          <div className="relative" ref={popoverRef}>
            <button
              type="button"
              onClick={() => setShowPopover(!showPopover)}
              className={cn(
                'flex items-center gap-3 rounded-xl transition-all duration-200 w-full',
                'hover:bg-accent/10 text-foreground',
                isExpanded ? 'px-3 py-2.5' : 'p-1.5 justify-center'
              )}
            >
              <Avatar className="w-10 h-10 shrink-0 ring-2 ring-border">
                <AvatarImage
                  src={user?.avatarUrl || undefined}
                  alt={user?.fullName || 'User'}
                />
                <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                  {(user?.fullName || 'U').charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex-1 min-w-0 text-left"
                  >
                    <p className="text-sm font-medium truncate">
                      {user?.fullName || 'Khách'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      @{user?.username || 'guest'}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </button>

            {/* ===== COMPACT ACCOUNT POPOVER ===== */}
            <AnimatePresence>
              {showPopover && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.96 }}
                  transition={{ duration: 0.12, ease: 'easeOut' }}
                  className="absolute bottom-full left-0 mb-2 rounded-xl border border-border bg-popover shadow-xl overflow-hidden"
                  style={{ width: '270px', zIndex: 50 }}
                >
                  {/* Identity */}
                  <div className="px-4 py-3 border-b border-border">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10 shrink-0">
                        <AvatarImage
                          src={user?.avatarUrl || undefined}
                          alt={user?.fullName || 'User'}
                        />
                        <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                          {(user?.fullName || 'U').charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate">
                          {user?.fullName || 'Khách vãng lai'}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          @{user?.username || 'guest'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Profile actions */}
                  <div className="py-1">
                    <Link
                      to={user ? `/profile/${user.username || user.id}` : '/auth/login'}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-accent/10 transition-colors"
                      onClick={() => setShowPopover(false)}
                    >
                      <User size={16} className="text-muted-foreground" />
                      Xem hồ sơ
                    </Link>
                    <Link
                      to="/profile/edit"
                      className="flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-accent/10 transition-colors"
                      onClick={() => setShowPopover(false)}
                    >
                      <Pencil size={16} className="text-muted-foreground" />
                      Chỉnh sửa hồ sơ
                    </Link>
                  </div>

                  {/* Create Post — full-width primary button */}
                  <div className="px-3 py-2 border-t border-border">
                    <button
                      type="button"
                      onClick={handleCreatePost}
                      className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.97] transition-all font-semibold px-3 py-2 text-sm"
                    >
                      <SquarePen size={16} />
                      Tạo bài viết
                    </button>
                  </div>

                  {/* Preferences */}
                  <div className="py-1 border-t border-border">
                    <button
                      type="button"
                      className="flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-accent/10 transition-colors w-full text-left"
                    >
                      <Sun size={16} className="text-muted-foreground shrink-0" />
                      <span>Giao diện</span>
                    </button>
                    <button
                      type="button"
                      className="flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-accent/10 transition-colors w-full text-left"
                    >
                      <Globe size={16} className="text-muted-foreground shrink-0" />
                      <span>Ngôn ngữ</span>
                    </button>
                    <Link
                      to="/settings"
                      className="flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-accent/10 transition-colors"
                      onClick={() => setShowPopover(false)}
                    >
                      <Settings size={16} className="text-muted-foreground shrink-0" />
                      <span>Cài đặt</span>
                    </Link>
                  </div>

                  {/* Logout */}
                  {user && (
                    <div className="py-1 border-t border-border">
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="flex items-center gap-2.5 px-4 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors w-full text-left"
                      >
                        <LogOut size={16} />
                        Đăng xuất
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.aside>
    </TooltipProvider>
  )
}
