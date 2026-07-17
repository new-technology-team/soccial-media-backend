import type { ChatMessage, Conversation } from '@/types'

const VN_TIMEZONE = 'Asia/Ho_Chi_Minh'

const MESSAGE_REACTION_META = [
  { type: 'smile', label: 'Cười' },
  { type: 'sad', label: 'Buồn' },
  { type: 'like', label: 'Thích' },
  { type: 'love', label: 'Yêu thích' },
  { type: 'wow', label: 'Bất ngờ' },
  { type: 'cry', label: 'Khóc' },
  { type: 'angry', label: 'Tức giận' },
] as const

export const parseChatDate = (value: string) => {
  const base = new Date(value)
  if (Number.isNaN(base.getTime())) return new Date()
  return base
}

export const formatVietnamTime = (value: string) =>
  new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: VN_TIMEZONE,
  }).format(parseChatDate(value))

export const getConversationDisplayName = (
  conversation: Pick<Conversation, 'type' | 'name' | 'members'>,
  currentUserId?: number
) => {
  if (conversation.type === 'group') {
    return conversation.name || 'Nhóm chat'
  }
  const peer = conversation.members.find((member) => member.userId !== currentUserId)
  return peer?.fullName || conversation.name || 'Cuộc trò chuyện'
}

export const getGroupRoleLabel = (role: string | null | undefined) => {
  if (role === 'leader') return 'Trưởng nhóm'
  if (role === 'deputy') return 'Phó nhóm'
  return 'Thành viên'
}

export const getAvatarInitial = (value: string | null | undefined) => {
  const normalized = String(value || '').trim()
  return (normalized[0] || 'U').toUpperCase()
}

export const getMessageReactionMeta = (reaction: string) =>
  MESSAGE_REACTION_META.find((item) => item.type === reaction) || MESSAGE_REACTION_META[2]

export const getMessageReactionItems = (msg: ChatMessage) =>
  (msg.reactions || [])
    .map((item) => ({ ...item, meta: getMessageReactionMeta(item.reaction) }))
    .filter((item) => MESSAGE_REACTION_META.some((reaction) => reaction.type === item.reaction))
