export type MessageNotificationItem = {
  id: number
  type: string
  title: string
  body: string | null
  created_at: string
  is_read: number
  meta?: Record<string, unknown> | null
}

export const parseNotificationMeta = (item: MessageNotificationItem) => {
  const rawMeta = item?.meta
  if (!rawMeta || typeof rawMeta !== 'object') return null
  const source = rawMeta as Record<string, unknown>
  const conversationId = source.conversationId ?? source.conversation_id ?? source.chatId ?? source.chat_id
  const requesterId = source.requesterId ?? source.requester_id ?? source.fromUserId ?? source.from_user_id
  const friendshipId = source.friendshipId ?? source.friendship_id

  return {
    conversationId: conversationId ? String(conversationId) : null,
    requesterId: requesterId ? Number(requesterId) : null,
    friendshipId: friendshipId ? Number(friendshipId) : null,
  }
}
