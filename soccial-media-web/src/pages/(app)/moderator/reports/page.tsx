'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, EyeOff, ShieldAlert, Search, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useAuthStore } from '@/lib/store/auth-store'
import { api } from '@/lib/api'
import type { FeedPost } from '@/lib/types'
import styles from './page.module.css'

type ReportStatus = 'all' | 'pending' | 'reviewed' | 'resolved'
type TargetFilter = 'all' | 'post' | 'comment' | 'user' | 'message'

const PAGE_SIZE = 8

export default function ModeratorReportsPage() {
  const user = useAuthStore((state) => state.user)
  const token = useAuthStore((state) => state.accessToken)
  const [reports, setReports] = useState<Array<Record<string, unknown>>>([])
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [status, setStatus] = useState<ReportStatus>('all')
  const [targetType, setTargetType] = useState<TargetFilter>('all')
  const [keyword, setKeyword] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null)

  const loadReports = async () => {
    if (!token) return
    const res = await api.moderationReports(token)
    setReports(res.reports)
  }

  const loadPosts = async () => {
    if (!token) return
    const res = await api.listFeedWithParams({ includeHidden: true, limit: 100 }, token)
    setPosts(res.posts)
  }

  useEffect(() => {
    loadReports().catch(console.error)
    loadPosts().catch(console.error)
  }, [token])

  const filtered = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()
    return reports.filter((item) => {
      const itemStatus = String(item.status || 'pending')
      const itemTarget = String(item.targetType || 'unknown')
      const itemReason = String(item.reason || '').toLowerCase()
      const itemDetails = String(item.details || '').toLowerCase()

      const okStatus = status === 'all' || itemStatus === status
      const okTarget = targetType === 'all' || itemTarget === targetType
      const okKeyword = !normalizedKeyword || itemReason.includes(normalizedKeyword) || itemDetails.includes(normalizedKeyword)
      return okStatus && okTarget && okKeyword
    })
  }, [keyword, reports, status, targetType])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)), [filtered.length])

  const paged = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [currentPage, filtered])

  const selectedReport = useMemo(() => {
    if (!selectedReportId) return null
    return reports.find((item) => Number(item.id) === selectedReportId) || null
  }, [reports, selectedReportId])

  const relatedPost = useMemo(() => {
    if (!selectedReport) return null
    if (String(selectedReport.targetType || '') !== 'post') return null
    const postId = Number(selectedReport.targetId || 0)
    return posts.find((post) => post.id === postId) || null
  }, [posts, selectedReport])

  useEffect(() => {
    setCurrentPage(1)
  }, [keyword, status, targetType])

  useEffect(() => {
    if (filtered.length === 0) {
      setSelectedReportId(null)
      return
    }
    if (!selectedReportId || !filtered.some((item) => Number(item.id) === selectedReportId)) {
      setSelectedReportId(Number(filtered[0].id))
    }
  }, [filtered, selectedReportId])

  const resolve = async (id: number, nextStatus: 'reviewed' | 'resolved') => {
    if (!token) return
    await api.reviewModerationReport(token, id, { status: nextStatus })
    await loadReports()
  }

  const hidePost = async (report: Record<string, unknown>) => {
    if (!token) return
    if (String(report.targetType || '') !== 'post') return
    const postId = Number(report.targetId || 0)
    if (!postId) return
    await api.moderatePost(token, postId, { status: 'hidden', resolutionNote: 'An bai tu trang quan ly bao cao' })
    await resolve(Number(report.id), 'resolved')
    await loadPosts()
  }

  const publishRelatedPost = async () => {
    if (!token || !relatedPost) return
    await api.moderatePost(token, relatedPost.id, {
      status: 'published',
      resolutionNote: 'Khoi phuc bai viet tu side panel bao cao',
    })
    await loadPosts()
  }

  const hideRelatedPost = async () => {
    if (!token || !relatedPost) return
    await api.moderatePost(token, relatedPost.id, {
      status: 'hidden',
      resolutionNote: 'An bai viet tu side panel bao cao',
    })
    await loadPosts()
  }

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <p>Stitch4 / Reports</p>
        <h1>Quản lý báo cáo khiếu nại</h1>
      </header>

      <section className={styles.filters}>
        {(['all', 'pending', 'reviewed', 'resolved'] as ReportStatus[]).map((item) => (
          <button
            key={item}
            type="button"
            className={status === item ? styles.filterActive : ''}
            onClick={() => setStatus(item)}
          >
            {item}
          </button>
        ))}
      </section>

      <section className={styles.advancedRow}>
        <label className={styles.searchWrap}>
          <Search size={15} />
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="Tìm theo lý do / chi tiết báo cáo..."
          />
        </label>

        <select value={targetType} onChange={(event) => setTargetType(event.target.value as TargetFilter)}>
          <option value="all">Tất cả đối tượng</option>
          <option value="post">Bài viết</option>
          <option value="comment">Bình luận</option>
          <option value="user">Người dùng</option>
          <option value="message">Tin nhắn</option>
        </select>

        <div className={styles.summaryStat}>
          <b>{filtered.length}</b>
          <span>kết quả lọc</span>
        </div>
      </section>

      <section className={styles.layout}>
        <div className={styles.list}>
          {paged.map((report) => {
            const id = Number(report.id)
            const isPending = String(report.status || 'pending') === 'pending'
            const isSelected = selectedReportId === id
            return (
              <article
                key={id}
                className={`${styles.card} ${isSelected ? styles.cardSelected : ''}`}
                onClick={() => setSelectedReportId(id)}
              >
                <div className={styles.head}>
                  <div>
                    <b>Báo cáo #{id}</b>
                    <small>
                      {String(report.targetType || 'unknown')} · đối tượng #{String(report.targetId || '-')}
                    </small>
                  </div>
                  <span>{String(report.status || 'pending')}</span>
                </div>

                <p>{String(report.reason || 'Không có lý do')}</p>

                <div className={styles.actions}>
                  <button type="button" onClick={() => resolve(id, 'reviewed')}>
                    <AlertTriangle size={15} /> Đánh dấu đã xem
                  </button>
                  <button type="button" onClick={() => resolve(id, 'resolved')}>
                    <CheckCircle2 size={15} /> Đóng báo cáo
                  </button>
                  {isPending ? (
                    <button type="button" onClick={() => hidePost(report)}>
                      <EyeOff size={15} /> Ẩn bài liên quan
                    </button>
                  ) : null}
                </div>
              </article>
            )
          })}

          {filtered.length === 0 ? (
            <div className={styles.empty}>
              <ShieldAlert size={16} /> Không có báo cáo phù hợp bộ lọc.
            </div>
          ) : null}

          {filtered.length > 0 ? (
            <div className={styles.pagination}>
              <button type="button" disabled={currentPage <= 1} onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}>
                <ChevronLeft size={15} /> Trước
              </button>
              <span>Trang {currentPage}/{totalPages}</span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              >
                Sau <ChevronRight size={15} />
              </button>
            </div>
          ) : null}
        </div>

        <aside className={styles.sidePanel}>
          {selectedReport ? (
            <>
              <div className={styles.sideHead}>
                <h2>Chi tiết report</h2>
                <button type="button" onClick={() => setSelectedReportId(null)}>
                  <X size={15} />
                </button>
              </div>
              <div className={styles.sideBlock}>
                <b>#{String(selectedReport.id)} · {String(selectedReport.status || 'pending')}</b>
                <p><span>Loại:</span> {String(selectedReport.targetType || 'unknown')}</p>
                <p><span>Đối tượng:</span> #{String(selectedReport.targetId || '-')}</p>
                <p><span>Lý do:</span> {String(selectedReport.reason || 'Không có')}</p>
                <p><span>Chi tiết:</span> {String(selectedReport.details || 'Không có')}</p>
              </div>

              <div className={styles.sideBlock}>
                <h3>Chi tiết post liên quan</h3>
                {relatedPost ? (
                  <>
                    <p><span>Tác giả:</span> {relatedPost.authorName}</p>
                    <p><span>Trạng thái:</span> {relatedPost.status}</p>
                    <p className={styles.postContent}>{relatedPost.content || '(Không có nội dung)'}</p>
                    <div className={styles.sideActions}>
                      <button type="button" onClick={hideRelatedPost}>
                        Ẩn bài
                      </button>
                      <button type="button" onClick={publishRelatedPost}>
                        Khôi phục
                      </button>
                    </div>
                  </>
                ) : (
                  <p className={styles.muted}>Report này không trỏ tới post hoặc post không còn trong feed hiện tại.</p>
                )}
              </div>

              <div className={styles.sideBlock}>
                <h3>Người duyệt hiện tại</h3>
                <p>{user?.fullName || 'Moderator'}</p>
              </div>
            </>
          ) : (
            <div className={styles.empty}>Chọn một report để xem chi tiết ở side panel.</div>
          )}
        </aside>
      </section>
    </div>
  )
}
