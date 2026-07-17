import { useEffect, useMemo, useState } from 'react'
import type React from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Download,
  Eye,
  MoreHorizontal,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react'

import type { User } from '@/types'
import styles from './admin-ui.module.css'

type ActionItem = {
  label: string
  icon?: React.ReactNode
  danger?: boolean
  disabled?: boolean
  onClick: () => void
}

export function AdminPage({
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  eyebrow: string
  title: string
  description: string
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {actions ? <div className={styles.heroActions}>{actions}</div> : null}
      </header>
      {children}
    </main>
  )
}

export function MetricCard({
  label,
  value,
  meta,
  icon,
  tone = 'info',
}: {
  label: string
  value?: number | string
  meta?: string
  icon?: React.ReactNode
  tone?: 'success' | 'warning' | 'danger' | 'info'
}) {
  return (
    <article className={styles.card}>
      <div className={styles.cardTop}>
        <div>
          <div className={styles.cardLabel}>{label}</div>
          <div className={styles.cardValue}>{typeof value === 'number' ? value.toLocaleString('vi-VN') : value || '0'}</div>
        </div>
        <span className={`${styles.badge} ${styles[tone]}`}>{icon}</span>
      </div>
      {meta ? <div className={styles.cardMeta}>{meta}</div> : null}
    </article>
  )
}

export function Panel({
  title,
  description,
  action,
  children,
}: {
  title?: string
  description?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className={styles.panel}>
      {title ? (
        <div className={styles.panelHeader}>
          <div>
            <h2 className={styles.panelTitle}>{title}</h2>
            {description ? <p className={styles.panelText}>{description}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  )
}

export function DataTable({
  columns,
  children,
  empty,
}: {
  columns: string[]
  children: React.ReactNode
  empty?: React.ReactNode
}) {
  return (
    <section className={styles.tablePanel}>
      <div className={styles.tableScroller}>
        <table className={styles.table}>
          <thead>
            <tr>{columns.map((item) => <th key={item}>{item}</th>)}</tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
      {empty}
    </section>
  )
}

export function ActionMenu({ items, label = 'Mở menu thao tác' }: { items: ActionItem[]; label?: string }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [open])

  return (
    <div className={styles.menuWrap} onClick={(event) => event.stopPropagation()}>
      <button type="button" className={styles.iconButton} aria-label={label} onClick={() => setOpen((value) => !value)}>
        <MoreHorizontal size={16} />
      </button>
      {open ? (
        <div className={styles.menu} role="menu">
          {items.map((item) => (
            <button
              type="button"
              key={item.label}
              role="menuitem"
              disabled={item.disabled}
              className={`${styles.menuItem} ${item.danger ? styles.menuDanger : ''}`}
              onClick={() => {
                setOpen(false)
                item.onClick()
              }}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function MiniBars({ values, labels }: { values: number[]; labels?: string[] }) {
  const normalized = values.map((value) => (Number.isFinite(Number(value)) ? Number(value) : 0))
  const max = Math.max(...normalized, 1)
  const aria = normalized
    .map((value, index) => `${labels?.[index] || `Cột ${index + 1}`}: ${value.toLocaleString('vi-VN')}`)
    .join(', ')

  return (
    <div className={styles.chart} role="img" aria-label={`Giá trị biểu đồ: ${aria}`}>
      {normalized.map((value, index) => (
        <span
          key={`${labels?.[index] || 'bar'}-${index}`}
          className={styles.bar}
          style={{ height: `${Math.max(16, (value / max) * 100)}%` }}
        >
          <b>{value.toLocaleString('vi-VN')}</b>
          {labels?.[index] ? <i>{labels[index]}</i> : null}
        </span>
      ))}
    </div>
  )
}

export function SeverityBadge({ value }: { value: number }) {
  const tone = value >= 75 ? 'high' : value >= 45 ? 'medium' : 'low'
  const label = value >= 75 ? 'Cao' : value >= 45 ? 'Trung bình' : 'Thấp'
  return <span className={`${styles.severity} ${styles[tone]}`}>{label} · {value}%</span>
}

export function StatusBadge({ value, label }: { value?: string; label?: string }) {
  const key = String(value || '').toLowerCase()
  const statusLabel: Record<string, string> = {
    active: 'Đang hoạt động',
    warning: 'Đã cảnh cáo',
    restricted: 'Bị hạn chế',
    temp_locked: 'Tạm khóa',
    locked: 'Đã khóa',
    hidden: 'Đã ẩn',
    deleted: 'Đã xóa',
    pending: 'Chờ xử lý',
    in_review: 'Đang xem xét',
    resolved: 'Đã xử lý',
    rejected: 'Đã từ chối',
    published: 'Đã đăng',
    admin: 'Quản trị viên',
    moderator: 'Kiểm duyệt viên',
    user: 'Người dùng',
  }
  return <span className={`${styles.badge} ${styles[key] || ''}`}>{label || statusLabel[key] || value || 'Không rõ'}</span>
}

export function UserCell({ user, onClick }: { user: User; onClick?: () => void }) {
  const initials = String(user.fullName || user.email || user.phone || user.id).slice(0, 2).toUpperCase()
  return (
    <button type="button" className={`${styles.ghost} ${styles.nameCell}`} onClick={onClick}>
      <span className={styles.avatar}>{user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : initials}</span>
      <span>
        <strong>{user.fullName || `Người dùng #${user.id}`}</strong>
        {user.username ? <br /> : null}
        {user.username ? <span className={styles.muted}>@{user.username}</span> : null}
        <br />
        <span className={styles.muted}>{user.email || user.phone || `ID ${user.id}`}</span>
      </span>
    </button>
  )
}

export function UserDrawer({ user, onClose }: { user: User | null; onClose: () => void }) {
  const recent = useMemo(
    () => [
      'Đăng nhập từ thiết bị web',
      'Cập nhật hồ sơ cá nhân',
      'Tương tác với bài viết cộng đồng',
    ],
    [],
  )

  if (!user) return null
  const initials = String(user.fullName || user.id).slice(0, 2).toUpperCase()

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Chi tiết người dùng">
      <aside className={styles.drawer}>
        <div className={styles.drawerHeader}>
          <div>
            <p className={styles.eyebrow}>Chi tiết người dùng</p>
            <h2 className={styles.panelTitle}>Hồ sơ vận hành</h2>
          </div>
          <button type="button" className={styles.iconButton} onClick={onClose} aria-label="Đóng">
            <X size={16} />
          </button>
        </div>
        <div className={styles.drawerProfile}>
          <span className={styles.avatar}>{user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : initials}</span>
          <div>
            <h3 className={styles.panelTitle}>{user.fullName}</h3>
            {user.username ? <p className={styles.muted} style={{ margin: '2px 0 0', fontSize: '0.8rem' }}>@{user.username}</p> : null}
            <div className={styles.inline}>
              <StatusBadge value={user.accountStatus} />
              <StatusBadge value={user.role} label={user.role === 'admin' ? 'Quản trị viên' : user.role === 'moderator' ? 'Kiểm duyệt viên' : 'Người dùng'} />
            </div>
          </div>
        </div>
        <Panel title="Thông tin tài khoản">
          <div className={styles.profileList}>
            <span>Email: <b>{user.email || 'Chưa cập nhật'}</b></span>
            <span>Số điện thoại: <b>{user.phone || 'Chưa cập nhật'}</b></span>
            <span>Thiết bị/IP: <b>Web · 127.0.0.1</b></span>
            <span>Cảnh cáo: <b>{user.warningCount || 0}</b></span>
            <span>Lý do hạn chế: <b>{user.restrictionReason || 'Không có'}</b></span>
          </div>
        </Panel>
        <Panel title="Lịch sử vi phạm" description="Tổng hợp phục vụ kiểm duyệt nhanh.">
          <div className={styles.activityList}>
            {(user.warningCount || 0) > 0 ? (
              <div className={styles.activityItem}>
                <span><ShieldAlert size={15} /> {user.warningCount} cảnh cáo</span>
                <StatusBadge value="warning" label="Cần theo dõi" />
              </div>
            ) : (
              <div className={styles.empty}>Chưa có lịch sử vi phạm.</div>
            )}
          </div>
        </Panel>
        <Panel title="Hoạt động gần đây">
          <div className={styles.activityList}>
            {recent.map((item) => (
              <div className={styles.activityItem} key={item}>
                <span>{item}</span>
                <span className={styles.muted}>Gần đây</span>
              </div>
            ))}
          </div>
        </Panel>
      </aside>
    </div>
  )
}

export function ConfirmAction({
  open,
  title,
  description,
  confirmText = 'Xác nhận',
  requireText,
  onCancel,
  onConfirm,
}: {
  open: boolean
  title: string
  description: string
  confirmText?: string
  requireText?: string
  onCancel: () => void
  onConfirm: () => void | Promise<void>
}) {
  const [text, setText] = useState('')
  useEffect(() => {
    if (open) setText('')
  }, [open])
  if (!open) return null
  const disabled = Boolean(requireText && text !== requireText)
  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={title}>
      <aside className={styles.drawer}>
        <div className={styles.drawerHeader}>
          <div>
            <p className={styles.eyebrow}>Hành động cần xác nhận</p>
            <h2 className={styles.panelTitle}>{title}</h2>
            <p className={styles.panelText}>{description}</p>
          </div>
          <button type="button" className={styles.iconButton} onClick={onCancel} aria-label="Đóng">
            <X size={16} />
          </button>
        </div>
        <div className={styles.dangerZone}>
          <div className={styles.inline}>
            <AlertTriangle size={18} />
            <strong>Hành động này sẽ được ghi vào nhật ký kiểm duyệt.</strong>
          </div>
          {requireText ? (
            <label className={styles.profileList}>
              <span className={styles.muted}>Nhập <b>{requireText}</b> để xác nhận.</span>
              <input className={styles.input} value={text} onChange={(event) => setText(event.target.value)} />
            </label>
          ) : null}
        </div>
        <div className={styles.heroActions} style={{ marginTop: 16 }}>
          <button type="button" className={styles.secondary} onClick={onCancel}>Hủy</button>
          <button type="button" className={styles.danger} disabled={disabled} onClick={() => void onConfirm()}>
            <Trash2 size={15} /> {confirmText}
          </button>
        </div>
      </aside>
    </div>
  )
}

export function CsvButton({ filename, rows }: { filename: string; rows: Array<Record<string, unknown>> }) {
  const exportCsv = () => {
    const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row))))
    const csv = [
      keys.join(','),
      ...rows.map((row) => keys.map((key) => JSON.stringify(row[key] ?? '')).join(',')),
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button type="button" className={styles.secondary} onClick={exportCsv}>
      <Download size={15} /> Xuất CSV
    </button>
  )
}

export const adminStyles = styles
export const adminIcons = { CheckCircle2, ChevronDown, Eye, Trash2 }
