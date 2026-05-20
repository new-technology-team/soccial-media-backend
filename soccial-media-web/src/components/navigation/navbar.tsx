'use client'

import { Link } from 'react-router-dom'
import {
  Search,
  MessageSquare,
  Bell,
  Home,
  Users,
  Menu,
  X,
  LogOut,
  UserRound,
  ChevronRight,
  MoreHorizontal,
  PlusSquare,
  Compass,
  Image,
  Shield,
  Siren,
  Bot,
  LayoutDashboard,
  FileWarning,
  UserCog,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/contexts/auth-store'
import { api } from '@/api/client'
import type { NotificationItem } from '@/types'
import styles from './navbar.module.css'

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<'notifications' | 'more' | null>(null)
  const [notificationPreviews, setNotificationPreviews] = useState<NotificationItem[]>([])
  const [pendingReportsCount, setPendingReportsCount] = useState(0)
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchUsers, setSearchUsers] = useState<Array<{ id: number; name: string }>>([])
  const [searchPosts, setSearchPosts] = useState<Array<{ id: number; authorName: string; content: string }>>([])
  const dropdownRef = useRef<HTMLDivElement | null>(null)
  const searchRef = useRef<HTMLDivElement | null>(null)
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const token = useAuthStore((state) => state.accessToken)
  const user = useAuthStore((state) => state.user)
  const clearAuth = useAuthStore((state) => state.clearAuth)
  const isLoggedIn = Boolean(user)
  const profileHref = user ? `/profile/${user.id}` : '/auth/login'
  const isStaff = user?.role === 'admin' || user?.role === 'moderator'

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!isLoggedIn || !token) return
    let canceled = false

    const loadPreviewData = async () => {
      try {
        const [notifResult, moderationResult] = await Promise.all([
          api.listNotifications(),
          isStaff ? api.moderationReports() : Promise.resolve({ reports: [] as Array<Record<string, unknown>> }),
        ])
        if (canceled) return
        setNotificationPreviews(
          (notifResult.notifications || []).map((n) => ({
            id: n.id,
            user_id: n.user_id,
            type: n.type,
            title: n.title,
            body: n.body ?? null,
            meta_json: n.meta_json ?? null,
            is_read: n.is_read,
            created_at: n.created_at,
          }))
        )
        if (isStaff) {
          const reports = moderationResult.reports as Array<Record<string, unknown>> || [];
          const pending = reports.filter(
            (item: Record<string, unknown>) => String(item.status || 'pending') === 'pending'
          ).length
          setPendingReportsCount(pending)
        } else {
          setPendingReportsCount(0)
        }
      } catch (error) {
        if (canceled) return
        if (error instanceof Error) {
          const msg = error.message.toLowerCase()
          if (msg.includes('invalid') || msg.includes('expired') || msg.includes('token')) {
            clearAuth()
            if (pathname !== '/auth/login') {
              navigate('/auth/login')
            }
            return
          }
        }
        console.warn('Failed to load notifications preview', error)
      }
    }

    loadPreviewData()
    return () => {
      canceled = true
    }
  }, [clearAuth, isLoggedIn, isStaff, pathname, navigate, token])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim())
    }, 280)
    return () => clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    let canceled = false
    const q = debouncedSearch.toLowerCase()

    if (!q || q.length < 2) {
      setSearchUsers([])
      setSearchPosts([])
      return
    }

    const loadSearch = async () => {
      try {
        const [feedRes, usersRes] = await Promise.all([
          api.listFeed(),
          debouncedSearch ? api.searchUsers(debouncedSearch) : Promise.resolve({ users: [] }),
        ])
        if (canceled) return

        const users = (usersRes.users || [])
          .map((item: Record<string, unknown>) => ({
            id: Number(item.id || 0),
            name: String(item.full_name || item.fullName || item.email || item.phone || 'NgưĂ¡»i dùng'),
          }))
          .filter((item) => item.id > 0)
          .slice(0, 5)

        const posts = (feedRes.posts as Array<Record<string, unknown>> || [])
          .filter(
            (item) =>
              String(item.authorName || '').toLowerCase().includes(q) ||
              String(item.content || '').toLowerCase().includes(q)
          )
          .slice(0, 4)
          .map((item: Record<string, unknown>) => ({ id: Number(item.id), authorName: String(item.authorName || ''), content: String(item.content || '') }))

        setSearchUsers(users)
        setSearchPosts(posts)
      } catch (error) {
        if (canceled) return
        setSearchUsers([])
        setSearchPosts([])
        console.warn('Failed to load search preview', error)
      }
    }

    loadSearch()
    return () => {
      canceled = true
    }
  }, [debouncedSearch, token])

  useEffect(() => {
    setOpenDropdown(null)
  }, [pathname])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!dropdownRef.current) return
      if (!dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null)
      }

      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setSearchOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const initials = useMemo(() => {
    const fullName = user?.fullName?.trim() || ''
    if (!fullName) return 'U'
    return fullName
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('')
  }, [user?.fullName])

  const handleLogout = () => {
    clearAuth()
    setIsOpen(false)
    navigate('/auth/login')
  }

  const closeMobile = () => setIsOpen(false)

  const primaryItems = [
    { href: '/', label: 'Trang chủ', icon: Home, private: false },
    { href: '/feed', label: 'BĂ¡º£ng tin', icon: MessageSquare, private: false },
    { href: '/explore', label: 'Khám phá', icon: Compass, private: false },
    { href: '/ai-chat', label: 'Chat AI', icon: Bot, private: false },
    { href: '/messages', label: 'Tin nhĂ¡º¯n', icon: MessageSquare, private: true },
  ].filter((item) => !item.private || isLoggedIn)

  const roleItems =
    user?.role === 'admin'
      ? [
          { href: '/admin/dashboard', label: 'Admin dashboard', icon: LayoutDashboard },
          { href: '/admin/posts', label: 'ThĂ¡»‘ng kê bài viết', icon: FileWarning },
          { href: '/admin/users', label: 'ThĂ¡»‘ng kê ngưĂ¡»i dùng', icon: UserCog },
          { href: '/moderator/reports', label: 'QuĂ¡º£n lý báo cáo', icon: Shield },
        ]
      : user?.role === 'moderator'
        ? [
            { href: '/moderator/dashboard', label: 'Mod dashboard', icon: LayoutDashboard },
            { href: '/moderator/reports', label: 'DuyĂ¡»‡t báo cáo', icon: FileWarning },
            { href: '/moderator/posts', label: 'DuyĂ¡»‡t bài viết', icon: Shield },
          ]
        : []

  const utilityItems = [
    { href: '/friends', label: 'Bạn bè', icon: UserRound },
    { href: '/media', label: 'Thư viĂ¡»‡n media', icon: Image },
    { href: '/system-alerts', label: 'CĂ¡º£nh báo hĂ¡»‡ thống', icon: Siren },
    { href: '/settings', label: 'BĂ¡º£o mĂ¡º­t', icon: Shield },
    { href: profileHref, label: 'Trang cá nhân', icon: UserRound },
    ...roleItems,
  ]

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  const unreadNotificationCount = useMemo(
    () => notificationPreviews.filter((item) => !item.is_read).length,
    [notificationPreviews]
  )

  const hasSearchResults = searchUsers.length > 0 || searchPosts.length > 0

  return (
    <nav className={styles.navbar}>
      <div className={styles.inner}>
        <Link to={isLoggedIn ? '/feed' : '/'} className={styles.logo}>
          ZChat
        </Link>

        <div className={styles.searchWrap} ref={searchRef}>
          <div className={styles.searchBox}>
            <Search size={16} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Tìm kiĂ¡º¿m trên ZChat"
              className={styles.searchInput}
              value={searchInput}
              onFocus={() => setSearchOpen(true)}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  const q = searchInput.trim()
                  if (q) {
                    setSearchOpen(false)
                    navigate(`/explore?q=${encodeURIComponent(q)}`)
                  }
                }
              }}
            />
          </div>

          {searchOpen && searchInput.trim().length >= 2 ? (
            <div className={styles.searchDropdown}>
              {hasSearchResults ? (
                <>
                  {searchUsers.length > 0 ? (
                    <div className={styles.searchGroup}>
                      <p>NgưĂ¡»i dùng</p>
                      {searchUsers.map((item) => (
                        <Link key={item.id} to={`/profile/${item.id}`} className={styles.searchItem} onClick={() => setSearchOpen(false)}>
                          <span>{item.name}</span>
                        </Link>
                      ))}
                    </div>
                  ) : null}

                  {searchPosts.length > 0 ? (
                    <div className={styles.searchGroup}>
                      <p>Bài viĂ¡º¿t</p>
                      {searchPosts.map((item) => (
                        <Link key={item.id} to={`/posts/${item.id}`} className={styles.searchItem} onClick={() => setSearchOpen(false)}>
                          <span>{item.authorName}: {item.content.slice(0, 58)}</span>
                        </Link>
                      ))}
                    </div>
                  ) : null}

                  <Link to={`/explore?q=${encodeURIComponent(searchInput.trim())}`} className={styles.searchAll} onClick={() => setSearchOpen(false)}>
                    Xem tĂ¡º¥t cĂ¡º£ kĂ¡º¿t quĂ¡º£ cho "{searchInput.trim()}"
                  </Link>
                </>
              ) : (
                <p className={styles.searchEmpty}>Không có kĂ¡º¿t quĂ¡º£ phù hĂ¡»£p.</p>
              )}
            </div>
          ) : null}
        </div>

        <div className={styles.desktopNav} ref={dropdownRef}>
          {primaryItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`${styles.navItem} ${isActive(item.href) ? styles.navItemActive : ''}`}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </Link>
            )
          })}

          {isLoggedIn ? (
            <Link to="/feed?compose=1" className={styles.quickPostBtn} title="Tạo bài viết">
              <PlusSquare size={16} />
            </Link>
          ) : null}

          {isLoggedIn ? (
            <div className={styles.dropdownWrap}>
              <button
                type="button"
                className={`${styles.navItem} ${styles.iconOnly} ${openDropdown === 'notifications' ? styles.navItemActive : ''}`}
                onClick={() => setOpenDropdown((prev) => (prev === 'notifications' ? null : 'notifications'))}
                title="Thông báo"
              >
                <Bell size={16} />
                {unreadNotificationCount > 0 ? <i className={styles.badge}>{unreadNotificationCount}</i> : null}
              </button>

              {openDropdown === 'notifications' ? (
                <div className={styles.dropdownPanel}>
                  <div className={styles.dropdownHeader}>
                    <strong>Thông báo mĂ¡»›i</strong>
                  </div>

                  <div className={styles.dropdownList}>
                    {notificationPreviews.length === 0 ? (
                      <p className={styles.dropdownEmpty}>Chưa có thông báo</p>
                    ) : (
                      notificationPreviews.map((item) => (
                        <Link key={item.id} to="/notifications" className={styles.dropdownItem}>
                          <span className={styles.dropdownAvatar}>N</span>
                          <span className={styles.dropdownText}>
                            <b>{item.title}</b>
                            <small>{item.body || 'Bạn có thông báo mĂ¡»›i'}</small>
                          </span>
                        </Link>
                      ))
                    )}
                  </div>

                  <Link to="/notifications" className={styles.viewAllBtn}>
                    Xem tĂ¡º¥t cĂ¡º£ <ChevronRight size={14} />
                  </Link>
                </div>
              ) : null}
            </div>
          ) : null}

          {isLoggedIn ? (
            <div className={styles.dropdownWrap}>
              <button
                type="button"
                className={`${styles.navItem} ${styles.iconOnly} ${openDropdown === 'more' ? styles.navItemActive : ''}`}
                onClick={() => setOpenDropdown((prev) => (prev === 'more' ? null : 'more'))}
                title="Menu"
              >
                <MoreHorizontal size={16} />
                {pendingReportsCount > 0 ? <i className={styles.badge}>{pendingReportsCount}</i> : null}
              </button>

              {openDropdown === 'more' ? (
                <div className={styles.dropdownPanel}>
                  <div className={styles.dropdownHeader}>
                    <strong>TiĂ¡»‡n ích</strong>
                  </div>
                  <div className={styles.dropdownList}>
                    {utilityItems.map((item) => {
                      const Icon = item.icon
                      return (
                        <Link key={item.href} to={item.href} className={styles.dropdownItem}>
                          <span className={styles.dropdownAvatar}>
                            <Icon size={14} />
                          </span>
                          <span className={styles.dropdownText}>
                            <b>{item.label}</b>
                            <small>MĂ¡» nhanh</small>
                          </span>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {mounted && isLoggedIn ? (
          <div className={styles.userActions}>
            <Link to={profileHref} className={styles.userChip}>
              <span className={styles.avatarCircle}>{initials}</span>
              <span className={styles.userName}>{user?.fullName || 'NgưĂ¡»i dùng'}</span>
            </Link>
            <button type="button" className={styles.logoutBtn} onClick={handleLogout}>
              <LogOut size={16} />
              <span>Ä ăng xuĂ¡º¥t</span>
            </button>
          </div>
        ) : (
          <div className={styles.authActions}>
            <Link to="/auth/login" className={styles.loginBtn}>
              Ä ăng nhĂ¡º­p
            </Link>
            <Link to="/auth/signup" className={styles.signupBtn}>
              Ä ăng ký
            </Link>
          </div>
        )}

        <button onClick={() => setIsOpen(!isOpen)} className={styles.mobileToggle}>
          {isOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {isOpen ? (
        <div className={styles.mobilePanel}>
          <div className={styles.mobileInner}>
            <div className={styles.searchBox}>
              <Search size={16} className={styles.searchIcon} />
              <input type="text" placeholder="Tìm kiĂ¡º¿m..." className={styles.searchInput} />
            </div>

            <div className={styles.mobileLinks}>
              {primaryItems.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={`${styles.mobileLink} ${isActive(item.href) ? styles.mobileLinkActive : ''}`}
                    onClick={closeMobile}
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                  </Link>
                )
              })}

              {isLoggedIn ? (
                <Link to="/feed?compose=1" className={styles.mobileLink} onClick={closeMobile}>
                  <PlusSquare size={18} />
                  <span>Tạo bài viết</span>
                </Link>
              ) : null}

              {isLoggedIn
                ? utilityItems.map((item) => {
                    const Icon = item.icon
                    return (
                      <Link key={item.href} to={item.href} className={styles.mobileLink} onClick={closeMobile}>
                        <Icon size={18} />
                        <span>{item.label}</span>
                      </Link>
                    )
                  })
                : null}
            </div>

            {mounted && isLoggedIn ? (
              <div className={styles.mobileUserBox}>
                <Link to={profileHref} className={styles.userChip} onClick={closeMobile}>
                  <span className={styles.avatarCircle}>{initials}</span>
                  <span className={styles.userName}>{user?.fullName || 'NgưĂ¡»i dùng'}</span>
                </Link>
                <button type="button" className={styles.logoutBtn} onClick={handleLogout}>
                  <LogOut size={16} />
                  <span>Ä ăng xuĂ¡º¥t</span>
                </button>
              </div>
            ) : (
              <div className={styles.mobileAuth}>
                <Link to="/auth/login" className={styles.loginBtn} onClick={closeMobile}>
                  Ä ăng nhĂ¡º­p
                </Link>
                <Link to="/auth/signup" className={styles.signupBtn} onClick={closeMobile}>
                  Ä ăng ký
                </Link>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </nav>
  )
}

