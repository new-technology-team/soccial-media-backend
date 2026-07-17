'use client'

import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bell, LogOut, Settings, Shield, UserRound } from 'lucide-react'
import { useAuthStore } from '@/contexts/auth-store'
import styles from './top-navbar.module.css'

export default function UserMenu() {
  const navigate = useNavigate()
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const user = useAuthStore((state) => state.user)
  const clearAuth = useAuthStore((state) => state.clearAuth)

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  const initials = (user?.fullName || 'U')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'U'

  const profileHref = user?.role === 'admin' ? '/admin/dashboard' : user ? `/profile/${user.username || user.id}` : '/auth/login'

  const handleLogout = () => {
    clearAuth()
    setOpen(false)
    window.location.href = '/auth/login'
  }

  if (!user) {
    return (
      <div className={styles.authActions}>
        <Link to="/auth/login" className={styles.loginBtn}>Đăng nhập</Link>
        <Link to="/auth/signup" className={styles.signupBtn}>Đăng ký</Link>
      </div>
    )
  }

  return (
    <div className={styles.userMenu} ref={menuRef}>
      <button
        type="button"
        className={styles.avatarButton}
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className={styles.avatarCircle}>
          {user.avatarUrl
            ? <img src={user.avatarUrl} alt={initials} className={styles.avatarImg} />
            : initials}
        </span>
        <span className={styles.userName}>{user.fullName}</span>
      </button>

      {open ? (
        <div className={styles.menuPanel} role="menu">
          <Link to={profileHref} className={styles.menuIdentity} onClick={() => setOpen(false)}>
            <span className={styles.avatarCircle}>
              {user.avatarUrl
                ? <img src={user.avatarUrl} alt={initials} className={styles.avatarImg} />
                : initials}
            </span>
            <span>
              <b>{user.fullName}</b>
              {user.username ? <small className={styles.menuUsername}>@{user.username}</small> : null}
              <small>{user.role === 'admin' ? 'Khu quản trị' : 'Xem hồ sơ'}</small>
            </span>
          </Link>

          {user.role !== 'admin' ? (
            <Link to={`/profile/${user.username || user.id}`} className={styles.menuItem} onClick={() => setOpen(false)}>
              <UserRound size={16} />
              Hồ sơ
            </Link>
          ) : null}
          <Link to="/notifications" className={styles.menuItem} onClick={() => setOpen(false)}>
            <Bell size={16} />
            Thông báo
          </Link>
          <Link to="/settings" className={styles.menuItem} onClick={() => setOpen(false)}>
            <Settings size={16} />
            Cài đặt
          </Link>
          {user.role === 'admin' || user.role === 'moderator' ? (
            <Link
              to={user.role === 'admin' ? '/admin/dashboard' : '/moderator/dashboard'}
              className={styles.menuItem}
              onClick={() => setOpen(false)}
            >
              <Shield size={16} />
              Bảng điều khiển
            </Link>
          ) : null}
          <button type="button" className={styles.menuItem} onClick={handleLogout}>
            <LogOut size={16} />
            Đăng xuất
          </button>
        </div>
      ) : null}
    </div>
  )
}
