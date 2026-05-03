'use client'

import { useEffect, useMemo, useState } from 'react'
import { Ban, Undo2, UserRoundCheck } from 'lucide-react'
import { useAuthStore } from '@/lib/store/auth-store'
import { api } from '@/lib/api'
import type { User } from '@/lib/types'
import styles from './page.module.css'

export default function ModeratorUsersPage() {
  const token = useAuthStore((state) => state.accessToken)
  const [users, setUsers] = useState<User[]>([])

  const loadUsers = async () => {
    if (!token) return
    const res = await api.moderationUsers(token)
    setUsers(res.users)
  }

  useEffect(() => {
    loadUsers().catch(console.error)
  }, [token])

  const riskyUsers = useMemo(
    () => users.filter((user) => user.role !== 'admin').slice(0, 30),
    [users]
  )

  const updateUser = async (userId: number, accountStatus: 'active' | 'restricted') => {
    if (!token) return
    await api.updateModerationUser(token, userId, { accountStatus })
    await loadUsers()
  }

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <p>Stitch4 / User moderation</p>
        <h1>Kiểm duyệt người dùng</h1>
      </header>

      <section className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Người dùng</th>
              <th>Vai trò</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {riskyUsers.map((user) => (
              <tr key={user.id}>
                <td>
                  <b>{user.fullName}</b>
                  <small>{user.email || user.phone || 'unknown'}</small>
                </td>
                <td>{user.role}</td>
                <td>{user.accountStatus}</td>
                <td>
                  <div className={styles.actions}>
                    <button type="button" onClick={() => updateUser(user.id, 'restricted')}>
                      <Ban size={14} /> Hạn chế
                    </button>
                    <button type="button" onClick={() => updateUser(user.id, 'active')}>
                      <Undo2 size={14} /> Khôi phục
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {riskyUsers.length === 0 ? (
          <div className={styles.empty}>
            <UserRoundCheck size={16} /> Không có người dùng cần xử lý.
          </div>
        ) : null}
      </section>
    </div>
  )
}
