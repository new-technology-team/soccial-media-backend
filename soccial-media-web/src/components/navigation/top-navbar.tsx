'use client'

import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Bot, Compass, Menu, MessageSquare, Newspaper, X } from 'lucide-react'
import { useAuthStore } from '@/contexts/auth-store'
import UserMenu from './user-menu'
import styles from './top-navbar.module.css'

const navItems = [
  { href: '/feed', label: 'Bảng tin', icon: Newspaper, private: false },
  { href: '/explore', label: 'Khám phá', icon: Compass, private: false },
  { href: '/ai-chat', label: 'Chat AI', icon: Bot, private: false },
  { href: '/messages', label: 'Tin nhắn', icon: MessageSquare, private: true },
]

export default function TopNavbar() {
  const { pathname } = useLocation()
  const user = useAuthStore((state) => state.user)
  const [mobileOpen, setMobileOpen] = useState(false)

  const visibleItems = navItems.filter((item) => !item.private || user)
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

  return (
    <header className={styles.navbar}>
      <div className={styles.inner}>
        <Link to="/feed" className={styles.logo} onClick={() => setMobileOpen(false)}>
          ZChat
        </Link>

        <nav className={styles.desktopNav} aria-label="Điều hướng chính">
          {visibleItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`${styles.navItem} ${isActive(item.href) ? styles.navItemActive : ''}`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className={styles.rightActions}>
          <UserMenu />
          <button
            type="button"
            className={styles.mobileToggle}
            onClick={() => setMobileOpen((current) => !current)}
            aria-label={mobileOpen ? 'Đóng menu' : 'Mở menu'}
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <nav className={styles.mobilePanel} aria-label="Điều hướng di động">
          {visibleItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`${styles.mobileItem} ${isActive(item.href) ? styles.mobileItemActive : ''}`}
                onClick={() => setMobileOpen(false)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      ) : null}
    </header>
  )
}
