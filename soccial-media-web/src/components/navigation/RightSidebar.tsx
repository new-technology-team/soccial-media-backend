'use client'

import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, TrendingUp, Users, Hash, ArrowRight, X } from 'lucide-react'
import { cn } from '@/utils'
import { useAuthStore } from '@/contexts/auth-store'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'

/* ---- Types ---- */
export interface TrendingTopic {
  tag: string
  postCount: number
  category?: string
}

export interface SuggestedUser {
  id: number
  name: string
  username?: string
  avatarUrl: string | null
  mutualCount?: number
}

interface RightSidebarProps {
  trending?: TrendingTopic[]
  suggestions?: SuggestedUser[]
  className?: string
}

/* ==========================================================
   RightSidebar — Khu vực bên phải (Trending + Suggestions)
   - Ẩn trên mobile/tablet, chỉ hiện desktop (>=1024px)
   - Sticky scroll
   ========================================================== */
export default function RightSidebar({
  trending = [],
  suggestions = [],
  className,
}: RightSidebarProps) {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  // Demo trending data nếu không có real data
  const displayTrending: TrendingTopic[] =
    trending.length > 0
      ? trending
      : [
          { tag: '#congnghe', postCount: 2840, category: 'Công nghệ' },
          { tag: '#giaitri', postCount: 1950, category: 'Giải trí' },
          { tag: '#thethao', postCount: 1520, category: 'Thể thao' },
          { tag: '#hoc tap', postCount: 1280, category: 'Giáo dục' },
          { tag: '#amnhac', postCount: 960, category: 'Âm nhạc' },
        ]

  const displaySuggestions: SuggestedUser[] =
    suggestions.length > 0
      ? suggestions
      : user
        ? []
        : [
            { id: 1, name: 'Nguyễn Văn A', avatarUrl: null, mutualCount: 3 },
            { id: 2, name: 'Trần Thị B', avatarUrl: null, mutualCount: 5 },
            { id: 3, name: 'Lê Văn C', avatarUrl: null, mutualCount: 1 },
          ]

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = searchQuery.trim()
    if (!q) return
    navigate(`/explore?q=${encodeURIComponent(q)}`)
    setSearchQuery('')
  }

  // Close search dropdown on outside click
  useEffect(() => {
    if (!searchFocused) return
    const handleClick = (e: PointerEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchFocused(false)
      }
    }
    window.addEventListener('pointerdown', handleClick)
    return () => window.removeEventListener('pointerdown', handleClick)
  }, [searchFocused])

  return (
    <aside
      className={cn(
        'w-[var(--right-sidebar-width)] shrink-0',
        'hidden lg:block',
        'sticky top-0 h-screen overflow-y-auto hide-scrollbar',
        'px-4 py-3',
        className
      )}
    >
      <div className="flex flex-col gap-4">
        {/* ===== SEARCH BAR ===== */}
        <div ref={searchRef} className="relative">
          <form onSubmit={handleSearch}>
            <div
              className={cn(
                'relative transition-all duration-200',
                searchFocused && 'scale-[1.02]'
              )}
            >
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
              />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                placeholder="Tìm kiếm..."
                className={cn(
                  'pl-9 h-10 rounded-full bg-muted/50 border-none',
                  'placeholder:text-muted-foreground/60',
                  'focus-visible:ring-1 focus-visible:ring-ring',
                  'transition-all duration-200'
                )}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </form>
        </div>

        {/* ===== TRENDING TOPICS ===== */}
        <section className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-4 pt-4 pb-3">
            <TrendingUp size={18} className="text-primary" />
            <h3 className="text-base font-bold">Xu hướng</h3>
          </div>
          <div className="divide-y divide-border/50">
            {displayTrending.map((topic, idx) => (
              <Link
                key={topic.tag}
                to={`/explore?q=${encodeURIComponent(topic.tag)}`}
                className={cn(
                  'flex items-start gap-3 px-4 py-3 transition-colors',
                  'hover:bg-accent/5 group'
                )}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold group-hover:text-primary transition-colors">
                    {topic.tag}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {topic.category && (
                      <span className="text-xs text-muted-foreground">
                        {topic.category}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {topic.postCount >= 1000
                        ? `${(topic.postCount / 1000).toFixed(1)}N`
                        : topic.postCount}{' '}
                      bài viết
                    </span>
                  </div>
                </div>
                <Hash
                  size={14}
                  className="mt-0.5 text-muted-foreground/40 group-hover:text-primary/60 transition-colors shrink-0"
                />
              </Link>
            ))}
          </div>
          <Link
            to="/explore"
            className="flex items-center gap-1 px-4 py-3 text-sm text-primary hover:bg-accent/5 transition-colors"
          >
            Xem thêm
            <ArrowRight size={14} />
          </Link>
        </section>

        {/* ===== WHO TO FOLLOW ===== */}
        {displaySuggestions.length > 0 && (
          <section className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-2 px-4 pt-4 pb-3">
              <Users size={18} className="text-primary" />
              <h3 className="text-base font-bold">Gợi ý theo dõi</h3>
            </div>
            <div className="divide-y divide-border/50">
              {displaySuggestions.map((person) => (
                <div
                  key={person.id}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <Link to={`/profile/${person.username || person.id}`} className="shrink-0">
                    <Avatar className="w-10 h-10">
                      <AvatarImage
                        src={person.avatarUrl || undefined}
                        alt={person.name}
                      />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                        {person.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/profile/${person.username || person.id}`}
                      className="text-sm font-medium hover:underline truncate block"
                    >
                      {person.name}
                    </Link>
                    {person.username ? (
                      <p className="text-xs text-muted-foreground truncate">@{person.username}</p>
                    ) : null}
                    {person.mutualCount !== undefined && person.mutualCount > 0 && (
                      <p className="text-xs text-muted-foreground truncate">
                        {person.mutualCount} bạn chung
                      </p>
                    )}
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="shrink-0 rounded-full text-xs h-8 px-3"
                    onClick={() => navigate(`/profile/${person.id}`)}
                  >
                    Xem
                  </Button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ===== FOOTER LINKS ===== */}
        <div className="px-1 py-2">
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground/60">
            <a href="#" className="hover:underline">Điều khoản</a>
            <a href="#" className="hover:underline">Bảo mật</a>
            <a href="#" className="hover:underline">Cookie</a>
            <a href="#" className="hover:underline">Quảng cáo</a>
            <a href="#" className="hover:underline">Trợ giúp</a>
          </div>
          <p className="text-xs text-muted-foreground/40 mt-2">
            © 2026 ZChat, Inc.
          </p>
        </div>
      </div>
    </aside>
  )
}
