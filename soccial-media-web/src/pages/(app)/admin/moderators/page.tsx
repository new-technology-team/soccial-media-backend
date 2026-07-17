import { useEffect, useMemo, useState } from 'react'
import { Lock, Plus, Search, Shield, Trash2, Unlock } from 'lucide-react'

import { api } from '@/api/client'
import { AppDialog, DialogButton } from '@/components/dialogs'
import {
  ActionMenu,
  AdminPage,
  ConfirmAction,
  MetricCard,
  Panel,
  StatusBadge,
  UserCell,
  adminStyles as styles,
} from '@/components/admin/admin-ui'
import { useAuthStore } from '@/contexts/auth-store'
import { toast } from '@/hooks/use-toast'
import type { User } from '@/types'

export default function AdminModeratorsPage() {
  const token = useAuthStore((state) => state.accessToken)
  const me = useAuthStore((state) => state.user)
  const [moderators, setModerators] = useState<User[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<User | null>(null)
  const [query, setQuery] = useState('')
  const [form, setForm] = useState({ username: '', password: '', displayName: '' })

  const loadModerators = async () => {
    if (!token) return
    const res = await api.adminModerators(token)
    setModerators(res.moderators)
  }

  useEffect(() => {
    loadModerators().catch(() => undefined)
  }, [token])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return moderators.filter((item) => !q || [item.fullName, item.email, item.phone, item.id].join(' ').toLowerCase().includes(q))
  }, [moderators, query])

  const createModerator = async () => {
    if (!token) return
    if (!form.username.trim() || !form.password.trim()) {
      toast({ title: 'Thiếu thông tin moderator', description: 'Vui lòng nhập tên đăng nhập và mật khẩu.', variant: 'destructive' })
      return
    }
    await api.createModerator(token, form)
    toast({ title: `Đã tạo kiểm duyệt viên "${form.displayName || form.username}"`, description: 'Tài khoản mới chỉ có quyền moderation.' })
    setCreateOpen(false)
    setForm({ username: '', password: '', displayName: '' })
    await loadModerators()
  }

  const updateStatus = async (moderator: User, accountStatus: User['accountStatus']) => {
    if (!token) return
    await api.updateModeratorPermissions(token, moderator.id, { role: 'moderator', accountStatus })
    toast({ title: accountStatus === 'locked' ? `Đã khóa moderator "${moderator.fullName}"` : `Đã mở khóa moderator "${moderator.fullName}"` })
    await loadModerators()
  }

  const deleteModerator = async () => {
    if (!token || !removeTarget) return
    await api.deleteModerator(token, removeTarget.id)
    toast({ title: `Đã xóa kiểm duyệt viên "${removeTarget.fullName}"` })
    setRemoveTarget(null)
    await loadModerators()
  }

  if (me?.role !== 'admin') return <div className={styles.empty}>Bạn không có quyền truy cập.</div>

  return (
    <AdminPage
      eyebrow="Moderator workforce"
      title="Quản lý kiểm duyệt viên"
      description="Theo dõi workload, trạng thái hoạt động, quyền xử lý báo cáo và phân bổ đội moderation."
      actions={<button type="button" className={styles.button} onClick={() => setCreateOpen(true)}><Plus size={15} /> Tạo moderator</button>}
    >
      <section className={styles.grid}>
        <MetricCard label="Moderator" value={moderators.length} icon={<Shield size={16} />} />
        <MetricCard label="Đang hoạt động" value={moderators.filter((item) => item.accountStatus === 'active').length} tone="success" />
        <MetricCard label="Workload trung bình" value="18" meta="reports / ngày" tone="info" />
        <MetricCard label="SLA xử lý" value="92%" meta="đúng hạn" tone="success" />
      </section>

      <Panel title="Danh sách kiểm duyệt viên" description="Quản lý khối lượng công việc và trạng thái để điều phối nhanh.">
        <div className={styles.toolbar}>
          <Search size={16} />
          <input className={styles.input} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm moderator" />
        </div>
        <section className={styles.grid}>
          {filtered.map((item, index) => {
            const isLocked = ['locked', 'temp_locked', 'restricted'].includes(item.accountStatus)
            return (
              <article className={styles.card} key={item.id}>
                <div className={styles.cardTop}>
                  <UserCell user={item} />
                  <ActionMenu
                    items={[
                      isLocked
                        ? { label: 'Mở khóa', icon: <Unlock size={15} />, onClick: () => void updateStatus(item, 'active') }
                        : { label: 'Khóa', icon: <Lock size={15} />, onClick: () => void updateStatus(item, 'locked') },
                      { label: 'Xóa moderator', icon: <Trash2 size={15} />, danger: true, onClick: () => setRemoveTarget(item) },
                    ]}
                  />
                </div>
                <div className={styles.inline}>
                  <StatusBadge value={item.accountStatus} />
                </div>
                <div className={styles.activityList}>
                  <div className={styles.activityItem}><span>Reports handled</span><b>{24 + index * 7}</b></div>
                  <div className={styles.activityItem}><span>Workload</span><b>{index % 2 ? 'Medium' : 'High'}</b></div>
                  <div className={styles.activityItem}><span>Last active</span><b>{index + 1}h trước</b></div>
                </div>
              </article>
            )
          })}
        </section>
        {filtered.length === 0 ? <div className={styles.empty}>Chưa có moderator phù hợp.</div> : null}
      </Panel>

      <AppDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Tạo kiểm duyệt viên"
        description="Tài khoản mới chỉ có quyền moderation, không có quyền cấu hình hệ thống."
        footer={<><DialogButton variant="secondary" onClick={() => setCreateOpen(false)}>Hủy</DialogButton><DialogButton onClick={() => void createModerator()}>Xác nhận</DialogButton></>}
      >
        <div className={styles.profileList}>
          <label>Tên hiển thị<input className={styles.input} value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} /></label>
          <label>Tên đăng nhập<input className={styles.input} value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} /></label>
          <label>Mật khẩu<input className={styles.input} type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
        </div>
      </AppDialog>

      <ConfirmAction
        open={Boolean(removeTarget)}
        title="Xóa kiểm duyệt viên?"
        description={`Tài khoản ${removeTarget?.fullName || ''} sẽ bị chuyển sang trạng thái deleted.`}
        confirmText="Xóa moderator"
        requireText="DELETE"
        onCancel={() => setRemoveTarget(null)}
        onConfirm={deleteModerator}
      />
    </AdminPage>
  )
}
