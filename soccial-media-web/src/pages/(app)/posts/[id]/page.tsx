'use client'

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useParams } from 'react-router-dom'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { api } from '@/lib/api'
import { useAuthStore } from '@/lib/store/auth-store'
import type { FeedComment, FeedPost } from '@/lib/types'
import styles from './page.module.css'

export default function PostDetailPage() {
  const params = useParams<{ id: string }>()
  const postId = Number(params.id)
  const token = useAuthStore((state) => state.accessToken)

  const [post, setPost] = useState<FeedPost | null>(null)
  const [comments, setComments] = useState<FeedComment[]>([])
  const [commentInput, setCommentInput] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!postId || Number.isNaN(postId)) return

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

  const createdAtText = useMemo(() => {
    if (!post) return ''
    return new Date(post.createdAt).toLocaleString('vi-VN')
  }, [post])

  const handleAddComment = async () => {
    if (!token || !commentInput.trim() || !postId) return
    try {
      const response = await api.addComment(token, postId, commentInput.trim())
      setComments((prev) => [...prev, response.comment])
      setCommentInput('')
    } catch (error) {
      console.error('Không thể thêm bình luận', error)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>Chi tiết bài viết</h1>
          <p>Xem nội dung đầy đủ và toàn bộ bình luận theo thời gian thực.</p>
        </div>

        {loading && <div className={styles.infoCard}>Đang tải dữ liệu...</div>}

        {!loading && !post && <div className={styles.infoCard}>Không tìm thấy bài viết.</div>}

        {post ? (
          <article className={styles.postCard}>
            <header className={styles.postHeader}>
              <Link to={`/profile/${post.authorId}`}>
                <h2>{post.authorName}</h2>
              </Link>
              <p>{createdAtText}</p>
            </header>

            <p className={styles.postContent}>{post.content}</p>

            {post.mediaUrl ? (
              <img
                src={post.mediaUrl}
                alt="Ảnh bài viết"
                className={styles.postMedia}
                loading="lazy"
                onError={(event) => {
                  event.currentTarget.style.display = 'none'
                }}
              />
            ) : null}

            <div className={styles.postMeta}>
              {post.reactionCount} lượt thích • {post.commentCount} bình luận
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
              />
              <button type="button" onClick={handleAddComment} disabled={!commentInput.trim()} className={styles.submitBtn}>
                Gửi bình luận
              </button>
            </div>
          ) : null}

          <div className={styles.commentList}>
            {comments.map((comment) => (
              <article key={comment.id} className={styles.commentItem}>
                <div className={styles.commentAvatarWrap}>
                  <Avatar>
                    <AvatarImage src={comment.authorAvatar || ''} />
                    <AvatarFallback>{comment.authorName?.[0] || 'U'}</AvatarFallback>
                  </Avatar>
                </div>
                <div className={styles.commentBody}>
                  <p className={styles.commentAuthor}>
                    <Link to={`/profile/${comment.userId}`}>{comment.authorName}</Link>
                  </p>
                  <p className={styles.commentText}>{comment.content}</p>
                  <p className={styles.commentTime}>{new Date(comment.createdAt).toLocaleString('vi-VN')}</p>
                </div>
              </article>
            ))}

            {comments.length === 0 ? <p className={styles.emptyText}>Chưa có bình luận nào.</p> : null}
          </div>
        </section>
      </div>
    </div>
  )
}
