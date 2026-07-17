'use client'

import { Link, useLocation } from 'react-router-dom'
import { Bookmark, Newspaper, PenLine, UserRound, Users } from 'lucide-react'
import type { User } from '@/types'
import styles from './sidebar.module.css'

type SidebarProps = {
  user: User | null
  onCreatePost?: () => void
}

export default function Sidebar({ user, onCreatePost }: SidebarProps) {
  const { pathname } = useLocation()
  const profileHref = user ? `/profile/${user.id}` : '/auth/login?next=/feed'
  const initials = (user?.fullName || 'K').trim()[0]?.toUpperCase() || 'K'

  const shortcuts = [
    { href: '/feed', label: 'Bảng tin', icon: Newspaper },
    { href: profileHref, label: 'Hồ sơ cá nhân', icon: UserRound },
    { href: '/feed?saved=1', label: 'Đã lưu', icon: Bookmark },
    { href: '/friends', label: 'Bạn bè', icon: Users },
  ]

  return (
    <aside className={styles.sidebar}>
      <Link to={profileHref} className={styles.userCard}>
        <span className={styles.avatar}>{initials}</span>
        <span>
          <b>{user?.fullName || 'Khách vãng lai'}</b>
          <small>{user ? 'Xem và cập nhật hồ sơ' : 'Đăng nhập để cá nhân hóa'}</small>
        </span>
      </Link>

      <button type="button" className={styles.createButton} onClick={onCreatePost}>
        <PenLine size={17} />
        Tạo bài viết
      </button>

      <nav className={styles.shortcuts} aria-label="Lối tắt bảng tin">
        {shortcuts.map((item) => {
          const Icon = item.icon
          const active = pathname === item.href || (item.href === '/feed' && pathname === '/feed')
          return (
            <Link key={item.label} to={item.href} className={`${styles.shortcut} ${active ? styles.shortcutActive : ''}`}>
              <Icon size={18} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
