'use client'

import { Link } from 'react-router-dom'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Search, Users, UserPlus, X } from 'lucide-react'
import { api } from '@/api/client'
import { useAuthStore } from '@/contexts/auth-store'
import type { FriendConnection } from '@/types'
import styles from './page.module.css'

type FriendsTab = 'received' | 'sent' | 'accepted'

const formatRelativeTime = (iso: string) => {
  const date = new Date(iso)
  const diffMins = Math.floor((Date.now() - date.getTime()) / 60000)
  if (diffMins < 1) return 'Vừa xong'
  if (diffMins < 60) return `${diffMins} phút trước`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours} giờ trước`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays} ngày trước`
}

export default function FriendsPage() {
  const token = useAuthStore((state) => state.accessToken)
  const [friends, setFriends] = useState<FriendConnection[]>([])
  const [activeTab, setActiveTab] = useState<FriendsTab>('received')
  const [busyIds, setBusyIds] = useState<number[]>([])
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const me = useAuthStore((state) => state.user)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{ id: number; fullName: string; username: string; avatarUrl: string | null; isVerified: boolean }>>([])
  const [searching, setSearching] = useState(false)
  const [requestSentIds, setRequestSentIds] = useState<number[]>([])

  const reloadFriends = useCallback(async () => {
    if (!token) return
    const res = await api.listFriends(token)
    setFriends(res.friends)
  }, [token])

  useEffect(() => {
    reloadFriends().catch((error) => {
      console.error('Không thể tải danh sách bạn bè', error)
      setNotice({ type: 'error', text: 'Không thể tải danh sách bạn bè. Vui lòng thử lại.' })
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
      await api.acceptFriend(token, id)
      await reloadFriends()
      setNotice({ type: 'success', text: 'Đã chấp nhận lời mời kết bạn.' })
    } catch (error) {
      console.error('Không thể chấp nhận lời mời kết bạn', error)
      setNotice({ type: 'error', text: 'Không thể chấp nhận lời mời. Vui lòng thử lại.' })
    } finally {
      setBusyIds((prev) => prev.filter((item) => item !== id))
    }
  }

  const handleDelete = async (id: number) => {
    if (!token) return
    setBusyIds((prev) => [...prev, id])
    try {
      await api.deleteFriend(token, id)
      await reloadFriends()
      setNotice({ type: 'success', text: 'Đã cập nhật danh sách kết bạn.' })
    } catch (error) {
      console.error('Không thể xóa lời mời hoặc hủy kết bạn', error)
      setNotice({ type: 'error', text: 'Không thể cập nhật lời mời kết bạn.' })
    } finally {
      setBusyIds((prev) => prev.filter((item) => item !== id))
    }
  }

  const suggestions = acceptedFriends.slice(0, 3)

  // Debounced user search
  useEffect(() => {
    if (!token || searchQuery.trim().length < 2) {
      setSearchResults([])
      return
    }
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await api.searchUsers(token, searchQuery.trim())
        const users = (res.users || []) as Array<{ id: number; fullName: string; username: string; avatarUrl: string | null; isVerified: boolean }>
        const friendIds = new Set(friends.map((f) => f.id))
        setSearchResults(users.filter((u) => !friendIds.has(u.id) && String(u.id) !== String(me?.id)))
      } catch {
        // ignore
      } finally {
        setSearching(false)
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [searchQuery, token, friends, me?.id])

  const handleSendRequest = async (userId: number) => {
    if (!token) return
    setRequestSentIds((prev) => [...prev, userId])
    try {
      await api.requestFriend(token, userId)
      setNotice({ type: 'success', text: 'Đã gửi lời mời kết bạn.' })
    } catch {
      setNotice({ type: 'error', text: 'Không thể gửi lời mời kết bạn.' })
    } finally {
      setRequestSentIds((prev) => prev.filter((id) => id !== userId))
    }
  }

  const hasActiveSearch = searchQuery.trim().length >= 2

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Bạn bè</h1>
          <p className="text-sm text-muted-foreground">Quản lý kết nối của bạn</p>
        </div>
        {/* Tabs */}
        <div className="flex gap-1 bg-muted/50 rounded-xl p-1">
          {(['received', 'sent', 'accepted'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === tab
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab === 'received' ? `Đã nhận (${receivedRequests.length})` : tab === 'sent' ? `Đã gửi (${sentRequests.length})` : `Bạn bè (${acceptedFriends.length})`}
            </button>
          ))}
        </div>
      </header>

      {/* Notice */}
      {notice && (
        <div className={`rounded-xl px-4 py-3 text-sm ${
          notice.type === 'success'
            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
            : 'bg-destructive/10 text-destructive border border-destructive/20'
        }`} role="status">
          {notice.text}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Tìm kiếm người dùng..."
          className="w-full h-10 pl-9 pr-9 rounded-xl border border-border bg-card text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
        />
        {searching && <Loader2 size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin" />}
        {!searching && searchQuery.length > 0 && (
          <button type="button" onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Search Results */}
      {hasActiveSearch && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          {searching ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Đang tìm kiếm...</div>
          ) : searchResults.length > 0 ? (
            <div className="divide-y divide-border">
              <div className="px-4 py-2.5 bg-muted/20">
                <p className="text-xs font-semibold text-muted-foreground">Kết quả tìm kiếm</p>
              </div>
              {searchResults.map((user) => (
                <div key={user.id} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/5 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold shrink-0">
                    {user.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link to={`/profile/${user.username || user.id}`} className="text-sm font-medium hover:underline">
                      {user.fullName}
                    </Link>
                    {user.username && <p className="text-xs text-muted-foreground">@{user.username}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSendRequest(user.id)}
                    disabled={requestSentIds.includes(user.id)}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all shrink-0"
                  >
                    {requestSentIds.includes(user.id) ? 'Đã gửi' : 'Kết bạn'}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center">
              <p className="text-sm text-muted-foreground">Không tìm thấy người dùng nào.</p>
            </div>
          )}
        </div>
      )}

      {/* Layout */}
      {!hasActiveSearch && (
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-4">
        {/* Main */}
        <div className="space-y-2">
          {visibleCards.length > 0 ? visibleCards.map((item) => (
            <article key={item.id} className="rounded-2xl border border-border bg-card p-4 flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
                {item.fullName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">
                    <Link to={`/profile/${item.username || item.id}`} className="hover:underline">{item.fullName}</Link>
                    {item.username ? <span className="text-xs text-muted-foreground ml-1.5 font-normal">@{item.username}</span> : null}
                  </h3>
                  <span className="text-xs text-muted-foreground shrink-0">{formatRelativeTime(item.createdAt)}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Users size={12} /> {item.email || item.phone || 'Có thể nhắn tin'}
                </p>
                <div className="flex items-center gap-2 mt-3">
                  {activeTab === 'received' && (
                    <>
                      <button type="button" onClick={() => handleAccept(item.id)} disabled={busyIds.includes(item.id)}
                        className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all">
                        {busyIds.includes(item.id) ? 'Đang xử lý...' : 'Chấp nhận'}
                      </button>
                      <button type="button" onClick={() => handleDelete(item.id)} disabled={busyIds.includes(item.id)}
                        className="px-4 py-1.5 rounded-lg text-xs font-medium border border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 disabled:opacity-50 transition-all">
                        Từ chối
                      </button>
                    </>
                  )}
                  {activeTab === 'sent' && (
                    <>
                      <span className="text-xs text-muted-foreground flex items-center gap-1"><Users size={12} /> Đã gửi lời mời</span>
                      <button type="button" onClick={() => handleDelete(item.id)} disabled={busyIds.includes(item.id)}
                        className="px-4 py-1.5 rounded-lg text-xs font-medium border border-border hover:bg-destructive/10 hover:text-destructive transition-all disabled:opacity-50">
                        Hủy lời mời
                      </button>
                    </>
                  )}
                  {activeTab === 'accepted' && (
                    <>
                      <span className="text-xs text-emerald-500 flex items-center gap-1"><Users size={12} /> Đã kết bạn</span>
                      <button type="button" onClick={() => handleDelete(item.id)} disabled={busyIds.includes(item.id)}
                        className="px-4 py-1.5 rounded-lg text-xs font-medium border border-border hover:bg-destructive/10 hover:text-destructive transition-all disabled:opacity-50">
                        Hủy kết bạn
                      </button>
                    </>
                  )}
                </div>
              </div>
            </article>
          )) : (
            <div className="rounded-2xl border border-border bg-card p-8 text-center">
              <Users size={32} className="mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">Không còn lời mời nào trong mục này.</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4 text-center">
            <p className="text-xs text-muted-foreground">Tổng chờ xác nhận</p>
            <p className="text-3xl font-bold text-primary mt-1">{receivedRequests.length}</p>
            <p className="text-xs text-muted-foreground mt-1">{acceptedFriends.length} bạn bè</p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold mb-3">Gợi ý</h3>
            <div className="space-y-2">
              {suggestions.map((item) => (
                <Link key={item.id} to={`/profile/${item.username || item.id}`} className="flex items-center gap-3 p-2 rounded-xl hover:bg-accent/10 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                    {item.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.fullName}</p>
                    {item.username ? <p className="text-xs text-muted-foreground">@{item.username}</p> : <p className="text-xs text-muted-foreground truncate">{item.email || 'Bạn bè'}</p>}
                  </div>
                  <UserPlus size={13} className="text-muted-foreground shrink-0" />
                </Link>
              ))}
            </div>
            <Link to="/explore" className="block text-xs text-primary hover:underline mt-3 text-center">
              Xem tất cả gợi ý
            </Link>
          </div>
        </aside>
      </div>
      )}
    </div>
  )
}

