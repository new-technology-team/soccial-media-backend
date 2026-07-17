import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileWarning,
  MessageCircleWarning,
  MessageSquareWarning,
  Search,
  ShieldCheck,
  Sparkles,
  UserRoundX,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { api } from '@/api/client'
import { useAuthStore } from '@/contexts/auth-store'
import { useReportRealtime } from '@/hooks/use-report-realtime'
import styles from './page.module.css'

type Severity = 'low' | 'medium' | 'high' | 'critical'
type QueueStatus = 'pending' | 'reviewing' | 'action_taken' | 'resolved' | 'appeal'
type ReportType = 'post' | 'user' | 'comment' | 'message'

type ModerationReport = {
  id: string
  type: ReportType
  status: QueueStatus
  severity: Severity
  priority: number
  reason: string
  aiScore: number
  createdAt: string
  subject: string
  reporter?: string
  assignee?: string
}

type FilterState = {
  search: string
  severity: Severity | 'all'
  type: ReportType | 'all'
  status: QueueStatus | 'all'
  sort: 'priority' | 'newest'
}

const statusMap: Record<string, QueueStatus> = {
  PENDING: 'pending',
  pending: 'pending',
  IN_REVIEW: 'reviewing',
  in_review: 'reviewing',
  reviewed: 'action_taken',
  RESOLVED: 'resolved',
  resolved: 'resolved',
  REJECTED: 'appeal',
  rejected: 'appeal',
}

const statusLabels: Record<QueueStatus, string> = {
  pending: 'Chờ xử lý',
  reviewing: 'Đang xem xét',
  action_taken: 'Đã hành động',
  resolved: 'Đã xử lý',
  appeal: 'Từ chối',
}

const typeLabels: Record<ReportType, string> = {
  post: 'Bài viết',
  user: 'Tài khoản',
  comment: 'Bình luận',
  message: 'Tin nhắn',
}

const cx = (...items: Array<string | false | null | undefined>) => items.filter(Boolean).join(' ')

const severityFromReason = (reason: string, index: number): Severity => {
  const lower = reason.toLowerCase()
  if (lower.includes('đe dọa') || lower.includes('threat') || lower.includes('hate') || lower.includes('sexual')) return 'critical'
  if (lower.includes('độc hại') || lower.includes('quấy rối') || lower.includes('spam') || lower.includes('toxic')) return 'high'
  return index % 3 === 0 ? 'medium' : 'low'
}

const normalizeType = (value: unknown): ReportType => {
  const type = String(value || '').toLowerCase()
  if (type === 'user' || type === 'message' || type === 'comment') return type
  return 'post'
}

const normalizeReports = (items: Array<Record<string, unknown>> | undefined): ModerationReport[] => {
  const reports = (items || []).map((item, index) => {
    const reason = String(item.reason || item.details || item.description || 'Báo cáo vi phạm tiêu chuẩn cộng đồng')
    const severity = severityFromReason(reason, index)
    const status = statusMap[String(item.status || '')] || 'pending'
    const priority = severity === 'critical' ? 1 : severity === 'high' ? 2 : severity === 'medium' ? 3 : 4

    return {
      id: String(item.id || item.reportId || `RPT-${index + 1}`),
      type: normalizeType(item.reportType || item.targetType || item.type),
      status,
      severity,
      priority,
      reason,
      aiScore: Number(item.aiScore || item.moderationScore || Math.max(45, 94 - index * 7)),
      createdAt: String(item.createdAt || item.created_at || item.updatedAt || 'Vừa xong'),
      subject: String(item.targetTitle || item.subject || item.targetId || `Báo cáo #${index + 1}`),
      reporter: String(item.reporterName || item.reporter || 'Cộng đồng'),
      assignee: item.assignedTo ? `#${String(item.assignedTo)}` : undefined,
    }
  })

  return reports
}

export default function ModeratorDashboard() {
  const token = useAuthStore((state) => state.accessToken)
  const user = useAuthStore((state) => state.user)
  const [stats, setStats] = useState<Record<string, number>>({})
  const [rawReports, setRawReports] = useState<Array<Record<string, unknown>>>([])
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    severity: 'all',
    type: 'all',
    status: 'all',
    sort: 'priority',
  })

  useReportRealtime({ token, user, setReports: setRawReports })

  useEffect(() => {
    if (!token) return
    api
      .moderationDashboard(token)
      .then((res) => {
        setStats(res.stats || {})
        setRawReports(res.reports || [])
      })
      .catch(() => undefined)
  }, [token])

  const reports = useMemo(() => normalizeReports(rawReports), [rawReports])

  const derived = useMemo(() => {
    const pending = stats.pendingReports ?? reports.filter((report) => report.status === 'pending').length
    const reviewing = stats.inReviewReports ?? reports.filter((report) => report.status === 'reviewing').length
    const resolved = stats.resolvedReports ?? reports.filter((report) => report.status === 'resolved').length
    return { pending, reviewing, resolved, workload: pending + reviewing }
  }, [reports, stats])

  const typeCounts = useMemo(() => ({
    post: reports.filter((item) => item.type === 'post').length,
    user: reports.filter((item) => item.type === 'user').length,
    comment: reports.filter((item) => item.type === 'comment').length,
    message: reports.filter((item) => item.type === 'message').length,
  }), [reports])

  const filteredReports = useMemo(() => {
    const search = filters.search.trim().toLowerCase()
    return reports
      .filter((report) => {
        if (filters.severity !== 'all' && report.severity !== filters.severity) return false
        if (filters.type !== 'all' && report.type !== filters.type) return false
        if (filters.status !== 'all' && report.status !== filters.status) return false
        if (!search) return true
        return `${report.subject} ${report.reason} ${report.reporter || ''}`.toLowerCase().includes(search)
      })
      .sort((a, b) => {
        if (filters.sort === 'newest') return b.createdAt.localeCompare(a.createdAt)
        return a.priority - b.priority || b.aiScore - a.aiScore
      })
  }, [filters, reports])

  if (user?.role !== 'admin' && user?.role !== 'moderator') {
    return <div className={styles.denied}>Bạn không có quyền truy cập.</div>
  }

  return (
    <main className={styles.page} aria-label="Moderator dashboard">
      <header className={styles.commandHeader}>
        <div className={styles.headerCopy}>
          <h1>Trung tâm kiểm duyệt ZChat</h1>
          <p>Quản lý báo cáo realtime theo 4 nhóm nghiệp vụ: bài viết, tài khoản, bình luận và tin nhắn.</p>
        </div>
        <div className={styles.productivityGrid}>
          <ProductivityMetric icon={FileWarning} label="Chờ xử lý" value={derived.pending.toLocaleString('vi-VN')} />
          <ProductivityMetric icon={Clock3} label="Đang xem xét" value={derived.reviewing.toLocaleString('vi-VN')} />
          <ProductivityMetric icon={CheckCircle2} label="Đã xử lý" value={derived.resolved.toLocaleString('vi-VN')} />
          <ProductivityMetric icon={ShieldCheck} label="Tải hiện tại" value={derived.workload.toLocaleString('vi-VN')} />
        </div>
      </header>

      <section className={styles.quickGrid} aria-label="Nhóm kiểm duyệt">
        <QuickPanel icon={FileWarning} label="Bài viết bị báo cáo" count={typeCounts.post} pending={reports.filter((item) => item.type === 'post' && item.status === 'pending').length} severity="Cao" href="/moderator/posts" />
        <QuickPanel icon={UserRoundX} label="Tài khoản bị báo cáo" count={typeCounts.user} pending={reports.filter((item) => item.type === 'user' && item.status === 'pending').length} severity="Trung bình" href="/moderator/users" />
        <QuickPanel icon={MessageCircleWarning} label="Bình luận bị báo cáo" count={typeCounts.comment} pending={reports.filter((item) => item.type === 'comment' && item.status === 'pending').length} severity="Trung bình" href="/moderator/reports?type=comment" />
        <QuickPanel icon={MessageSquareWarning} label="Tin nhắn bị báo cáo" count={typeCounts.message} pending={reports.filter((item) => item.type === 'message' && item.status === 'pending').length} severity="Nghiêm trọng" href="/moderator/reports?type=message" />
      </section>

      <section className={styles.mainGridSingle}>
        <ModerationQueue reports={filteredReports} filters={filters} onFiltersChange={setFilters} />
      </section>
    </main>
  )
}

function ProductivityMetric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className={styles.productivityMetric}>
      <span><Icon size={16} />{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function QuickPanel({ icon: Icon, label, count, pending, severity, href }: { icon: LucideIcon; label: string; count: number; pending: number; severity: string; href: string }) {
  return (
    <Link to={href} className={styles.quickPanel} aria-label={`${label}, ${pending} báo cáo đang chờ`}>
      <div className={styles.quickHead}>
        <span><Icon size={20} /></span>
        <b>{pending} đang chờ</b>
      </div>
      <h2>{label}</h2>
      <div className={styles.quickMeta}>
        <span>{count.toLocaleString('vi-VN')} tổng cộng</span>
        <em>{severity}</em>
      </div>
      <strong>Mở danh sách</strong>
    </Link>
  )
}

function ModerationQueue({ reports, filters, onFiltersChange }: { reports: ModerationReport[]; filters: FilterState; onFiltersChange: (value: FilterState) => void }) {
  const update = <K extends keyof FilterState>(key: K, value: FilterState[K]) => onFiltersChange({ ...filters, [key]: value })

  return (
    <section className={styles.queuePanel} aria-labelledby="queue-title">
      <div className={styles.queueHeader}>
        <div>
          <p>Danh sách báo cáo</p>
          <h2 id="queue-title">Hàng đợi kiểm duyệt</h2>
        </div>
        <span>{reports.length} báo cáo</span>
      </div>
      <div className={styles.filters}>
        <label className={styles.searchBox}>
          <Search size={16} />
          <input value={filters.search} onChange={(event) => update('search', event.target.value)} placeholder="Tìm báo cáo" aria-label="Tìm báo cáo" />
        </label>
        <select value={filters.type} onChange={(event) => update('type', event.target.value as FilterState['type'])} aria-label="Lọc theo loại">
          <option value="all">Tất cả loại</option>
          <option value="post">Bài viết</option>
          <option value="user">Tài khoản</option>
          <option value="comment">Bình luận</option>
          <option value="message">Tin nhắn</option>
        </select>
        <select value={filters.severity} onChange={(event) => update('severity', event.target.value as FilterState['severity'])} aria-label="Lọc theo mức độ">
          <option value="all">Tất cả mức độ</option>
          <option value="critical">Nghiêm trọng</option>
          <option value="high">Cao</option>
          <option value="medium">Trung bình</option>
          <option value="low">Thấp</option>
        </select>
        <select value={filters.status} onChange={(event) => update('status', event.target.value as FilterState['status'])} aria-label="Lọc theo trạng thái">
          <option value="all">Tất cả trạng thái</option>
          <option value="pending">Chờ xử lý</option>
          <option value="reviewing">Đang xem xét</option>
          <option value="action_taken">Đã hành động</option>
          <option value="resolved">Đã xử lý</option>
          <option value="appeal">Từ chối</option>
        </select>
        <select value={filters.sort} onChange={(event) => update('sort', event.target.value as FilterState['sort'])} aria-label="Sắp xếp">
          <option value="priority">Ưu tiên</option>
          <option value="newest">Mới nhất</option>
        </select>
      </div>

      {reports.length ? (
        <div className={styles.reportList}>
          {reports.map((report) => <ReportCard key={report.id} report={report} />)}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <CheckCircle2 size={38} />
          <h3>Không có báo cáo cần xử lý</h3>
          <p>Không có bài viết, tài khoản, bình luận hoặc tin nhắn mới cần kiểm duyệt.</p>
        </div>
      )}
    </section>
  )
}

function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={cx(styles.severityBadge, styles[`severity_${severity}`])}>
      {severity === 'critical' ? <AlertTriangle size={13} /> : <ShieldCheck size={13} />}
      {severity === 'critical' ? 'Nghiêm trọng' : severity === 'high' ? 'Cao' : severity === 'medium' ? 'Trung bình' : 'Thấp'}
    </span>
  )
}

function ReportCard({ report }: { report: ModerationReport }) {
  return (
    <article className={cx(styles.reportCard, report.severity === 'critical' && styles.reportCritical)}>
      <div className={styles.reportMain}>
        <div>
          <div className={styles.reportBadges}>
            <SeverityBadge severity={report.severity} />
            <span className={cx(styles.statusBadge, styles[`status_${report.status}`])}>{statusLabels[report.status]}</span>
            <span className={styles.typeBadge}>{typeLabels[report.type]}</span>
          </div>
          <h3>{report.subject}</h3>
          <p>{report.reason}</p>
        </div>
        <div className={styles.priorityBox}>
          <span>Ưu tiên</span>
          <strong>P{report.priority}</strong>
        </div>
      </div>
      <div className={styles.reportMeta}>
        <span><Sparkles size={14} />AI {report.aiScore}%</span>
        <span><Clock3 size={14} />{report.createdAt}</span>
        <span><MessageSquareWarning size={14} />{report.reporter || 'Cộng đồng'}</span>
      </div>
      <div className={styles.reportFooter}>
        <span>Người xử lý: {report.assignee || 'Chưa phân công'}</span>
        <div>
          <Link to={`/moderator/report-detail/${report.id}`}>Xem chi tiết</Link>
          <Link to="/moderator/reports">Xử lý ngay</Link>
        </div>
      </div>
    </article>
  )
}
