import { useEffect, useMemo, useState } from 'react'
import { Activity, BarChart3, Flag, MessageSquare, Phone, TrendingUp, Users } from 'lucide-react'

import { api } from '@/api/client'
import { AdminPage, MetricCard, MiniBars, Panel, adminStyles as styles } from '@/components/admin/admin-ui'
import { useAuthStore } from '@/contexts/auth-store'

const realNumber = (value: unknown) => (Number.isFinite(Number(value)) ? Number(value) : 0)

export default function AdminStatisticsPage() {
  const token = useAuthStore((state) => state.accessToken)
  const me = useAuthStore((state) => state.user)
  const [stats, setStats] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!token) return
    api.adminStatistics(token).then((res) => setStats(res.stats || {})).catch(() => undefined)
  }, [token])

  const series = useMemo(() => ({
    platform: [
      realNumber(stats.totalUsers),
      realNumber(stats.totalPosts),
      realNumber(stats.totalComments),
      realNumber(stats.totalReactions),
    ],
    reports: [
      realNumber(stats.pendingReports),
      realNumber(stats.resolvedReports),
    ],
    operations: [
      realNumber(stats.systemActivities),
      realNumber(stats.totalCalls),
    ],
  }), [stats])

  if (me?.role !== 'admin') return <div className={styles.empty}>Bạn không có quyền truy cập.</div>

  return (
    <AdminPage
      eyebrow="Advanced analytics"
      title="Thống kê hệ thống"
      description="Dashboard phân tích số liệu thật từ hệ thống admin: người dùng, nội dung, tương tác, báo cáo và audit log."
    >
      <section className={styles.grid}>
        <MetricCard label="Người dùng" value={stats.totalUsers} icon={<Users size={16} />} />
        <MetricCard label="Bài viết" value={stats.totalPosts} icon={<MessageSquare size={16} />} />
        <MetricCard label="Tương tác" value={stats.totalReactions} icon={<TrendingUp size={16} />} tone="success" />
        <MetricCard label="Báo cáo chờ xử lý" value={stats.pendingReports} icon={<Flag size={16} />} tone="warning" />
      </section>

      <section className={styles.grid3}>
        <Panel title="Platform totals" description="Số liệu thật từ API admin/statistics, không nội suy xu hướng.">
          <MiniBars values={series.platform} labels={['Users', 'Posts', 'Comments', 'Reactions']} />
        </Panel>
        <Panel title="Reports status" description="Tổng số báo cáo đang chờ và đã xử lý.">
          <MiniBars values={series.reports} labels={['Pending', 'Resolved']} />
        </Panel>
      </section>

      <section className={styles.grid3}>
        <Panel title="Operations activity" description="Audit log và cuộc gọi theo số liệu hệ thống.">
          <MiniBars values={series.operations} labels={['Audit logs', 'Calls']} />
        </Panel>
        <Panel title="Real system totals" description="Các chỉ số thật thay cho heatmap/phân tích giả lập.">
          <section className={styles.grid}>
            <MetricCard
              label="Bình luận"
              value={stats.totalComments}
              meta="Tổng comment hiện có"
              icon={<BarChart3 size={16} />}
            />
            <MetricCard
              label="Audit logs"
              value={stats.systemActivities}
              meta="Hoạt động hệ thống"
              icon={<Activity size={16} />}
              tone="success"
            />
            <MetricCard
              label="Cuộc gọi"
              value={stats.totalCalls}
              meta="WebRTC/signaling"
              icon={<Phone size={16} />}
              tone="info"
            />
            <MetricCard
              label="Đã xử lý"
              value={stats.resolvedReports}
              meta="Báo cáo hoàn tất"
              icon={<Flag size={16} />}
              tone="success"
            />
          </section>
        </Panel>
      </section>
    </AdminPage>
  )
}
