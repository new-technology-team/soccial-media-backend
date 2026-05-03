'use client'

import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { Users, FileText, AlertTriangle, CheckCircle2, Activity, ArrowUpRight } from 'lucide-react'
import { useAuthStore } from '@/lib/store/auth-store'
import { api } from '@/lib/api'
import styles from './page.module.css'

export default function AdminDashboard() {
  const user = useAuthStore((state) => state.user)
  const token = useAuthStore((state) => state.accessToken)
  const [rawStats, setRawStats] = useState<Record<string, number>>({})
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .adminStats()
      .then((r) => {
        setRawStats(r.stats as Record<string, number>)
        setError('')
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Không thể tải dữ liệu admin dashboard')
      })
  }, [])

  const stats = useMemo(() => {
    const totalUsers = Number(rawStats.totalUsers || 0)
    const totalPosts = Number(rawStats.totalPosts || 0)
    const totalComments = Number(rawStats.totalComments || 0)
    const totalReactions = Number(rawStats.totalReactions || 0)
    const pendingReports = Number(rawStats.pendingReports || 0)
    const resolvedReports = Number(rawStats.resolvedReports || 0)

    return {
      totalUsers,
      totalPosts,
      totalComments,
      totalReactions,
      pendingReports,
      resolvedReports,
      engagementScore: totalPosts > 0 ? Math.round(((totalComments + totalReactions) / totalPosts) * 10) / 10 : 0,
    }
  }, [rawStats])

  if (user?.role?.toLowerCase() !== 'admin') {
    return <div className={styles.denied}>Bạn không có quyền truy cập khu vực admin.</div>
  }

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroTop}>
          <p className={styles.eyebrow}>Admin Control Room</p>
          <h1>Dashboard vận hành hệ thống</h1>
          <p>
            Tổng quan realtime cho khu admin riêng: theo dõi user, nội dung, báo cáo và chuyển nhanh tới tác vụ quản trị.
          </p>
        </div>
      </header>

      <section className={styles.statGrid}>
        {[
          { label: 'Tổng người dùng', value: stats.totalUsers, icon: Users, tone: 'blue' },
          { label: 'Tổng bài viết', value: stats.totalPosts, icon: FileText, tone: 'teal' },
          { label: 'Báo cáo chờ xử lý', value: stats.pendingReports, icon: AlertTriangle, tone: 'amber' },
          { label: 'Báo cáo đã xử lý', value: stats.resolvedReports, icon: CheckCircle2, tone: 'green' },
        ].map((item) => {
          const Icon = item.icon
          return (
            <article key={item.label} className={`${styles.statCard} ${styles[`tone${item.tone}`]}`}>
              <div className={styles.statTop}>
                <span>{item.label}</span>
                <Icon size={18} />
              </div>
              <strong>{item.value.toLocaleString('vi-VN')}</strong>
            </article>
          )
        })}
      </section>

      {error ? <p className={styles.error}>{error}</p> : null}

      <section className={styles.contentGrid}>
        <article className={styles.panel}>
          <h2>Nhịp vận hành nền tảng</h2>
          <div className={styles.progressList}>
            <div>
              <span>Độ ổn định hệ thống</span>
              <b>99.9%</b>
            </div>
            <div className={styles.progressTrack}>
              <i style={{ width: '99.9%' }} />
            </div>

            <div>
              <span>Chỉ số tương tác / bài viết</span>
              <b>{stats.engagementScore}</b>
            </div>
            <div className={styles.progressTrack}>
              <i style={{ width: `${Math.min(100, Math.max(10, stats.engagementScore * 9))}%` }} />
            </div>

            <div>
              <span>Tổng tương tác (bình luận + cảm xúc)</span>
              <b>{(stats.totalComments + stats.totalReactions).toLocaleString('vi-VN')}</b>
            </div>
          </div>
        </article>

        <article className={styles.panel}>
          <h2>Điều phối quản trị</h2>
          <div className={styles.linkList}>
            <Link to="/admin/posts" className={styles.quickLink}>
              <span>
                <b>Quản lý bài viết</b>
                <small>Vào CRM nội dung để lọc, sửa, ẩn/xóa bài viết hàng loạt</small>
              </span>
              <ArrowUpRight size={16} />
            </Link>
            <Link to="/admin/users" className={styles.quickLink}>
              <span>
                <b>Quản lý người dùng</b>
                <small>Giám sát tăng trưởng user, vai trò và trạng thái tài khoản</small>
              </span>
              <ArrowUpRight size={16} />
            </Link>
            <Link to="/moderator/reports" className={styles.quickLink}>
              <span>
                <b>Bảng xử lý báo cáo</b>
                <small>Phối hợp với moderator để xử lý vi phạm khẩn</small>
              </span>
              <Activity size={16} />
            </Link>
          </div>
        </article>
      </section>
    </div>
  )
}
