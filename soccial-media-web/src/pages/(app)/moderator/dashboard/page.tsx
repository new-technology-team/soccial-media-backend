'use client'

import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, ShieldAlert, UserCog, FileCheck2, ChevronRight } from 'lucide-react'
import { useAuthStore } from '@/contexts/auth-store'
import { api } from '@/api/client'
import styles from './page.module.css'

export default function ModeratorDashboard() {
  const token = useAuthStore((state) => state.accessToken)
  const [pendingReports, setPendingReports] = useState<Array<Record<string, unknown>>>([])
  const [moderationUsers, setModerationUsers] = useState<Array<Record<string, unknown>>>([])

  useEffect(() => {
    if (!token) return
    api.moderationReports(token).then((r) => setPendingReports(r.reports)).catch(console.error)
    api.moderationUsers(token).then((r) => setModerationUsers(r.users as unknown as Array<Record<string, unknown>>)).catch(console.error)
  }, [token])

  const stats = useMemo(
    () => [
      { label: 'Báo cáo đang chĂ¡»', value: pendingReports.length, icon: AlertCircle },
      {
        label: 'NgưĂ¡»i dùng bĂ¡»‹ hạn chĂ¡º¿',
        value: moderationUsers.filter((u) => String(u.accountStatus) === 'restricted').length,
        icon: UserCog,
      },
      { label: 'Tác vĂ¡»¥ kiĂ¡»ƒm duyĂ¡»‡t', value: pendingReports.length + moderationUsers.length, icon: ShieldAlert },
    ],
    [moderationUsers, pendingReports]
  )

  const quickLinks = [
    { href: '/moderator/reports', title: 'QuĂ¡º£n lý báo cáo', subtitle: 'LĂ¡»c theo mĂ¡»©c đĂ¡»™ ưu tiên' },
    { href: '/moderator/posts', title: 'KiĂ¡»ƒm duyĂ¡»‡t bài viết', subtitle: 'Ă¡º¨n hoặc duyĂ¡»‡t nĂ¡»™i dung' },
    { href: '/moderator/users', title: 'KiĂ¡»ƒm duyĂ¡»‡t ngưĂ¡»i dùng', subtitle: 'Hạn chĂ¡º¿ và khôi phĂ¡»¥c tài khoĂ¡º£n' },
  ]

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <p>Moderation hub</p>
        <h1>KiĂ¡»ƒm duyĂ¡»‡t cĂ¡»™ng đĂ¡»“ng</h1>
        <span>LuĂ¡»“ng xĂ¡»  lý theo mô hình stitch4: báo cáo, bài viết, ngưĂ¡»i dùng.</span>
      </header>

      <section className={styles.statGrid}>
        {stats.map((item) => {
          const Icon = item.icon
          return (
            <article key={item.label} className={styles.statCard}>
              <div>
                <small>{item.label}</small>
                <strong>{item.value.toLocaleString('vi-VN')}</strong>
              </div>
              <Icon size={18} />
            </article>
          )
        })}
      </section>

      <section className={styles.split}>
        <article className={styles.panel}>
          <h2>Danh sách ưu tiên</h2>
          <div className={styles.priorityList}>
            {pendingReports.slice(0, 5).map((report) => (
              <div key={String(report.id)}>
<<<<<<< HEAD
                <b>#{String(report.id)} 킷 {String(report.reason || 'Báo cáo nĂ¡»™i dung')}</b>
                <small>{String(report.targetType || 'unknown')} 킷 {String(report.status || 'pending')}</small>
=======
                <b>#{String(report.id)} • {String(report.reason || 'Báo cáo nội dung')}</b>
                <small>{String(report.targetType || 'unknown')} • {String(report.status || 'pending')}</small>
>>>>>>> e1e0f981eaeaaf7229c1f05934c42d2d9ef91993
              </div>
            ))}
            {pendingReports.length === 0 ? <p>Chưa có báo cáo mĂ¡»›i.</p> : null}
          </div>
        </article>

        <article className={styles.panel}>
          <h2>ĐiĂ¡»u hưĂ¡»›ng thao tác</h2>
          <div className={styles.quickList}>
            {quickLinks.map((item) => (
              <Link key={item.href} to={item.href} className={styles.quickItem}>
                <span>
                  <b>{item.title}</b>
                  <small>{item.subtitle}</small>
                </span>
                <ChevronRight size={16} />
              </Link>
            ))}
            <Link to="/posts/1" className={styles.quickItem}>
              <span>
                <b>Chi tiĂ¡º¿t bình luĂ¡º­n bài đăng</b>
                <small>Route mẫu tĂ¡»« stitch4 detail</small>
              </span>
              <FileCheck2 size={16} />
            </Link>
          </div>
        </article>
      </section>
    </div>
  )
}

