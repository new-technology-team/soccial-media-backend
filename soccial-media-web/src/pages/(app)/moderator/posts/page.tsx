import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { api } from '@/api/client'
import { AppDialog, DialogButton } from '@/components/dialogs'
import { useAuthStore } from '@/contexts/auth-store'
import { useSocialRealtime } from '@/hooks/use-social-realtime'
import { toast } from '@/hooks/use-toast'
import type { FeedPost } from '@/types'
import styles from '../users/page.module.css'

const POST_STATUS_LABEL: Record<string, string> = {
  published: 'Đang hiển thị',
  hidden: 'Đã ẩn',
  deleted: 'Đã xóa',
}

const PAGE_SIZE = 20

export default function ModeratorPostsPage() {
  const token = useAuthStore((state) => state.accessToken)
  const user = useAuthStore((state) => state.user)
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [keyword, setKeyword] = useState('')
  const [action, setAction] = useState<{ post: FeedPost; status: 'published' | 'hidden' | 'deleted'; title: string } | null>(null)
  const [reason, setReason] = useState('')
  const [page, setPage] = useState(1)

  const loadPosts = async () => {
    if (!token) return
    const res = await api.listFeedWithParams({ includeHidden: true, limit: 80 }, token)
    setPosts(res.posts)
  }

  useEffect(() => {
    loadPosts().catch(() => undefined)
  }, [token])

  useSocialRealtime({ token, user, setPosts })

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase()
    return posts.filter((post) => post.status !== 'deleted' && (!q || [post.content, post.authorName, post.id].join(' ').toLowerCase().includes(q)))
  }, [keyword, posts])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const visiblePosts = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const submit = async () => {
    if (!token || !action) return
    await api.moderatePost(token, action.post.id, { status: action.status, resolutionNote: reason || 'Cập nhật từ trang kiểm duyệt bài viết' })
    toast({
      title:
        action.status === 'hidden'
          ? `Đã ẩn bài viết #${action.post.id}`
          : action.status === 'deleted'
            ? `Đã xóa bài viết vi phạm #${action.post.id}`
            : `Đã khôi phục bài viết #${action.post.id}`,
      description: 'Hành động kiểm duyệt đã được ghi nhận và đồng bộ realtime.',
    })
    setAction(null)
    setReason('')
  }

  if (user?.role !== 'admin' && user?.role !== 'moderator') return <div className={styles.denied}>Bạn không có quyền truy cập.</div>

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Kiểm duyệt viên</p>
          <h1>Bài viết bị báo cáo</h1>
          <p>Ẩn bài viết, xóa bài viết vi phạm, khôi phục nội dung phù hợp và ghi lý do xử lý.</p>
        </div>
      </header>
      <section className={styles.toolbar}>
        <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Tìm kiếm bài viết..." />
        <button type="button" className={styles.secondary} onClick={loadPosts}>Làm mới</button>
      </section>
      <section className={styles.panel}>
        <table className={styles.table}>
          <thead><tr><th>Bài viết</th><th>Tác giả</th><th>Trạng thái</th><th>Tương tác</th><th>Thao tác</th></tr></thead>
          <tbody>
            {visiblePosts.map((post) => (
              <tr key={post.id}>
                <td><b>#{post.id}</b><br /><small>{post.content || 'Không có nội dung'}</small></td>
                <td>{post.authorName}</td>
                <td><span className={`${styles.badge} ${styles[post.status] || ''}`}>{POST_STATUS_LABEL[post.status] || post.status}</span></td>
                <td>{post.reactionCount} cảm xúc · {post.commentCount} bình luận</td>
                <td>
                  <div className={styles.actions}>
                    <button type="button" className={styles.secondary} onClick={() => setAction({ post, status: 'hidden', title: 'Ẩn bài viết?' })}>Ẩn</button>
                    <button type="button" className={styles.secondary} onClick={() => setAction({ post, status: 'published', title: 'Khôi phục bài viết?' })}>Khôi phục</button>
                    <button type="button" className={styles.danger} onClick={() => setAction({ post, status: 'deleted', title: 'Xóa bài viết vi phạm?' })}>Xóa</button>
                    <Link className={styles.secondary} to={`/posts/${post.id}`}>Chi tiết</Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 ? <p className={styles.empty}>Không có dữ liệu</p> : null}
        {totalPages > 1 ? (
          <div className={styles.pagination}>
            <button type="button" className={styles.secondary} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Trước</button>
            <span>Trang {page} / {totalPages} ({filtered.length} bài)</span>
            <button type="button" className={styles.secondary} disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Sau →</button>
          </div>
        ) : null}
      </section>

      <AppDialog
        open={Boolean(action)}
        onOpenChange={(open) => !open && setAction(null)}
        title={action?.title || ''}
        description="Hành động kiểm duyệt này sẽ được ghi vào lịch sử xử lý vi phạm."
        footer={<><DialogButton variant="secondary" onClick={() => setAction(null)}>Hủy</DialogButton><DialogButton variant="destructive" onClick={() => void submit()}>Xác nhận</DialogButton></>}
      >
        <div className={styles.modalForm}>
          <label>Lý do xử lý<textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Nhập lý do xử lý..." /></label>
        </div>
      </AppDialog>
    </main>
  )
}
