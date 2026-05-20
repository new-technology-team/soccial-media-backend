import { api } from '@/api/client'
import type { FriendConnection } from '@/types'
import type { MessageNotificationItem } from './notification-meta'

export const loadChatConversations = async (token: string) => {
  const response = await api.listConversations(token)
  return response.conversations
}

export const loadChatMessages = async (token: string, conversationId: string, limit = 25, beforeId?: string) => {
  return api.listMessages(token, conversationId, { limit, beforeId })
}

export const loadChatNotifications = async (token: string): Promise<MessageNotificationItem[]> => {
  const result = await api.notifications(token)
  return (result.notifications || [])
    .filter((item) => item.type === 'missed-call' || item.type === 'message' || item.type === 'friend-request')
    .slice(0, 40)
}

export const loadFriendMap = async (token: string) => {
  const result = await api.listFriends(token)
  return result.friends.reduce<Record<number, FriendConnection>>((map, friend) => {
    map[friend.id] = friend
    return map
  }, {})
}

export const searchMessageUsers = async (token: string, keyword: string) => {
  const result = await api.searchUsers(token, keyword)
  return (result.users || [])
    .map((item) => ({
      id: Number(item.id || 0),
      name: String(item.full_name || item.fullName || item.email || item.phone || ''),
    }))
    .filter((item) => item.id > 0)
}
