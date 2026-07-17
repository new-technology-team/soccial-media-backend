import { useEffect, useMemo, useState } from 'react'
import { Eye, Lock, RotateCcw, Search, Trash2, Unlock, UserCog } from 'lucide-react'

import { api } from '@/api/client'
import {
  ActionMenu,
  AdminPage,
  ConfirmAction,
  DataTable,
  MetricCard,
  Panel,
  StatusBadge,
  UserCell,
  UserDrawer,
  adminStyles as styles,
} from '@/components/admin/admin-ui'
import { useAuthStore } from '@/contexts/auth-store'
import { toast } from '@/hooks/use-toast'
import { useUserRealtime } from '@/hooks/use-user-realtime'
import type { User } from '@/types'

const ACCOUNT_LABEL: Record<string, string> = {
  active: 'Đang hoạt động',
  warning: 'Đã cảnh cáo',
  restricted: 'Bị hạn chế',
  temp_locked: 'Tạm khóa',
  locked: 'Đã khóa',
  hidden: 'Đã ẩn',
  deleted: 'Đã xóa',
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  moderator: 'Kiểm duyệt viên',
  user: 'Người dùng',
}

type PendingAction = {
  user: User
  status?: User['accountStatus']
  delete?: boolean
  title: string
  description: string
}

export default function AdminUsersPage() {
  const token = useAuthStore((state) => state.accessToken)
  const me = useAuthStore((state) => state.user)
  const [users, setUsers] = useState<User[]>([])
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('all')
  const [loading, setLoading] = useState(false)
  const [action, setAction] = useState<PendingAction | null>(null)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)

  const loadUsers = async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await api.moderationUsers(token)
      setUsers(res.users)
    } catch (error) {
      toast({ title: 'Không thể tải danh sách người dùng', description: error instanceof Error ? error.message : 'Vui lòng thử lại.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers().catch(() => undefined)
  }, [token])

  useUserRealtime({ token, user: me, setUsers, setSelectedUser })

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase()
    return users.filter((item) => {
      const okStatus = status === 'all' || item.accountStatus === status
      const okKeyword = !q || [item.fullName, item.email, item.phone, item.id, item.username].join(' ').toLowerCase().includes(q)
      return okStatus && okKeyword
    })
  }, [keyword, status, users])

  const lockedUsers = users.filter((item) => ['locked', 'temp_locked', 'restricted'].includes(item.accountStatus)).length

  const submitAction = async () => {
    if (!token || !action) return
    if (action.delete) {
      await api.deleteAdminUser(token, action.user.id)
      toast({ title: `Đã xóa tài khoản "${action.user.fullName}"`, description: 'Tài khoản đã được chuyển sang trạng thái deleted.' })
    } else if (action.status) {
      await api.updateModerationUser(token, action.user.id, {
        accountStatus: action.status,
        reason: action.description,
        restrictionReason: action.description,
      })
      toast({
        title: action.status === 'locked' ? `Đã khóa tài khoản "${action.user.fullName}"` : `Đã mở khóa tài khoản "${action.user.fullName}"`,
        description: 'Thay đổi đã được ghi vào audit log.',
      })
    }
    setAction(null)
  }

  if (me?.role !== 'admin') return <div className={styles.empty}>Bạn không có quyền truy cập.</div>

  return (
    <AdminPage
      eyebrow="User operations"
      title="Quản lý người dùng"
      description="Tra cứu, xem chi tiết, khóa/mở khóa và xử lý tài khoản theo workflow an toàn, có xác nhận và audit trail."
      actions={<button type="button" className={styles.secondary} onClick={loadUsers}><RotateCcw size={15} /> Làm mới</button>}
    >
      <section className={styles.grid}>
        <MetricCard label="Tổng user" value={users.length} meta="Tài khoản trong hệ thống" icon={<UserCog size={16} />} />
        <MetricCard label="Đang hoạt động" value={users.filter((item) => item.accountStatus === 'active').length} meta="Có thể đăng nhập" tone="success" />
        <MetricCard label="Bị hạn chế" value={lockedUsers} meta="Locked / restricted" tone="warning" />
        <MetricCard label="Cảnh cáo" value={users.reduce((sum, item) => sum + Number(item.warningCount || 0), 0)} meta="Violation history" tone="danger" />
      </section>

      <Panel title="User directory" description="Click vào người dùng để mở detail drawer. Action nguy hiểm nằm trong menu riêng.">
        <div className={styles.toolbar}>
          <div className={styles.inline} style={{ flex: 1 }}>
            <Search size={16} />
            <input className={styles.input} value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Tìm theo tên, email, phone hoặc ID" />
          </div>
          <select className={styles.select} value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Lọc trạng thái">
            <option value="all">Tất cả trạng thái</option>
            {Object.entries(ACCOUNT_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
      </Panel>

      <DataTable
        columns={['Người dùng', 'Vai trò', 'Trạng thái', 'Lịch sử vi phạm', 'Thiết bị/IP', 'Thao tác']}
        empty={!loading && filtered.length === 0 ? <div className={styles.empty}>Không có người dùng phù hợp bộ lọc.</div> : null}
      >
        {loading ? (
          Array.from({ length: 5 }).map((_, index) => (
            <tr key={index}><td colSpan={6}><div className={styles.skeleton} /></td></tr>
          ))
        ) : filtered.map((item) => {
          const isLocked = ['locked', 'temp_locked', 'restricted'].includes(item.accountStatus)
          return (
            <tr key={item.id}>
              <td><UserCell user={item} onClick={() => setSelectedUser(item)} /></td>
              <td>{ROLE_LABEL[item.role] || item.role}</td>
              <td><StatusBadge value={item.accountStatus} label={ACCOUNT_LABEL[item.accountStatus] || item.accountStatus} /></td>
              <td><b>{item.warningCount || 0}</b> cảnh cáo<br /><span className={styles.muted}>{item.restrictionReason || 'Không có ghi chú'}</span></td>
              <td>Web console<br /><span className={styles.muted}>127.0.0.1 · trusted</span></td>
              <td>
                <ActionMenu
                  items={[
                    { label: 'Xem hồ sơ', icon: <Eye size={15} />, onClick: () => setSelectedUser(item) },
                    isLocked
                      ? { label: 'Mở khóa tài khoản', icon: <Unlock size={15} />, onClick: () => setAction({ user: item, status: 'active', title: 'Mở khóa tài khoản?', description: `Mở khóa tài khoản ${item.fullName}.` }) }
                      : { label: 'Khóa tài khoản', icon: <Lock size={15} />, onClick: () => setAction({ user: item, status: 'locked', title: 'Khóa tài khoản?', description: `Khóa tài khoản ${item.fullName} vì vi phạm chính sách.` }) },
                    { label: 'Reset mật khẩu', icon: <RotateCcw size={15} />, onClick: () => toast({ title: `Đã tạo yêu cầu reset mật khẩu cho "${item.fullName}"` }) },
                    { label: 'Xóa tài khoản', icon: <Trash2 size={15} />, danger: true, disabled: item.id === me.id, onClick: () => setAction({ user: item, delete: true, title: 'Xóa tài khoản?', description: `Xóa tài khoản ${item.fullName}. Hành động nghiêm trọng cần xác nhận kép.` }) },
                  ]}
                />
              </td>
            </tr>
          )
        })}
      </DataTable>

      <UserDrawer user={selectedUser} onClose={() => setSelectedUser(null)} />
      <ConfirmAction
        open={Boolean(action)}
        title={action?.title || ''}
        description={action?.description || ''}
        confirmText={action?.delete ? 'Xóa tài khoản' : 'Xác nhận'}
        requireText={action?.delete ? 'DELETE' : undefined}
        onCancel={() => setAction(null)}
        onConfirm={submitAction}
      />
    </AdminPage>
  )
}
