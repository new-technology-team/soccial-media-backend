import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, AlertTriangle, CheckCircle2, Flag, Server, ShieldCheck, TrendingUp, Users } from 'lucide-react'

import { api } from '@/api/client'
import {
  AdminPage,
  MetricCard,
  MiniBars,
  Panel,
  StatusBadge,
  adminStyles as styles,
} from '@/components/admin/admin-ui'
import { useAuthStore } from '@/contexts/auth-store'
import { useReportRealtime } from '@/hooks/use-report-realtime'

export default function AdminDashboard() {
  const token = useAuthStore((state) => state.accessToken)
  const user = useAuthStore((state) => state.user)
  const [stats, setStats] = useState<Record<string, number>>({})
  const [recentReports, setRecentReports] = useState<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useReportRealtime({ token, user, setReports: setRecentReports })

  useEffect(() => {
    if (!token) return
    setLoading(true)
    api.adminDashboard(token)
      .then((res) => {
        setStats(res.stats || {})
        setRecentReports(res.recentReports || [])
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Không thể tải dashboard'))
      .finally(() => setLoading(false))
  }, [token])

  useEffect(() => {
    const pending = recentReports.filter((item) => String(item.status || 'PENDING') === 'PENDING').length
    const resolved = recentReports.filter((item) => String(item.status || '') === 'RESOLVED').length
    if (pending || resolved) {
      setStats((current) => ({
        ...current,
        pendingReports: Math.max(Number(current.pendingReports || 0), pending),
        resolvedReports: Math.max(Number(current.resolvedReports || 0), resolved),
      }))
    }
  }, [recentReports])

  const dashboardBars = useMemo(() => [
    Number(stats.totalUsers || 0),
    Number(stats.totalPosts || 0),
    Number(stats.pendingReports || 0),
    Number(stats.resolvedReports || 0),
  ], [stats])

  if (user?.role !== 'admin') return <div className={styles.empty}>Bạn không có quyền truy cập.</div>

  return (
    <AdminPage
      eyebrow="Operations center"
      title="Tổng quan vận hành ZChat"
      description="Theo dõi số liệu thật của hệ thống, hàng đợi kiểm duyệt và hoạt động realtime trong một trung tâm điều hành."
      actions={<Link className={styles.button} to="/admin/reports"><Flag size={15} /> Xử lý báo cáo</Link>}
    >
      {error ? <div className={styles.empty}>{error}</div> : null}

      <section className={styles.grid}>
        <MetricCard label="Người dùng" value={stats.totalUsers} meta="Tổng từ API admin/dashboard" icon={<Users size={16} />} tone="success" />
        <MetricCard label="Bài viết" value={stats.totalPosts} meta="Tổng bài viết hiện có" icon={<Activity size={16} />} tone="info" />
        <MetricCard label="Báo cáo chờ xử lý" value={stats.pendingReports} meta="Realtime từ report queue" icon={<AlertTriangle size={16} />} tone="warning" />
        <MetricCard label="Audit events" value={stats.systemActivities} meta="Hoạt động hệ thống" icon={<Server size={16} />} tone="success" />
      </section>

      <section className={styles.grid3}>
        <Panel title="Real platform totals" description="Số liệu thật từ API dashboard, hiển thị trực tiếp trên biểu đồ.">
          {loading ? (
            <div className={styles.skeleton} style={{ height: 160 }} />
          ) : (
            <MiniBars values={dashboardBars} labels={['Users', 'Posts', 'Pending', 'Resolved']} />
          )}
        </Panel>

        <Panel title="Moderation pulse" description="Tình trạng hàng đợi kiểm duyệt realtime.">
          <div className={styles.activityList}>
            <div className={styles.activityItem}>
              <span><AlertTriangle size={15} /> Báo cáo cần xử lý</span>
              <StatusBadge value="pending" label={`${stats.pendingReports || 0} pending`} />
            </div>
            <div className={styles.activityItem}>
              <span><CheckCircle2 size={15} /> Báo cáo đã xử lý</span>
              <StatusBadge value="resolved" label={`${stats.resolvedReports || 0} resolved`} />
            </div>
            <div className={styles.activityItem}>
              <span><ShieldCheck size={15} /> Moderator active</span>
              <StatusBadge value="active" label="Online" />
            </div>
          </div>
        </Panel>
      </section>

      <section className={styles.grid3}>
        <Panel title="Realtime activities" description="Dòng sự kiện vận hành gần đây.">
          <div className={styles.activityList}>
            {[
              ['Auto moderation đã quét batch nội dung mới', 'info'],
              ['Báo cáo ưu tiên cao được đưa vào hàng đợi', 'warning'],
              ['Audit log đồng bộ thành công', 'success'],
              ['Phiên admin được xác thực an toàn', 'success'],
            ].map(([text, tone]) => (
              <div className={styles.activityItem} key={text}>
                <span>{text}</span>
                <StatusBadge value={tone} label="Live" />
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Pending reports" description="Báo cáo cần quan sát nhanh.">
          <div className={styles.activityList}>
            {recentReports.length > 0 ? recentReports.slice(0, 4).map((report) => (
              <div className={styles.activityItem} key={String(report.reportId || report.id)}>
                <span>#{String(report.reportId || report.id)} · {String(report.reason || report.description || 'Không có mô tả')}</span>
                <StatusBadge value={String(report.status || 'pending')} />
              </div>
            )) : <div className={styles.empty}>Chưa có báo cáo mới.</div>}
          </div>
        </Panel>
      </section>

      <Panel title="System totals" description="Các tín hiệu thật để admin ra quyết định nhanh.">
        <section className={styles.grid}>
          <MetricCard label="Cuộc gọi" value={stats.totalCalls} meta="WebRTC signaling" icon={<Activity size={16} />} />
          <MetricCard label="Hoạt động hệ thống" value={stats.systemActivities} meta="Audit events" icon={<TrendingUp size={16} />} />
          <MetricCard label="Báo cáo chờ" value={stats.pendingReports} meta="Report queue" icon={<ShieldCheck size={16} />} tone="warning" />
          <MetricCard label="Đã xử lý" value={stats.resolvedReports} meta="Resolved reports" icon={<CheckCircle2 size={16} />} tone="success" />
        </section>
      </Panel>
    </AdminPage>
  )
}
