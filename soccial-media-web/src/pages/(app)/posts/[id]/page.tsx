'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Heart, X } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { api, resolveApiAssetUrl } from '@/api/client'
import { useAuthStore } from '@/contexts/auth-store'
import { connectSocket } from '@/services/socket'
import { normalizeFeedComment } from '@/api/client'
import type { FeedComment, FeedPost, PostReactionViewer } from '@/types'
import { Skeleton } from '@/components/ui/skeleton'
import styles from './page.module.css'

const isVideoMediaUrl = (url: string) =>
  /\.(mp4|webm|ogg|mov|m4v|avi|mkv)(\?.*)?$/i.test(url) || url.includes('/video/')

const POST_REACTIONS = [
  { type: 'like', emoji: '👍', label: 'Thích' },
  { type: 'love', emoji: '❤️', label: 'Yêu thích' },
  { type: 'haha', emoji: '😆', label: 'Haha' },
  { type: 'wow', emoji: '😮', label: 'Wow' },
  { type: 'sad', emoji: '😢', label: 'Buồn' },
  { type: 'angry', emoji: '😡', label: 'Phẫn nộ' },
] as const

const appendCommentOnce = (items: FeedComment[], comment: FeedComment): FeedComment[] => {
  const commentId = String(comment.id)
  const parentId = comment.parentCommentId ? String(comment.parentCommentId) : null
  if (!parentId) {
    return items.some((item) => String(item.id) === commentId) ? items : [...items, comment]
  }
  return items.map((item) => {
    if (String(item.id) === parentId) {
      const alreadyExists = (item.replies || []).some((r) => String(r.id) === commentId)
      return {
        ...item,
        replies: alreadyExists ? item.replies || [] : [...(item.replies || []), comment],
      }
    }
    return {
      ...item,
      replies: item.replies ? appendCommentOnce(item.replies, comment) : [],
    }
  })
}

const replaceCommentById = (items: FeedComment[], nextComment: FeedComment): FeedComment[] =>
  items.map((item) => {
    if (String(item.id) === String(nextComment.id)) return { ...nextComment, replies: nextComment.replies || item.replies || [] }
    return { ...item, replies: item.replies ? replaceCommentById(item.replies, nextComment) : [] }
  })

export default function PostDetailPage() {
  const params = useParams<{ id: string }>()
  const navigate = useNavigate()
  const postId = String(params.id || '').trim()
  const token = useAuthStore((state) => state.accessToken)
  const me = useAuthStore((state) => state.user)

  const [post, setPost] = useState<FeedPost | null>(null)
  const [comments, setComments] = useState<FeedComment[]>([])
  const [commentInput, setCommentInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [showReactionPicker, setShowReactionPicker] = useState(false)
  const [replyingToCommentIds, setReplyingToCommentIds] = useState<Record<string, boolean>>({})
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({})
  const [busyCommentId, setBusyCommentId] = useState<string | null>(null)
  const [commentReactionViewers, setCommentReactionViewers] = useState<Record<string, PostReactionViewer[]>>({})
  const [reactionViewerComment, setReactionViewerComment] = useState<FeedComment | null>(null)
  const [reactionViewerLoading, setReactionViewerLoading] = useState(false)
  const reactionPickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!postId) {
      setLoading(false)
      setPost(null)
      setComments([])
      return
    }

    const loadData = async () => {
      setLoading(true)
      try {
        const [postRes, commentRes] = await Promise.all([
          api.getPost(postId, token || undefined),
          api.listComments(postId, token || undefined),
        ])
        setPost(postRes.post || null)
        setComments(commentRes.comments)
      } catch (error) {
        console.error('Không thể tải chi tiết bài viết', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [postId, token])

  useEffect(() => {
    if (!token || !me?.id || !postId) return
    const socket = connectSocket(token, me.id)

    const isThisPost = (value: unknown) => String(value || '') === String(postId)
    const onPostUpdated = (payload: { post?: FeedPost }) => {
      if (payload?.post && isThisPost(payload.post.id)) setPost(payload.post)
    }
    const onPostDeleted = (payload: { postId?: number | string }) => {
      if (isThisPost(payload?.postId)) setPost(null)
    }
    const onPostReaction = (payload: { postId?: number | string; actorId?: number | string; reaction?: string | null; reactionCount?: number }) => {
      if (!isThisPost(payload?.postId)) return
      setPost((current) =>
        current
          ? {
              ...current,
              reactionCount: Number(payload.reactionCount ?? current.reactionCount),
              viewerReaction: String(payload.actorId || '') === String(me.id) ? payload.reaction || null : current.viewerReaction,
            }
          : current
      )
    }
    const onCommentCreated = (payload: { postId?: number | string; parentCommentId?: string | null; comment?: FeedComment; commentCount?: number }) => {
      if (!isThisPost(payload?.postId)) return
      if (payload.comment) {
        setComments((prev) => appendCommentOnce(prev, payload.comment as FeedComment))
      }
      setPost((current) => (current ? { ...current, commentCount: Number(payload.commentCount ?? current.commentCount + 1) } : current))
    }
    const onCommentDeleted = (payload: { postId?: number | string; commentId?: number | string; commentCount?: number }) => {
      if (!isThisPost(payload?.postId)) return
      setComments((prev) => prev.filter((item) => String(item.id) !== String(payload.commentId)))
      setPost((current) => (current ? { ...current, commentCount: Number(payload.commentCount ?? Math.max(0, current.commentCount - 1)) } : current))
    }
    const onCommentReaction = (payload: { postId?: number | string; commentId?: number | string; actorId?: number | string; reaction?: string | null; reactionCount?: number }) => {
      if (!isThisPost(payload?.postId)) return
      if (payload?.commentId) {
        setCommentReactionViewers((prev) => {
          const next = { ...prev }
          delete next[String(payload.commentId)]
          return next
        })
      }
      setComments((prev) => {
        const update = (items: FeedComment[]): FeedComment[] =>
          items.map((comment) => {
            if (String(comment.id) === String(payload.commentId)) {
              return {
                ...comment,
                reactionCount: Number(payload.reactionCount ?? comment.reactionCount),
                viewerReaction: String(payload.actorId || '') === String(me.id) ? payload.reaction || null : comment.viewerReaction,
              }
            }
            return { ...comment, replies: comment.replies ? update(comment.replies) : [] }
          })
        return update(prev)
      })
    }
    const onAvatarUpdated = (payload: { userId?: number | string; avatarUrl?: string }) => {
      const avatarUrl = resolveApiAssetUrl(payload?.avatarUrl) ?? payload?.avatarUrl ?? null
      setPost((current) =>
        current && String(current.authorId) === String(payload?.userId) ? { ...current, authorAvatar: avatarUrl } : current
      )
      setComments((prev) =>
        prev.map((comment) => (String(comment.userId) === String(payload?.userId) ? { ...comment, authorAvatar: avatarUrl } : comment))
      )
    }

    socket.on('post:updated', onPostUpdated)
    socket.on('post:deleted', onPostDeleted)
    socket.on('post:reaction', onPostReaction)
    socket.on('comment:created', onCommentCreated)
    socket.on('comment:deleted', onCommentDeleted)
    socket.on('comment:reaction', onCommentReaction)
    socket.on('user:avatar-updated', onAvatarUpdated)

    return () => {
      socket.off('post:updated', onPostUpdated)
      socket.off('post:deleted', onPostDeleted)
      socket.off('post:reaction', onPostReaction)
      socket.off('comment:created', onCommentCreated)
      socket.off('comment:deleted', onCommentDeleted)
      socket.off('comment:reaction', onCommentReaction)
      socket.off('user:avatar-updated', onAvatarUpdated)
    }
  }, [me?.id, postId, token])

  // Đóng reaction picker khi click ra ngoài
  useEffect(() => {
    if (!showReactionPicker) return
    const handle = (e: MouseEvent) => {
      if (reactionPickerRef.current && !reactionPickerRef.current.contains(e.target as Node)) {
        setShowReactionPicker(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [showReactionPicker])

  const createdAtText = useMemo(() => {
    if (!post) return ''
    return new Date(post.createdAt).toLocaleString('vi-VN')
  }, [post])

  const currentReaction = useMemo(() => {
    if (!post?.viewerReaction) return null
    return POST_REACTIONS.find((r) => r.type === post.viewerReaction) || null
  }, [post?.viewerReaction])

  const handleReactPost = async (type: string) => {
    if (!token || !post) return
    setShowReactionPicker(false)
    const isSame = post.viewerReaction === type
    try {
      if (isSame) {
        const res = await api.unreactPost(token, post.id)
        setPost(res.post)
      } else {
        const res = await api.reactPost(token, post.id, type)
        setPost(res.post)
      }
    } catch (error) {
      console.error('Không thể thả cảm xúc', error)
    }
  }

  const handleAddComment = async () => {
    if (!token || !commentInput.trim() || !postId) return
    try {
      const response = await api.addComment(token, postId, commentInput.trim())
      setComments((prev) => appendCommentOnce(prev, response.comment))
      setPost((current) => (current ? { ...current, commentCount: current.commentCount + 1 } : current))
      setCommentInput('')
    } catch (error) {
      console.error('Không thể thêm bình luận', error)
    }
  }

  const handleAddReply = async (comment: FeedComment) => {
    const key = String(comment.id)
    const value = (replyInputs[key] || '').trim()
    if (!token || !value) return
    setBusyCommentId(key)
    try {
      const response = await api.addCommentReply(token, comment.id, value)
      setComments((prev) => appendCommentOnce(prev, normalizeFeedComment(response.comment)))
      setPost((current) => (current ? { ...current, commentCount: current.commentCount + 1 } : current))
      setReplyInputs((prev) => ({ ...prev, [key]: '' }))
      setReplyingToCommentIds((prev) => ({ ...prev, [key]: false }))
    } catch (error) {
      console.error('Không thể gửi phản hồi', error)
    } finally {
      setBusyCommentId(null)
    }
  }

  const handleReactComment = async (comment: FeedComment) => {
    if (!token) return
    const key = String(comment.id)
    setBusyCommentId(key)
    try {
      const response = comment.viewerReaction
        ? await api.unreactComment(token, comment.id)
        : await api.reactComment(token, comment.id, 'like')
      setComments((prev) => replaceCommentById(prev, response.comment))
    } catch (error) {
      console.error('Không thể cập nhật lượt thích bình luận', error)
    } finally {
      setBusyCommentId(null)
    }
  }

  const handleOpenCommentReactionViewers = async (comment: FeedComment) => {
    const key = String(comment.id)
    setReactionViewerComment(comment)
    if (commentReactionViewers[key]) return
    setReactionViewerLoading(true)
    try {
      const response = await api.listCommentReactions(comment.id)
      setCommentReactionViewers((prev) => ({ ...prev, [key]: response.reactions }))
    } catch (error) {
      console.error('Không thể tải danh sách người thích bình luận', error)
      setCommentReactionViewers((prev) => ({ ...prev, [key]: [] }))
    } finally {
      setReactionViewerLoading(false)
    }
  }

  const renderComment = (comment: FeedComment, depth = 0): React.ReactNode => {
    const key = String(comment.id)
    const showReplyForm = replyingToCommentIds[key]
    return (
      <div key={comment.id} className={`${styles.commentItem} ${depth > 0 ? styles.commentReply : ''}`}>
        <div className={styles.commentAvatarWrap}>
          <Avatar className={styles.commentAvatar}>
            <AvatarImage src={comment.authorAvatar || ''} />
            <AvatarFallback>{comment.authorName?.[0] || 'U'}</AvatarFallback>
          </Avatar>
        </div>
        <div className={styles.commentBody}>
          <p className={styles.commentAuthor}>
            <Link to={`/profile/${comment.authorUsername || comment.userId}`}>{comment.authorName}</Link>
            {comment.authorUsername ? <span className={styles.commentAuthorUsername}> @{comment.authorUsername}</span> : null}
          </p>
          {comment.content ? <p className={styles.commentText}>{comment.content}</p> : null}
          {comment.imageUrl ? <img src={comment.imageUrl} alt="Ảnh trong bình luận" className={styles.commentImage} loading="lazy" /> : null}
          <div className={styles.commentActions}>
            <p className={styles.commentTime}>{new Date(comment.createdAt).toLocaleString('vi-VN')}</p>
            <button
              type="button"
              className={`${styles.replyBtn} ${comment.viewerReaction ? styles.commentLiked : ''}`}
              onClick={() => void handleReactComment(comment)}
              disabled={busyCommentId === key}
            >
              {comment.viewerReaction ? 'Đã thích' : 'Thích'}{comment.reactionCount ? ` · ${comment.reactionCount}` : ''}
            </button>
            {comment.reactionCount ? (
              <button
                type="button"
                className={styles.replyBtn}
                onClick={() => void handleOpenCommentReactionViewers(comment)}
              >
                Xem lượt thích
              </button>
            ) : null}
            {token ? (
              <button
                type="button"
                className={styles.replyBtn}
                onClick={() => setReplyingToCommentIds((prev) => ({ ...prev, [key]: !prev[key] }))}
              >
                Trả lời
              </button>
            ) : null}
          </div>

          {showReplyForm ? (
            <div className={styles.replyForm}>
              <input
                className={styles.replyInput}
                value={replyInputs[key] || ''}
                onChange={(e) => setReplyInputs((prev) => ({ ...prev, [key]: e.target.value }))}
                placeholder={`Trả lời ${comment.authorName}...`}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleAddReply(comment) } }}
                autoFocus
              />
              <button
                type="button"
                className={styles.replySubmit}
                onClick={() => void handleAddReply(comment)}
                disabled={busyCommentId === key || !replyInputs[key]?.trim()}
              >
                {busyCommentId === key ? '...' : 'Gửi'}
              </button>
            </div>
          ) : null}

          {comment.replies && comment.replies.length > 0 ? (
            <div className={styles.replyList}>
              {comment.replies.map((reply) => renderComment(reply, depth + 1))}
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <button type="button" className={styles.backButton} onClick={() => navigate(-1)}>
            <ArrowLeft size={16} />
            Quay lại
          </button>
          <h1>Chi tiết bài viết</h1>
          <p>Xem nội dung đầy đủ và toàn bộ bình luận theo thời gian thực.</p>
        </div>

        {loading && (
          <div className={styles.infoCard}>
            <Skeleton style={{ height: 192, borderRadius: 12, marginBottom: 12 }} />
            <Skeleton style={{ height: 64, borderRadius: 12, marginBottom: 8 }} />
            <Skeleton style={{ height: 64, borderRadius: 12, marginBottom: 8 }} />
            <Skeleton style={{ height: 64, borderRadius: 12 }} />
          </div>
        )}

        {!loading && !post && <div className={styles.infoCard}>Không tìm thấy bài viết.</div>}

        {post ? (
          <article className={styles.postCard}>
            <header className={styles.postHeader}>
              <div className={styles.postAuthorRow}>
                <Avatar className={styles.postAuthorAvatar}>
                  <AvatarImage src={post.authorAvatar || ''} />
                  <AvatarFallback>{post.authorName?.[0] || 'U'}</AvatarFallback>
                </Avatar>
                <div>
                  <Link to={`/profile/${post.authorUsername || post.authorId}`}>
                    <h2>{post.authorName}</h2>
                  </Link>
                  {post.authorUsername ? <p className={styles.postAuthorUsername}>@{post.authorUsername}</p> : null}
                  <p>{createdAtText}</p>
                </div>
              </div>
            </header>

            {post.content ? <p className={styles.postContent}>{post.content}</p> : null}

            {post.mediaUrl ? (
              isVideoMediaUrl(post.mediaUrl) ? (
                <video
                  src={post.mediaUrl}
                  className={styles.postMedia}
                  controls
                  preload="metadata"
                />
              ) : (
                <img
                  src={post.mediaUrl}
                  alt="Ảnh bài viết"
                  className={styles.postMedia}
                  loading="lazy"
                  onError={(event) => {
                    event.currentTarget.style.display = 'none'
                  }}
                />
              )
            ) : null}

            <div className={styles.postMeta}>
              <span>{post.reactionCount} lượt thích • {post.commentCount} bình luận</span>

              {token ? (
                <div className={styles.reactionWrap} ref={reactionPickerRef}>
                  <button
                    type="button"
                    className={`${styles.reactionBtn} ${currentReaction ? styles.reactionBtnActive : ''}`}
                    onClick={() => setShowReactionPicker((v) => !v)}
                  >
                    {currentReaction ? (
                      <span>{currentReaction.emoji} {currentReaction.label}</span>
                    ) : (
                      <span><Heart size={15} style={{ verticalAlign: 'middle' }} /> Thích</span>
                    )}
                  </button>
                  {showReactionPicker ? (
                    <div className={styles.reactionPicker}>
                      {POST_REACTIONS.map((r) => (
                        <button
                          key={r.type}
                          type="button"
                          className={`${styles.reactionOption} ${post.viewerReaction === r.type ? styles.reactionOptionActive : ''}`}
                          onClick={() => void handleReactPost(r.type)}
                          title={r.label}
                        >
                          {r.emoji}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </article>
        ) : null}

        <section className={styles.commentCard}>
          <h3>Bình luận</h3>

          {token ? (
            <div className={styles.commentForm}>
              <textarea
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                placeholder="Viết bình luận của bạn..."
                className={styles.commentTextarea}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleAddComment() } }}
              />
              <button type="button" onClick={handleAddComment} disabled={!commentInput.trim()} className={styles.submitBtn}>
                Gửi bình luận
              </button>
            </div>
          ) : null}

          <div className={styles.commentList}>
            {comments.map((comment) => renderComment(comment))}
            {comments.length === 0 ? <p className={styles.emptyText}>Chưa có bình luận nào.</p> : null}
          </div>
        </section>
      </div>

      {reactionViewerComment ? (
        <div className={styles.viewerBackdrop} role="presentation" onClick={() => setReactionViewerComment(null)}>
          <section className={styles.viewerDialog} role="dialog" aria-label="Người thích bình luận" onClick={(event) => event.stopPropagation()}>
            <header className={styles.viewerHeader}>
              <div>
                <h3>Người thích bình luận</h3>
                <p>{reactionViewerComment.reactionCount} lượt thích</p>
              </div>
              <button type="button" onClick={() => setReactionViewerComment(null)} aria-label="Đóng">
                <X size={17} />
              </button>
            </header>
            <div className={styles.viewerList}>
              {reactionViewerLoading ? <p className={styles.emptyText}>Đang tải...</p> : null}
              {!reactionViewerLoading && (commentReactionViewers[String(reactionViewerComment.id)] || []).map((viewer) => (
                <Link key={`${viewer.userId}-${viewer.createdAt || viewer.reaction}`} to={`/profile/${viewer.username || viewer.userId}`} className={styles.viewerItem} onClick={() => setReactionViewerComment(null)}>
                  <Avatar className={styles.viewerAvatar}>
                    <AvatarImage src={viewer.avatarUrl || ''} />
                    <AvatarFallback>{viewer.fullName?.[0] || 'U'}</AvatarFallback>
                  </Avatar>
                  <span>
                    <strong>{viewer.fullName}</strong>
                    {viewer.username ? <small>@{viewer.username}</small> : null}
                    <small>{viewer.reaction === 'like' ? 'Đã thích' : viewer.reaction}</small>
                  </span>
                </Link>
              ))}
              {!reactionViewerLoading && (commentReactionViewers[String(reactionViewerComment.id)] || []).length === 0 ? (
                <p className={styles.emptyText}>Chưa có lượt thích.</p>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}
