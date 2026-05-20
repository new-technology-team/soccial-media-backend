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
    title: 'Phát hiĂ¡»‡n đăng nhĂ¡º­p bĂ¡º¥t thường',
    body: 'MĂ¡»™t đăng nhĂ¡º­p đã bĂ¡»‹ chặn tĂ¡»Ă¡»ừ đĂ¡»‹a chỉ IP chưa xác minh. Hãy kiểm tra tài khoĂ¡º£n ngay.',
    time: '12 phút trưĂ¡»›c',
  },
  {
    id: 2,
    type: 'update',
    title: 'ZChat Core v2.4.0 đã phát hành',
    body: 'BĂ¡º£n cĂ¡º­p nhĂ¡º­t mĂ¡»›i cĂ¡º£i thiĂ¡»‡n tốc đĂ¡»™ bĂ¡º£ng tin và trĂ¡º£i nghiĂ¡»‡m trò chuyĂ¡»‡n mĂ¡º­t đĂ¡»™ cao.',
    time: '2 giờ trưĂ¡»›c',
  },
  {
    id: 3,
    type: 'maintenance',
    title: 'LĂ¡»‹ch bĂ¡º£o trì API',
    body: 'HĂ¡»‡ thống sẽ tối ưu cơ sĂ¡» dữ liĂ¡»‡u vào Chủ nhĂ¡º­t lúc 02:00 UTC.',
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
          <h1>CĂ¡º£nh báo hĂ¡»‡ thống</h1>
          <p>Theo dõi cĂ¡º­p nhĂ¡º­t bĂ¡º£o mĂ¡º­t, phát hành và lĂ¡»‹ch bĂ¡º£o trì.</p>
        </div>
        <div className={styles.filterRow}>
          <button type="button" className={filter === 'all' ? styles.active : ''} onClick={() => setFilter('all')}>TĂ¡º¥t cĂ¡º£</button>
          <button type="button" className={filter === 'security' ? styles.active : ''} onClick={() => setFilter('security')}>BĂ¡º£o mĂ¡º­t</button>
          <button type="button" className={filter === 'maintenance' ? styles.active : ''} onClick={() => setFilter('maintenance')}>BĂ¡º£o trì</button>
        </div>
      </header>

      <section className={styles.hero}>
        <div>
          <p>Trạng thái hĂ¡»‡ thống</p>
          <h2>TĂ¡º¥t cĂ¡º£ dĂ¡»‹ch vĂ¡»¥ đang hoạt đĂ¡»™ng Ă¡»•n đĂ¡»‹nh</h2>
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
