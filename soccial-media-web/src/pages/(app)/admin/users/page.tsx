'use client'

import { useEffect, useMemo, useState } from 'react'
import { UserCheck2, UserX2, Users, ShieldCheck, UserRoundCog } from 'lucide-react'
import { useAuthStore } from '@/lib/store/auth-store'
import { api } from '@/lib/api'
import type { User } from '@/lib/types'
import styles from './page.module.css'

export default function AdminUserStatsPage() {
  const user = useAuthStore((state) => state.user)
  const token = useAuthStore((state) => state.accessToken)
  const [rawStats, setRawStats] = useState<Record<string, number>>({})
  const [users, setUsers] = useState<User[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([api.adminStats(), api.moderationUsers()])
      .then(([statsRes, usersRes]) => {
        setRawStats(statsRes.stats as Record<string, number>)
        setUsers((usersRes.users as unknown[]) as User[])
        setError('')
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Không thể tải dữ liệu người dùng admin')
      })
  }, [])

  const analytics = useMemo(() => {
    const totalUsers = Number(rawStats.totalUsers || users.length || 0)
    const activeUsers = users.filter((item) => item.accountStatus === 'active').length
    const restrictedUsers = users.filter((item) => item.accountStatus === 'restricted').length
    const hiddenUsers = users.filter((item) => item.accountStatus === 'hidden').length
    const moderators = users.filter((item) => item.role === 'moderator').length
    const admins = users.filter((item) => item.role === 'admin').length

    return {
      totalUsers,
      activeUsers,
      restrictedUsers,
      hiddenUsers,
      moderators,
      admins,
      activeRate: totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0,
    }
  }, [rawStats, users])

  const newestUsers = useMemo(() => users.slice(0, 8), [users])

  if (user?.role?.toLowerCase() !== 'admin') {
    return <div className={styles.denied}>Bạn không có quyền truy cập khu vực admin.</div>
  }

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>Admin CRM / Users</p>
        <h1>Quản lý người dùng</h1>
        <p>Theo dõi vai trò, trạng thái tài khoản và biến động user trong cùng giao diện điều hành admin.</p>
      </header>

      <section className={styles.grid}>
        <article className={styles.card}>
          <div className={styles.cardTop}>
            <span>Tổng người dùng</span>
            <Users size={18} />
          </div>
          <strong>{analytics.totalUsers.toLocaleString('vi-VN')}</strong>
        </article>

        <article className={styles.card}>
          <div className={styles.cardTop}>
            <span>Tài khoản hoạt động</span>
            <UserCheck2 size={18} />
          </div>
          <strong>{analytics.activeUsers.toLocaleString('vi-VN')}</strong>
        </article>

        <article className={styles.card}>
          <div className={styles.cardTop}>
            <span>Tài khoản hạn chế</span>
            <UserX2 size={18} />
          </div>
          <strong>{analytics.restrictedUsers.toLocaleString('vi-VN')}</strong>
        </article>

        <article className={styles.card}>
          <div className={styles.cardTop}>
            <span>Điều phối viên</span>
            <ShieldCheck size={18} />
          </div>
          <strong>{analytics.moderators.toLocaleString('vi-VN')}</strong>
        </article>
      </section>

      {error ? <p className={styles.error}>{error}</p> : null}

      <section className={styles.split}>
        <article className={styles.panel}>
          <h2>Tình trạng tài khoản</h2>
          <div className={styles.metricRow}>
            <span>Tỷ lệ user active</span>
            <b>{analytics.activeRate}%</b>
          </div>
          <div className={styles.track}>
            <i style={{ width: `${analytics.activeRate}%` }} />
          </div>

          <div className={styles.metricRow}>
            <span>Tài khoản hidden</span>
            <b>{analytics.hiddenUsers}</b>
          </div>
          <div className={styles.track}>
            <i style={{ width: `${analytics.totalUsers ? (analytics.hiddenUsers / analytics.totalUsers) * 100 : 0}%` }} />
          </div>

          <div className={styles.metricRow}>
            <span>Admin hệ thống</span>
            <b>{analytics.admins}</b>
          </div>
        </article>

        <article className={styles.panel}>
          <h2>
            <UserRoundCog size={16} /> Người dùng gần đây
          </h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Tên</th>
                  <th>Vai trò</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {newestUsers.map((item) => (
                  <tr key={item.id}>
                    <td>{item.fullName}</td>
                    <td>{item.role}</td>
                    <td>{item.accountStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {newestUsers.length === 0 ? <p className={styles.empty}>Chưa có dữ liệu người dùng.</p> : null}
          </div>
        </article>
      </section>
    </div>
  )
}
