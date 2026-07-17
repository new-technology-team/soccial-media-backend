import type {
  AuthPayload,
  ChatMessage,
  Conversation,
  FeedComment,
  FriendConnection,
  FeedPost,
  NotificationItem,
  PostReactionViewer,
  User,
} from '@/types'
import { API_BASE } from '@/config/api'
import { useAuthStore } from '@/contexts/auth-store'

export type CallHistoryItem = {
  id: string
  conversationId: string
  initiatorId: number
  participantIds: number[]
  callSessionId?: string
  participantStatuses?: Array<{
    userId: number
    joinedAt: string | null
    leftAt: string | null
    durationSec: number
    role: 'caller' | 'receiver' | 'member'
  }>
  callType: 'voice' | 'video'
  mode: 'private' | 'group'
  status: 'completed' | 'missed' | 'rejected' | 'no_answer' | 'cancelled' | 'failed'
  startedAt: string
  answeredAt: string | null
  endedAt: string | null
  durationSec: number
  createdAt: string
}

export const resolveApiAssetUrl = (value: string | null | undefined) => {
  if (!value) return null
  if (/^https?:\/\//i.test(value) || value.startsWith('blob:') || value.startsWith('data:')) {
    return value
  }

  if (value.startsWith('/uploads/')) {
    if (API_BASE.startsWith('/backend')) {
      return `/backend${value}`
    }

    if (API_BASE.startsWith('/api')) {
      return value
    }

    try {
      const origin =
        typeof window !== 'undefined' && window.location?.origin ? window.location.origin : ''
      if (!origin) return value
      const base = new URL(API_BASE, origin)
      return new URL(value, `${base.origin}/`).toString()
    } catch {
      return value
    }
  }

  return value
}

const normalizeUser = <T extends { avatarUrl?: string | null; coverUrl?: string | null }>(user: T): T => ({
  ...user,
  avatarUrl: resolveApiAssetUrl(user.avatarUrl),
  coverUrl: resolveApiAssetUrl(user.coverUrl),
})

const normalizeConversation = (conversation: Conversation): Conversation => ({
  ...conversation,
  id: String(conversation.id),
  pinnedMessageIds: (conversation.pinnedMessageIds || []).map((item) => String(item)),
  pinnedMessages: (conversation.pinnedMessages || []).map(normalizeChatMessage),
  avatarUrl: resolveApiAssetUrl(conversation.avatarUrl),
  backgroundUrl: resolveApiAssetUrl(conversation.backgroundUrl),
  lastMessage: conversation.lastMessage
    ? {
        ...conversation.lastMessage,
        id: String(conversation.lastMessage.id),
        senderId: Number(conversation.lastMessage.senderId || 0),
        senderAvatar: resolveApiAssetUrl(conversation.lastMessage.senderAvatar),
        mediaUrl: resolveApiAssetUrl(conversation.lastMessage.mediaUrl),
        expiresAt: conversation.lastMessage.expiresAt || null,
      }
    : conversation.lastMessage,
  members: (conversation.members || []).map((member) => ({
    ...member,
    avatarUrl: resolveApiAssetUrl(member.avatarUrl),
  })),
})

const normalizeChatMessage = (message: ChatMessage): ChatMessage => ({
  ...message,
  id: String(message.id),
  conversationId: String(message.conversationId),
  mediaUrl: resolveApiAssetUrl(message.mediaUrl),
})

export const normalizeFeedComment = (comment: FeedComment): FeedComment => ({
  ...comment,
  id: String(comment.id),
  postId: String(comment.postId),
  parentCommentId: comment.parentCommentId ? String(comment.parentCommentId) : null,
  authorAvatar: resolveApiAssetUrl(comment.authorAvatar),
  imageUrl: resolveApiAssetUrl(comment.imageUrl || comment.file || null),
  file: resolveApiAssetUrl(comment.file || comment.imageUrl || null),
  replies: (comment.replies || []).map(normalizeFeedComment),
})

export const normalizeFeedPost = (post: FeedPost): FeedPost => ({
  ...post,
  createdAt: String((post as FeedPost & { created_at?: string; updatedAt?: string; updated_at?: string }).createdAt || (post as FeedPost & { created_at?: string; updatedAt?: string; updated_at?: string }).created_at || (post as FeedPost & { created_at?: string; updatedAt?: string; updated_at?: string }).updatedAt || (post as FeedPost & { created_at?: string; updatedAt?: string; updated_at?: string }).updated_at || ''),
  updatedAt: String((post as FeedPost & { updatedAt?: string; updated_at?: string; createdAt?: string; created_at?: string }).updatedAt || (post as FeedPost & { updatedAt?: string; updated_at?: string; createdAt?: string; created_at?: string }).updated_at || (post as FeedPost & { updatedAt?: string; updated_at?: string; createdAt?: string; created_at?: string }).createdAt || (post as FeedPost & { updatedAt?: string; updated_at?: string; createdAt?: string; created_at?: string }).created_at || ''),
  mediaUrl: resolveApiAssetUrl(post.mediaUrl),
  authorAvatar: resolveApiAssetUrl(post.authorAvatar),
  sharedPost: post.sharedPost
    ? {
        ...post.sharedPost,
        mediaUrl: resolveApiAssetUrl(post.sharedPost.mediaUrl),
        authorAvatar: resolveApiAssetUrl(post.sharedPost.authorAvatar),
      }
    : post.sharedPost,
})

const normalizeNotification = (item: NotificationItem & Record<string, unknown>): NotificationItem => ({
  ...item,
  id: String(item.id),
  is_read: item.is_read !== undefined ? Number(item.is_read) : item.isRead ? 1 : 0,
  created_at: String(item.created_at || item.createdAt || ''),
  meta: (item.meta as Record<string, unknown> | null | undefined) || null,
  body: item.body ? String(item.body) : null,
})

export class ApiError extends Error {
  status?: number
  code?: string

  constructor(message: string, options?: { status?: number; code?: string }) {
    super(message)
    this.name = 'ApiError'
    this.status = options?.status
    this.code = options?.code
  }
}

export const isAuthExpiredError = (error: unknown) => {
  if (!(error instanceof Error)) return false
  const status = error instanceof ApiError ? error.status : undefined
  const code = error instanceof ApiError ? error.code : undefined
  const lower = error.message.toLowerCase()

  return (
    status === 401 ||
    status === 403 ||
    code === 'AUTH_EXPIRED' ||
    lower.includes('invalid or expired token') ||
    lower.includes('token expired') ||
    lower.includes('jwt expired') ||
    lower.includes('unauthorized')
  )
}

const buildHeaders = (token?: string) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  return headers
}

export const request = async <T>(
  path: string,
  options: RequestInit = {},
  token?: string,
  retriedAfterRefresh = false
): Promise<T> => {
  const requestUrl = `${API_BASE}${path}`
  let response: Response

  try {
    response = await fetch(requestUrl, {
      ...options,
      headers: {
        ...buildHeaders(token),
        ...(options.headers || {}),
      },
      cache: 'no-store',
    })
  } catch (error) {
    const lower = error instanceof Error ? error.message.toLowerCase() : ''
    const isNetworkError =
      error instanceof TypeError ||
      lower.includes('failed to fetch') ||
      lower.includes('networkerror') ||
      lower.includes('load failed')

    if (isNetworkError) {
      throw new ApiError(
        'Không thể kết nối backend API. Hãy chạy server API ở frontend (npm run dev:api) và tải lại trang.',
        { code: 'BACKEND_UNREACHABLE' }
      )
    }

    throw error
  }

  const data = await response.json().catch(() => ({}))

  if ((response.status === 401 || response.status === 403) && token && !retriedAfterRefresh && path !== '/auth/refresh') {
    const refreshedToken = await refreshAccessToken()
    if (refreshedToken) {
      return request<T>(path, options, refreshedToken, true)
    }
  }

  if (!response.ok) {
    const message = typeof data.message === 'string' ? data.message : ''
    const lowerMessage = message.toLowerCase()
    const isDbUnavailable =
      response.status === 503 ||
      lowerMessage.includes('database') ||
      lowerMessage.includes('mariadb') ||
      lowerMessage.includes('pool failed')

    if (isDbUnavailable) {
      throw new ApiError('Máy chủ đang mất kết nối cơ sở dữ liệu. Vui lòng bật MariaDB và thử lại.', {
        status: response.status,
        code: 'DB_UNAVAILABLE',
      })
    }

    const isAuthError =
      response.status === 401 ||
      response.status === 403 ||
      lowerMessage.includes('invalid or expired token') ||
      lowerMessage.includes('token expired') ||
      lowerMessage.includes('jwt expired') ||
      lowerMessage.includes('unauthorized')

    if (isAuthError) {
      throw new ApiError(message || 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.', {
        status: response.status,
        code: 'AUTH_EXPIRED',
      })
    }

    throw new ApiError(message || 'Request failed', {
      status: response.status,
      code: typeof data.code === 'string' ? data.code : undefined,
    })
  }

  return data as T
}

let refreshRequest: Promise<string | null> | null = null

const refreshAccessToken = async () => {
  if (refreshRequest) return refreshRequest

  refreshRequest = (async () => {
    const auth = useAuthStore.getState()
    if (!auth.refreshToken) return null

    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ refreshToken: auth.refreshToken }),
        cache: 'no-store',
      })
      const data = await response.json().catch(() => ({})) as Partial<AuthPayload>
      if (!response.ok || !data.accessToken || !data.refreshToken || !data.user) {
        auth.clearAuth()
        sessionStorage.setItem('auth_cleared_reason', 'session-expired')
        return null
      }

      auth.setAuth({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: normalizeUser(data.user),
      })
      return data.accessToken
    } catch {
      return null
    } finally {
      refreshRequest = null
    }
  })()

  return refreshRequest
}

export const api = {
  login: (emailOrPhone: string, password: string) =>
    request<AuthPayload>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ emailOrPhone, password }),
    }).then((p) => ({ ...p, user: normalizeUser(p.user) })),

  register: (payload: {
    username: string
    emailOrPhone: string
    fullName: string
    dateOfBirth?: string
    gender?: string
    password: string
  }) =>
    request<{ requiresVerification?: boolean; verificationCode?: string; emailOrPhone?: string; message?: string }>(
      '/auth/register',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),

  checkUsername: (username: string) =>
    request<{ available: boolean }>(
      `/auth/check-username?username=${encodeURIComponent(username)}`,
      { method: 'GET' }
    ),

  verifyRegistration: (payload: { emailOrPhone: string; code: string }) =>
    request<AuthPayload>('/auth/verify-registration', {
      method: 'POST',
      body: JSON.stringify(payload),
    }).then((p) => ({ ...p, user: normalizeUser(p.user) })),

  resendVerificationCode: (emailOrPhone: string) =>
    request<{
      message: string
      otpSent?: boolean
      otpChannel?: string
      otpDestination?: string
      otpReason?: string
      verificationCode?: string
    }>('/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ emailOrPhone }),
    }),

  forgotPassword: (emailOrPhone: string) =>
    request<{
      message: string
      otpSent?: boolean
      otpChannel?: string
      otpDestination?: string
      otpReason?: string
      resetCode?: string
    }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ emailOrPhone }),
    }),

  resetPassword: (payload: { emailOrPhone: string; code: string; newPassword: string }) =>
    request<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  me: (token: string) => request<{ user: User }>('/auth/me', { method: 'GET' }, token),

  updateProfile: (
    token: string,
    payload: { fullName?: string; username?: string; avatarUrl?: string; coverUrl?: string; dateOfBirth?: string; gender?: string }
  ) => request<{ message: string; user: User }>('/auth/me', { method: 'PUT', body: JSON.stringify(payload) }, token),

  getUserByUsername: (token: string, username: string) =>
    request<{ user: User | null; relationship?: { status: string } | null }>(
      `/social/users/by-username/${encodeURIComponent(username)}`,
      { method: 'GET' },
      token
    ).then((r) => ({ user: r.user ? normalizeUser(r.user) : null, relationship: r.relationship })),

  uploadCoverBase64: (token: string, payload: { fileName: string; contentType: string; base64Data: string }) =>
    request<{ message?: string; fileUrl?: string; user?: User }>(
      '/auth/cover-upload-base64',
      { method: 'POST', body: JSON.stringify(payload) },
      token
    ).then((data) => ({
      message: data.message || 'Uploaded',
      fileUrl: resolveApiAssetUrl(data.fileUrl || '') || '',
      user: data.user,
    })),

  getSettings: (token: string) =>
    request<{
      settings: {
        privacyLastSeen: boolean
        privacyProfilePhoto: boolean
        allowFriendRequests: boolean
        notificationMessages: boolean
        notificationCalls: boolean
        updatedAt: string
      }
    }>('/social/settings', { method: 'GET' }, token),

  saveSettings: (
    token: string,
    settings: {
      privacyLastSeen?: boolean
      privacyProfilePhoto?: boolean
      allowFriendRequests?: boolean
      notificationMessages?: boolean
      notificationCalls?: boolean
    }
  ) =>
    request<{
      message: string
      settings: {
        privacyLastSeen: boolean
        privacyProfilePhoto: boolean
        allowFriendRequests: boolean
        notificationMessages: boolean
        notificationCalls: boolean
        updatedAt: string
      }
    }>('/social/settings', { method: 'PUT', body: JSON.stringify(settings) }, token),

  changePassword: (
    token: string,
    payload: { oldPassword: string; newPassword: string }
  ) => request<{ message: string }>('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword: payload.oldPassword, newPassword: payload.newPassword }) }, token),

  listFeed: (token?: string) =>
    request<{ posts: FeedPost[]; viewer: { id: number; role: string } | null }>(
      '/social/feed',
      { method: 'GET' },
      token
    ).then((res) => ({
      ...res,
      posts: (res.posts || []).map(normalizeFeedPost),
    })),

  listFeedWithParams: (params: { includeHidden?: boolean; limit?: number }, token?: string) => {
    const query = new URLSearchParams()
    if (params.includeHidden) query.set('includeHidden', '1')
    if (params.limit) query.set('limit', String(params.limit))
    const suffix = query.toString() ? `?${query.toString()}` : ''
    return request<{ posts: FeedPost[]; viewer: { id: number; role: string } | null }>(
      `/social/feed${suffix}`,
      { method: 'GET' },
      token
    ).then((res) => ({
      ...res,
      posts: (res.posts || []).map(normalizeFeedPost),
    }))
  },

  createPost: (token: string, payload: { content?: string; mediaUrl?: string; visibility?: 'public' | 'private'; sharedPostId?: number | string }) =>
    request<FeedPost>(
      '/social/posts',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      token
    ).then((post) => ({
      post: normalizeFeedPost(post),
    })),

  updatePost: (
    token: string,
    postId: number | string,
    payload: { content?: string; mediaUrl?: string; visibility?: 'public' | 'private' }
  ) =>
    request<FeedPost>(
      `/social/posts/${postId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
      token
    ).then((post) => ({
      message: 'Đã cập nhật',
      post: normalizeFeedPost(post),
    })),

  deletePost: (token: string, postId: number | string) =>
    request<{ message: string }>(`/social/posts/${postId}`, { method: 'DELETE' }, token),

  getPost: (postId: number | string, token?: string) =>
    request<{ post: FeedPost }>(`/social/posts/${postId}`, { method: 'GET' }, token).then((res) => ({
      post: normalizeFeedPost(res.post),
    })),

  uploadPostMediaBase64: (
    token: string,
    payload: { fileName: string; contentType: string; base64Data: string }
  ) =>
    request<{ message?: string; mediaUrl?: string; fileUrl?: string }>(
      '/social/posts/upload-base64',
      { method: 'POST', body: JSON.stringify(payload) },
      token
    ).then((data) => ({
      message: data.message || 'Uploaded',
      mediaUrl: resolveApiAssetUrl(data.mediaUrl || data.fileUrl || '') || '',
    })),

  savePost: (token: string, postId: number | string) =>
    request<{ saved: boolean }>(`/social/posts/${postId}/save`, { method: 'POST' }, token),

  unsavePost: (token: string, postId: number | string) =>
    request<{ saved: boolean }>(`/social/posts/${postId}/save`, { method: 'DELETE' }, token),

  listSavedPosts: (token: string) =>
    request<{ posts: FeedPost[] }>('/social/posts/saved', { method: 'GET' }, token).then((res) => ({
      posts: (res.posts || []).map(normalizeFeedPost),
    })),

  reactPost: (token: string, postId: number | string, type = 'like') =>
    request<FeedPost>(
      `/social/posts/${postId}/reaction`,
      {
        method: 'POST',
        body: JSON.stringify({ type }),
      },
      token
    ).then((post) => ({
      post: normalizeFeedPost(post),
    })),

  unreactPost: (token: string, postId: number | string) =>
    request<FeedPost>(`/social/posts/${postId}/reaction`, { method: 'DELETE' }, token).then((post) => ({
      post: normalizeFeedPost(post),
    })),

  listPostReactions: (postId: number | string) =>
    request<{ reactions: PostReactionViewer[] }>(`/social/posts/${postId}/reactions`, { method: 'GET' }).then((res) => ({
      reactions: (res.reactions || []).map((item) => ({
        ...item,
        avatarUrl: resolveApiAssetUrl(item.avatarUrl),
      })),
    })),

  listComments: (
    postId: number | string,
    token?: string,
    params?: {
      limit?: number
      offset?: number
    }
  ) => {
    const query = new URLSearchParams()
    if (params?.limit) query.set('limit', String(params.limit))
    if (params?.offset) query.set('offset', String(params.offset))
    const suffix = query.toString() ? `?${query.toString()}` : ''

    return request<{
      comments: FeedComment[]
      total?: number
      hasMore?: boolean
      limit?: number
      offset?: number
    }>(`/social/posts/${postId}/comments${suffix}`, { method: 'GET' }, token).then((res) => ({
      ...res,
      comments: (res.comments || []).map(normalizeFeedComment),
    }))
  },

  addComment: (token: string, postId: number | string, content: string, imageUrl?: string | null, parentCommentId?: number | string | null) =>
    request<{ comment: FeedComment }>(
      `/social/posts/${postId}/comments`,
      { method: 'POST', body: JSON.stringify({ content, imageUrl, parentCommentId }) },
      token
    ).then((res) => ({ comment: normalizeFeedComment(res.comment) })),

  addCommentReply: (token: string, commentId: number | string, content: string, imageUrl?: string | null) =>
    request<{ comment: FeedComment }>(
      `/social/comments/${commentId}/replies`,
      { method: 'POST', body: JSON.stringify({ content, imageUrl }) },
      token
    ).then((res) => ({ comment: normalizeFeedComment(res.comment) })),

  uploadCommentImageBase64: (
    token: string,
    payload: { fileName: string; contentType: string; base64Data: string }
  ) =>
    request<{ mediaUrl?: string; fileUrl?: string }>(
      '/social/comments/upload-base64',
      { method: 'POST', body: JSON.stringify(payload) },
      token
    ).then((data) => ({
      mediaUrl: resolveApiAssetUrl(data.mediaUrl || data.fileUrl || '') || '',
    })),

  deleteComment: (token: string, commentId: number | string) =>
    request<{ message: string }>(`/social/comments/${commentId}`, { method: 'DELETE' }, token),

  reactComment: (token: string, commentId: number | string, type = 'like') =>
    request<{ message: string; comment: FeedComment }>(
      `/social/comments/${commentId}/reaction`,
      { method: 'POST', body: JSON.stringify({ type }) },
      token
    ).then((res) => ({ ...res, comment: normalizeFeedComment(res.comment) })),

  unreactComment: (token: string, commentId: number | string) =>
    request<{ message: string; comment: FeedComment }>(
      `/social/comments/${commentId}/reaction`,
      { method: 'DELETE' },
      token
    ).then((res) => ({ ...res, comment: normalizeFeedComment(res.comment) })),

  listCommentReactions: (commentId: number | string) =>
    request<{ reactions: PostReactionViewer[] }>(`/social/comments/${commentId}/reactions`, { method: 'GET' }).then((res) => ({
      reactions: (res.reactions || []).map((item) => ({
        ...item,
        avatarUrl: resolveApiAssetUrl(item.avatarUrl),
      })),
    })),

  listConversations: (token: string) =>
    request<{ conversations: Conversation[] }>('/chat/conversations', { method: 'GET' }, token).then((data) => ({
      conversations: (data.conversations || []).map(normalizeConversation),
    })),

  searchUsers: (token: string, keyword: string) =>
    request<{ users: Array<Record<string, unknown>> }>(
      `/social/users/search?q=${encodeURIComponent(keyword)}`,
      { method: 'GET' },
      token
    ),

  listFriends: (token: string) =>
    request<{ friends: FriendConnection[] }>('/social/friends', { method: 'GET' }, token)
      .then((r) => ({ friends: r.friends.map((f) => normalizeUser(f)) })),

  listFriendRequests: (token: string) =>
    request<Array<{ id: number; fullName: string; avatarUrl: string | null; status?: string; requestedByMe?: boolean }>>(
      '/social/friends/pending', { method: 'GET' }, token
    ).then((arr) => ({ requests: (Array.isArray(arr) ? arr : []).map((r) => normalizeUser(r)) })),

  requestFriend: (token: string, userId: number) =>
    request<{ message: string }>('/social/friends/request', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }, token),

  acceptFriend: (token: string, userId: number) =>
    request<{ message: string }>(`/social/friends/${userId}/accept`, { method: 'POST' }, token),

  deleteFriend: (token: string, userId: number) =>
    request<{ message: string }>(`/social/friends/${userId}`, { method: 'DELETE' }, token),

  createDirectConversation: (token: string, userId: number) =>
    request<{ conversation: Conversation }>(
      '/chat/conversations/direct',
      { method: 'POST', body: JSON.stringify({ userId }) },
      token
    ).then((data) => ({ conversation: normalizeConversation(data.conversation) })),

  createGroupConversation: (
    token: string,
    payload: { name: string; memberIds: number[]; avatarUrl?: string }
  ) =>
    request<{ conversation: Conversation }>(
      '/chat/conversations/group',
      { method: 'POST', body: JSON.stringify(payload) },
      token
    ).then((data) => ({ conversation: normalizeConversation(data.conversation) })),

  addGroupMember: (token: string, conversationId: string, userId: number) =>
    request<{ message: string }>(
      `/chat/conversations/${conversationId}/members`,
      { method: 'POST', body: JSON.stringify({ userId }) },
      token
    ),

  removeGroupMember: (token: string, conversationId: string, userId: number) =>
    request<{ message: string }>(`/chat/conversations/${conversationId}/members/${userId}`, { method: 'DELETE' }, token),

  leaveGroupConversation: (token: string, conversationId: string) =>
    request<{ message: string }>(`/chat/conversations/${conversationId}/leave`, { method: 'DELETE' }, token),

  updateGroupMemberAdmin: (token: string, conversationId: string, userId: number, isAdmin: boolean) =>
    request<{ message: string }>(
      `/chat/conversations/${conversationId}/admins`,
      { method: 'PATCH', body: JSON.stringify({ userId, isAdmin }) },
      token
    ),

  transferGroupLeader: (token: string, conversationId: string, userId: number) =>
    request<{ message: string }>(
      `/chat/conversations/${conversationId}/leader`,
      { method: 'PATCH', body: JSON.stringify({ userId }) },
      token
    ),

  setGroupDeputy: (token: string, conversationId: string, userId: number | null) =>
    request<{ message: string }>(
      `/chat/conversations/${conversationId}/deputy`,
      { method: 'PATCH', body: JSON.stringify({ userId }) },
      token
    ),

  pinConversation: (token: string, conversationId: string, pinned: boolean) =>
    request<{ message: string; conversation: Conversation }>(
      `/chat/conversations/${conversationId}/pin`,
      { method: pinned ? 'PATCH' : 'DELETE' },
      token
    ).then((data) => ({ ...data, conversation: normalizeConversation(data.conversation) })),

  muteConversation: (token: string, conversationId: string, muted: boolean, mutedUntil?: string | null) =>
    request<{ message: string; conversation: Conversation }>(
      `/chat/conversations/${conversationId}/mute`,
      { method: 'PATCH', body: JSON.stringify({ muted, mutedUntil }) },
      token
    ).then((data) => ({ ...data, conversation: normalizeConversation(data.conversation) })),

  updateConversationPreferences: (
    token: string,
    conversationId: string,
    payload: {
      backgroundUrl?: string | null
      themeColor?: string | null
      autoDeleteAfterSeconds?: number | null
      hidden?: boolean
      locked?: boolean
      hiddenPassword?: string | null
      lockedPassword?: string | null
    }
  ) =>
    request<{ message: string; conversation: Conversation }>(
      `/chat/conversations/${conversationId}/preferences`,
      { method: 'PATCH', body: JSON.stringify(payload) },
      token
    ).then((data) => ({ ...data, conversation: normalizeConversation(data.conversation) })),

  verifyHiddenConversation: (token: string, conversationId: string, hiddenPassword: string) =>
    request<{ ok: boolean; conversation: Conversation }>(
      `/chat/conversations/${conversationId}/hidden/verify`,
      { method: 'POST', body: JSON.stringify({ hiddenPassword }) },
      token
    ).then((data) => ({ ...data, conversation: normalizeConversation(data.conversation) })),

  updateConversationNickname: (token: string, conversationId: string, userId: number, nickname: string | null) =>
    request<{ message: string; conversation: Conversation }>(
      `/chat/conversations/${conversationId}/members/${userId}/nickname`,
      { method: 'PATCH', body: JSON.stringify({ nickname }) },
      token
    ).then((data) => ({ ...data, conversation: normalizeConversation(data.conversation) })),

  updateGroupProfile: (token: string, conversationId: string, payload: { name: string; avatarUrl?: string | null }) =>
    request<{ message: string; conversation: Conversation }>(
      `/chat/conversations/${conversationId}/profile`,
      { method: 'PATCH', body: JSON.stringify(payload) },
      token
    ).then((data) => ({ ...data, conversation: normalizeConversation(data.conversation) })),

  dissolveGroupConversation: (token: string, conversationId: string) =>
    request<{ message: string }>(`/chat/conversations/${conversationId}`, { method: 'DELETE' }, token),

  listMessages: (
    token: string,
    conversationId: string,
    params?: {
      limit?: number
      beforeId?: string
      senderId?: number
      type?: string
      sentDate?: string
      q?: string
    }
  ) => {
    const query = new URLSearchParams()
    if (params?.limit) query.set('limit', String(params.limit))
    if (params?.beforeId) query.set('beforeId', String(params.beforeId))
    if (params?.senderId) query.set('senderId', String(params.senderId))
    if (params?.type) query.set('type', params.type)
    if (params?.sentDate) query.set('sentDate', params.sentDate)
    if (params?.q) query.set('q', params.q)
    const suffix = query.toString() ? `?${query.toString()}` : ''

    return request<{
      messages: ChatMessage[]
      messageLimit?: {
        total: number
        sent: number
        remaining: number
        isFriend: boolean
      } | null
    }>(`/chat/conversations/${conversationId}/messages${suffix}`, { method: 'GET' }, token).then((data) => ({
      ...data,
      messages: (data.messages || []).map(normalizeChatMessage),
    }))
  },

  markConversationRead: (token: string, conversationId: string, lastReadMessageId?: string | null) =>
    request<{ message: string }>(
      `/chat/conversations/${conversationId}/messages/read`,
      { method: 'POST', body: JSON.stringify({ lastReadMessageId }) },
      token
    ),

  getConversationSharedContent: (token: string, conversationId: string) =>
    request<{ photosVideos: ChatMessage[]; files: ChatMessage[]; links: ChatMessage[] }>(
      `/chat/conversations/${conversationId}/shared`,
      { method: 'GET' },
      token
    ).then((data) => ({
      photosVideos: (data.photosVideos || []).map(normalizeChatMessage),
      files: (data.files || []).map(normalizeChatMessage),
      links: (data.links || []).map(normalizeChatMessage),
    })),

  sendMessage: (token: string, conversationId: string, text: string) =>
    request<{ message: ChatMessage }>(
      `/chat/conversations/${conversationId}/messages`,
      { method: 'POST', body: JSON.stringify({ type: 'text', text }) },
      token
    ).then((data) => ({ message: normalizeChatMessage(data.message) })),

  sendMessagePayload: (
    token: string,
    conversationId: string,
    payload: {
      type: 'text' | 'image' | 'video' | 'audio' | 'file' | 'sticker' | 'call-history'
      text?: string
      mediaUrl?: string
      fileName?: string
      mimeType?: string
      fileSize?: number
      sticker?: string
      meta?: Record<string, unknown>
    }
  ) =>
    request<{ message: ChatMessage }>(
      `/chat/conversations/${conversationId}/messages`,
      { method: 'POST', body: JSON.stringify(payload) },
      token
    ).then((data) => ({ message: normalizeChatMessage(data.message) })),

  uploadMessageBase64: (
    token: string,
    conversationId: string,
    payload: { fileName: string; contentType: string; base64Data: string }
  ) =>
    request<{ message?: string; mediaUrl?: string; fileUrl?: string }>(
      `/chat/conversations/${conversationId}/messages/upload-base64`,
      { method: 'POST', body: JSON.stringify(payload) },
      token
    ).then((data) => ({
      message: data.message || 'Uploaded',
      mediaUrl: resolveApiAssetUrl(data.mediaUrl || data.fileUrl || '') || '',
    })),

  reactMessage: (token: string, messageId: string, type: string) =>
    request<{ message: string; chatMessage: ChatMessage }>(
      `/chat/messages/${messageId}/reaction`,
      { method: 'POST', body: JSON.stringify({ type }) },
      token
    ).then((data) => ({ ...data, chatMessage: normalizeChatMessage(data.chatMessage) })),

  removeMessageReaction: (token: string, messageId: string) =>
    request<{ message: string; chatMessage: ChatMessage }>(`/chat/messages/${messageId}/reaction`, { method: 'DELETE' }, token).then((data) => ({
      ...data,
      chatMessage: normalizeChatMessage(data.chatMessage),
    })),

  recallMessage: (token: string, messageId: string) =>
    request<{ message: string; chatMessage: ChatMessage }>(`/chat/messages/${messageId}/recall`, { method: 'PATCH' }, token).then((data) => ({
      ...data,
      chatMessage: normalizeChatMessage(data.chatMessage),
    })),

  deleteMessage: (token: string, messageId: string) =>
    request<{ message: string }>(`/chat/messages/${messageId}`, { method: 'DELETE' }, token),

  pinMessage: (token: string, messageId: string) =>
    request<{ message: string }>(`/chat/messages/${messageId}/pin`, { method: 'PATCH' }, token),

  unpinMessage: (token: string, messageId: string) =>
    request<{ message: string }>(`/chat/messages/${messageId}/pin`, { method: 'DELETE' }, token),

  clearConversationMessages: (token: string, conversationId: string) =>
    request<{ message: string }>(`/chat/conversations/${conversationId}/messages`, { method: 'DELETE' }, token),

  blockUser: (token: string, userId: number) =>
    request<{ message: string }>(`/social/users/${userId}/block`, { method: 'POST' }, token),

  unblockUser: (token: string, userId: number) =>
    request<{ message: string }>(`/social/users/${userId}/block`, { method: 'DELETE' }, token),

  isUserBlocked: (token: string, userId: number) =>
    request<{ blocked: boolean }>(`/social/users/${userId}/block`, { method: 'GET' }, token),

  forwardMessage: (token: string, messageId: string, targetConversationId: string) =>
    request<{ message: string; chatMessage: ChatMessage }>(
      `/chat/messages/${messageId}/forward`,
      { method: 'POST', body: JSON.stringify({ targetConversationId }) },
      token
    ).then((data) => ({ ...data, chatMessage: normalizeChatMessage(data.chatMessage) })),

  aiChat: (token: string | undefined, message: string, history?: { role: 'user' | 'model'; text: string }[]) =>
    request<{ message?: string; reply?: string }>('/social/ai/support', {
      method: 'POST',
      body: JSON.stringify({ message, history }),
    }, token),

  getAiHistory: (token: string) =>
    request<Array<{ role: 'user' | 'model'; text: string }>>('/social/ai/history', { method: 'GET' }, token),

  summarizeChat: (token: string, messages: any[]) =>
    request<{ summary: string }>('/social/ai/summarize', {
      method: 'POST',
      body: JSON.stringify({ messages }),
    }, token),

  suggestReplies: (token: string, messages: any[], currentUserName: string) =>
    request<{ suggestions: string[] }>('/social/ai/suggest-replies', {
      method: 'POST',
      body: JSON.stringify({ messages, currentUserName }),
    }, token),

  analyzeSentiment: (token: string, messages: any[]) =>
    request<{ sentiment: 'positive' | 'neutral' | 'negative'; score: number; detail: string; emotions: string[] }>('/social/ai/analyze-sentiment', {
      method: 'POST',
      body: JSON.stringify({ messages }),
    }, token),

  translateMessage: (token: string, text: string, targetLanguage: string = 'vi') =>
    request<{ translatedText: string; detectedLanguage: string }>('/social/ai/translate', {
      method: 'POST',
      body: JSON.stringify({ text, targetLanguage }),
    }, token),

  notifications: (token: string) =>
    request<{ notifications: NotificationItem[] }>('/social/notifications', { method: 'GET' }, token).then((res) => ({
      notifications: (res.notifications || []).map((item) => normalizeNotification(item as NotificationItem & Record<string, unknown>)),
    })),

  readNotification: (token: string, id: number | string) =>
    request<{ message: string }>(`/social/notifications/${id}/read`, { method: 'PATCH' }, token),

  unreadNotification: (token: string, id: number | string) =>
    request<{ message: string }>(`/social/notifications/${id}/unread`, { method: 'PATCH' }, token),

  readAllNotifications: (token: string) =>
    request<{ message: string }>('/social/notifications/read-all', { method: 'PATCH' }, token),

  deleteNotification: (token: string, id: number | string) =>
    request<{ message: string }>(`/social/notifications/${id}`, { method: 'DELETE' }, token),

  createCall: (
    token: string,
    payload: {
      conversationId: string
      initiatorId: number
      participantIds: number[]
      callSessionId?: string
      callType: 'voice' | 'video'
      mode: 'private' | 'group'
      status: 'completed' | 'missed' | 'rejected' | 'no_answer' | 'cancelled' | 'failed'
      startedAt?: string | number
      answeredAt?: string | number | null
      endedAt?: string | number | null
      durationSec?: number
      participantStatuses?: Array<{
        userId: number
        joinedAt?: string | number | null
        leftAt?: string | number | null
        durationSec?: number
        role?: 'caller' | 'receiver' | 'member'
      }>
      withName?: string
    }
  ) =>
    request<{ id: string }>('/social/calls', { method: 'POST', body: JSON.stringify(payload) }, token),

  getCallHistory: (token: string, limit?: number) => {
    const suffix = limit ? `?limit=${limit}` : ''
    return request<{ calls: CallHistoryItem[] }>(`/social/calls${suffix}`, { method: 'GET' }, token)
  },

  getUserProfile: (token: string, userId: number | string) =>
    request<{ user: User | null; relationship?: { status: string } | null }>(`/social/users/${userId}`, { method: 'GET' }, token)
      .then((r) => ({ user: r.user ? normalizeUser(r.user) : null, relationship: r.relationship })),

  updateUserProfile: (
    token: string,
    payload: { displayName?: string; avatarUrl?: string; sex?: string; dateOfBirth?: string }
  ) =>
    request<{ message: string; user: User }>('/social/users/profile', { method: 'PUT', body: JSON.stringify(payload) }, token),

  getUserPosts: (token: string, userId: number | string, limit?: number) => {
    const suffix = limit ? `?limit=${limit}` : ''
    return request<{ posts: FeedPost[] }>(`/social/users/${userId}/posts${suffix}`, { method: 'GET' }, token).then((res) => ({
      posts: (res.posts || []).map(normalizeFeedPost),
    }))
  },

  submitReport: (
    token: string,
    payload: {
      targetType: 'post' | 'comment' | 'user' | 'message'
      targetId: number | string
      reason: string
      details?: string
    }
  ) =>
    request<{ message: string; report: Record<string, unknown> }>(
      '/social/reports',
      { method: 'POST', body: JSON.stringify(payload) },
      token
    ),

  adminStats: (token: string) => request<{ stats: Record<string, number> }>('/social/admin/stats', { method: 'GET' }, token),

  adminDashboard: (token: string) =>
    request<{ stats: Record<string, number>; recentUsers?: User[]; recentReports?: Array<Record<string, unknown>> }>('/admin/dashboard', { method: 'GET' }, token),

  adminStatistics: (token: string) =>
    request<{ stats: Record<string, number> }>('/admin/statistics', { method: 'GET' }, token),

  adminAuditLogs: (token: string) =>
    request<{ logs: Array<Record<string, unknown>> }>('/admin/audit-logs', { method: 'GET' }, token),

  adminSystemSettings: (token: string) =>
    request<{ settings: Record<string, boolean>; updatedAt?: string | null }>('/admin/settings', { method: 'GET' }, token),

  updateAdminSystemSettings: (token: string, settings: Record<string, boolean>) =>
    request<{ message: string; settings: Record<string, boolean> }>(
      '/admin/settings',
      { method: 'PATCH', body: JSON.stringify({ settings }) },
      token
    ),

  adminReports: (token: string, status?: string) => {
    const suffix = status && status !== 'all' ? `?status=${encodeURIComponent(status)}` : ''
    return request<{ reports: Array<Record<string, unknown>> }>(`/admin/reports${suffix}`, { method: 'GET' }, token)
  },

  assignAdminReport: (token: string, reportId: number, assignedTo: number | null) =>
    request<{ message: string; report: Record<string, unknown> }>(
      `/admin/reports/${reportId}/assign`,
      { method: 'PATCH', body: JSON.stringify({ assignedTo }) },
      token
    ),

  adminModerators: (token: string) =>
    request<{ moderators: User[] }>('/admin/moderators', { method: 'GET' }, token),

  createModerator: (token: string, payload: { username: string; password: string; displayName?: string; email?: string | null; phone?: string | null }) =>
    request<{ message: string; moderator: User }>('/admin/moderators', { method: 'POST', body: JSON.stringify(payload) }, token),

  deleteModerator: (token: string, userId: number) =>
    request<{ message: string; user: User }>(`/admin/moderators/${userId}`, { method: 'DELETE' }, token),

  updateModeratorPermissions: (
    token: string,
    userId: number,
    payload: { role?: 'user' | 'moderator' | 'admin'; accountStatus?: User['accountStatus']; reason?: string; permissions?: string[] }
  ) =>
    request<{ message: string; moderator: User }>(
      `/admin/moderators/${userId}/permissions`,
      { method: 'PATCH', body: JSON.stringify(payload) },
      token
    ),

  deleteAdminUser: (token: string, userId: number) =>
    request<{ message: string; user: User }>(`/admin/users/${userId}`, { method: 'DELETE' }, token),

  moderationDashboard: (token: string) =>
    request<{ stats: Record<string, number>; reports: Array<Record<string, unknown>>; reportedUsers: User[] }>('/moderator/dashboard', { method: 'GET' }, token),

  moderationReports: (token: string, status?: string) => {
    const suffix = status && status !== 'all' ? `?status=${encodeURIComponent(status)}` : ''
    return request<{ reports: Array<Record<string, unknown>> }>(`/moderator/reports${suffix}`, { method: 'GET' }, token)
  },

  getModerationReport: (token: string, reportId: number) =>
    request<{ report: Record<string, unknown> }>(`/moderator/reports/${reportId}`, { method: 'GET' }, token),

  moderationUsers: (token: string) =>
    request<{ users: User[] }>('/moderator/users', { method: 'GET' }, token),

  reviewModerationReport: (
    token: string,
    reportId: number,
    payload: { status: 'PENDING' | 'IN_REVIEW' | 'RESOLVED' | 'REJECTED' | 'pending' | 'reviewed' | 'resolved'; resolutionNote?: string }
  ) =>
    request<{ message: string; report: Record<string, unknown> }>(
      `/moderator/reports/${reportId}/status`,
      { method: 'PATCH', body: JSON.stringify(payload) },
      token
    ),

  assignModerationReport: (token: string, reportId: number, assignedTo: number | null) =>
    request<{ message: string; report: Record<string, unknown> }>(
      `/moderator/reports/${reportId}/assign`,
      { method: 'PATCH', body: JSON.stringify({ assignedTo }) },
      token
    ),

  moderatePost: (
    token: string,
    postId: number | string,
    payload: { status: 'published' | 'hidden' | 'deleted'; resolutionNote?: string }
  ) =>
    request<{ message: string; post: FeedPost }>(
      `/social/moderation/posts/${postId}`,
      { method: 'PATCH', body: JSON.stringify(payload) },
      token
    ),

  warnModerationUser: (token: string, userId: number, reason?: string) =>
    request<{ message: string; user: User }>(`/moderator/users/${userId}/warn`, { method: 'PATCH', body: JSON.stringify({ reason }) }, token),

  restrictModerationUser: (token: string, userId: number, reason?: string) =>
    request<{ message: string; user: User }>(`/moderator/users/${userId}/restrict`, { method: 'PATCH', body: JSON.stringify({ reason }) }, token),

  tempLockModerationUser: (token: string, userId: number, reason?: string) =>
    request<{ message: string; user: User }>(`/moderator/users/${userId}/temp-lock`, { method: 'PATCH', body: JSON.stringify({ reason }) }, token),

  restoreModerationUser: (token: string, userId: number) =>
    request<{ message: string; user: User }>(`/moderator/users/${userId}/restore`, { method: 'PATCH' }, token),

  adminPosts: (
    token: string,
    params?: {
      q?: string
      status?: 'published' | 'hidden' | 'deleted'
      visibility?: 'public' | 'private'
      limit?: number
    }
  ) => {
    const query = new URLSearchParams()
    if (params?.q) query.set('q', params.q)
    if (params?.status) query.set('status', params.status)
    if (params?.visibility) query.set('visibility', params.visibility)
    if (params?.limit) query.set('limit', String(params.limit))
    const suffix = query.toString() ? `?${query.toString()}` : ''
    return request<{ posts: FeedPost[] }>(`/social/admin/posts${suffix}`, { method: 'GET' }, token).then((res) => ({
      posts: (res.posts || []).map(normalizeFeedPost),
    }))
  },

  updateAdminPost: (
    token: string,
    postId: number,
    payload: {
      visibility?: 'public' | 'private'
      status?: 'published' | 'hidden' | 'deleted'
    }
  ) =>
    request<{ message: string; post: FeedPost }>(
      `/social/admin/posts/${postId}`,
      { method: 'PATCH', body: JSON.stringify(payload) },
      token
    ).then((res) => ({
      ...res,
      post: normalizeFeedPost(res.post),
    })),

  deleteAdminPost: (token: string, postId: number) =>
    request<{ message: string }>(`/social/admin/posts/${postId}`, { method: 'DELETE' }, token),

  updateModerationUser: (
    token: string,
    userId: number,
    payload: { role?: 'user' | 'moderator' | 'admin'; accountStatus?: User['accountStatus']; reason?: string; restrictionReason?: string; lockedUntil?: string | null }
  ) =>
    request<{ message: string; user: User }>(
      `/social/admin/users/${userId}`,
      { method: 'PATCH', body: JSON.stringify(payload) },
      token
    ),

  // =========================================================
  // DISCOVERY / RECOMMENDATION ENDPOINTS
  // =========================================================

  discoverFeed: (token: string, limit?: number) =>
    request<{
      posts: FeedPost[]
      friendPosts: FeedPost[]
      recommendedPosts: FeedPost[]
      totalFriends: number
    }>(
      `/social/discover/feed${limit ? `?limit=${limit}` : ''}`,
      { method: 'GET' },
      token
    ).then((res) => ({
      ...res,
      posts: (res.posts || []).map(normalizeFeedPost),
      friendPosts: (res.friendPosts || []).map(normalizeFeedPost),
      recommendedPosts: (res.recommendedPosts || []).map(normalizeFeedPost),
    })),

  getSuggestedUsers: (token: string, limit?: number) =>
    request<{
      users: Array<{
        id: number
        fullName: string
        username: string
        avatarUrl: string | null
        bio: string | null
        location: string | null
        mutualFriends: number
        postCount: number
      }>
    }>(
      `/social/discover/suggested-users${limit ? `?limit=${limit}` : ''}`,
      { method: 'GET' },
      token
    ).then((res) => ({
      users: (res.users || []).map((u) => ({
        ...u,
        avatarUrl: resolveApiAssetUrl(u.avatarUrl),
      })),
    })),

  getTrendingPosts: (token: string, limit?: number) =>
    request<{ posts: FeedPost[] }>(
      `/social/discover/trending-posts${limit ? `?limit=${limit}` : ''}`,
      { method: 'GET' },
      token
    ).then((res) => ({
      posts: (res.posts || []).map(normalizeFeedPost),
    })),

  getTrendingHashtags: (token?: string) =>
    request<{ hashtags: Array<{ tag: string; count: number }> }>(
      '/social/discover/trending-hashtags',
      { method: 'GET' },
      token
    ),
}
