'use client'

import { Link } from 'react-router-dom'
import { useLocation } from 'react-router-dom'
import { BarChart3, FileText, ShieldCheck, Users } from 'lucide-react'
import styles from './admin-layout.module.css'

const navItems = [
  { href: '/admin/dashboard', label: 'TĂ¡»•ng quan', icon: BarChart3 },
  { href: '/admin/posts', label: 'QuĂ¡º£n lý bài viết', icon: FileText },
  { href: '/admin/users', label: 'QuĂ¡º£n lý ngÆ°á» i dùng', icon: Users },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.badge}>
            <ShieldCheck size={14} /> ADMIN
          </span>
          <strong>ZChat Control Room</strong>
          <p>Không gian vĂ¡º­n hành riêng cho quĂ¡º£n trĂ¡»‹ viên.</p>
        </div>

        <nav className={styles.nav}>
          {navItems.map((item) => {
            const Icon = item.icon
            const active = pathname === item.href
            return (
              <Link key={item.href} to={item.href} className={active ? styles.activeLink : styles.link}>
                <Icon size={16} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </aside>

      <section className={styles.content}>{children}</section>
    </div>
  )
}
