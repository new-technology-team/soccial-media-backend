'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, EyeOff, ShieldAlert, Search, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useAuthStore } from '@/contexts/auth-store'
import { api } from '@/api/client'
import type { FeedPost } from '@/types'
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
        <h1>QuĂ¡º£n lý báo cáo khiĂ¡º¿u nại</h1>
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
            placeholder="Tìm theo lý do / chi tiĂ¡º¿t báo cáo..."
          />
        </label>

        <select value={targetType} onChange={(event) => setTargetType(event.target.value as TargetFilter)}>
          <option value="all">TĂ¡º¥t cĂ¡º£ đĂ¡»‘i tưĂ¡»£ng</option>
          <option value="post">Bài viĂ¡º¿t</option>
          <option value="comment">Bình luĂ¡º­n</option>
          <option value="user">NgưĂ¡»i dùng</option>
          <option value="message">Tin nhĂ¡º¯n</option>
        </select>

        <div className={styles.summaryStat}>
          <b>{filtered.length}</b>
          <span>kĂ¡º¿t quĂ¡º£ lĂ¡»c</span>
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
<<<<<<< HEAD
                      {String(report.targetType || 'unknown')} 킷 đĂ¡»‘i tưĂ¡»£ng #{String(report.targetId || '-')}
=======
                      {String(report.targetType || 'unknown')} • đối tượng #{String(report.targetId || '-')}
>>>>>>> e1e0f981eaeaaf7229c1f05934c42d2d9ef91993
                    </small>
                  </div>
                  <span>{String(report.status || 'pending')}</span>
                </div>

                <p>{String(report.reason || 'Không có lý do')}</p>

                <div className={styles.actions}>
                  <button type="button" onClick={() => resolve(id, 'reviewed')}>
                    <AlertTriangle size={15} /> ĐĂ¡nh dĂ¡º¥u đã xem
                  </button>
                  <button type="button" onClick={() => resolve(id, 'resolved')}>
                    <CheckCircle2 size={15} /> ĐĂ³ng báo cáo
                  </button>
                  {isPending ? (
                    <button type="button" onClick={() => hidePost(report)}>
                      <EyeOff size={15} /> Ă¡º¨n bài liên quan
                    </button>
                  ) : null}
                </div>
              </article>
            )
          })}

          {filtered.length === 0 ? (
            <div className={styles.empty}>
              <ShieldAlert size={16} /> Không có báo cáo phù hĂ¡»£p bĂ¡»™ lĂ¡»c.
            </div>
          ) : null}

          {filtered.length > 0 ? (
            <div className={styles.pagination}>
              <button type="button" disabled={currentPage <= 1} onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}>
                <ChevronLeft size={15} /> TrưĂ¡»›c
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
                <h2>Chi tiĂ¡º¿t report</h2>
                <button type="button" onClick={() => setSelectedReportId(null)}>
                  <X size={15} />
                </button>
              </div>
              <div className={styles.sideBlock}>
<<<<<<< HEAD
                <b>#{String(selectedReport.id)} 킷 {String(selectedReport.status || 'pending')}</b>
=======
                <b>#{String(selectedReport.id)} • {String(selectedReport.status || 'pending')}</b>
>>>>>>> e1e0f981eaeaaf7229c1f05934c42d2d9ef91993
                <p><span>Loại:</span> {String(selectedReport.targetType || 'unknown')}</p>
                <p><span>ĐĂ¡»‘i tưĂ¡»£ng:</span> #{String(selectedReport.targetId || '-')}</p>
                <p><span>Lý do:</span> {String(selectedReport.reason || 'Không có')}</p>
                <p><span>Chi tiĂ¡º¿t:</span> {String(selectedReport.details || 'Không có')}</p>
              </div>

              <div className={styles.sideBlock}>
                <h3>Chi tiĂ¡º¿t post liên quan</h3>
                {relatedPost ? (
                  <>
                    <p><span>Tác giĂ¡º£:</span> {relatedPost.authorName}</p>
                    <p><span>Trạng thái:</span> {relatedPost.status}</p>
                    <p className={styles.postContent}>{relatedPost.content || '(Không có nĂ¡»™i dung)'}</p>
                    <div className={styles.sideActions}>
                      <button type="button" onClick={hideRelatedPost}>
                        Ă¡º¨n bài
                      </button>
                      <button type="button" onClick={publishRelatedPost}>
                        Khôi phĂ¡»¥c
                      </button>
                    </div>
                  </>
                ) : (
                  <p className={styles.muted}>Report này không trĂ¡» tĂ¡»›i post hoặc post không còn trong feed hiĂ¡»‡n tại.</p>
                )}
              </div>

              <div className={styles.sideBlock}>
                <h3>NgưĂ¡»i duyĂ¡»‡t hiĂ¡»‡n tại</h3>
                <p>{user?.fullName || 'Moderator'}</p>
              </div>
            </>
          ) : (
            <div className={styles.empty}>ChĂ¡»n mĂ¡»™t report để xem chi tiĂ¡º¿t Ă¡»Ÿ side panel.</div>
          )}
        </aside>
      </section>
    </div>
  )
}

