'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Bell, ShieldCheck, Wrench } from 'lucide-react'
import { api } from '@/api/client'
import { useAuthStore } from '@/contexts/auth-store'
import styles from './page.module.css'

type AlertType = 'security' | 'update' | 'maintenance'

type AlertItem = {
  id: string | number
  type: AlertType
  title: string
  body: string
  time: string
}

function mapNotifType(type: string): AlertType {
  const t = (type || '').toLowerCase()
  if (t.includes('security') || t.includes('login') || t.includes('password') || t.includes('block')) return 'security'
  if (t.includes('maintenance') || t.includes('system') || t.includes('update')) return 'maintenance'
  return 'update'
}

function formatRelativeTime(isoString: string) {
  if (!isoString) return ''
  const diff = Date.now() - new Date(isoString).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Vừa xong'
  if (minutes < 60) return `${minutes} phút trước`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} giờ trước`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Hôm qua'
  return `${days} ngày trước`
}

export default function SystemAlertsPage() {
  const token = useAuthStore((state) => state.accessToken)
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | AlertType>('all')

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }
    api.notifications(token)
      .then((r) => {
        const mapped: AlertItem[] = r.notifications.map((n) => ({
          id: n.id,
          type: mapNotifType(n.type),
          title: n.title || 'Thông báo hệ thống',
          body: n.body || '',
          time: formatRelativeTime(n.created_at),
        }))
        setAlerts(mapped)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [token])

  const visibleAlerts = useMemo(() => {
    if (filter === 'all') return alerts
    return alerts.filter((item) => item.type === filter)
  }, [filter, alerts])

  const iconForType = (type: AlertType) => {
    if (type === 'security') return <AlertTriangle size={16} />
    if (type === 'maintenance') return <Wrench size={16} />
    return <Bell size={16} />
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Cảnh báo hệ thống</h1>
          <p>Theo dõi cập nhật bảo mật, phát hành và lịch bảo trì.</p>
        </div>
        <div className={styles.filterRow}>
          <button type="button" className={filter === 'all' ? styles.active : ''} onClick={() => setFilter('all')}>Tất cả</button>
          <button type="button" className={filter === 'security' ? styles.active : ''} onClick={() => setFilter('security')}>Bảo mật</button>
          <button type="button" className={filter === 'maintenance' ? styles.active : ''} onClick={() => setFilter('maintenance')}>Bảo trì</button>
        </div>
      </header>

      <section className={styles.hero}>
        <div>
          <p>Trạng thái hệ thống</p>
          <h2>Tất cả dịch vụ đang hoạt động ổn định</h2>
          <div className={styles.badges}>
            <span>Core Engine</span>
            <span>Security Wall</span>
          </div>
        </div>
        <ShieldCheck size={76} />
      </section>

      <section className={styles.list}>
        {loading ? (
          <p style={{ padding: '1rem', color: '#6b7280' }}>Đang tải thông báo...</p>
        ) : visibleAlerts.length === 0 ? (
          <p style={{ padding: '1rem', color: '#6b7280' }}>Không có cảnh báo nào.</p>
        ) : visibleAlerts.map((item) => (
          <article key={item.id} className={`${styles.item} ${styles[item.type]}`}>
            <div className={styles.icon}>{iconForType(item.type)}</div>
            <div className={styles.itemBody}>
              <div className={styles.itemHead}>
                <h3>{item.title}</h3>
                <span>{item.type.toUpperCase()}</span>
              </div>
              {item.body ? <p>{item.body}</p> : null}
              <small>{item.time}</small>
            </div>
          </article>
        ))}
      </section>
    </div>
  )
}
