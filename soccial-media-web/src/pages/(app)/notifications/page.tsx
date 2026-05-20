'use client'

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, MessageCircle, UserPlus, Heart, Share2, CheckCheck } from 'lucide-react'
import { api } from '@/api/client'
import { useAuthStore } from '@/contexts/auth-store'
import type { NotificationItem } from '@/types'
import styles from './page.module.css'

type NotifFilter = 'all' | 'social' | 'messages'

type NotificationMeta = {
  requesterId?: number
  requester_id?: number
  friendshipId?: number
  friendship_id?: number
  conversationId?: string | number
  conversation_id?: string | number
  requesterName?: string
  accepterId?: number
}

const formatTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

const normalizeType = (type: string): 'message' | 'social' | 'other' => {
  if (type === 'comment' || type === 'message') return 'message'
  if (
    type === 'like' ||
    type === 'follow' ||
    type === 'share' ||
    type === 'friend-request' ||
    type === 'friend-accepted'
  ) {
    return 'social'
  }
  return 'other'
}

const iconForType = (type: string) => {
  switch (type) {
    case 'like':
      return <Heart className={styles.itemTypeIcon} />
    case 'follow':
    case 'friend-request':
    case 'friend-accepted':
      return <UserPlus className={styles.itemTypeIcon} />
    case 'share':
      return <Share2 className={styles.itemTypeIcon} />
    case 'comment':
    case 'message':
      return <MessageCircle className={styles.itemTypeIcon} />
    default:
      return <Bell className={styles.itemTypeIcon} />
  }
}

export default function NotificationsPage() {
  const navigate = useNavigate()
  const token = useAuthStore((state) => state.accessToken)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [activeFilter, setActiveFilter] = useState<NotifFilter>('all')
  const [busyActionId, setBusyActionId] = useState<number | null>(null)

  const parseMeta = (item: NotificationItem): NotificationMeta | null => {
    const source = item.meta ?? item.meta_json
    if (!source) return null
    try {
      if (typeof source === 'string') {
        return JSON.parse(source) as NotificationMeta
      }
      return source as NotificationMeta
    } catch {
      return null
    }
  }

  const getConversationIdFromMeta = (item: NotificationItem) => {
    const meta = parseMeta(item)
    if (!meta) return null
    const value = meta.conversationId ?? meta.conversation_id
    return value ? String(value) : null
  }

  useEffect(() => {
    if (!token) return
    api
      .notifications(token)
      .then((r) => setNotifications(r.notifications))
      .catch((error) => {
        console.error('Không thể tĂ¡º£i thông báo', error)
      })
  }, [token])

  const unreadCount = useMemo(() => notifications.filter((item) => !item.is_read).length, [notifications])

  const filteredNotifications = useMemo(() => {
    if (activeFilter === 'all') return notifications
    if (activeFilter === 'messages') {
      return notifications.filter((item) => normalizeType(item.type) === 'message')
    }
    return notifications.filter((item) => normalizeType(item.type) === 'social')
  }, [activeFilter, notifications])

  const handleMarkAllAsRead = async () => {
    if (!token) return
    try {
      await api.readAllNotifications(token)
      setNotifications((prev) => prev.map((item) => ({ ...item, is_read: 1 })))
    } catch (error) {
      console.error('Không thể đánh dĂ¡º¥u tĂ¡º¥t cĂ¡º£ đã đĂ¡»c', error)
    }
  }

  const handleMarkOneAsRead = async (id: number) => {
    if (!token) return
    const target = notifications.find((item) => item.id === id)
    if (!target || target.is_read) return

    try {
      await api.readNotification(token, id)
      setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, is_read: 1 } : item)))
    } catch (error) {
      console.error('Không thể đánh dĂ¡º¥u đã đĂ¡»c', error)
    }
  }

  const handleAcceptInvite = async (item: NotificationItem) => {
    if (!token) return
    const meta = parseMeta(item)
    const requesterId = Number(meta?.requesterId ?? meta?.requester_id ?? 0)
    const friendshipId = Number(meta?.friendshipId ?? meta?.friendship_id ?? 0)
    const identifier = requesterId || friendshipId
    if (!identifier) return

    setBusyActionId(item.id)
    try {
      await api.acceptFriend(token, identifier)
      await api.readNotification(token, item.id)
      setNotifications((prev) =>
        prev.map((notif) =>
          notif.id === item.id
            ? {
                ...notif,
                is_read: 1,
                title: 'ĐĂ£ chĂ¡º¥p nhĂ¡º­n lĂ¡»i mĂ¡»i kĂ¡º¿t bạn',
                body: 'Bạn và ngưĂ¡»i này đã trĂ¡» thành bạn bè.',
              }
            : notif
        )
      )
    } catch (error) {
      console.error('Không thể chĂ¡º¥p nhĂ¡º­n lĂ¡»i mĂ¡»i tĂ¡»« thông báo', error)
    } finally {
      setBusyActionId(null)
    }
  }

  const handleDeleteInvite = async (item: NotificationItem) => {
    if (!token) return
    const meta = parseMeta(item)
    const requesterId = Number(meta?.requesterId ?? meta?.requester_id ?? 0)
    if (!requesterId) return

    setBusyActionId(item.id)
    try {
      await api.deleteFriend(token, requesterId)
      await api.readNotification(token, item.id)
      setNotifications((prev) => prev.filter((notif) => notif.id !== item.id))
    } catch (error) {
      console.error('Không thể xóa lĂ¡»i mĂ¡»i tĂ¡»« thông báo', error)
    } finally {
      setBusyActionId(null)
    }
  }

  const handleOpenConversation = (item: NotificationItem) => {
    const conversationId = getConversationIdFromMeta(item)
    if (!conversationId) return
    navigate(`/messages?conversation=${encodeURIComponent(conversationId)}`)
  }

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Trung tâm cĂ¡º­p nhĂ¡º­t</p>
          <h1>Thông báo</h1>
          <p className={styles.heroSub}>Theo dõi mĂ¡»i tương tác mĂ¡»›i nhĂ¡º¥t tĂ¡»« bạn bè và cĂ¡»™ng đĂ¡»“ng của bạn.</p>
        </div>
        <button type="button" className={styles.markAllBtn} onClick={handleMarkAllAsRead}>
          <CheckCheck size={16} />
          ĐĂ¡nh dĂ¡º¥u tĂ¡º¥t cĂ¡º£ đã đĂ¡»c
        </button>
      </div>

      <div className={styles.filterRow}>
        <button
          type="button"
          className={`${styles.filterBtn} ${activeFilter === 'all' ? styles.filterBtnActive : ''}`}
          onClick={() => setActiveFilter('all')}
        >
          TĂ¡º¥t cĂ¡º£
        </button>
        <button
          type="button"
          className={`${styles.filterBtn} ${activeFilter === 'social' ? styles.filterBtnActive : ''}`}
          onClick={() => setActiveFilter('social')}
        >
          Mạng xã hĂ¡»™i
        </button>
        <button
          type="button"
          className={`${styles.filterBtn} ${activeFilter === 'messages' ? styles.filterBtnActive : ''}`}
          onClick={() => setActiveFilter('messages')}
        >
          Tin nhĂ¡º¯n
        </button>
      </div>

      <div className={styles.layout}>
        <section className={styles.mainPanel}>
          <div className={styles.panelHead}>
            <h2>Danh sách thông báo</h2>
            <span>{filteredNotifications.length} mĂ¡»¥c</span>
          </div>

          <div className={styles.list}>
            {filteredNotifications.map((item) => (
              <article
                key={item.id}
                className={`${styles.item} ${item.is_read ? '' : styles.itemUnread}`}
                onClick={() => handleMarkOneAsRead(item.id)}
              >
                <div className={styles.itemIconWrap}>{iconForType(item.type)}</div>
                <div className={styles.itemBody}>
                  <p>
                    <strong>{item.title}</strong>
                    {item.body ? ` ${item.body}` : ''}
                  </p>
                  <small>{formatTime(item.created_at)}</small>
                  {item.type === 'friend-request' && !item.is_read ? (
                    <div className={styles.itemActions}>
                      <button
                        type="button"
                        className={styles.acceptBtn}
                        onClick={(event) => {
                          event.stopPropagation()
                          void handleAcceptInvite(item)
                        }}
                        disabled={busyActionId === item.id}
                      >
                        ChĂ¡º¥p nhĂ¡º­n
                      </button>
                      {getConversationIdFromMeta(item) ? (
                        <button
                          type="button"
                          className={styles.deleteBtn}
                          onClick={(event) => {
                            event.stopPropagation()
                            handleOpenConversation(item)
                          }}
                        >
                          MĂ¡» chat
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className={styles.deleteBtn}
                        onClick={(event) => {
                          event.stopPropagation()
                          void handleDeleteInvite(item)
                        }}
                        disabled={busyActionId === item.id}
                      >
                        Xóa
                      </button>
                    </div>
                  ) : null}
                </div>
                {!item.is_read ? <span className={styles.dot} /> : null}
              </article>
            ))}
          </div>

          {filteredNotifications.length === 0 ? (
            <p className={styles.empty}>Không có thông báo nào trong mĂ¡»¥c này.</p>
          ) : null}
        </section>

        <aside className={styles.sidePanel}>
          <div className={styles.statCard}>
            <h3>Chưa đĂ¡»c</h3>
            <p className={styles.statValue}>{unreadCount}</p>
            <span>Thông báo cần bạn xem ngay</span>
          </div>

          <div className={styles.statCard}>
            <h3>GĂ¡»£i ý</h3>
            <ul>
              <li>TrĂ¡º£ lĂ¡»i bình luĂ¡º­n mĂ¡»›i trên bài viết gần đây.</li>
              <li>Kiểm tra lĂ¡»i mĂ¡»i tham gia nhóm chat.</li>
              <li>MĂ¡» mĂ¡»¥c Bạn bè để xem lĂ¡»i mĂ¡»i kĂ¡º¿t bạn.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}

