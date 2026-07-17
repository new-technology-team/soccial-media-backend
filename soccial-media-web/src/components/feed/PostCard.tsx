'use client'

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  BookmarkCheck,
  Ellipsis,
  Globe,
  Lock,
  Dot,
  ChevronDown,
  ChevronUp,
  ImageIcon,
  Smile,
  Send,
  X,
  Reply,
  Flag,
  Trash2,
  Copy,
  EyeOff,
  Edit3,
} from 'lucide-react'
import { cn } from '@/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { FeedPost, FeedComment, User } from '@/types'

/* ---- Types ---- */
interface PostCardProps {
  post: FeedPost
  user: User | null
  isGuestView: boolean
  savedPostIds: Set<number | string>
  activeMenuId: number | null

  // Actions
  onReact: (postId: number, reactionType: string) => void
  onToggleComments: (postId: number) => void
  onShare: (post: FeedPost) => void
  onSave: (postId: number | string) => void
  onMenuOpen: (postId: number | null) => void
  onDelete: (post: FeedPost) => void
  onReport: (post: FeedPost) => void
  onHide: (postId: number) => void
  onEdit: (post: FeedPost) => void
  onCopyLink: (postId: number) => void
  onCopyId: (postId: number) => void

  // Comment state
  commentInput: string
  onCommentInputChange: (value: string) => void
  isCommenting: boolean
  onAddComment: () => void
  comments: FeedComment[]
  expanded: boolean
  loadingComments: boolean
  hasMoreComments: boolean
  onLoadMore: () => void

  // Reply state
  replyInputs: Record<string, string>
  onReplyInputChange: (commentId: string, value: string) => void
  replyingToCommentIds: Record<string, boolean>
  onToggleReply: (commentId: string) => void
  onAddReply: (comment: FeedComment) => void
  busyCommentId: number | string | null
  onDeleteComment: (comment: FeedComment) => void
  onReportComment: (comment: FeedComment) => void
  expandedReplyIds: Record<string, boolean>
  onToggleExpandedReply: (commentId: string) => void

  // Media
  commentImageDraft: { file: File; previewUrl: string } | null
  onCommentImageSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  onRemoveCommentImage: () => void
}

/* ---- Constants ---- */
const POST_REACTIONS = [
  { type: 'like', emoji: '👍', label: 'Thích' },
  { type: 'love', emoji: '❤️', label: 'Yêu thích' },
  { type: 'haha', emoji: '😆', label: 'Haha' },
  { type: 'wow', emoji: '😮', label: 'Wow' },
  { type: 'sad', emoji: '😢', label: 'Buồn' },
  { type: 'angry', emoji: '😡', label: 'Phẫn nộ' },
] as const

const isVideoUrl = (url: string) =>
  /\.(mp4|webm|ogg|mov|m4v|avi|mkv)(\?.*)?$/i.test(url) || url.includes('/video/')

/* ---- Helpers ---- */
const formatTimeAgo = (value: string) => {
  const date = new Date(value)
  if (isNaN(date.getTime())) return 'Không rõ'
  const diffMs = Date.now() - date.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'Vừa xong'
  if (mins < 60) return `${mins} phút trước`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} giờ trước`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Hôm qua'
  if (days < 7) return `${days} ngày trước`
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
}

const formatExactTime = (value: string) => {
  const date = new Date(value)
  if (isNaN(date.getTime())) return 'Không rõ'
  return date.toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

/* ==========================================================
   PostCard — The main feed post component
   ========================================================== */
export default function PostCard({
  post,
  user,
  isGuestView,
  savedPostIds,
  activeMenuId,
  onReact, onToggleComments, onShare, onSave, onMenuOpen,
  onDelete, onReport, onHide, onEdit, onCopyLink, onCopyId,
  commentInput, onCommentInputChange, isCommenting, onAddComment,
  comments, expanded, loadingComments, hasMoreComments, onLoadMore,
  replyInputs, onReplyInputChange, replyingToCommentIds, onToggleReply,
  onAddReply, busyCommentId, onDeleteComment, onReportComment,
  expandedReplyIds, onToggleExpandedReply,
  commentImageDraft, onCommentImageSelect, onRemoveCommentImage,
}: PostCardProps) {
  const navigate = useNavigate()
  const [showReactionPicker, setShowReactionPicker] = useState(false)
  const [liked, setLiked] = useState(!!post.viewerReaction)
  const [reactionCount, setReactionCount] = useState(post.reactionCount)

  const isSaved = savedPostIds.has(post.id)
  const canManage = user && (post.authorId === user.id || user.role === 'admin' || user.role === 'moderator')
  const menuOpen = activeMenuId === post.id

  const handleLike = (type: string) => {
    setShowReactionPicker(false)
    onReact(post.id, type)
  }

  return (
    <article className="group/post relative rounded-2xl border border-border bg-card transition-all duration-200 hover:border-border/80 hover:shadow-sm">
      {/* ===== HEADER: Avatar + Author + Time + Menu ===== */}
      <div className="flex items-start gap-3 px-4 pt-4 pb-2">
        <Link to={`/profile/${post.authorId}`} className="shrink-0">
          <Avatar className="w-10 h-10 ring-2 ring-background hover:ring-primary/30 transition-all">
            <AvatarImage src={post.authorAvatar || undefined} alt={post.authorName} />
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
              {post.authorName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <Link
              to={`/profile/${post.authorId}`}
              className="text-sm font-semibold hover:underline truncate"
            >
              {post.authorName}
            </Link>
            {post.authorUsername && (
              <span className="text-xs text-muted-foreground hidden sm:inline">
                @{post.authorUsername}
              </span>
            )}
            {post.visibility === 'private' && (
              <Lock size={12} className="text-muted-foreground shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <time dateTime={post.createdAt} title={formatExactTime(post.createdAt)}>
              {formatTimeAgo(post.createdAt)}
            </time>
            <Dot size={10} className="shrink-0" />
            <span className="flex items-center gap-0.5">
              {post.visibility === 'public' ? <Globe size={10} /> : <Lock size={10} />}
              {post.visibility === 'public' ? 'Công khai' : 'Riêng tư'}
            </span>
          </div>
        </div>

        {/* ===== MORE MENU TRIGGER ===== */}
        <div className="relative" data-post-menu-root="true">
          <button
            type="button"
            onClick={() => onMenuOpen(menuOpen ? null : post.id)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-colors opacity-0 group-hover/post:opacity-100 focus:opacity-100"
            aria-label="Tùy chọn bài viết"
            aria-expanded={menuOpen}
          >
            <Ellipsis size={16} />
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                transition={{ duration: 0.12 }}
                className="absolute right-0 top-full mt-1 z-50 min-w-[200px] rounded-xl border border-border bg-popover shadow-xl overflow-hidden"
                role="menu"
              >
                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => { onCopyId(post.id); onMenuOpen(null) }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-sm hover:bg-accent/10 transition-colors text-left"
                    role="menuitem"
                  >
                    <Copy size={15} className="text-muted-foreground" />
                    Sao chép ID (#{post.id})
                  </button>
                  <button
                    type="button"
                    onClick={() => { onSave(post.id); onMenuOpen(null) }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-sm hover:bg-accent/10 transition-colors text-left"
                    role="menuitem"
                  >
                    {isSaved ? (
                      <BookmarkCheck size={15} className="text-primary" />
                    ) : (
                      <Bookmark size={15} className="text-muted-foreground" />
                    )}
                    {isSaved ? 'Bỏ lưu' : 'Lưu bài viết'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { onCopyLink(post.id); onMenuOpen(null) }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-sm hover:bg-accent/10 transition-colors text-left"
                    role="menuitem"
                  >
                    <Copy size={15} className="text-muted-foreground" />
                    Sao chép liên kết
                  </button>
                  <button
                    type="button"
                    onClick={() => { onShare(post); onMenuOpen(null) }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-sm hover:bg-accent/10 transition-colors text-left"
                    role="menuitem"
                  >
                    <Share2 size={15} className="text-muted-foreground" />
                    Chia sẻ
                  </button>

                  {canManage ? (
                    <>
                      <div className="h-px bg-border mx-2 my-1" />
                      <button
                        type="button"
                        onClick={() => { onEdit(post); onMenuOpen(null) }}
                        className="flex items-center gap-2.5 w-full px-3 py-2 text-sm hover:bg-accent/10 transition-colors text-left"
                        role="menuitem"
                      >
                        <Edit3 size={15} className="text-muted-foreground" />
                        Chỉnh sửa
                      </button>
                      <button
                        type="button"
                        onClick={() => { onDelete(post); onMenuOpen(null) }}
                        className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors text-left"
                        role="menuitem"
                      >
                        <Trash2 size={15} />
                        Xóa bài viết
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="h-px bg-border mx-2 my-1" />
                      <button
                        type="button"
                        onClick={() => { onHide(post.id); onMenuOpen(null) }}
                        className="flex items-center gap-2.5 w-full px-3 py-2 text-sm hover:bg-accent/10 transition-colors text-left"
                        role="menuitem"
                      >
                        <EyeOff size={15} className="text-muted-foreground" />
                        Ẩn bài viết
                      </button>
                      <button
                        type="button"
                        onClick={() => { onReport(post); onMenuOpen(null) }}
                        className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors text-left"
                        role="menuitem"
                      >
                        <Flag size={15} />
                        Báo cáo
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ===== SHARED BY LINE ===== */}
      {post.sharedPost && (
        <p className="px-4 pb-1 text-xs text-muted-foreground">
          Đã chia sẻ một bài viết
        </p>
      )}

      {/* ===== CONTENT ===== */}
      {post.content && (
        <div className="px-4 pb-2">
          <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words text-foreground/90">
            {post.content}
          </p>
        </div>
      )}

      {/* ===== MEDIA ===== */}
      {post.mediaUrl && (
        <div className="px-4 pb-2">
          {isVideoUrl(post.mediaUrl) ? (
            <video
              src={post.mediaUrl}
              className="w-full rounded-xl border border-border/50 bg-muted"
              controls
              preload="metadata"
              poster={post.mediaUrl + '?poster=1'}
            />
          ) : (
            <Link to={`/posts/${post.id}`} onClick={(e) => e.button === 0 && window.open(`/posts/${post.id}`, '_self')}>
              <img
                src={post.mediaUrl}
                alt="Bài viết media"
                className="w-full rounded-xl border border-border/50 bg-muted object-cover max-h-[500px]"
                loading="lazy"
              />
            </Link>
          )}
        </div>
      )}

      {/* ===== SHARED POST EMBED ===== */}
      {post.sharedPost && (
        <div className="px-4 pb-2">
          <Link
            to={post.sharedPost.unavailable ? '#' : `/posts/${post.sharedPost.id}`}
            className={cn(
              'block rounded-xl border border-border/60 bg-muted/30 p-3 transition-colors',
              !post.sharedPost.unavailable && 'hover:bg-muted/50'
            )}
          >
            {post.sharedPost.unavailable ? (
              <p className="text-sm text-muted-foreground italic">
                Bài viết gốc không còn khả dụng
              </p>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                    {post.sharedPost.authorName?.charAt(0) || 'U'}
                  </div>
                  <span className="text-xs font-medium">
                    {post.sharedPost.authorName || 'Người dùng'}
                  </span>
                </div>
                {post.sharedPost.content && (
                  <p className="text-sm leading-relaxed line-clamp-3">
                    {post.sharedPost.content}
                  </p>
                )}
                {post.sharedPost.mediaUrl && (
                  isVideoUrl(post.sharedPost.mediaUrl) ? (
                    <video src={post.sharedPost.mediaUrl} controls className="w-full rounded-lg" />
                  ) : (
                    <img src={post.sharedPost.mediaUrl} alt="" className="w-full rounded-lg max-h-40 object-cover" />
                  )
                )}
                <div className="flex gap-3 text-xs text-muted-foreground">
                  <span>{post.sharedPost.reactionCount || 0} cảm xúc</span>
                  <span>{post.sharedPost.commentCount || 0} bình luận</span>
                </div>
              </div>
            )}
          </Link>
        </div>
      )}

      {/* ===== STATS ===== */}
      <div className="flex items-center justify-between px-4 py-2 text-xs text-muted-foreground">
        <button
          type="button"
          onClick={() => onReact(post.id, 'like')}
          className="hover:text-foreground transition-colors"
        >
          {post.reactionCount > 0 && (
            <span>{post.reactionCount} cảm xúc</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => onToggleComments(post.id)}
          className="hover:text-foreground transition-colors"
          disabled={isGuestView}
        >
          {post.commentCount > 0 && (
            <span>{post.commentCount} bình luận</span>
          )}
        </button>
      </div>

      {/* ===== DIVIDER ===== */}
      <div className="px-4">
        <div className="h-px bg-border/60" />
      </div>

      {/* ===== ACTION BAR ===== */}
      <div className="flex items-center justify-around px-2 py-1">
        {/* Like */}
        <TooltipProvider>
          <div className="relative">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setShowReactionPicker(!showReactionPicker)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                    'hover:bg-primary/10 hover:text-primary',
                    post.viewerReaction && 'text-primary'
                  )}
                  disabled={isGuestView}
                  aria-label="Thả cảm xúc"
                >
                  <motion.div
                    animate={post.viewerReaction ? { scale: [1, 1.3, 1] } : {}}
                    transition={{ duration: 0.3 }}
                  >
                    {post.viewerReaction ? (
                      <span className="text-lg leading-none">
                        {POST_REACTIONS.find(r => r.type === post.viewerReaction)?.emoji || '❤️'}
                      </span>
                    ) : (
                      <Heart size={18} strokeWidth={1.5} />
                    )}
                  </motion.div>
                  <span className="hidden sm:inline text-xs">
                    {post.viewerReaction
                      ? POST_REACTIONS.find(r => r.type === post.viewerReaction)?.label || 'Đã thích'
                      : 'Thích'
                    }
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>Thả cảm xúc</p>
              </TooltipContent>
            </Tooltip>

            {/* Reaction Picker */}
            <AnimatePresence>
              {showReactionPicker && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.9 }}
                  transition={{ duration: 0.15 }}
                  className="absolute bottom-full left-0 mb-2 flex gap-1 rounded-xl border border-border bg-popover p-1.5 shadow-lg z-50"
                >
                  {POST_REACTIONS.map((reaction) => (
                    <button
                      key={reaction.type}
                      type="button"
                      onClick={() => handleLike(reaction.type)}
                      className={cn(
                        'text-xl p-1.5 rounded-lg transition-all hover:scale-125 hover:bg-accent/10',
                        post.viewerReaction === reaction.type && 'scale-110 bg-primary/10'
                      )}
                      title={reaction.label}
                      aria-label={reaction.label}
                    >
                      {reaction.emoji}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </TooltipProvider>

        {/* Comment */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onToggleComments(post.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                  'hover:bg-primary/10 hover:text-primary',
                  expanded && 'text-primary'
                )}
                disabled={isGuestView}
                aria-label="Bình luận"
              >
                <MessageCircle size={18} strokeWidth={1.5} />
                <span className="hidden sm:inline text-xs">Bình luận</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Bình luận</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Share */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onShare(post)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                  'hover:bg-primary/10 hover:text-primary'
                )}
                disabled={isGuestView}
                aria-label="Chia sẻ"
              >
                <Share2 size={18} strokeWidth={1.5} />
                <span className="hidden sm:inline text-xs">Chia sẻ</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Chia sẻ</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Save */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onSave(post.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                  'hover:bg-primary/10 hover:text-primary',
                  isSaved && 'text-primary'
                )}
                aria-label={isSaved ? 'Bỏ lưu' : 'Lưu bài viết'}
              >
                <motion.div
                  animate={isSaved ? { scale: [1, 1.2, 1] } : {}}
                  transition={{ duration: 0.3 }}
                >
                  {isSaved ? <BookmarkCheck size={18} strokeWidth={2.5} /> : <Bookmark size={18} strokeWidth={1.5} />}
                </motion.div>
                <span className="hidden sm:inline text-xs">
                  {isSaved ? 'Đã lưu' : 'Lưu'}
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>{isSaved ? 'Bỏ lưu' : 'Lưu bài viết'}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* ===== COMMENT SECTION ===== */}
      {expanded && (
        <div className="border-t border-border/60">
          {/* Comments list */}
          <div className="px-4 py-3 space-y-3">
            {loadingComments && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                Đang tải bình luận...
              </div>
            )}

            {!loadingComments && comments.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">
                Chưa có bình luận nào.
              </p>
            )}

            {comments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                postId={post.id}
                depth={0}
                replyInputs={replyInputs}
                onReplyInputChange={onReplyInputChange}
                replyingToCommentIds={replyingToCommentIds}
                onToggleReply={onToggleReply}
                onAddReply={onAddReply}
                busyCommentId={busyCommentId}
                onDelete={onDeleteComment}
                onReport={onReportComment}
                expandedReplyIds={expandedReplyIds}
                onToggleExpandedReply={onToggleExpandedReply}
              />
            ))}

            {/* Load more */}
            {!loadingComments && hasMoreComments && (
              <button
                type="button"
                onClick={onLoadMore}
                className="text-sm text-primary hover:text-primary/80 transition-colors font-medium"
              >
                Xem thêm bình luận
              </button>
            )}

            {/* View detail */}
            <button
              type="button"
              onClick={() => navigate(`/posts/${post.id}`)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Xem chi tiết
            </button>
          </div>

          {/* Comment composer */}
          <div className="px-4 pb-3 pt-1">
            <div className="flex items-center gap-2">
              <Avatar className="w-8 h-8 shrink-0">
                <AvatarImage src={user?.avatarUrl || undefined} alt={user?.fullName || 'User'} />
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                  {(user?.fullName || 'U').charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 flex items-center gap-2 rounded-xl bg-muted/50 border border-border/60 px-3 py-1.5 focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
                <input
                  value={commentInput}
                  onChange={(e) => onCommentInputChange(e.target.value)}
                  placeholder={commentImageDraft ? 'Thêm chú thích...' : 'Viết bình luận...'}
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60 min-h-[32px]"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      onAddComment()
                    }
                  }}
                />
                <div className="flex items-center gap-1">
                  <label className="p-1 rounded-md text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
                    <ImageIcon size={16} />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={onCommentImageSelect}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={onAddComment}
                    disabled={isCommenting || (!commentInput.trim() && !commentImageDraft)}
                    className={cn(
                      'p-1 rounded-md transition-colors',
                      (commentInput.trim() || commentImageDraft)
                        ? 'text-primary hover:bg-primary/10'
                        : 'text-muted-foreground'
                    )}
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Comment image preview */}
            <AnimatePresence>
              {commentImageDraft && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-2 ml-10 relative inline-block"
                >
                  <img
                    src={commentImageDraft.previewUrl}
                    alt="Comment image"
                    className="h-16 w-16 rounded-lg object-cover border border-border"
                  />
                  <button
                    type="button"
                    onClick={onRemoveCommentImage}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                  >
                    <X size={10} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* ===== GUEST HINT ===== */}
      {isGuestView && (
        <div className="px-4 pb-3">
          <p className="text-xs text-muted-foreground text-center">
            <Link to={`/auth/login?next=${encodeURIComponent(window.location.pathname)}`} className="text-primary hover:underline">
              Đăng nhập
            </Link>{' '}
            để bình luận và tương tác với bài viết.
          </p>
        </div>
      )}
    </article>
  )
}

/* ==========================================================
   CommentItem — Nested comment thread component
   ========================================================== */
interface CommentItemProps {
  comment: FeedComment
  postId: number
  depth: number
  replyInputs: Record<string, string>
  onReplyInputChange: (commentId: string, value: string) => void
  replyingToCommentIds: Record<string, boolean>
  onToggleReply: (commentId: string) => void
  onAddReply: (comment: FeedComment) => void
  busyCommentId: number | string | null
  onDelete: (comment: FeedComment) => void
  onReport: (comment: FeedComment) => void
  expandedReplyIds: Record<string, boolean>
  onToggleExpandedReply: (commentId: string) => void
}

function CommentItem({
  comment, postId, depth,
  replyInputs, onReplyInputChange,
  replyingToCommentIds, onToggleReply,
  onAddReply, busyCommentId,
  onDelete, onReport,
  expandedReplyIds, onToggleExpandedReply,
}: CommentItemProps) {
  const key = String(comment.id)
  const replies = comment.replies || []
  const showReplies = expandedReplyIds[key] || replies.length <= 2
  const visibleReplies = showReplies ? replies : replies.slice(0, 2)
  const isReplying = replyingToCommentIds[key]
  const replyValue = replyInputs[key] || ''

  return (
    <div className={cn(
      'flex gap-2',
      depth > 0 && 'ml-8 pl-3 border-l-2 border-border/40'
    )}>
      <Link to={`/profile/${comment.userId}`} className="shrink-0 mt-0.5">
        <Avatar className="w-7 h-7">
          <AvatarImage src={comment.authorAvatar || undefined} alt={comment.authorName} />
          <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
            {comment.authorName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </Link>

      <div className="flex-1 min-w-0">
        {/* Comment body */}
        <div className="rounded-xl bg-muted/40 px-3 py-2">
          <Link to={`/profile/${comment.userId}`} className="text-xs font-semibold hover:underline">
            {comment.authorName}
          </Link>
          {comment.content && (
            <p className="text-sm leading-relaxed mt-0.5 whitespace-pre-wrap break-words">
              {comment.content}
            </p>
          )}
          {comment.imageUrl && (
            <img
              src={comment.imageUrl}
              alt="Comment image"
              className="mt-1.5 rounded-lg max-h-40 object-cover border border-border/40"
              loading="lazy"
            />
          )}
        </div>

        {/* Comment actions */}
        <div className="flex items-center gap-3 mt-1 px-1">
          <button
            type="button"
            onClick={() => onToggleReply(key)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <Reply size={11} />
            Trả lời
          </button>
          <button
            type="button"
            onClick={() => onReport(comment)}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors"
            disabled={busyCommentId === comment.id}
          >
            Báo cáo
          </button>
          <button
            type="button"
            onClick={() => onDelete(comment)}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors"
            disabled={busyCommentId === comment.id}
          >
            Xóa
          </button>
        </div>

        {/* Reply composer */}
        <AnimatePresence>
          {isReplying && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-2 flex items-center gap-2"
            >
              <input
                value={replyValue}
                onChange={(e) => onReplyInputChange(key, e.target.value)}
                placeholder={`Trả lời ${comment.authorName}...`}
                className="flex-1 bg-muted/30 border border-border/60 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-primary/40 transition-colors"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    onAddReply(comment)
                  }
                }}
              />
              <button
                type="button"
                onClick={() => onAddReply(comment)}
                disabled={!replyValue.trim() || busyCommentId === comment.id}
                className="px-3 py-1.5 rounded-lg text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all"
              >
                Gửi
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Nested replies */}
        {replies.length > 0 && (
          <div className="mt-2 space-y-2">
            {visibleReplies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                postId={postId}
                depth={depth + 1}
                replyInputs={replyInputs}
                onReplyInputChange={onReplyInputChange}
                replyingToCommentIds={replyingToCommentIds}
                onToggleReply={onToggleReply}
                onAddReply={onAddReply}
                busyCommentId={busyCommentId}
                onDelete={onDelete}
                onReport={onReport}
                expandedReplyIds={expandedReplyIds}
                onToggleExpandedReply={onToggleExpandedReply}
              />
            ))}
            {replies.length > 2 && (
              <button
                type="button"
                onClick={() => onToggleExpandedReply(key)}
                className="text-xs text-primary hover:text-primary/80 transition-colors ml-8"
              >
                {showReplies
                  ? 'Thu gọn phản hồi'
                  : `Xem thêm ${replies.length - 2} phản hồi`
                }
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
