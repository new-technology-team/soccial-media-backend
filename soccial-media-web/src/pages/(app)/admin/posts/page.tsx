'use client'

import { useEffect, useMemo, useState } from 'react'
import { EyeOff, FileText, Globe, Heart, Lock, PencilLine, RefreshCcw, Save, Search, Trash2 } from 'lucide-react'
import { useAuthStore } from '@/lib/store/auth-store'
import { api } from '@/lib/api'
import type { FeedPost } from '@/lib/types'
import styles from './page.module.css'

function toFeedPost(raw: Record<string, unknown>): FeedPost {
  const owner = raw.owner as Record<string, unknown> | undefined;
  return {
    id: Number(raw.id ?? 0),
    authorId: Number(owner?.userId ?? 0),
    authorName: String(owner?.displayName ?? raw.title ?? 'Người dùng'),
    authorAvatar: (owner?.avatarUrl as string | undefined) ?? null,
    content: String(raw.content ?? raw.title ?? ''),
    mediaUrl: (raw.mediaUrl as string) || null,
    visibility: (raw.visibility as 'public' | 'private') || 'public',
    status: (raw.status as PostStatus) || 'published',
    reactionCount: Number(raw.reactionCount ?? 0),
    commentCount: Number(raw.commentCount ?? 0),
    viewerReaction: (raw.viewerReaction as string | null) ?? null,
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
  };
}

type PostStatus = 'published' | 'hidden' | 'deleted'
type PostVisibility = 'public' | 'private'

export default function AdminPostManagementPage() {
  const user = useAuthStore((state) => state.user)
  const token = useAuthStore((state) => state.accessToken)
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [selectedPostIds, setSelectedPostIds] = useState<number[]>([])
  const [bulkWorking, setBulkWorking] = useState(false)

  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | PostStatus>('all')
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | PostVisibility>('all')

  const [editingPostId, setEditingPostId] = useState<number | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editMediaUrl, setEditMediaUrl] = useState('')
  const [editStatus, setEditStatus] = useState<PostStatus>('published')
  const [editVisibility, setEditVisibility] = useState<PostVisibility>('public')

  const loadPosts = async () => {
    setLoading(true)
    setError('')
    setNotice('')

    try {
      const res = await api.adminPosts()
      const mapped = (res.posts as Record<string, unknown>[]).map(toFeedPost)
      setPosts(mapped)
      const visibleIds = new Set(mapped.map((item) => item.id))
      setSelectedPostIds((prev) => prev.filter((id) => visibleIds.has(id)))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể tải danh sách bài viết'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPosts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const analytics = useMemo(() => {
    const totalPosts = posts.length
    const hiddenPosts = posts.filter((p) => p.status === 'hidden').length
    const deletedPosts = posts.filter((p) => p.status === 'deleted').length
    const publishedPosts = posts.filter((p) => p.status === 'published').length
    const publicPosts = posts.filter((p) => p.visibility === 'public').length
    const privatePosts = posts.filter((p) => p.visibility === 'private').length

    const totalComments = posts.reduce((acc, post) => acc + Number(post.commentCount || 0), 0)
    const totalReactions = posts.reduce((acc, post) => acc + Number(post.reactionCount || 0), 0)

    return {
      totalPosts,
      hiddenPosts,
      deletedPosts,
      publishedPosts,
      publicPosts,
      privatePosts,
      totalComments,
      totalReactions,
    }
  }, [posts])

  const openEdit = (post: FeedPost) => {
    setEditingPostId(post.id)
    setEditContent(post.content || '')
    setEditMediaUrl(post.mediaUrl || '')
    setEditStatus(post.status)
    setEditVisibility(post.visibility)
  }

  const closeEdit = () => {
    setEditingPostId(null)
    setEditContent('')
    setEditMediaUrl('')
    setEditStatus('published')
    setEditVisibility('public')
  }

  const saveEdit = async () => {
    if (!token || !editingPostId) return
    try {
      setError('')
      setNotice('')
      await api.updateAdminPost(editingPostId, {
        content: editContent.trim(),
        mediaUrl: editMediaUrl.trim() || null,
        status: editStatus,
        visibility: editVisibility,
      })
      closeEdit()
      setNotice('Đã cập nhật bài viết thành công')
      await loadPosts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể cập nhật bài viết')
    }
  }

  const quickUpdateStatus = async (postId: number, status: PostStatus) => {
    if (!token) return
    try {
      setError('')
      setNotice('')
      await api.updateAdminPost(postId, { status })
      setNotice(`Đã cập nhật trạng thái bài viết #${postId}`)
      await loadPosts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể cập nhật trạng thái bài viết')
    }
  }

  const deletePost = async (postId: number) => {
    if (!token) return
    const ok = window.confirm('Xóa bài viết này khỏi feed? Hành động này sẽ chuyển trạng thái sang deleted.')
    if (!ok) return

    try {
      setError('')
      setNotice('')
      await api.deleteAdminPost(postId)
      setNotice(`Đã xóa bài viết #${postId}`)
      await loadPosts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể xóa bài viết')
    }
  }

  const toggleSelectPost = (postId: number) => {
    setSelectedPostIds((prev) => (prev.includes(postId) ? prev.filter((id) => id !== postId) : [...prev, postId]))
  }

  const toggleSelectAllVisible = () => {
    const allVisibleIds = posts.map((post) => post.id)
    const isAllSelected = allVisibleIds.length > 0 && allVisibleIds.every((id) => selectedPostIds.includes(id))
    if (isAllSelected) {
      setSelectedPostIds([])
      return
    }
    setSelectedPostIds(allVisibleIds)
  }

  const runBulkAction = async (action: 'hide' | 'delete') => {
    if (selectedPostIds.length === 0 || bulkWorking) return

    const actionLabel = action === 'hide' ? 'ẩn' : 'xóa'
    const ok = window.confirm(`Xác nhận ${actionLabel} ${selectedPostIds.length} bài viết đã chọn?`)
    if (!ok) return

    setBulkWorking(true)
    setError('')
    setNotice('')

    try {
      const results = await Promise.allSettled(
        selectedPostIds.map((postId) => {
          if (action === 'hide') {
            return api.updateAdminPost(postId, { isHidden: true })
          }
          return api.deleteAdminPost(postId)
        })
      )

      const failed = results.filter((item) => item.status === 'rejected').length
      const success = results.length - failed

      if (failed > 0) {
        setError(`Bulk ${actionLabel}: thành công ${success}, thất bại ${failed}. Vui lòng thử lại các mục lỗi.`)
      } else {
        setNotice(`Đã ${actionLabel} thành công ${success} bài viết.`)
      }

      setSelectedPostIds([])
      await loadPosts()
    } finally {
      setBulkWorking(false)
    }
  }

  if (user?.role?.toLowerCase() !== 'admin') {
    return <div className={styles.denied}>Bạn không có quyền truy cập khu vực admin.</div>
  }

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>Admin CRM / Content Ops</p>
        <h1>Quản lý bài viết end-to-end</h1>
        <p>Quản trị toàn bộ bài viết: lọc, sửa nội dung, đổi trạng thái hiển thị và xóa nội dung vi phạm.</p>
      </header>

      <section className={styles.grid}>
        <article className={styles.card}>
          <div className={styles.cardTop}>
            <span>Tổng bài viết</span>
            <FileText size={18} />
          </div>
          <strong>{analytics.totalPosts.toLocaleString('vi-VN')}</strong>
        </article>

        <article className={styles.card}>
          <div className={styles.cardTop}>
            <span>Bài đang ẩn</span>
            <EyeOff size={18} />
          </div>
          <strong>{analytics.hiddenPosts.toLocaleString('vi-VN')}</strong>
        </article>

        <article className={styles.card}>
          <div className={styles.cardTop}>
            <span>Bài đã xóa</span>
            <Trash2 size={18} />
          </div>
          <strong>{analytics.deletedPosts.toLocaleString('vi-VN')}</strong>
        </article>

        <article className={styles.card}>
          <div className={styles.cardTop}>
            <span>Tổng bình luận</span>
            <FileText size={18} />
          </div>
          <strong>{analytics.totalComments.toLocaleString('vi-VN')}</strong>
        </article>

        <article className={styles.card}>
          <div className={styles.cardTop}>
            <span>Tổng cảm xúc</span>
            <Heart size={18} />
          </div>
          <strong>{analytics.totalReactions.toLocaleString('vi-VN')}</strong>
        </article>
      </section>

      <section className={styles.panel}>
        <div className={styles.toolbar}>
          <label className={styles.searchBox}>
            <Search size={15} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm theo nội dung hoặc tên tác giả"
            />
          </label>

          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | PostStatus)}>
            <option value="all">Tất cả trạng thái</option>
            <option value="published">published</option>
            <option value="hidden">hidden</option>
            <option value="deleted">deleted</option>
          </select>

          <select
            value={visibilityFilter}
            onChange={(event) => setVisibilityFilter(event.target.value as 'all' | PostVisibility)}
          >
            <option value="all">Tất cả quyền xem</option>
            <option value="public">public</option>
            <option value="private">private</option>
          </select>

          <button type="button" className={styles.refreshBtn} onClick={loadPosts}>
            <RefreshCcw size={15} /> Làm mới
          </button>
          <button type="button" className={styles.refreshBtn} onClick={loadPosts}>
            <Search size={15} /> Lọc
          </button>
        </div>

        <div className={styles.visibilityStats}>
          <span>
            <Globe size={14} /> Công khai: <b>{analytics.publicPosts}</b>
          </span>
          <span>
            <Lock size={14} /> Riêng tư: <b>{analytics.privatePosts}</b>
          </span>
          <span>
            Đang hiển thị: <b>{analytics.publishedPosts}</b>
          </span>
        </div>

        <div className={styles.bulkBar}>
          <span>
            Đang chọn <b>{selectedPostIds.length}</b> / {posts.length} bài
          </span>
          <div className={styles.bulkActions}>
            <button type="button" className={styles.bulkBtn} onClick={toggleSelectAllVisible}>
              {posts.length > 0 && posts.every((item) => selectedPostIds.includes(item.id)) ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
            </button>
            <button
              type="button"
              className={styles.bulkBtn}
              disabled={selectedPostIds.length === 0 || bulkWorking}
              onClick={() => runBulkAction('hide')}
            >
              Ẩn đã chọn
            </button>
            <button
              type="button"
              className={`${styles.bulkBtn} ${styles.bulkDanger}`}
              disabled={selectedPostIds.length === 0 || bulkWorking}
              onClick={() => runBulkAction('delete')}
            >
              Xóa đã chọn
            </button>
          </div>
        </div>

        {error ? <p className={styles.error}>{error}</p> : null}
        {notice ? <p className={styles.notice}>{notice}</p> : null}

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    aria-label="Chọn tất cả bài viết"
                    checked={posts.length > 0 && posts.every((item) => selectedPostIds.includes(item.id))}
                    onChange={toggleSelectAllVisible}
                  />
                </th>
                <th>ID</th>
                <th>Tác giả</th>
                <th>Nội dung</th>
                <th>Hiển thị</th>
                <th>Trạng thái</th>
                <th>Tương tác</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => {
                const isEditing = editingPostId === post.id
                return (
                  <tr key={post.id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Chọn bài viết ${post.id}`}
                        checked={selectedPostIds.includes(post.id)}
                        onChange={() => toggleSelectPost(post.id)}
                      />
                    </td>
                    <td>#{post.id}</td>
                    <td>{post.authorName}</td>
                    <td>
                      {isEditing ? (
                        <div className={styles.inlineEdit}>
                          <textarea
                            value={editContent}
                            onChange={(event) => setEditContent(event.target.value)}
                            placeholder="Nội dung bài viết"
                          />
                          <input
                            value={editMediaUrl}
                            onChange={(event) => setEditMediaUrl(event.target.value)}
                            placeholder="Media URL (optional)"
                          />
                        </div>
                      ) : (
                        <p className={styles.content}>{post.content || '(media only)'}</p>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <select
                          value={editVisibility}
                          onChange={(event) => setEditVisibility(event.target.value as PostVisibility)}
                        >
                          <option value="public">public</option>
                          <option value="private">private</option>
                        </select>
                      ) : (
                        post.visibility
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <select value={editStatus} onChange={(event) => setEditStatus(event.target.value as PostStatus)}>
                          <option value="published">published</option>
                          <option value="hidden">hidden</option>
                          <option value="deleted">deleted</option>
                        </select>
                      ) : (
                        post.status
                      )}
                    </td>
                    <td>
                      {post.reactionCount} react / {post.commentCount} comment
                    </td>
                    <td>
                      <div className={styles.actions}>
                        {isEditing ? (
                          <>
                            <button type="button" onClick={saveEdit}>
                              <Save size={14} /> Lưu
                            </button>
                            <button type="button" onClick={closeEdit}>
                              Hủy
                            </button>
                          </>
                        ) : (
                          <>
                            <button type="button" onClick={() => openEdit(post)}>
                              <PencilLine size={14} /> Sửa
                            </button>
                            <button type="button" onClick={() => quickUpdateStatus(post.id, 'hidden')}>
                              Ẩn
                            </button>
                            <button type="button" onClick={() => quickUpdateStatus(post.id, 'published')}>
                              Hiện
                            </button>
                            <button type="button" className={styles.danger} onClick={() => deletePost(post.id)}>
                              <Trash2 size={14} /> Xóa
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}

              {!loading && posts.length === 0 ? (
                <tr>
                  <td colSpan={8} className={styles.empty}>Không có bài viết phù hợp bộ lọc.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {loading ? <p className={styles.empty}>Đang tải dữ liệu...</p> : null}
      </section>
    </div>
  )
}
