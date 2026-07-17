import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock3, Eye, MoreVertical, ShieldAlert, UserRound, X } from 'lucide-react'

import { api } from '@/api/client'
import { AppDialog, DialogButton } from '@/components/dialogs'
import { useAuthStore } from '@/contexts/auth-store'
import { useUserRealtime } from '@/hooks/use-user-realtime'
import { toast } from '@/hooks/use-toast'
import type { User } from '@/types'
import styles from './page.module.css'

const ACCOUNT_LABEL: Record<string, string> = {
  active: 'Đang hoạt động',
  warning: 'Đã cảnh cáo',
  restricted: 'Bị hạn chế',
  temp_locked: 'Tạm khóa',
  locked: 'Đã khóa',
  hidden: 'Đã ẩn',
  deleted: 'Đã xóa',
}

type ActionType = 'warn' | 'restrict' | 'temp-lock' | 'restore'

export default function ModeratorUsersPage() {
  const token = useAuthStore((state) => state.accessToken)
  const me = useAuthStore((state) => state.user)
  const [users, setUsers] = useState<User[]>([])
  const [keyword, setKeyword] = useState('')
  const [action, setAction] = useState<{ user: User; type: ActionType; title: string } | null>(null)
  const [reason, setReason] = useState('')
  const [actionMenuUserId, setActionMenuUserId] = useState<number | null>(null)
  const [detailUser, setDetailUser] = useState<User | null>(null)

  const loadUsers = async () => {
    if (!token) return
    const res = await api.moderationUsers(token)
    setUsers(res.users.filter((item) => item.role !== 'admin'))
  }

  useEffect(() => {
    loadUsers().catch(() => undefined)
  }, [token])

  useUserRealtime({ token, user: me, setUsers, setSelectedUser: setDetailUser })

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase()
    return users.filter((item) => !q || [item.fullName, item.email, item.phone, item.id, item.username].join(' ').toLowerCase().includes(q))
  }, [keyword, users])

  const submit = async () => {
    if (!token || !action) return
    if (action.type === 'warn') await api.warnModerationUser(token, action.user.id, reason)
    else if (action.type === 'restrict') await api.restrictModerationUser(token, action.user.id, reason)
    else if (action.type === 'temp-lock') await api.tempLockModerationUser(token, action.user.id, reason)
    else if (action.type === 'restore') await api.restoreModerationUser(token, action.user.id)
    toast({
      title:
        action.type === 'warn' ? `Đã cảnh cáo ${action.user.fullName}`
        : action.type === 'restrict' ? `Đã hạn chế ${action.user.fullName}`
        : action.type === 'temp-lock' ? `Đã tạm khóa ${action.user.fullName}`
        : `Đã khôi phục ${action.user.fullName}`,
      description: 'Người dùng sẽ nhận được thông báo về hành động kiểm duyệt này.',
    })
    setAction(null)
    setReason('')
  }

  const canRestore = (status: string) => status === 'restricted' || status === 'temp_locked' || status === 'warning'

  if (me?.role !== 'admin' && me?.role !== 'moderator') return <div className={styles.denied}>Bạn không có quyền truy cập.</div>

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Trung tâm kiểm duyệt</p>
          <h1>Kiểm duyệt người dùng</h1>
          <p>Rà soát tài khoản có rủi ro, xem chi tiết người dùng và thực hiện hành động kiểm duyệt rõ ràng.</p>
        </div>
      </header>
      <section className={styles.toolbar}>
        <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Tìm tài khoản..." />
        <button type="button" className={styles.secondary} onClick={loadUsers}>Làm mới</button>
      </section>
      <section className={styles.panel}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Tài khoản</th>
              <th>Trạng thái</th>
              <th>Lịch sử kiểm duyệt</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.id}>
                <td>
                  <b>{item.fullName}</b>
                  {item.username ? <br /> : null}
                  {item.username ? <small style={{ color: '#64748b', fontSize: '0.75rem' }}>@{item.username}</small> : null}<br />
                  <small>{item.email || item.phone || `ID ${item.id}`}</small>
                </td>
                <td>
                  <span className={`${styles.badge} ${styles[item.accountStatus] || ''}`}>
                    {ACCOUNT_LABEL[item.accountStatus] || item.accountStatus}
                  </span>
                </td>
                <td>
                  {item.warningCount || 0} cảnh cáo<br />
                  <small>{item.restrictionReason || 'Không có ghi chú kiểm duyệt đang áp dụng'}</small>
                </td>
                <td>
                  <div className={styles.actions}>
                    <button type="button" className={styles.secondary} onClick={() => setDetailUser(item)}><Eye size={15} /> Chi tiết</button>
                    <div className={styles.menuWrap}>
                      <button type="button" className={styles.iconButton} onClick={() => setActionMenuUserId((current) => current === item.id ? null : item.id)} aria-label="Mở menu thao tác">
                        <MoreVertical size={16} />
                      </button>
                      {actionMenuUserId === item.id ? (
                        <div className={styles.actionMenu}>
                          <Link to={`/profile/${item.username || item.id}`} target="_blank" rel="noopener noreferrer">Xem hồ sơ</Link>
                          <button type="button" onClick={() => { setAction({ user: item, type: 'warn', title: 'Cảnh cáo người dùng?' }); setActionMenuUserId(null) }}>Cảnh cáo</button>
                          <button type="button" onClick={() => { setAction({ user: item, type: 'restrict', title: 'Hạn chế tài khoản?' }); setActionMenuUserId(null) }}>Hạn chế</button>
                          <button type="button" className={styles.menuDanger} onClick={() => { setAction({ user: item, type: 'temp-lock', title: 'Tạm khóa tài khoản?' }); setActionMenuUserId(null) }}>Tạm khóa</button>
                          {canRestore(item.accountStatus) ? (
                            <button type="button" onClick={() => { setAction({ user: item, type: 'restore', title: 'Khôi phục tài khoản?' }); setActionMenuUserId(null) }}>Khôi phục</button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 ? <p className={styles.empty}>Không có người dùng phù hợp với tìm kiếm hiện tại.</p> : null}
      </section>

      <AppDialog
        open={Boolean(action)}
        onOpenChange={(open) => !open && setAction(null)}
        title={action?.title || ''}
        description={action?.type === 'restore' ? 'Khôi phục tài khoản về trạng thái hoạt động bình thường.' : 'Thêm ghi chú kiểm duyệt để lưu vào lịch sử xử lý.'}
        footer={
          <>
            <DialogButton variant="secondary" onClick={() => setAction(null)}>Hủy</DialogButton>
            <DialogButton variant="destructive" onClick={() => void submit()}>Xác nhận</DialogButton>
          </>
        }
      >
        <div className={styles.modalForm}>
          {action?.type !== 'restore' ? (
            <label>
              Lý do kiểm duyệt
              <textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Nhập lý do..." />
            </label>
          ) : (
            <p>Tài khoản <strong>{action?.user.fullName}</strong>{action?.user.username ? <> (<small>@{action?.user.username}</small>)</> : null} sẽ được khôi phục về trạng thái hoạt động bình thường.</p>
          )}
        </div>
      </AppDialog>

      {detailUser ? (
        <aside className={styles.drawerBackdrop} role="presentation" onClick={() => setDetailUser(null)}>
          <section className={styles.drawer} role="dialog" aria-label="Chi tiết người dùng" onClick={(event) => event.stopPropagation()}>
            <header className={styles.drawerHeader}>
              <div>
                <p className={styles.eyebrow}>Chi tiết người dùng</p>
                <h2>{detailUser.fullName}</h2>
                {detailUser.username ? <p style={{ margin: '2px 0 0', color: '#64748b', fontSize: '0.8rem' }}>@{detailUser.username}</p> : null}
              </div>
              <button type="button" onClick={() => setDetailUser(null)} aria-label="Đóng"><X size={17} /></button>
            </header>
            <div className={styles.userHero}>
              {detailUser.avatarUrl ? <img src={detailUser.avatarUrl} alt={detailUser.fullName} /> : <span>{(detailUser.fullName[0] || 'U').toUpperCase()}</span>}
              <div>
                <b>{detailUser.email || detailUser.phone || `ID ${detailUser.id}`}</b>
                {detailUser.username ? <><br /><small style={{ color: '#64748b' }}>@{detailUser.username}</small></> : null}
                <br />
                <small>{ACCOUNT_LABEL[detailUser.accountStatus] || detailUser.accountStatus}</small>
              </div>
            </div>
            <div className={styles.historyList}>
              <h3><Clock3 size={16} /> Lịch sử kiểm duyệt</h3>
              <article>
                <ShieldAlert size={15} />
                <span><b>{detailUser.warningCount || 0} cảnh cáo</b><small>{detailUser.restrictionReason || 'Không có ghi chú hạn chế hiện tại.'}</small></span>
              </article>
              <article>
                <UserRound size={15} />
                <span><b>Trạng thái tài khoản</b><small>{ACCOUNT_LABEL[detailUser.accountStatus] || detailUser.accountStatus}</small></span>
              </article>
            </div>
          </section>
        </aside>
      ) : null}
    </main>
  )
}
