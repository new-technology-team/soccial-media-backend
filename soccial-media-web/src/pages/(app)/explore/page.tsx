'use client'

import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Heart, MessageCircle, Search, Share2, UserPlus } from 'lucide-react'
import { api, isAuthExpiredError } from '@/api/client'
import { useAuthStore } from '@/contexts/auth-store'
import type { FeedPost } from '@/types'
import { Skeleton } from '@/components/ui/skeleton'
import styles from './page.module.css'

const isVideoMediaUrl = (url: string) =>
  /\.(mp4|webm|ogg|mov|m4v|avi|mkv)(\?.*)?$/i.test(url) || url.includes('/video/')

type UserResult = { userId: number; displayName: string; username?: string; avatarUrl: string | null }

export default function ExplorePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = useAuthStore((state) => state.accessToken)
  const clearAuth = useAuthStore((state) => state.clearAuth)
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [sortMode, setSortMode] = useState<'all' | 'recent' | 'popular'>('all')
  const [userResults, setUserResults] = useState<UserResult[]>([])
  const [isSearching, setIsSearching] = useState(false)

  useEffect(() => {
    api
      .listFeed(token || undefined)
      .then((r) => setPosts(r.posts))
      .catch((error) => {
        if (isAuthExpiredError(error)) {
          clearAuth()
          navigate('/auth/login?reason=session-expired')
          return
        }
        console.error('Failed to load explore feed', error)
      })
  }, [clearAuth, navigate, token])

  useEffect(() => {
    const q = (searchParams.get('q') || '').trim()
    if (q) {
      setQuery(q)
    }
  }, [searchParams])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
    }, 260)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    const q = debouncedQuery.trim()
    if (!q || !token) {
      setUserResults([])
      setIsSearching(false)
      return
    }
    setIsSearching(true)
    api.searchUsers(token, q)
      .then((r) => setUserResults((r.users || []) as unknown as UserResult[]))
      .catch(console.error)
      .finally(() => setIsSearching(false))
  }, [debouncedQuery, token])

  const filteredPosts = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase()
    if (!q) return posts
    return posts.filter((post) => post.content.toLowerCase().includes(q) || post.authorName.toLowerCase().includes(q))
  }, [debouncedQuery, posts])

  const sortedPosts = useMemo(() => {
    if (sortMode === 'recent') {
      return [...filteredPosts].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    }
    if (sortMode === 'popular') {
      return [...filteredPosts].sort(
        (a, b) => b.reactionCount + b.commentCount - (a.reactionCount + a.commentCount)
      )
    }
    return filteredPosts
  }, [filteredPosts, sortMode])

  const people = useMemo(() => {
    const map = new Map<number, { id: number; name: string; avatarUrl: string | null; postCount: number }>()
    sortedPosts.forEach((post) => {
      if (!map.has(post.authorId)) {
        map.set(post.authorId, { id: post.authorId, name: post.authorName, avatarUrl: post.authorAvatar || null, postCount: 1 })
      } else {
        const current = map.get(post.authorId)
        if (current) {
          current.postCount += 1
          if (!current.avatarUrl && post.authorAvatar) current.avatarUrl = post.authorAvatar
        }
      }
    })
    return Array.from(map.values())
      .sort((a, b) => b.postCount - a.postCount)
      .slice(0, 5)
  }, [sortedPosts])

  const relatedTopics = useMemo(() => {
    const topicMap = new Map<string, number>()
    sortedPosts.forEach((post) => {
      const tags = post.content.match(/#[^\s#.,!?;:]+/g) || []
      tags.forEach((tag) => topicMap.set(tag, (topicMap.get(tag) || 0) + 1))
    })

    return Array.from(topicMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
  }, [sortedPosts])

  const topPosts = sortedPosts.slice(0, 3)

  return (
    <div className="p-4 space-y-4">
      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm kiếm toàn cục..."
          className="w-full h-11 pl-10 pr-4 rounded-2xl bg-muted/50 border border-border text-sm outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all"
          autoFocus
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
          >
            Xóa
          </button>
        )}
      </div>

      {/* Results count + filters */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">Khám phá</h1>
          <p className="text-xs text-muted-foreground">
            {filteredPosts.length} kết quả{query && <> cho "<span className="text-foreground font-medium">{query}</span>"</>}
          </p>
        </div>
        <div className="flex gap-1 bg-muted/50 rounded-xl p-1">
          {(['all', 'recent', 'popular'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setSortMode(mode)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                sortMode === mode
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {mode === 'all' ? 'Tất cả' : mode === 'recent' ? 'Gần đây' : 'Nổi bật'}
            </button>
          ))}
        </div>
      </div>

      {/* People + Topics + Posts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        {/* Sidebar */}
        <aside className="space-y-4">
          {/* People */}
          <section className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Mọi người</h2>
              <Link to="/friends" className="text-xs text-primary hover:underline">Xem tất cả</Link>
            </div>
            <div className="space-y-2">
              {query.trim() ? (
                isSearching ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-muted shimmer shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3 bg-muted rounded shimmer w-3/4" />
                        <div className="h-2.5 bg-muted rounded shimmer w-1/2" />
                      </div>
                    </div>
                  ))
                ) : userResults.length > 0 ? (
                  userResults.map((u) => (
                    <Link
                      key={u.userId}
                      to={`/profile/${u.username || u.userId}`}
                      className="flex items-center gap-3 p-2 rounded-xl hover:bg-accent/10 transition-colors"
                    >
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold shrink-0 overflow-hidden">
                        {u.avatarUrl ? <img src={u.avatarUrl} alt={u.displayName} className="w-full h-full object-cover" /> : u.displayName[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{u.displayName}</p>
                        {u.username ? <p className="text-xs text-muted-foreground">@{u.username}</p> : null}
                      </div>
                      <UserPlus size={14} className="text-muted-foreground shrink-0" />
                    </Link>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">Không tìm thấy người dùng.</p>
                )
              ) : people.length > 0 ? (
                people.map((person) => (
                  <Link
                    key={person.id}
                    to={`/profile/${person.id}`}
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-accent/10 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold shrink-0 overflow-hidden">
                      {person.avatarUrl ? <img src={person.avatarUrl} alt={person.name} className="w-full h-full object-cover" /> : person.name[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{person.name}</p>
                      <p className="text-xs text-muted-foreground">{person.postCount} bài viết</p>
                    </div>
                  </Link>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Không có người dùng nổi bật.</p>
              )}
            </div>
          </section>

          {/* Topics */}
          <section className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Chủ đề</h2>
              <Link to="/feed" className="text-xs text-primary hover:underline">Xem tất cả</Link>
            </div>
            <div className="space-y-1">
              {relatedTopics.map(([tag, count]) => (
                <Link
                  key={tag}
                  to={`/explore?q=${encodeURIComponent(tag)}`}
                  className="flex items-center gap-3 p-2 rounded-xl hover:bg-accent/10 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                    {tag.replace('#', '').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{tag}</p>
                    <p className="text-xs text-muted-foreground">{count} bài viết</p>
                  </div>
                </Link>
              ))}
              {relatedTopics.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Chưa có hashtag.</p>
              )}
            </div>
          </section>
        </aside>

        {/* Posts */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Bài viết nổi bật</h2>
            <Link to={debouncedQuery ? `/feed?q=${encodeURIComponent(debouncedQuery)}` : '/feed'} className="text-xs text-primary hover:underline">Xem tất cả</Link>
          </div>

          {topPosts.length > 0 ? topPosts.map((post, idx) => (
            <article
              key={post.id}
              className={`rounded-2xl border bg-card transition-all hover:shadow-sm cursor-pointer ${
                idx === 0 ? 'border-primary/20 ring-1 ring-primary/10' : 'border-border'
              }`}
              onClick={() => navigate(`/posts/${post.id}`)}
            >
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold shrink-0 overflow-hidden">
                    {post.authorAvatar ? <img src={post.authorAvatar} alt={post.authorName} className="w-full h-full object-cover" /> : post.authorName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <Link to={`/profile/${post.authorUsername || post.authorId}`} onClick={(e) => e.stopPropagation()} className="text-sm font-semibold hover:underline">
                      {post.authorName}
                      {post.authorUsername ? <span className="text-xs text-muted-foreground ml-1">@{post.authorUsername}</span> : null}
                    </Link>
                    <p className="text-xs text-muted-foreground">{new Date(post.createdAt).toLocaleString('vi-VN')}</p>
                  </div>
                  {idx === 0 && (
                    <span className="ml-auto px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium">Nổi bật</span>
                  )}
                </div>

                <p className="text-sm leading-relaxed line-clamp-3">{post.content}</p>

                {post.mediaUrl && (
                  <div className="rounded-xl overflow-hidden bg-muted">
                    {isVideoMediaUrl(post.mediaUrl) ? (
                      <video src={post.mediaUrl} controls className="w-full max-h-48 object-cover" onClick={(e) => e.stopPropagation()} />
                    ) : (
                      <img src={post.mediaUrl} alt="" className="w-full max-h-48 object-cover" loading="lazy" />
                    )}
                  </div>
                )}

                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Heart size={13} /> {post.reactionCount}</span>
                  <span className="flex items-center gap-1"><MessageCircle size={13} /> {post.commentCount}</span>
                  <span className="flex items-center gap-1"><Share2 size={13} /> Chia sẻ</span>
                </div>
              </div>
            </article>
          )) : (
            <div className="rounded-2xl border border-border bg-card p-8 text-center">
              <Search size={28} className="mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">Không có bài viết.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

