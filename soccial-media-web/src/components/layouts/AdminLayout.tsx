'use client'

import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  ChevronDown,
  Database,
  FileText,
  Flag,
  History,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  Settings,
  Shield,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react'

import { useAuthStore } from '@/contexts/auth-store'
import styles from './admin-layout.module.css'

const groups = [
  {
    title: 'Quản trị',
    items: [
      { href: '/admin/dashboard', label: 'Tổng quan', icon: LayoutDashboard },
      { href: '/admin/statistics', label: 'Thống kê', icon: BarChart3 },
      { href: '/admin/audit-logs', label: 'Nhật ký hệ thống', icon: History },
    ],
  },
  {
    title: 'Người dùng',
    items: [
      { href: '/admin/users', label: 'Quản lý người dùng', icon: Users },
      { href: '/admin/moderators', label: 'Kiểm duyệt viên', icon: Shield },
    ],
  },
  {
    title: 'Nội dung',
    items: [
      { href: '/admin/posts', label: 'Quản lý nội dung', icon: FileText },
      { href: '/admin/reports', label: 'Báo cáo', icon: Flag },
      { href: '/admin/posts?media=true', label: 'Media', icon: Database },
    ],
  },
  {
    title: 'Hệ thống',
    items: [
      { href: '/admin/settings', label: 'Cấu hình hệ thống', icon: Settings },
      { href: '/admin/settings#security', label: 'Bảo mật', icon: Lock },
      { href: '/admin/audit-logs#logs', label: 'Logs', icon: Database },
    ],
  },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { pathname, search, hash } = useLocation()
  const navigate = useNavigate()
  const clearAuth = useAuthStore((state) => state.clearAuth)
  const user = useAuthStore((state) => state.user)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const activeGroup = useMemo(() => {
    const current = `${pathname}${search}${hash}`
    const group = groups.find((section) =>
      section.items.some((item) => {
        const targetPath = item.href.split('?')[0].split('#')[0]
        if (item.href.includes('#') || item.href.includes('?')) return current === item.href
        return pathname === targetPath
      })
    )
    return group?.title
  }, [hash, pathname, search])

  const handleLogout = () => {
    clearAuth()
    navigate('/auth/admin-login', { replace: true })
  }

  const sidebar = (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <span className={styles.badge}>
          <ShieldCheck size={14} /> ADMIN
        </span>
        <strong>ZChat Control Room</strong>
        <p>Operations console cho quản trị, an toàn nội dung và sức khỏe hệ thống.</p>
      </div>

      <div className={styles.operator}>
        <span className={styles.avatar}>{String(user?.fullName || 'AD').slice(0, 2).toUpperCase()}</span>
        <span>
          <b>{user?.fullName || 'Admin'}</b>
          {user?.username ? <small className={styles.adminUsername}>@{user.username}</small> : null}
          <small>Security session active</small>
        </span>
      </div>

      <nav className={styles.nav} aria-label="Admin navigation">
        {groups.map((group) => {
          const isOpen = collapsed[group.title] !== false || activeGroup === group.title
          return (
            <section key={group.title} className={styles.navGroup}>
              <button
                type="button"
                className={styles.groupButton}
                aria-expanded={isOpen}
                onClick={() => setCollapsed((prev) => ({ ...prev, [group.title]: !isOpen }))}
              >
                <span>{group.title}</span>
                <ChevronDown size={15} className={isOpen ? styles.chevronOpen : ''} />
              </button>
              {isOpen ? (
                <div className={styles.groupItems}>
                  {group.items.map((item) => {
                    const Icon = item.icon
                    const targetPath = item.href.split('?')[0].split('#')[0]
                    const current = `${pathname}${search}${hash}`
                    const active = item.href.includes('#') || item.href.includes('?')
                      ? current === item.href
                      : pathname === targetPath && !hash && !search
                    return (
                      <Link
                        key={item.href}
                        to={item.href}
                        className={active ? styles.activeLink : styles.link}
                        onClick={() => setDrawerOpen(false)}
                      >
                        <Icon size={16} />
                        <span>{item.label}</span>
                      </Link>
                    )
                  })}
                </div>
              ) : null}
            </section>
          )
        })}
      </nav>

      <button type="button" className={styles.logoutButton} onClick={handleLogout}>
        <LogOut size={16} />
        <span>Đăng xuất</span>
      </button>
    </aside>
  )

  return (
    <div className={styles.shell}>
      <header className={styles.mobileBar}>
        <button type="button" className={styles.mobileMenu} onClick={() => setDrawerOpen(true)} aria-label="Mở menu admin">
          <Menu size={18} />
        </button>
        <strong>ZChat Admin</strong>
        <span className={styles.mobileStatus}>Live</span>
      </header>

      <div className={styles.desktopSidebar}>{sidebar}</div>
      {drawerOpen ? (
        <div className={styles.drawerOverlay} role="dialog" aria-modal="true">
          <button type="button" className={styles.drawerClose} onClick={() => setDrawerOpen(false)} aria-label="Đóng menu">
            <X size={18} />
          </button>
          {sidebar}
        </div>
      ) : null}

      <section className={styles.content}>{children}</section>
    </div>
  )
}
