'use client'

import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, ShieldAlert, UserCog, FileCheck2, ChevronRight } from 'lucide-react'
import { useAuthStore } from '@/lib/store/auth-store'
import { api } from '@/lib/api'
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
      { label: 'Báo cáo đang chờ', value: pendingReports.length, icon: AlertCircle },
      {
        label: 'Người dùng bị hạn chế',
        value: moderationUsers.filter((u) => String(u.accountStatus) === 'restricted').length,
        icon: UserCog,
      },
      { label: 'Tác vụ kiểm duyệt', value: pendingReports.length + moderationUsers.length, icon: ShieldAlert },
    ],
    [moderationUsers, pendingReports]
  )

  const quickLinks = [
    { href: '/moderator/reports', title: 'Quản lý báo cáo', subtitle: 'Lọc theo mức độ ưu tiên' },
    { href: '/moderator/posts', title: 'Kiểm duyệt bài viết', subtitle: 'Ẩn hoặc duyệt nội dung' },
    { href: '/moderator/users', title: 'Kiểm duyệt người dùng', subtitle: 'Hạn chế và khôi phục tài khoản' },
  ]

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <p>Moderation hub</p>
        <h1>Kiểm duyệt cộng đồng</h1>
        <span>Luồng xử lý theo mô hình stitch4: báo cáo, bài viết, người dùng.</span>
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
                <b>#{String(report.id)} · {String(report.reason || 'Báo cáo nội dung')}</b>
                <small>{String(report.targetType || 'unknown')} · {String(report.status || 'pending')}</small>
              </div>
            ))}
            {pendingReports.length === 0 ? <p>Chưa có báo cáo mới.</p> : null}
          </div>
        </article>

        <article className={styles.panel}>
          <h2>Điều hướng thao tác</h2>
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
                <b>Chi tiết bình luận bài đăng</b>
                <small>Route mẫu từ stitch4 detail</small>
              </span>
              <FileCheck2 size={16} />
            </Link>
          </div>
        </article>
      </section>
    </div>
  )
}
