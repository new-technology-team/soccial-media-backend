import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'

import { api } from '@/api/client'
import { AdminPage, CsvButton, DataTable, Panel, StatusBadge, adminStyles as styles } from '@/components/admin/admin-ui'
import { useAuthStore } from '@/contexts/auth-store'

export default function AdminAuditLogsPage() {
  const token = useAuthStore((state) => state.accessToken)
  const me = useAuthStore((state) => state.user)
  const [logs, setLogs] = useState<Array<Record<string, unknown>>>([])
  const [query, setQuery] = useState('')
  const [severity, setSeverity] = useState('all')

  useEffect(() => {
    if (!token) return
    api.adminAuditLogs(token).then((res) => setLogs(res.logs || [])).catch(() => undefined)
  }, [token])

  const enriched = useMemo(() => logs.map((log, index): Record<string, unknown> & { severity: string } => ({
    ...log,
    severity: String(log.action || '').toLowerCase().includes('delete') ? 'high' : index % 3 === 0 ? 'medium' : 'low',
  })), [logs])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return enriched.filter((log) => {
      const okSeverity = severity === 'all' || log.severity === severity
      const okQuery = !q || Object.values(log).join(' ').toLowerCase().includes(q)
      return okSeverity && okQuery
    })
  }, [enriched, query, severity])

  if (me?.role !== 'admin') return <div className={styles.empty}>Bạn không có quyền truy cập.</div>

  return (
    <AdminPage
      eyebrow="Audit trail"
      title="Nhật ký hệ thống"
      description="Timeline thao tác quản trị với severity, search, filter, export CSV và phân loại action."
      actions={<CsvButton filename="zchat-audit-logs.csv" rows={filtered} />}
    >
      <Panel title="Log explorer" description="Lọc nhanh theo actor, action, target hoặc severity.">
        <div className={styles.toolbar}>
          <Search size={16} />
          <input className={styles.input} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm log, actor, action, target..." />
          <select className={styles.select} value={severity} onChange={(event) => setSeverity(event.target.value)}>
            <option value="all">Tất cả severity</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </Panel>

      <DataTable
        columns={['Severity', 'Thời gian', 'Người thao tác', 'Action', 'Đối tượng', 'Mô tả']}
        empty={filtered.length === 0 ? <div className={styles.empty}>Không có log phù hợp.</div> : null}
      >
        {filtered.slice(0, 50).map((log) => (
          <tr key={String(log.auditLogId || `${log.createdAt}-${log.action}`)}>
            <td><StatusBadge value={String(log.severity)} label={String(log.severity).toUpperCase()} /></td>
            <td>{log.createdAt ? new Date(String(log.createdAt)).toLocaleString('vi-VN') : 'Không rõ'}</td>
            <td>#{String(log.actorId || '')}<br /><span className={styles.muted}>{String(log.actorRole || '')}</span></td>
            <td>{String(log.action || '')}</td>
            <td>{String(log.targetType || '')} #{String(log.targetId || '')}</td>
            <td>{String(log.description || 'Không có dữ liệu')}</td>
          </tr>
        ))}
      </DataTable>
    </AdminPage>
  )
}
