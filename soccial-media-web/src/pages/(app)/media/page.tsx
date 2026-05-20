'use client'

import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { Search, Upload, FileText, PlayCircle } from 'lucide-react'
import { api, isAuthExpiredError } from '@/api/client'
import type { FeedPost } from '@/types'
import { useAuthStore } from '@/contexts/auth-store'
import styles from './page.module.css'

type MediaType = 'image' | 'video' | 'doc' | 'file'

const detectMediaType = (url: string): MediaType => {
  const normalized = url.toLowerCase()
  if (/(\.jpg|\.jpeg|\.png|\.gif|\.webp|\.avif)(\?|$)/.test(normalized)) return 'image'
  if (/(\.mp4|\.mov|\.webm|\.mkv)(\?|$)/.test(normalized)) return 'video'
  if (/(\.pdf|\.doc|\.docx|\.xls|\.xlsx|\.ppt|\.pptx)(\?|$)/.test(normalized)) return 'doc'
  return 'file'
}

const colorClasses = ['a', 'b', 'c', 'd', 'e', 'f'] as const

export default function MediaPage() {
  const token = useAuthStore((state) => state.accessToken)
  const me = useAuthStore((state) => state.user)
  const clearAuth = useAuthStore((state) => state.clearAuth)
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'image' | 'video' | 'doc'>('all')
  const [scope, setScope] = useState<'sent' | 'community'>('sent')

  useEffect(() => {
    api
      .listFeed(token || undefined)
      .then((result) => setPosts(result.posts))
      .catch((error) => {
        if (isAuthExpiredError(error)) {
          clearAuth()
          window.location.href = '/auth/login?reason=session-expired'
          return
        }
        console.error('Failed to load media items', error)
      })
  }, [clearAuth, token])

  const mediaItems = useMemo(() => {
    const selectedPosts = posts.filter((post) => {
      if (!post.mediaUrl) return false
      if (scope === 'sent') {
        return post.authorId === me?.id
      }
      return true
    })

    return selectedPosts.map((post, index) => {
      const mediaUrl = post.mediaUrl || ''
      const type = detectMediaType(mediaUrl)
      const title = mediaUrl.split('/').pop()?.split('?')[0] || `media-${post.id}`
      const score = post.reactionCount + post.commentCount
      return {
        id: post.id,
        type,
        title,
        tag: type,
        color: colorClasses[index % colorClasses.length],
        large: score >= 5,
        mediaUrl,
      }
    })
  }, [me?.id, posts, scope])

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase()
    return mediaItems.filter((item) => {
      if (typeFilter !== 'all' && item.type !== typeFilter) return false
      if (!q) return true
      return item.title.toLowerCase().includes(q) || item.tag.toLowerCase().includes(q)
    })
  }, [mediaItems, query, typeFilter])

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Thư viĂ¡»‡n media</h1>
          <p>QuĂ¡º£n lý Ă¡º£nh, video và tài liĂ¡»‡u dùng trong bài viết của bạn.</p>
        </div>
        <div className={styles.searchWrap}>
          <Search size={16} />
          <input placeholder="Tìm media..." value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
      </header>

      <div className={styles.tabRow}>
        <div className={styles.tabs}>
          <button type="button" className={typeFilter === 'all' ? styles.tabActive : ''} onClick={() => setTypeFilter('all')}>TĂ¡º¥t cĂ¡º£</button>
          <button type="button" className={typeFilter === 'image' ? styles.tabActive : ''} onClick={() => setTypeFilter('image')}>Ă¡º¢nh</button>
          <button type="button" className={typeFilter === 'video' ? styles.tabActive : ''} onClick={() => setTypeFilter('video')}>Video</button>
          <button type="button" className={typeFilter === 'doc' ? styles.tabActive : ''} onClick={() => setTypeFilter('doc')}>Tài liĂ¡»‡u</button>
        </div>
        <div className={styles.switchWrap}>
          <button type="button" className={scope === 'sent' ? styles.tabActive : ''} onClick={() => setScope('sent')}>CĂ¡»§a tôi</button>
          <button type="button" className={scope === 'community' ? styles.tabActive : ''} onClick={() => setScope('community')}>CĂ¡»™ng đĂ¡»“ng</button>
        </div>
      </div>

      <section className={styles.grid}>
        {filteredItems.map((item) => (
          <article key={item.id} className={`${styles.card} ${item.large ? styles.cardLarge : ''} ${styles[item.color]}`}>
            {item.type === 'video' ? <PlayCircle className={styles.videoIcon} size={18} /> : null}
            {item.type === 'doc' ? <FileText size={26} /> : null}
            {item.type === 'file' ? <Upload size={26} /> : null}
            <div className={styles.meta}>
              <b>{item.title}</b>
              <small>{item.tag.toUpperCase()}</small>
            </div>
          </article>
        ))}
        {filteredItems.length === 0 ? <p className={styles.empty}>Chưa có media phù hĂ¡»£p vĂ¡»›i bĂ¡»™ lĂ¡»c hiĂ¡»‡n tại.</p> : null}
      </section>

      <Link to="/feed?compose=1" className={styles.uploadBtn}>
        <Upload size={18} />
      </Link>
    </div>
  )
}

