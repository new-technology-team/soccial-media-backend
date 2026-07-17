import { useEffect } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { connectSocket } from '@/services/socket'
import type { User } from '@/types'

type UserPayload = {
  user?: User
  userId?: number | string
  action?: string
}

const sameId = (left: number | string | undefined | null, right: number | string | undefined | null) =>
  String(left ?? '') === String(right ?? '')

export function useUserRealtime({
  token,
  user,
  setUsers,
  setSelectedUser,
}: {
  token: string | null
  user: User | null
  setUsers: Dispatch<SetStateAction<User[]>>
  setSelectedUser?: Dispatch<SetStateAction<User | null>>
}) {
  useEffect(() => {
    if (!token || !user?.id || (user.role !== 'admin' && user.role !== 'moderator')) return

    const socket = connectSocket(token, user.id)

    const applyUser = (payload: UserPayload) => {
      if (!payload?.user) return
      const next = payload.user
      setUsers((prev) => {
        const exists = prev.some((item) => sameId(item.id, next.id))
        if (!exists) return [next, ...prev]
        return prev.map((item) => (sameId(item.id, next.id) ? { ...item, ...next } : item))
      })
      setSelectedUser?.((current) => (current && sameId(current.id, next.id) ? { ...current, ...next } : current))
    }

    socket.on('user:updated', applyUser)
    socket.on('user:moderation-updated', applyUser)

    return () => {
      socket.off('user:updated', applyUser)
      socket.off('user:moderation-updated', applyUser)
    }
  }, [setSelectedUser, setUsers, token, user])
}
