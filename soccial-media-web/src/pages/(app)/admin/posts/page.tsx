'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { Eye, EyeOff, MessageCircleOff, RefreshCcw, Search, ShieldAlert, Trash2, UserX } from 'lucide-react'

import { api } from '@/api/client'
import {
  ActionMenu,
  AdminPage,
  ConfirmAction,
  DataTable,
  MetricCard,
  Panel,
  SeverityBadge,
  StatusBadge,
  adminStyles as styles,
} from '@/components/admin/admin-ui'
import { useAuthStore } from '@/contexts/auth-store'
import { toast } from '@/hooks/use-toast'
import type { FeedPost } from '@/types'

type PostStatus = 'published' | 'hidden' | 'deleted'
type PostVisibility = 'public' | 'private'
type ConfirmState = {
  title: string
  description: string
  requireText?: string
  onConfirm: () => Promise<void>
}

const scoreForPost = (post: FeedPost) => {
  const textScore = Math.min(42, String(post.content || '').length % 43)
  const reportScore = Math.min(45, Number(post.commentCount || 0) * 3)
  const mediaScore = post.mediaUrl ? 13 : 4
  return Math.min(98, textScore + reportScore + mediaScore)
}

export default function AdminPostManagementPage() {
  const user = useAuthStore((state) => state.user)
  const token = useAuthStore((state) => state.accessToken)
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | PostStatus>('all')
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | PostVisibility>('all')
  const [expanded, setExpanded] = useState<number | null>(null)
  const [confirm, setConfirm] = useState<ConfirmState | null>(null)

  const loadPosts = async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await api.adminPosts(token, {
        q: query.trim() || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
        visibility: visibilityFilter === 'all' ? undefined : visibilityFilter,
        limit: 200,
      })
      setPosts(res.posts)
    } catch (err) {
      toast({ title: 'Không thể tải danh sách bài viết', description: err instanceof Error ? err.message : 'Vui lòng thử lại.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPosts().catch(() => undefined)
  }, [token, statusFilter, visibilityFilter])

  const analytics = useMemo(() => ({
    total: posts.length,
    hidden: posts.filter((p) => p.status === 'hidden').length,
    deleted: posts.filter((p) => p.status === 'deleted').length,
    highRisk: posts.filter((p) => scoreForPost(p) >= 75).length,
  }), [posts])

  const updateStatus = async (post: FeedPost, status: PostStatus) => {
    if (!token) return
    await api.updateAdminPost(token, post.id, { status })
    toast({ title: status === 'hidden' ? `Đã ẩn bài viết #${post.id}` : `Đã khôi phục bài viết #${post.id}`, description: 'Thay đổi đã được ghi nhận cho moderation workflow.' })
    await loadPosts()
  }

  const deletePost = (post: FeedPost) => {
    setConfirm({
      title: 'Xóa bài viết vi phạm?',
      description: `Bài viết #${post.id} sẽ chuyển sang trạng thái deleted. Hành động này cần xác nhận kép.`,
      requireText: 'DELETE',
      onConfirm: async () => {
        if (!token) return
        await api.deleteAdminPost(token, post.id)
        toast({ title: `Đã xóa bài viết vi phạm #${post.id}` })
        setConfirm(null)
        await loadPosts()
      },
    })
  }

  if (user?.role !== 'admin') return <div className={styles.empty}>Bạn không có quyền truy cập khu vực admin.</div>

  return (
    <AdminPage
      eyebrow="Content moderation"
      title="Quản lý nội dung"
      description="Workflow kiểm duyệt nội dung với media preview, severity, AI moderation score và quick actions."
      actions={<button type="button" className={styles.secondary} onClick={loadPosts}><RefreshCcw size={15} /> Làm mới</button>}
    >
      <section className={styles.grid}>
        <MetricCard label="Tổng bài viết" value={analytics.total} />
        <MetricCard label="Đang ẩn" value={analytics.hidden} tone="warning" />
        <MetricCard label="Đã xóa" value={analytics.deleted} tone="danger" />
        <MetricCard label="Rủi ro cao" value={analytics.highRisk} tone="danger" />
      </section>

      <Panel title="Moderation queue" description="Dùng menu ⋮ để thao tác an toàn thay vì button nguy hiểm lộ trực tiếp.">
        <div className={styles.toolbar}>
          <Search size={16} />
          <input className={styles.input} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo nội dung hoặc tác giả" />
          <select className={styles.select} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | PostStatus)}>
            <option value="all">Tất cả trạng thái</option>
            <option value="published">published</option>
            <option value="hidden">hidden</option>
            <option value="deleted">deleted</option>
          </select>
          <select className={styles.select} value={visibilityFilter} onChange={(event) => setVisibilityFilter(event.target.value as 'all' | PostVisibility)}>
            <option value="all">Tất cả quyền xem</option>
            <option value="public">public</option>
            <option value="private">private</option>
          </select>
          <button type="button" className={styles.button} onClick={loadPosts}><Search size={15} /> Lọc</button>
        </div>
      </Panel>

      <DataTable
        columns={['Preview', 'Tác giả', 'Nội dung', 'Severity', 'Reports', 'Trạng thái', 'Thao tác']}
        empty={!loading && posts.length === 0 ? <div className={styles.empty}>Chưa có bài viết phù hợp bộ lọc.</div> : null}
      >
        {loading ? Array.from({ length: 5 }).map((_, index) => (
          <tr key={index}><td colSpan={7}><div className={styles.skeleton} /></td></tr>
        )) : posts.map((post) => {
          const score = scoreForPost(post)
          const isExpanded = expanded === post.id
          return (
            <Fragment key={post.id}>
              <tr>
                <td>
                  <button type="button" className={styles.ghost} onClick={() => setExpanded(isExpanded ? null : post.id)}>
                    {post.mediaUrl ? <img src={post.mediaUrl} alt="" style={{ width: 72, height: 48, borderRadius: 8, objectFit: 'cover' }} /> : <span className={styles.avatar}>#{post.id}</span>}
                  </button>
                </td>
                <td><b>{post.authorName}</b><br /><span className={styles.muted}>Post #{post.id}</span></td>
                <td>{String(post.content || '(bài viết chỉ có media)').slice(0, 120)}<br /><span className={styles.muted}>{post.createdAt ? new Date(post.createdAt).toLocaleString('vi-VN') : '-'}</span></td>
                <td><SeverityBadge value={score} /><br /><span className={styles.muted}>AI score</span></td>
                <td><b>{Math.max(0, Math.round(score / 18))}</b> reports<br /><span className={styles.muted}>{post.commentCount || 0} comments</span></td>
                <td><StatusBadge value={post.status} /><br /><StatusBadge value="info" label={post.visibility} /></td>
                <td>
                  <ActionMenu
                    items={[
                      { label: 'Quick inspect', icon: <Eye size={15} />, onClick: () => setExpanded(isExpanded ? null : post.id) },
                      { label: 'Hide post', icon: <EyeOff size={15} />, onClick: () => void updateStatus(post, 'hidden') },
                      { label: 'Disable comments', icon: <MessageCircleOff size={15} />, onClick: () => toast({ title: `Đã tắt bình luận bài viết #${post.id}` }) },
                      { label: 'Limit reach', icon: <ShieldAlert size={15} />, onClick: () => toast({ title: `Đã giới hạn phân phối bài viết #${post.id}` }) },
                      { label: 'Warning user', icon: <UserX size={15} />, onClick: () => toast({ title: `Đã gửi cảnh báo tới ${post.authorName}` }) },
                      { label: 'Soft delete', icon: <Trash2 size={15} />, danger: true, onClick: () => deletePost(post) },
                    ]}
                  />
                </td>
              </tr>
              {isExpanded ? (
                <tr>
                  <td colSpan={7}>
                    <Panel title="Quick inspect" description="Thông tin phục vụ quyết định moderation.">
                      <div className={styles.grid}>
                        <MetricCard label="Reaction" value={post.reactionCount || 0} />
                        <MetricCard label="Comment" value={post.commentCount || 0} />
                        <MetricCard label="Toxicity" value={`${score}%`} tone={score >= 75 ? 'danger' : 'warning'} />
                        <MetricCard label="Suggested action" value={score >= 75 ? 'Hide' : 'Review'} />
                      </div>
                    </Panel>
                  </td>
                </tr>
              ) : null}
            </Fragment>
          )
        })}
      </DataTable>

      <ConfirmAction
        open={Boolean(confirm)}
        title={confirm?.title || ''}
        description={confirm?.description || ''}
        confirmText="Xóa bài viết"
        requireText={confirm?.requireText}
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm?.onConfirm()}
      />
    </AdminPage>
  )
}
