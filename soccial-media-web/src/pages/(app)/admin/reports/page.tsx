import { useEffect, useMemo, useState } from 'react'
import { Flag, Search, UserCheck } from 'lucide-react'

import { api } from '@/api/client'
import { AppDialog, DialogButton } from '@/components/dialogs'
import { AdminPage, ActionMenu, DataTable, MetricCard, Panel, SeverityBadge, StatusBadge, adminStyles as styles } from '@/components/admin/admin-ui'
import { useAuthStore } from '@/contexts/auth-store'
import { useReportRealtime } from '@/hooks/use-report-realtime'
import { toast } from '@/hooks/use-toast'
import type { User } from '@/types'

const REPORT_LABEL: Record<string, string> = {
  PENDING: 'Chờ xử lý',
  IN_REVIEW: 'Đang xem xét',
  RESOLVED: 'Đã xử lý',
  REJECTED: 'Đã từ chối',
}

const TARGET_LABEL: Record<string, string> = {
  POST: 'Bài viết',
  COMMENT: 'Bình luận',
  MESSAGE: 'Tin nhắn',
  USER: 'Người dùng',
}

function targetLabel(report: Record<string, unknown>) {
  const type = String(report.reportType || report.targetType || '').toUpperCase()
  return TARGET_LABEL[type] || 'Không rõ'
}

export default function AdminReportsPage() {
  const token = useAuthStore((state) => state.accessToken)
  const me = useAuthStore((state) => state.user)
  const [reports, setReports] = useState<Array<Record<string, unknown>>>([])
  const [moderators, setModerators] = useState<User[]>([])
  const [status, setStatus] = useState('all')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null)
  const [assignedTo, setAssignedTo] = useState('')

  useReportRealtime({ token, user: me, setReports })

  const load = async () => {
    if (!token) return
    const [reportRes, moderatorRes] = await Promise.all([api.adminReports(token, status), api.adminModerators(token)])
    setReports(reportRes.reports)
    setModerators(moderatorRes.moderators)
  }

  useEffect(() => {
    load().catch(() => undefined)
  }, [token, status])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return reports.filter((report) => !q || Object.values(report).join(' ').toLowerCase().includes(q))
  }, [query, reports])

  const assign = async () => {
    if (!token || !selected) return
    await api.assignAdminReport(token, Number(selected.reportId || selected.id), assignedTo ? Number(assignedTo) : null)
    const moderator = moderators.find((item) => String(item.id) === assignedTo)
    toast({
      title: `Đã phân công báo cáo #${String(selected.reportId || selected.id)}`,
      description: moderator ? `Người xử lý: ${moderator.fullName}` : 'Báo cáo đang ở hàng đợi chung.',
    })
    setSelected(null)
    await load()
  }

  if (me?.role !== 'admin') return <div className={styles.empty}>Bạn không có quyền truy cập.</div>

  return (
    <AdminPage
      eyebrow="Report operations"
      title="Quản lý báo cáo"
      description="Hàng đợi báo cáo với severity, assignment workflow, owner rõ ràng và trạng thái xử lý."
    >
      <section className={styles.grid}>
        <MetricCard label="Tổng báo cáo" value={reports.length} icon={<Flag size={16} />} />
        <MetricCard label="Chờ xử lý" value={reports.filter((item) => String(item.status || 'PENDING') === 'PENDING').length} tone="warning" />
        <MetricCard label="Đang review" value={reports.filter((item) => String(item.status || '') === 'IN_REVIEW').length} tone="info" />
        <MetricCard label="Moderator active" value={moderators.length} icon={<UserCheck size={16} />} tone="success" />
      </section>

      <Panel title="Report queue" description="Phân công báo cáo nhanh cho moderator phù hợp.">
        <div className={styles.toolbar}>
          <Search size={16} />
          <input className={styles.input} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm báo cáo" />
          <select className={styles.select} value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">Tất cả báo cáo</option>
            {Object.entries(REPORT_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
      </Panel>

      <DataTable columns={['Báo cáo', 'Đối tượng', 'Severity', 'Trạng thái', 'Phân công', 'Thao tác']} empty={filtered.length === 0 ? <div className={styles.empty}>Không có báo cáo phù hợp.</div> : null}>
        {filtered.map((report, index) => {
          const currentStatus = String(report.status || 'PENDING')
          const score = Math.min(95, 35 + index * 11)
          return (
            <tr key={String(report.reportId || report.id)}>
              <td><b>#{String(report.reportId || report.id)}</b><br /><span className={styles.muted}>{String(report.reason || report.description || 'Không có mô tả')}</span></td>
              <td>{targetLabel(report)} #{String(report.targetId || '')}</td>
              <td><SeverityBadge value={score} /></td>
              <td><StatusBadge value={currentStatus.toLowerCase()} label={REPORT_LABEL[currentStatus] || currentStatus} /></td>
              <td>{report.assignedTo ? `#${report.assignedTo}` : 'Chưa phân công'}</td>
              <td>
                <ActionMenu
                  items={[
                    { label: 'Phân công moderator', icon: <UserCheck size={15} />, onClick: () => setSelected(report) },
                    { label: 'Đưa vào review', icon: <Flag size={15} />, onClick: () => toast({ title: `Đã đưa báo cáo #${String(report.reportId || report.id)} vào review` }) },
                  ]}
                />
              </td>
            </tr>
          )
        })}
      </DataTable>

      <AppDialog
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
        title="Phân công báo cáo"
        description="Báo cáo sẽ chuyển sang workflow đang xem xét."
        footer={<><DialogButton variant="secondary" onClick={() => setSelected(null)}>Hủy</DialogButton><DialogButton onClick={() => void assign()}>Xác nhận</DialogButton></>}
      >
        <div className={styles.profileList}>
          <label>Kiểm duyệt viên
            <select className={styles.select} value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)}>
              <option value="">Hàng đợi chung</option>
              {moderators.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}
            </select>
          </label>
        </div>
      </AppDialog>
    </AdminPage>
  )
}
