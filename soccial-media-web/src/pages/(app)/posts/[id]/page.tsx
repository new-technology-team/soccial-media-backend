'use client'

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useParams } from 'react-router-dom'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { api } from '@/api/client'
import { useAuthStore } from '@/contexts/auth-store'
import type { FeedComment, FeedPost } from '@/types'
import styles from './page.module.css'

export default function PostDetailPage() {
  const params = useParams<{ id: string }>()
  const postId = String(params.id || '').trim()
  const token = useAuthStore((state) => state.accessToken)

  const [post, setPost] = useState<FeedPost | null>(null)
  const [comments, setComments] = useState<FeedComment[]>([])
  const [commentInput, setCommentInput] = useState('')
  const [loading, setLoading] = useState(true)

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
        console.error('Không thể tĂ¡º£i chi tiĂ¡º¿t bài viết', error)
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
      console.error('Không thể thêm bình luĂ¡º­n', error)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>Chi tiĂ¡º¿t bài viết</h1>
          <p>Xem nĂ¡»™i dung đầy đĂ¡»§ và toàn bĂ¡»™ bình luĂ¡º­n theo thĂ¡»i gian thĂ¡»±c.</p>
        </div>

        {loading && <div className={styles.infoCard}>Ä ang tĂ¡º£i dĂ¡»¯ liĂ¡»‡u...</div>}

        {!loading && !post && <div className={styles.infoCard}>Không tìm thĂ¡º¥y bài viết.</div>}

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
                alt="Ă¡º¢nh bài viết"
                className={styles.postMedia}
                loading="lazy"
                onError={(event) => {
                  event.currentTarget.style.display = 'none'
                }}
              />
            ) : null}

            <div className={styles.postMeta}>
              {post.reactionCount} lưĂ¡»£t thích • {post.commentCount} bình luĂ¡º­n
            </div>
          </article>
        ) : null}

        <section className={styles.commentCard}>
          <h3>Bình luĂ¡º­n</h3>

          {token ? (
            <div className={styles.commentForm}>
              <textarea
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                placeholder="ViĂ¡º¿t bình luĂ¡º­n của bạn..."
                className={styles.commentTextarea}
              />
              <button type="button" onClick={handleAddComment} disabled={!commentInput.trim()} className={styles.submitBtn}>
                GĂ¡»­i bình luĂ¡º­n
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

            {comments.length === 0 ? <p className={styles.emptyText}>Chưa có bình luĂ¡º­n nào.</p> : null}
          </div>
        </section>
      </div>
    </div>
  )
}

