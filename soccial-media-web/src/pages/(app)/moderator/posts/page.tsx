'use client'

import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, EyeOff } from 'lucide-react'
import { useAuthStore } from '@/lib/store/auth-store'
import { api } from '@/lib/api'
import type { FeedPost } from '@/lib/types'
import styles from './page.module.css'

export default function ModeratorPostsPage() {
  const token = useAuthStore((state) => state.accessToken)
  const [posts, setPosts] = useState<FeedPost[]>([])

  const loadPosts = async () => {
    if (!token) return
    const res = await api.listFeedWithParams({ includeHidden: true, limit: 60 }, token)
    setPosts(res.posts)
  }

  useEffect(() => {
    loadPosts().catch(console.error)
  }, [token])

  const flaggedPosts = useMemo(() => posts.filter((p) => p.status !== 'deleted').slice(0, 20), [posts])

  const moderate = async (postId: number, status: 'published' | 'hidden') => {
    if (!token) return
    await api.moderatePost(token, postId, { status, resolutionNote: 'Cap nhat tu trang kiem duyet bai viet' })
    await loadPosts()
  }

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <p>Stitch4 / Post moderation</p>
        <h1>Kiểm duyệt bài viết</h1>
      </header>

      <section className={styles.list}>
        {flaggedPosts.map((post) => (
          <article key={post.id} className={styles.card}>
            <div className={styles.head}>
              <div>
                <b>Bài #{post.id} · {post.authorName}</b>
                <small>{new Date(post.createdAt).toLocaleString('vi-VN')} · trạng thái {post.status}</small>
              </div>
              <span>{post.reactionCount} ❤️ · {post.commentCount} 💬</span>
            </div>

            <p className={styles.content}>{post.content || '(Không có nội dung)'}</p>

            <div className={styles.actions}>
              <button type="button" onClick={() => moderate(post.id, 'hidden')}>
                <EyeOff size={15} /> Ẩn bài
              </button>
              <button type="button" onClick={() => moderate(post.id, 'published')}>
                <CheckCircle2 size={15} /> Duyệt bài
              </button>
              <Link to={`/posts/${post.id}`}>Chi tiết bình luận</Link>
            </div>
          </article>
        ))}

        {flaggedPosts.length === 0 ? <p className={styles.empty}>Không có bài viết cần kiểm duyệt.</p> : null}
      </section>
    </div>
  )
}
