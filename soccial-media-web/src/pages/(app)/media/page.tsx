'use client'

import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { Search, Upload, FileText, PlayCircle, X } from 'lucide-react'
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
  const [lightboxUrl, setLightboxUrl] = useState<{ url: string; type: MediaType } | null>(null)

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
    <div className="p-4 space-y-4">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Thư viện Media</h1>
          <p className="text-sm text-muted-foreground">Ảnh, video và tài liệu của bạn</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm media..."
            className="w-full h-10 pl-9 pr-3 rounded-xl bg-muted/50 border border-border text-sm outline-none focus:border-primary/40 transition-colors"
          />
        </div>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 bg-muted/50 rounded-xl p-1">
          {(['all', 'image', 'video', 'doc'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setTypeFilter(type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                typeFilter === type
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {type === 'all' ? 'Tất cả' : type === 'image' ? 'Ảnh' : type === 'video' ? 'Video' : 'Tài liệu'}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-muted/50 rounded-xl p-1 ml-auto">
          <button type="button" onClick={() => setScope('sent')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${scope === 'sent' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            Của tôi
          </button>
          <button type="button" onClick={() => setScope('community')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${scope === 'community' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            Cộng đồng
          </button>
        </div>
      </div>

      {/* Media grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {filteredItems.map((item) => (
          <article
            key={item.id}
            className={`group relative rounded-2xl border border-border bg-card overflow-hidden transition-all hover:shadow-md hover:border-primary/20 ${
              item.large ? 'row-span-2 col-span-2' : ''
            }`}
            onClick={() => (item.type === 'image' || item.type === 'video') ? setLightboxUrl({ url: item.mediaUrl, type: item.type }) : undefined}
          >
            {item.type === 'image' ? (
              <div className="aspect-square overflow-hidden bg-muted">
                <img src={item.mediaUrl} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
              </div>
            ) : item.type === 'video' ? (
              <div className="aspect-square bg-muted flex items-center justify-center relative">
                <PlayCircle size={40} className="text-foreground/30 group-hover:text-primary/50 transition-colors" />
              </div>
            ) : (
              <div className="aspect-square bg-muted/50 flex items-center justify-center">
                <FileText size={32} className="text-muted-foreground/40" />
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 pt-6 opacity-0 group-hover:opacity-100 transition-opacity">
              <p className="text-white text-xs font-medium truncate">{item.title}</p>
              <p className="text-white/60 text-[10px]">{item.tag.toUpperCase()}</p>
            </div>
          </article>
        ))}
        {filteredItems.length === 0 && (
          <div className="col-span-full rounded-2xl border border-border bg-card p-8 text-center">
            <Search size={28} className="mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">Chưa có media phù hợp.</p>
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setLightboxUrl(null)}>
          <button type="button" onClick={() => setLightboxUrl(null)} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors">
            <X size={20} />
          </button>
          {lightboxUrl.type === 'video' ? (
            <video src={lightboxUrl.url} controls className="max-w-full max-h-[85vh] rounded-2xl" onClick={(e) => e.stopPropagation()} />
          ) : (
            <img src={lightboxUrl.url} alt="preview" className="max-w-full max-h-[85vh] rounded-2xl object-contain" onClick={(e) => e.stopPropagation()} />
          )}
        </div>
      )}

      {/* FAB Upload */}
      <Link to="/feed?compose=1" className="fixed bottom-20 right-4 lg:bottom-6 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-all active:scale-95 z-40">
        <Upload size={18} />
      </Link>
    </div>
  )
}

