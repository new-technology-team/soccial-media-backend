export type Role = 'user' | 'admin' | 'moderator'

export interface User {
  id: number
  email: string | null
  phone: string | null
  fullName: string
  username: string
  role: Role
  accountStatus: 'active' | 'warning' | 'restricted' | 'temp_locked' | 'locked' | 'hidden' | 'deleted'
  avatarUrl: string | null
  coverUrl?: string | null
  bio?: string | null
  location?: string | null
  isVerified: boolean
  lockedUntil?: string | null
  warningCount?: number
  restrictionReason?: string | null
  permissions?: string[]
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
  authorUsername?: string
  authorAvatar: string | null
  content: string
  mediaUrl: string | null
  sharedPostId?: number | string | null
  sharedPost?: {
    id?: number | string
    authorId?: number
    authorName?: string
    authorAvatar?: string | null
    content?: string
    mediaUrl?: string | null
    reactionCount?: number
    commentCount?: number
    createdAt?: string
    unavailable?: boolean
  } | null
  visibility: 'public' | 'private'
  status: 'published' | 'hidden' | 'deleted'
  reactionCount: number
  commentCount: number
  viewerReaction: string | null
  createdAt: string
  updatedAt?: string
  _recommended?: boolean // Flag for recommended content from discovery
}

export interface FeedComment {
  id: number | string
  postId: number | string
  parentCommentId?: number | string | null
  userId: number
  authorName: string
  authorUsername?: string
  authorAvatar: string | null
  content: string
  imageUrl?: string | null
  file?: string | null
  replies?: FeedComment[]
  reactionCount: number
  viewerReaction: string | null
  createdAt: string
}

export interface Conversation {
  id: string
  type: 'direct' | 'group'
  name: string | null
  avatarUrl: string | null
  backgroundUrl?: string | null
  themeColor?: string | null
  autoDeleteAfterSeconds?: number | null
  createdBy?: number
  createdAt?: string
  updatedAt?: string
  unreadCount: number
  lastMessage?: {
    id: string
    senderId: number
    senderName?: string | null
    senderAvatar?: string | null
    type: string
    text: string | null
    mediaUrl: string | null
    fileName?: string | null
    mimeType?: string | null
    fileSize?: number | null
    meta?: Record<string, unknown> | null
    createdAt: string
    updatedAt?: string | null
    expiresAt?: string | null
    isDeleted?: boolean
    viewerReaction?: string | null
  } | null
  pinnedMessageIds?: string[]
  pinnedMessages?: ChatMessage[]
  role?: string
  groupOwner?: number
  onlineCount?: number
  isPinned?: boolean
  isMuted?: boolean
  isHidden?: boolean
  mutedUntil?: string | null
  isLocked?: boolean
  lockedAt?: string | null
  notificationsEnabled?: boolean
  members: Array<{
    userId: number
    fullName: string
    username?: string
    realName?: string
    nickname?: string | null
    avatarUrl: string | null
    role: string
    lastReadAt?: string | null
    lastReadMessageId?: string | null
    isPinned?: boolean
    isMuted?: boolean
    mutedUntil?: string | null
    isLocked?: boolean
    lockedAt?: string | null
    deletedHistoryAt?: string | null
    online?: boolean
    lastActiveAt?: string | null
  }>
}

export interface PostReactionViewer {
  userId: number
  fullName: string
  username?: string
  avatarUrl: string | null
  reaction: string
  createdAt?: string | null
}

export interface ChatMessage {
  id: string
  conversationId: string
  senderId: number
  senderName: string
  senderUsername?: string
  senderAvatar: string | null
  type: string
  text: string | null
  mediaUrl: string | null
  fileName?: string | null
  mimeType?: string | null
  fileSize?: number | null
  meta?: Record<string, unknown> | null
  links?: string[]
  status?: 'sent' | 'delivered' | 'seen'
  readBy?: Array<{ userId: number; at?: string | null }>
  deliveredTo?: Array<{ userId: number; at?: string | null }>
  expiresAt?: string | null
  isDeleted?: boolean
  reactionCount: number
  viewerReaction: string | null
  reactions?: Array<{ userId: number; reaction: string; createdAt?: string | null }>
  createdAt: string
  updatedAt?: string
}

export interface NotificationItem {
  id: number | string
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
  username?: string
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
