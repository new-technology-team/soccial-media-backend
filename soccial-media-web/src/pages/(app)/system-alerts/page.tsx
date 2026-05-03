'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, Bell, ShieldCheck, Wrench } from 'lucide-react'
import styles from './page.module.css'

type AlertType = 'security' | 'update' | 'maintenance'

type AlertItem = {
  id: number
  type: AlertType
  title: string
  body: string
  time: string
}

const allAlerts: AlertItem[] = [
  {
    id: 1,
    type: 'security',
    title: 'Phát hiện đăng nhập bất thường',
    body: 'Một đăng nhập đã bị chặn từ địa chỉ IP chưa xác minh. Hãy kiểm tra tài khoản ngay.',
    time: '12 phút trước',
  },
  {
    id: 2,
    type: 'update',
    title: 'ZChat Core v2.4.0 đã phát hành',
    body: 'Bản cập nhật mới cải thiện tốc độ bảng tin và trải nghiệm trò chuyện mật độ cao.',
    time: '2 giờ trước',
  },
  {
    id: 3,
    type: 'maintenance',
    title: 'Lịch bảo trì API',
    body: 'Hệ thống sẽ tối ưu cơ sở dữ liệu vào Chủ nhật lúc 02:00 UTC.',
    time: 'Hôm qua',
  },
]

export default function SystemAlertsPage() {
  const [filter, setFilter] = useState<'all' | AlertType>('all')

  const visibleAlerts = useMemo(() => {
    if (filter === 'all') return allAlerts
    return allAlerts.filter((item) => item.type === filter)
  }, [filter])

  const iconForType = (type: AlertType) => {
    if (type === 'security') return <AlertTriangle size={16} />
    if (type === 'update') return <Bell size={16} />
    return <Wrench size={16} />
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
        {visibleAlerts.map((item) => (
          <article key={item.id} className={`${styles.item} ${styles[item.type]}`}>
            <div className={styles.icon}>{iconForType(item.type)}</div>
            <div className={styles.itemBody}>
              <div className={styles.itemHead}>
                <h3>{item.title}</h3>
                <span>{item.type.toUpperCase()}</span>
              </div>
              <p>{item.body}</p>
              <small>{item.time}</small>
            </div>
          </article>
        ))}
      </section>
    </div>
  )
}
