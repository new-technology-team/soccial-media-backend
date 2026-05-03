export type Role = 'USER' | 'user' | 'ADMIN' | 'admin' | 'MODERATOR' | 'moderator'

export interface User {
  id: number
  username?: string
  email: string | null
  phone: string | null
  fullName: string
  role: string
  accountStatus: string
  avatarUrl: string | null
  isVerified: boolean
  dateOfBirth?: string | null
}

export interface AuthPayload {
  accessToken: string
  refreshToken: string
  user: User
}

export interface FeedPost {
  id: number
  authorId: number
  authorName: string
  authorAvatar: string | null
  content: string
  mediaUrl: string | null
  visibility: 'public' | 'private'
  status: 'published' | 'hidden' | 'deleted'
  reactionCount: number
  commentCount: number
  viewerReaction: string | null
  createdAt: string
}

export interface FeedComment {
  id: number
  postId: number
  userId: number
  authorName: string
  authorAvatar: string | null
  content: string
  reactionCount: number
  viewerReaction: string | null
  createdAt: string
}

export interface Conversation {
  id: string
  type: 'direct' | 'group'
  name: string | null
  avatarUrl: string | null
  unreadCount: number
  pinnedMessageIds?: string[]
  members: Array<{
    userId: number
    fullName: string
    avatarUrl: string | null
    role: string
  }>
}

export interface ChatMessage {
  id: string
  conversationId: string
  senderId: number
  senderName: string
  senderAvatar: string | null
  type: string
  text: string | null
  mediaUrl: string | null
  fileName?: string | null
  mimeType?: string | null
  fileSize?: number | null
  meta?: Record<string, unknown> | null
  isDeleted?: boolean
  reactionCount: number
  viewerReaction: 'like' | 'love' | 'care' | null
  createdAt: string
  updatedAt?: string
}

export interface NotificationItem {
  id: number
  type: string
  title: string
  body: string | null
  is_read: number
  created_at: string
  meta_json?: string | null
  meta?: Record<string, unknown> | null
}

export interface FriendConnection {
  id: number
  fullName: string
  email: string | null
  phone: string | null
  avatarUrl: string | null
  isVerified: boolean
  role: Role
  accountStatus: User['accountStatus']
  status: 'pending' | 'accepted'
  requestedByMe: boolean
  createdAt: string
}
