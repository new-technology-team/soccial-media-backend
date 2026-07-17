'use client'

import { useNavigate, useLocation, Link } from 'react-router-dom'
import {
  ClipboardList,
  FileWarning,
  LayoutDashboard,
  LogOut,
  MessageSquareWarning,
  MessageCircleWarning,
  History,
  Users,
} from 'lucide-react'
import { useAuthStore } from '@/contexts/auth-store'
import styles from './moderator-nav.module.css'

const NAV_ITEMS = [
  { href: '/moderator/dashboard', icon: LayoutDashboard, label: 'Tổng quan' },
  { href: '/moderator/reports', icon: ClipboardList, label: 'Báo cáo' },
  { href: '/moderator/posts', icon: FileWarning, label: 'Bài viết' },
  { href: '/moderator/comments', icon: MessageCircleWarning, label: 'Bình luận' },
  { href: '/moderator/messages', icon: MessageSquareWarning, label: 'Tin nhắn' },
  { href: '/moderator/users', icon: Users, label: 'Người dùng' },
  { href: '/moderator/history', icon: History, label: 'Lịch sử' },
] as const

export default function ModeratorNav() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const clearAuth = useAuthStore((state) => state.clearAuth)

  const handleLogout = () => {
    clearAuth()
    navigate('/auth/login', { replace: true })
  }

  return (
    <nav className={styles.nav} aria-label="Điều hướng kiểm duyệt">
      <div className={styles.brand}>
        <span className={styles.brandIcon}>🛡️</span>
        <span className={styles.brandLabel}>Trung tâm kiểm duyệt</span>
      </div>

      <ul className={styles.list}>
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== '/moderator/dashboard' && pathname.startsWith(href))
          return (
            <li key={href}>
              <Link to={href} className={`${styles.item} ${active ? styles.active : ''}`} aria-current={active ? 'page' : undefined}>
                <Icon size={18} />
                <span>{label}</span>
              </Link>
            </li>
          )
        })}
      </ul>

      <button type="button" className={styles.logout} onClick={handleLogout}>
        <LogOut size={16} />
        <span>Đăng xuất</span>
      </button>
    </nav>
  )
}
