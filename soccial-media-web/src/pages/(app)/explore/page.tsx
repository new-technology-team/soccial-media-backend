'use client'

import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Heart, MessageCircle, Search, Share2, UserPlus } from 'lucide-react'
import { api, isAuthExpiredError } from '@/lib/api'
import { useAuthStore } from '@/lib/store/auth-store'
import type { FeedPost } from '@/lib/types'
import styles from './page.module.css'

/** Transform backend post response to FeedPost. */
function toFeedPost(raw: Record<string, unknown>): FeedPost {
  const owner = raw.owner as Record<string, unknown> | undefined;
  return {
    id: Number(raw.id ?? 0),
    authorId: Number(owner?.userId ?? 0),
    authorName: String(owner?.displayName ?? raw.title ?? 'Người dùng'),
    authorAvatar: (owner?.avatarUrl as string | undefined) ?? null,
    content: String(raw.content ?? raw.title ?? ''),
    mediaUrl: (raw.mediaUrl as string) || null,
    visibility: (raw.visibility as 'public' | 'private') || 'public',
    status: 'published',
    reactionCount: Number(raw.reactionCount ?? 0),
    commentCount: Number(raw.commentCount ?? 0),
    viewerReaction: (raw.viewerReaction as string | null) ?? null,
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
  };
}

export default function ExplorePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = useAuthStore((state) => state.accessToken)
  const clearAuth = useAuthStore((state) => state.clearAuth)
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [sortMode, setSortMode] = useState<'all' | 'recent' | 'popular'>('all')

  useEffect(() => {
    api
      .listFeed()
      .then((r) => setPosts((r.posts as Record<string, unknown>[]).map(toFeedPost)))
      .catch((error) => {
        if (isAuthExpiredError(error)) {
          clearAuth()
          navigate('/auth/login?reason=session-expired')
          return
        }
        console.error('Failed to load explore feed', error)
      })
  }, [clearAuth, navigate])

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
    const map = new Map<number, { id: number; name: string; postCount: number }>()
    sortedPosts.forEach((post) => {
      if (!map.has(post.authorId)) {
        map.set(post.authorId, { id: post.authorId, name: post.authorName, postCount: 1 })
      } else {
        const current = map.get(post.authorId)
        if (current) current.postCount += 1
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
    <div className={styles.page}>
      <section className={styles.topSearch}>
        <Search size={16} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm kiếm toàn cục..." />
      </section>

      <section className={styles.header}>
        <div>
          <h1>Kết quả tìm kiếm</h1>
          <p>
            Hiển thị {filteredPosts.length} kết quả cho <span>"{query || 'tất cả'}"</span>
          </p>
        </div>
        <div className={styles.filters}>
          <button type="button" className={sortMode === 'all' ? styles.filterActive : ''} onClick={() => setSortMode('all')}>Tất cả</button>
          <button type="button" className={sortMode === 'recent' ? styles.filterActive : ''} onClick={() => setSortMode('recent')}>Gần đây</button>
          <button type="button" className={sortMode === 'popular' ? styles.filterActive : ''} onClick={() => setSortMode('popular')}>Nổi bật</button>
        </div>
      </section>

      <div className={styles.grid}>
        <section className={styles.peopleCol}>
          <div className={styles.sectionHead}>
            <h2>Mọi người</h2>
            <Link to="/friends">Xem tất cả</Link>
          </div>

          <div className={styles.peopleList}>
            {people.map((person) => (
              <Link key={person.id} to={`/profile/${person.id}`} className={styles.personCard}>
                <div className={styles.avatar}>{(person.name[0] || 'U').toUpperCase()}</div>
                <div className={styles.personMeta}>
                  <strong>{person.name}</strong>
                  <small>{person.postCount} bài viết liên quan</small>
                </div>
                <UserPlus size={14} />
              </Link>
            ))}
            {people.length === 0 ? <p className={styles.empty}>Không có người dùng phù hợp.</p> : null}
          </div>

          <div className={styles.box}>
            <div className={styles.sectionHead}>
              <h2>Chủ đề liên quan</h2>
              <Link to="/feed">Xem tất cả</Link>
            </div>
            {relatedTopics.map(([tag, count], idx) => (
              <Link key={tag} to={`/explore?q=${encodeURIComponent(tag)}`} className={styles.groupItem}>
                <span className={idx % 2 === 0 ? styles.groupIcon : styles.groupIconAlt}>{tag.replace('#', '').slice(0, 1).toUpperCase() || '#'}</span>
                <span>
                  <b>{tag}</b>
                  <small>{count} bài viết</small>
                </span>
              </Link>
            ))}
            {relatedTopics.length === 0 ? <p className={styles.empty}>Chưa có hashtag phù hợp.</p> : null}
          </div>
        </section>

        <section className={styles.postsCol}>
          <div className={styles.sectionHead}>
            <h2>Bài viết nổi bật</h2>
            <Link to="/feed">Xem tất cả</Link>
          </div>

          {topPosts.map((post, idx) => (
            <article key={post.id} className={`${styles.postCard} ${idx === 0 ? styles.postFeatured : ''}`}>
              <div className={styles.postHead}>
                <div className={styles.avatar}>{(post.authorName[0] || 'U').toUpperCase()}</div>
                <div>
                  <Link to={`/profile/${post.authorId}`}>
                    <strong>{post.authorName}</strong>
                  </Link>
                  <small>{new Date(post.createdAt).toLocaleString('vi-VN')}</small>
                </div>
              </div>

              <p className={styles.postContent}>{post.content}</p>
              {post.mediaUrl ? (
                <img
                  src={post.mediaUrl}
                  alt="Post media"
                  className={styles.postMedia}
                  loading="lazy"
                  onError={(event) => {
                    event.currentTarget.style.display = 'none'
                  }}
                />
              ) : null}

              <div className={styles.postStats}>
                <span><Heart size={14} /> {post.reactionCount}</span>
                <span><MessageCircle size={14} /> {post.commentCount}</span>
                <span><Share2 size={14} /> Chia sẻ</span>
              </div>
            </article>
          ))}

          {topPosts.length === 0 ? <p className={styles.empty}>Không có bài viết phù hợp.</p> : null}
        </section>
      </div>
    </div>
  )
}
