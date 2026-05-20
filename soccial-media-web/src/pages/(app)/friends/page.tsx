'use client'

import { Link } from 'react-router-dom'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Users, UserPlus } from 'lucide-react'
import { api } from '@/api/client'
import { useAuthStore } from '@/contexts/auth-store'
import type { FriendConnection } from '@/types'
import styles from './page.module.css'

type FriendsTab = 'received' | 'sent' | 'accepted'

const formatRelativeTime = (iso: string) => {
  const date = new Date(iso)
  const diffMins = Math.floor((Date.now() - date.getTime()) / 60000)
  if (diffMins < 1) return 'VĂ¡»«a xong'
  if (diffMins < 60) return `${diffMins} phút trưĂ¡»›c`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours} giĂ¡» trưĂ¡»›c`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays} ngày trưĂ¡»›c`
}

export default function FriendsPage() {
  const token = useAuthStore((state) => state.accessToken)
  const [friends, setFriends] = useState<FriendItem[]>([])
  const [activeTab, setActiveTab] = useState<FriendsTab>('received')
  const [busyIds, setBusyIds] = useState<number[]>([])
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const reloadFriends = useCallback(async () => {
    const res = await api.listFriends()
    setFriends(res.friends)
  }, [])

  useEffect(() => {
    reloadFriends().catch((error) => {
      console.error('Không thể tĂ¡º£i danh sách bạn bè', error)
      setNotice({ type: 'error', text: 'Không thể tĂ¡º£i danh sách bạn bè. Vui lòng thĂ¡»  lại.' })
    })
  }, [reloadFriends])

  const receivedRequests = useMemo(
    () => friends.filter((item) => item.status === 'pending' && !item.requestedByMe),
    [friends]
  )
  const sentRequests = useMemo(
    () => friends.filter((item) => item.status === 'pending' && item.requestedByMe),
    [friends]
  )
  const acceptedFriends = useMemo(() => friends.filter((item) => item.status === 'accepted'), [friends])

  const visibleCards = useMemo(() => {
    if (activeTab === 'received') return receivedRequests
    if (activeTab === 'sent') return sentRequests
    return acceptedFriends
  }, [activeTab, acceptedFriends, receivedRequests, sentRequests])

  const handleAccept = async (id: number) => {
    if (!token) return
    setBusyIds((prev) => [...prev, id])
    try {
      await api.acceptFriend(id)
      await reloadFriends()
      setNotice({ type: 'success', text: 'ĐĂ£ chĂ¡º¥p nhĂ¡º­n lĂ¡»i mĂ¡»i kĂ¡º¿t bạn.' })
    } catch (error) {
      console.error('Không thể chĂ¡º¥p nhĂ¡º­n lĂ¡»i mĂ¡»i kĂ¡º¿t bạn', error)
      setNotice({ type: 'error', text: 'Không thể chĂ¡º¥p nhĂ¡º­n lĂ¡»i mĂ¡»i. Vui lòng thĂ¡»  lại.' })
    } finally {
      setBusyIds((prev) => prev.filter((item) => item !== id))
    }
  }

  const handleDelete = async (id: number) => {
    if (!token) return
    setBusyIds((prev) => [...prev, id])
    try {
      await api.removeFriend(id)
      await reloadFriends()
      setNotice({ type: 'success', text: 'ĐĂ£ cĂ¡º­p nhĂ¡º­t danh sách kĂ¡º¿t bạn.' })
    } catch (error) {
      console.error('Không thể xóa lĂ¡»i mĂ¡»i hoặc hủy kĂ¡º¿t bạn', error)
      setNotice({ type: 'error', text: 'Không thể cĂ¡º­p nhĂ¡º­t lĂ¡»i mĂ¡»i kĂ¡º¿t bạn.' })
    } finally {
      setBusyIds((prev) => prev.filter((item) => item !== id))
    }
  }

  const suggestions = acceptedFriends.slice(0, 3)

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>LĂ¡»i mĂ¡»i kĂ¡º¿t bạn</h1>
          <p>QuĂ¡º£n lý các kết nối đến và đi của bạn</p>
        </div>
        <div className={styles.tabs}>
          <button
            type="button"
            className={activeTab === 'received' ? styles.tabActive : ''}
            onClick={() => setActiveTab('received')}
          >
            ĐĂ£ nhĂ¡º­n
          </button>
          <button
            type="button"
            className={activeTab === 'sent' ? styles.tabActive : ''}
            onClick={() => setActiveTab('sent')}
          >
            ĐĂ£ gĂ¡» i
          </button>
          <button
            type="button"
            className={activeTab === 'accepted' ? styles.tabActive : ''}
            onClick={() => setActiveTab('accepted')}
          >
            Bạn bè
          </button>
        </div>
      </header>

      {notice ? (
        <div className={notice.type === 'success' ? styles.noticeSuccess : styles.noticeError} role="status">
          {notice.text}
        </div>
      ) : null}

      <div className={styles.layout}>
        <section className={styles.mainCol}>
          {visibleCards.map((item) => (
            <article key={item.id} className={styles.requestCard}>
              <div className={styles.avatar}>{(item.fullName[0] || 'U').toUpperCase()}</div>
              <div className={styles.cardBody}>
                <div className={styles.cardHead}>
                  <h3>
                    <Link to={`/profile/${item.id}`}>{item.fullName}</Link>
                  </h3>
                  <span>{formatRelativeTime(item.createdAt)}</span>
                </div>
                <p>
                  <Users size={14} /> {item.email || item.phone || 'Bạn có thĂ¡»ƒ nhĂ¡º¯n tin ngay'}
                </p>
                {activeTab === 'received' ? (
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.acceptBtn}
                      onClick={() => handleAccept(item.id)}
                      disabled={busyIds.includes(item.id)}
                    >
                      {busyIds.includes(item.id) ? 'Ä ang xĂ¡»  lý...' : 'ChĂ¡º¥p nhĂ¡º­n'}
                    </button>
                    <button
                      type="button"
                      className={styles.declineBtn}
                      onClick={() => handleDelete(item.id)}
                      disabled={busyIds.includes(item.id)}
                    >
                      TĂ¡»Ă¡»ừ chối
                    </button>
                  </div>
                ) : activeTab === 'sent' ? (
                  <div className={styles.actions}>
                    <span className={styles.sentLabel}>ĐĂ£ gĂ¡» i lĂ¡»i mĂ¡»i</span>
                    <button
                      type="button"
                      className={styles.declineBtn}
                      onClick={() => handleDelete(item.id)}
                      disabled={busyIds.includes(item.id)}
                    >
                      Hủy lĂ¡»i mĂ¡»i
                    </button>
                  </div>
                ) : (
                  <div className={styles.actions}>
                    <span className={styles.sentLabel}>ĐĂ£ là bạn bè</span>
                    <button
                      type="button"
                      className={styles.declineBtn}
                      onClick={() => handleDelete(item.id)}
                      disabled={busyIds.includes(item.id)}
                    >
                      Hủy kĂ¡º¿t bạn
                    </button>
                  </div>
                )}
              </div>
            </article>
          ))}

          {visibleCards.length === 0 ? <p className={styles.empty}>Không còn lĂ¡»i mĂ¡»i nào trong mĂ¡»¥c này.</p> : null}
        </section>

        <aside className={styles.sideCol}>
          <div className={styles.statCard}>
            <p>TĂ¡»•ng chĂ¡» xác nhĂ¡º­n</p>
            <strong>{receivedRequests.length}</strong>
            <small>{acceptedFriends.length} bạn bè đang kết nối</small>
          </div>

          <div className={styles.suggestCard}>
            <h3>GĂ¡»£i ý</h3>
            <div className={styles.suggestList}>
              {suggestions.map((item) => (
                <Link key={item.id} to={`/profile/${item.id}`} className={styles.suggestItem}>
                  <span className={styles.avatarSmall}>{(item.fullName[0] || 'U').toUpperCase()}</span>
                  <span>
                    <b>{item.fullName}</b>
                    <small>{item.email || item.phone || 'Bạn bè'}</small>
                  </span>
                  <UserPlus size={14} />
                </Link>
              ))}
            </div>
            <Link to="/explore" className={styles.allSuggestBtn}>
              Xem tĂ¡º¥t cĂ¡º£ gĂ¡»£i ý
            </Link>
          </div>
        </aside>
      </div>
    </div>
  )
}

