'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell,
  Check,
  CheckCheck,
  Heart,
  MessageCircle,
  Phone,
  Search,
  Settings,
  Shield,
  Trash2,
  UserPlus,
  Video,
  Volume2,
  VolumeX,
} from 'lucide-react'

import { api } from '@/api/client'
import { useAuthStore } from '@/contexts/auth-store'
import { connectSocket } from '@/services/socket'
import type { NotificationItem } from '@/types'
import styles from './page.module.css'

type Category = 'all' | 'messages' | 'calls' | 'social' | 'system'
type ReadFilter = 'all' | 'unread' | 'read' | 'today' | 'yesterday' | 'week' | 'month'
type SortMode = 'newest' | 'oldest'

const categoryMeta: Record<Category, { label: string; color: string }> = {
  all: { label: 'Tất cả', color: '#22c55e' },
  messages: { label: 'Tin nhắn', color: '#2563eb' },
  calls: { label: 'Cuộc gọi', color: '#22c55e' },
  social: { label: 'Xã hội', color: '#ec4899' },
  system: { label: 'Hệ thống', color: '#f97316' },
}

const getCategory = (type: string): Exclude<Category, 'all'> => {
  if (['message', 'mention', 'reply', 'reaction', 'message_recalled', 'group_invitation'].includes(type)) return 'messages'
  if (['call', 'call_missed', 'incoming_call', 'video_call', 'group_call'].includes(type)) return 'calls'
  if (['like', 'comment', 'share', 'follow', 'friend-request', 'friend-accepted', 'post_mention'].includes(type)) return 'social'
  return 'system'
}

const iconForNotification = (item: NotificationItem) => {
  const category = getCategory(item.type)
  if (category === 'messages') return MessageCircle
  if (category === 'calls') return item.type.includes('video') ? Video : Phone
  if (category === 'social') return item.type.includes('friend') || item.type === 'follow' ? UserPlus : Heart
  return item.type.includes('security') ? Shield : Bell
}

const parseMeta = (item: NotificationItem): Record<string, unknown> => {
  const source = item.meta ?? item.meta_json
  if (!source) return {}
  try {
    return typeof source === 'string' ? JSON.parse(source) : source
  } catch {
    return {}
  }
}

const timeAgo = (value: string) => {
  const diff = Date.now() - new Date(value).getTime()
  if (!Number.isFinite(diff)) return value
  const minutes = Math.max(0, Math.floor(diff / 60000))
  if (minutes < 1) return 'Vừa xong'
  if (minutes < 60) return `${minutes} phút trước`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} giờ trước`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} ngày trước`
  return new Date(value).toLocaleString('vi-VN')
}

const isInDateFilter = (item: NotificationItem, filter: ReadFilter) => {
  if (filter === 'unread') return !item.is_read
  if (filter === 'read') return Boolean(item.is_read)
  if (filter === 'all') return true
  const created = new Date(item.created_at)
  const now = new Date()
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const createdTime = created.getTime()
  if (filter === 'today') return createdTime >= startToday
  if (filter === 'yesterday') return createdTime >= startToday - 86400000 && createdTime < startToday
  if (filter === 'week') return createdTime >= Date.now() - 7 * 86400000
  return createdTime >= Date.now() - 31 * 86400000
}

export default function NotificationsPage() {
  const navigate = useNavigate()
  const token = useAuthStore((state) => state.accessToken)
  const user = useAuthStore((state) => state.user)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [activeCategory, setActiveCategory] = useState<Category>('all')
  const [readFilter, setReadFilter] = useState<ReadFilter>('all')
  const [sortMode, setSortMode] = useState<SortMode>('newest')
  const [query, setQuery] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [soundOn, setSoundOn] = useState(true)
  const [busyId, setBusyId] = useState<number | string | null>(null)

  const loadNotifications = async () => {
    if (!token) return
    const response = await api.notifications(token)
    setNotifications(response.notifications)
  }

  useEffect(() => {
    loadNotifications().catch(console.error)
  }, [token])

  useEffect(() => {
    if (!token || !user?.id) return
    const socket = connectSocket(token, user.id)
    const onNotification = (payload: NotificationItem) => {
      setNotifications((prev) => [payload, ...prev.filter((item) => item.id !== payload.id)])
      if (soundOn) {
        try {
          const audio = new Audio('/notification.mp3')
          audio.volume = 0.35
          void audio.play()
        } catch {
          // Browser may block autoplay.
        }
      }
      document.title = `(${notifications.filter((item) => !item.is_read).length + 1}) ZChat`
    }
    const onNotificationUpdated = (payload: NotificationItem) => {
      setNotifications((prev) => prev.map((item) => item.id === payload.id ? { ...item, ...payload } : item))
    }
    const onNotificationDeleted = (payload: { id?: number | string }) => {
      setNotifications((prev) => prev.filter((item) => String(item.id) !== String(payload?.id)))
    }
    const onAllRead = () => {
      setNotifications((prev) => prev.map((item) => ({ ...item, is_read: 1 })))
    }
    socket.on('notification:new', onNotification)
    socket.on('notification:updated', onNotificationUpdated)
    socket.on('notification:deleted', onNotificationDeleted)
    socket.on('notification:all-read', onAllRead)
    return () => {
      socket.off('notification:new', onNotification)
      socket.off('notification:updated', onNotificationUpdated)
      socket.off('notification:deleted', onNotificationDeleted)
      socket.off('notification:all-read', onAllRead)
    }
  }, [notifications, soundOn, token, user?.id])

  const counts = useMemo(() => {
    const base: Record<Category, number> = { all: notifications.length, messages: 0, calls: 0, social: 0, system: 0 }
    notifications.forEach((item) => {
      base[getCategory(item.type)] += 1
    })
    return base
  }, [notifications])

  const filteredNotifications = useMemo(() => {
    const q = query.trim().toLowerCase()
    return notifications
      .filter((item) => activeCategory === 'all' || getCategory(item.type) === activeCategory)
      .filter((item) => isInDateFilter(item, readFilter))
      .filter((item) => !q || `${item.title} ${item.body || ''}`.toLowerCase().includes(q))
      .sort((a, b) => {
        const value = new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        return sortMode === 'newest' ? value : -value
      })
  }, [activeCategory, notifications, query, readFilter, sortMode])

  const openNotification = async (item: NotificationItem) => {
    const meta = parseMeta(item)
    const conversationId = meta.conversationId ?? meta.conversation_id
    const postId = meta.postId ?? meta.post_id
    if (!item.is_read && token) {
      await api.readNotification(token, item.id).catch(() => undefined)
      setNotifications((prev) => prev.map((notif) => notif.id === item.id ? { ...notif, is_read: 1 } : notif))
    }
    if (conversationId) navigate(`/messages?conversation=${encodeURIComponent(String(conversationId))}`)
    else if (postId) navigate(`/posts/${postId}`)
  }

  const markReadState = async (item: NotificationItem, read: boolean) => {
    if (!token) return
    setBusyId(item.id)
    try {
      if (read) await api.readNotification(token, item.id)
      else await api.unreadNotification(token, item.id)
      setNotifications((prev) => prev.map((notif) => notif.id === item.id ? { ...notif, is_read: read ? 1 : 0 } : notif))
    } finally {
      setBusyId(null)
    }
  }

  const deleteNotification = async (item: NotificationItem) => {
    if (!token) return
    setBusyId(item.id)
    try {
      await api.deleteNotification(token, item.id)
      setNotifications((prev) => prev.filter((notif) => notif.id !== item.id))
    } finally {
      setBusyId(null)
    }
  }

  const unreadCount = notifications.filter((item) => !item.is_read).length

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold">Thông báo</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Theo dõi tin nhắn, cuộc gọi và tương tác</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={async () => {
              if (!token) return
              await api.readAllNotifications(token)
              setNotifications((prev) => prev.map((item) => ({ ...item, is_read: 1 })))
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-border bg-card hover:bg-accent/10 transition-colors"
          >
            <CheckCheck size={14} />
            Đã đọc tất cả
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen((v) => !v)}
            aria-expanded={settingsOpen}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-colors"
          >
            <Settings size={16} />
          </button>
        </div>
      </header>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm thông báo..."
            className="w-full h-10 pl-9 pr-3 rounded-xl bg-muted/50 border border-border text-sm outline-none focus:border-primary/40 transition-colors"
          />
        </div>
        <select
          value={readFilter}
          onChange={(e) => setReadFilter(e.target.value as ReadFilter)}
          className="h-10 px-3 rounded-xl bg-muted/50 border border-border text-sm outline-none focus:border-primary/40 transition-colors"
        >
          <option value="all">Tất cả</option>
          <option value="unread">Chưa đọc</option>
          <option value="read">Đã đọc</option>
          <option value="today">Hôm nay</option>
          <option value="week">Tuần này</option>
        </select>
        <select
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as SortMode)}
          className="h-10 px-3 rounded-xl bg-muted/50 border border-border text-sm outline-none focus:border-primary/40 transition-colors"
        >
          <option value="newest">Mới nhất</option>
          <option value="oldest">Cũ nhất</option>
        </select>
      </div>

      {/* Categories */}
      <nav className="flex gap-1 overflow-x-auto hide-scrollbar" aria-label="Lọc thông báo">
        {(Object.keys(categoryMeta) as Category[]).map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setActiveCategory(category)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              activeCategory === category
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            {categoryMeta[category].label}
            <span className="ml-1 opacity-70">({counts[category]})</span>
          </button>
        ))}
      </nav>

      {/* Settings panel */}
      {settingsOpen && (
        <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold">Cài đặt thông báo</h3>
          <div className="space-y-2">
            {['Tin nhắn', 'Cuộc gọi', 'Lời mời kết bạn', 'Bình luận', 'Lượt thích'].map((label) => (
              <label key={label} className="flex items-center gap-2 text-sm">
                <input type="checkbox" defaultChecked className="rounded border-border text-primary focus:ring-primary/30" />
                {label}
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setSoundOn((v) => !v)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {soundOn ? <Volume2 size={15} /> : <VolumeX size={15} />}
            Âm thanh {soundOn ? 'bật' : 'tắt'}
          </button>
        </section>
      )}

      {/* Summary */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="w-2 h-2 rounded-full bg-primary animate-pulse-dot" />
        <strong className="text-foreground">{unreadCount}</strong> thông báo chưa đọc
      </div>

      {/* Notifications List */}
      <div className="space-y-2">
        {filteredNotifications.map((item) => {
          const category = getCategory(item.type)
          const Icon = iconForNotification(item)
          const meta = parseMeta(item)
          const avatarText = String(meta.userName || meta.requesterName || item.title || 'Z').slice(0, 1).toUpperCase()
          const notificationUsername = String(meta.username || meta.user_name || '')
          return (
            <article
              key={item.id}
              className={`rounded-2xl border transition-all ${
                !item.is_read
                  ? 'border-primary/20 bg-primary/[0.02] shadow-sm'
                  : 'border-border bg-card hover:bg-accent/5'
              }`}
            >
              <div className="flex items-start gap-3 p-3">
                {/* Avatar */}
                <div className="relative shrink-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${
                    !item.is_read ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                  }`}>
                    {avatarText}
                  </div>
                  <span
                    className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] ring-2 ring-background"
                    style={{ background: categoryMeta[category].color }}
                  >
                    <Icon size={10} />
                  </span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <button type="button" onClick={() => void openNotification(item)} className="text-left w-full">
                    <p className={`text-sm ${!item.is_read ? 'font-semibold' : ''}`}>{item.title}</p>
                    {notificationUsername ? <p className="text-xs text-muted-foreground">@{notificationUsername}</p> : null}
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.body || 'Thông báo mới từ ZChat'}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">{timeAgo(item.created_at)}</p>
                  </button>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => void markReadState(item, !item.is_read)}
                    disabled={busyId === item.id}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-colors disabled:opacity-50"
                    title={item.is_read ? 'Đánh dấu chưa đọc' : 'Đánh dấu đã đọc'}
                  >
                    <Check size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteNotification(item)}
                    disabled={busyId === item.id}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                    title="Xóa"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </article>
          )
        })}
        {filteredNotifications.length === 0 && (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <Bell size={32} className="mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">Không có thông báo phù hợp.</p>
          </div>
        )}
      </div>
    </div>
  )
}
