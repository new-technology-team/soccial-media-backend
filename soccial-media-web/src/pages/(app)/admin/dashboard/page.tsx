'use client'

import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { Users, FileText, AlertTriangle, CheckCircle2, Activity, ArrowUpRight } from 'lucide-react'
import { useAuthStore } from '@/contexts/auth-store'
import { api } from '@/api/client'
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
        setError(err instanceof Error ? err.message : 'Không thể tĂ¡º£i dĂ¡»¯ liĂ¡»‡u admin dashboard')
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

  if (user?.role !== 'admin') {
    return <div className={styles.denied}>Bạn không có quyĂ¡»n truy cĂ¡º­p khu vĂ¡»±c admin.</div>
  }

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroTop}>
          <p className={styles.eyebrow}>Admin Control Room</p>
          <h1>Dashboard vĂ¡º­n hành hĂ¡»‡ thống</h1>
          <p>
            TĂ¡»•ng quan realtime cho khu admin riêng: theo dõi user, nĂ¡»™i dung, báo cáo và chuyĂ¡»ƒn nhanh tĂ¡»›i tác vĂ¡»¥ quĂ¡º£n trĂ¡»‹.
          </p>
        </div>
      </header>

      <section className={styles.statGrid}>
        {[
          { label: 'TĂ¡»•ng ngưĂ¡»i dùng', value: stats.totalUsers, icon: Users, tone: 'blue' },
          { label: 'TĂ¡»•ng bài viết', value: stats.totalPosts, icon: FileText, tone: 'teal' },
          { label: 'Báo cáo chĂ¡» xĂ¡»  lý', value: stats.pendingReports, icon: AlertTriangle, tone: 'amber' },
          { label: 'Báo cáo đã xĂ¡»  lý', value: stats.resolvedReports, icon: CheckCircle2, tone: 'green' },
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
          <h2>NhĂ¡»‹p vĂ¡º­n hành nĂ¡»n tĂ¡º£ng</h2>
          <div className={styles.progressList}>
            <div>
              <span>ĐĂ¡»™ Ă¡»•n đĂ¡»‹nh hĂ¡»‡ thống</span>
              <b>99.9%</b>
            </div>
            <div className={styles.progressTrack}>
              <i style={{ width: '99.9%' }} />
            </div>

            <div>
              <span>ChĂ¡»‰ sĂ¡»‘ tương tác / bài viết</span>
              <b>{stats.engagementScore}</b>
            </div>
            <div className={styles.progressTrack}>
              <i style={{ width: `${Math.min(100, Math.max(10, stats.engagementScore * 9))}%` }} />
            </div>

            <div>
              <span>TĂ¡»•ng tương tác (bình luĂ¡º­n + cĂ¡º£m xúc)</span>
              <b>{(stats.totalComments + stats.totalReactions).toLocaleString('vi-VN')}</b>
            </div>
          </div>
        </article>

        <article className={styles.panel}>
          <h2>ĐiĂ¡»u phĂ¡»‘i quĂ¡º£n trĂ¡»‹</h2>
          <div className={styles.linkList}>
            <Link to="/admin/posts" className={styles.quickLink}>
              <span>
                <b>QuĂ¡º£n lý bài viết</b>
                <small>Vào CRM nĂ¡»™i dung để lĂ¡»c, sĂ¡»­a, ẩn/xóa bài viết hàng loạt</small>
              </span>
              <ArrowUpRight size={16} />
            </Link>
            <Link to="/admin/users" className={styles.quickLink}>
              <span>
                <b>QuĂ¡º£n lý ngưĂ¡»i dùng</b>
                <small>Giám sát tăng trưĂ¡»Ÿng user, vai trò và trạng thái tài khoĂ¡º£n</small>
              </span>
              <ArrowUpRight size={16} />
            </Link>
            <Link to="/moderator/reports" className={styles.quickLink}>
              <span>
                <b>BĂ¡º£ng xĂ¡»  lý báo cáo</b>
                <small>PhĂ¡»‘i hĂ¡»£p vĂ¡»›i moderator để xĂ¡»  lý vi phạm khẩn</small>
              </span>
              <Activity size={16} />
            </Link>
          </div>
        </article>
      </section>
    </div>
  )
}

