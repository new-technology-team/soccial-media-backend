'use client'

import { cn } from '@/utils'

interface PostSkeletonProps {
  variant?: 'default' | 'compact'
  hasMedia?: boolean
}

/* ==========================================================
   PostSkeleton — Animated loading placeholder for post cards
   ========================================================== */
export default function PostSkeleton({
  variant = 'default',
  hasMedia = true,
}: PostSkeletonProps) {
  const isCompact = variant === 'compact'

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3 animate-pulse">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-muted shrink-0 shimmer" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-3.5 bg-muted rounded-md shimmer" style={{ width: '40%' }} />
          <div className="h-3 bg-muted rounded-md shimmer" style={{ width: '25%' }} />
        </div>
      </div>

      {/* Content */}
      <div className="space-y-2">
        <div className={cn(
          'h-3 bg-muted rounded-md shimmer',
          isCompact ? 'w-full' : 'w-full'
        )} />
        <div className={cn(
          'h-3 bg-muted rounded-md shimmer',
          isCompact ? 'w-4/5' : 'w-11/12'
        )} />
        {!isCompact && (
          <div className="h-3 bg-muted rounded-md shimmer" style={{ width: '60%' }} />
        )}
      </div>

      {/* Media */}
      {hasMedia && (
        <div className="h-48 md:h-56 rounded-xl bg-muted shimmer" />
      )}

      {/* Stats */}
      <div className="flex justify-between pt-1">
        <div className="h-3 w-16 bg-muted rounded-md shimmer" />
        <div className="h-3 w-16 bg-muted rounded-md shimmer" />
      </div>

      {/* Divider */}
      <div className="h-px bg-border/60" />

      {/* Actions */}
      <div className="flex justify-around">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-4 w-14 bg-muted rounded-md shimmer" />
        ))}
      </div>
    </div>
  )
}

/* ==========================================================
   FeedSkeleton — Multiple skeletons for the feed
   ========================================================== */
export function FeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <PostSkeleton key={i} hasMedia={i % 2 === 0} />
      ))}
    </div>
  )
}
