import type {
  AuthPayload,
  ChatMessage,
  Conversation,
  FeedComment,
  FriendConnection,
  FeedPost,
  NotificationItem,
  User,
} from '@/types'
import { API_BASE } from '@/config/api'

const resolveApiAssetUrl = (value: string | null | undefined) => {
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
        typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'http://localhost'
      const base = new URL(API_BASE, origin)
      return new URL(value, `${base.origin}/`).toString()
    } catch {
      return value
    }
  }

  return value
}

const normalizeConversation = (conversation: Conversation): Conversation => ({
  ...conversation,
  id: String(conversation.id),
  pinnedMessageIds: (conversation.pinnedMessageIds || []).map((item) => String(item)),
  avatarUrl: resolveApiAssetUrl(conversation.avatarUrl),
  lastMessage: conversation.lastMessage
    ? {
        ...conversation.lastMessage,
        id: String(conversation.lastMessage.id),
        senderId: Number(conversation.lastMessage.senderId || 0),
        senderAvatar: resolveApiAssetUrl(conversation.lastMessage.senderAvatar),
        mediaUrl: resolveApiAssetUrl(conversation.lastMessage.mediaUrl),
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

const normalizeFeedPost = (post: FeedPost): FeedPost => ({
  ...post,
  mediaUrl: resolveApiAssetUrl(post.mediaUrl),
  authorAvatar: resolveApiAssetUrl(post.authorAvatar),
})

export class ApiError extends Error {
  constructor(
    public readonly message: string,
    public readonly code?: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'ApiError';
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

const request = async <T>(
  path: string,
  options: RequestInit = {},
  token?: string
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
        'Không thể kết nối backend API. Hãy chạy server API Ă¡»Ÿ frontend (npm run dev:api) và tĂ¡º£i lại trang.',
        { code: 'BACKEND_UNREACHABLE' }
      )
    }
  }

  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = typeof data.message === 'string' ? data.message : ''
    const lowerMessage = message.toLowerCase()
    const isDbUnavailable =
      response.status === 503 ||
      lowerMessage.includes('database') ||
      lowerMessage.includes('mariadb') ||
      lowerMessage.includes('pool failed')

    if (isDbUnavailable) {
      throw new ApiError('Máy chĂ¡»§ đang mĂ¡º¥t kết nối cơ sĂ¡»Ÿ dĂ¡»¯ liĂ¡»‡u. Vui lòng bĂ¡º­t MariaDB và thĂ¡»  lại.', {
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
      throw new ApiError(message || 'Phiên đăng nhĂ¡º­p đã hết hạn, vui lòng đăng nhĂ¡º­p lại.', {
        status: response.status,
        code: 'AUTH_EXPIRED',
      })
    }

    throw new ApiError(message || 'Request failed', {
      status: response.status,
      code: typeof data.code === 'string' ? data.code : undefined,
    })
  }

  return data as T;
}

/** GET /health — không JWT. Output: { status, service?, now? } */
export async function fetchBackendHealth(): Promise<{ status: string; service?: string; now?: string }> {
  const response = await fetch(`${API_URL}/health`);
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const msg = typeof data.message === "string" ? data.message : `HTTP ${response.status}`;
    throw new Error(msg);
  }
  return data as { status: string; service?: string; now?: string };
}

export const api = {
  register: (payload: {
    emailOrPhone: string;
    password: string;
    fullName?: string;
    dateOfBirth?: string;
    gender?: "male" | "female" | "other";
    avatarUrl?: string;
  }) =>
    request<RegisterResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload)
    }),

  verifyRegistration: (payload: { emailOrPhone: string; code: string }) =>
    request<AuthResponse>("/api/auth/verify-registration", {
      method: "POST",
      body: JSON.stringify(payload)
    }),

  resendVerification: (emailOrPhone: string) =>
    request<{ message: string; verificationCode?: string; otpSent?: boolean; otpChannel?: string; otpDestination?: string; otpReason?: string; otpError?: string }>("/api/auth/resend-verification", {
      method: "POST",
      body: JSON.stringify({ emailOrPhone })
    }),

  login: (payload: { emailOrPhone: string; password: string }) =>
    request<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload)
    }),

  forgotPassword: (emailOrPhone: string) =>
    request<{ message: string; resetCode?: string; otpSent?: boolean; otpChannel?: string; otpDestination?: string; otpReason?: string; otpError?: string }>(
      "/api/auth/forgot-password",
      {
      method: "POST",
      body: JSON.stringify({ emailOrPhone })
      }
    ),

  resetPassword: (payload: { emailOrPhone: string; code: string; newPassword: string }) =>
    request<{ message: string }>("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(payload)
    }),

  refresh: (refreshToken: string) =>
    request<AuthResponse>("/api/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken })
    }),

  me: () => request<AuthUser>("/api/auth/me"),

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

  uploadAvatarBase64: (payload: { fileName: string; contentType: string; base64Data: string }) =>
    request<{ message: string; mediaUrl: string; signedReadUrl: string; key: string }>("/api/auth/avatar-upload-base64", {
      method: "POST",
      body: JSON.stringify(payload)
    }),

  uploadAvatarToSignedUrl: async (signedUploadUrl: string, file: File) => {
    const response = await fetch(signedUploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": file.type || "application/octet-stream"
      },
      token
    ).then((res) => ({
      post: normalizeFeedPost(res.post),
    })),

  updatePost: (
    token: string,
    postId: number | string,
    payload: { content?: string; mediaUrl?: string; visibility?: 'public' | 'private' }
  ) =>
    request<{ message: string; post: FeedPost }>(
      `/social/posts/${postId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
      token
    ).then((res) => ({
      ...res,
      post: normalizeFeedPost(res.post),
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

  reactPost: (token: string, postId: number | string, type = 'like') =>
    request<{ post: FeedPost }>(
      `/social/posts/${postId}/reaction`,
      {
        method: 'POST',
        body: JSON.stringify({ type }),
      },
      token
    ).then((res) => ({
      post: normalizeFeedPost(res.post),
    })),

  unreactPost: (token: string, postId: number | string) =>
    request<{ post: FeedPost }>(`/social/posts/${postId}/reaction`, { method: 'DELETE' }, token).then((res) => ({
      post: normalizeFeedPost(res.post),
    })),

  listComments: (
    postId: number | string,
    token?: string,
    params?: {
      limit?: number
      offset?: number
    }
  },

  addComment: (token: string, postId: number | string, content: string) =>
    request<{ comment: FeedComment }>(
      `/social/posts/${postId}/comments`,
      { method: 'POST', body: JSON.stringify({ content }) },
      token
    ),

  listConversations: () => request<{ conversations: Conversation[] }>("/api/chat/conversations"),

  createDirectConversation: (userId: number) =>
    request<{ conversation: Conversation }>("/api/chat/conversations/direct", {
      method: "POST",
      body: JSON.stringify({ userId })
    }),

  createGroupConversation: (payload: { name: string; memberIds: number[]; avatarUrl?: string }) =>
    request<{ conversation: Conversation }>("/api/chat/conversations/group", {
      method: "POST",
      body: JSON.stringify(payload)
    }),

  getConversationMessages: (conversationId: number, limit = 30) =>
    request<{ messages: ChatMessage[] }>(`/api/chat/conversations/${conversationId}/messages?limit=${limit}`),

  sendMessage: (
    conversationId: number,
    payload: {
      type: "text" | "image" | "video" | "audio" | "file" | "sticker";
      text?: string;
      mediaUrl?: string;
      fileName?: string;
      mimeType?: string;
      fileSize?: number;
      sticker?: string;
    }
  ) =>
    request<{ message: ChatMessage }>(`/api/chat/conversations/${conversationId}/messages`, {
      method: "POST",
      body: JSON.stringify(payload)
    }),

  markSeen: (conversationId: number) =>
    request<{ message: string }>(`/api/chat/conversations/${conversationId}/seen`, {
      method: "PATCH"
    }),

  searchMessages: (keyword: string) =>
    request<{ messages: ChatMessage[] }>(`/api/chat/search/messages?q=${encodeURIComponent(keyword)}`),

  addMember: (conversationId: number, userId: number) =>
    request<{ message: string }>(`/api/chat/conversations/${conversationId}/members`, {
      method: "POST",
      body: JSON.stringify({ userId })
    }),

  removeMember: (conversationId: number, userId: number) =>
    request<{ message: string }>(`/api/chat/conversations/${conversationId}/members/${userId}`, {
      method: "DELETE"
    }),

  updateAdmin: (conversationId: number, userId: number, isAdmin: boolean) =>
    request<{ message: string }>(`/api/chat/conversations/${conversationId}/admins`, {
      method: "PATCH",
      body: JSON.stringify({ userId, isAdmin })
    }),

  toggleConversationNotifications: (conversationId: number, enabled: boolean) =>
    request<{ message: string }>(`/api/chat/conversations/${conversationId}/notifications`, {
      method: "PATCH",
      body: JSON.stringify({ enabled })
    }),

  getMessageUploadUrl: (conversationId: number, payload: { fileName: string; contentType: string }) =>
    request<{ signedUploadUrl: string; mediaUrl: string; key: string }>(
      `/api/chat/conversations/${conversationId}/messages/upload-url`,
      {
        method: "POST",
        body: JSON.stringify(payload)
      }
    ),

  uploadMessageMediaToSignedUrl: async (signedUploadUrl: string, file: File) => {
    const response = await fetch(signedUploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": file.type || "application/octet-stream"
      },
      body: file
    });

    if (!response.ok) {
      throw new Error("Tải file chat lên S3 thất bại");
    }
  },

  uploadMessageBase64: (conversationId: number, payload: { fileName: string; contentType: string; base64Data: string }) =>
    request<{ message: string; mediaUrl: string }>(`/api/chat/conversations/${conversationId}/messages/upload-base64`, {
      method: "POST",
      body: JSON.stringify(payload)
    }),

  listFriends: () => request<{ friends: FriendItem[] }>("/api/social/friends"),

  searchUsers: (keyword: string) =>
    request<{ users: Array<{ id: number; full_name: string; email?: string; phone?: string; avatar_url?: string; is_verified: number }> }>(
      `/api/social/users/search?q=${encodeURIComponent(keyword)}`
    ),

  requestFriend: (userId: number) =>
    request<{ message: string }>("/api/social/friends/request", {
      method: "POST",
      body: JSON.stringify({ userId })
    }),

  acceptFriend: (userId: number) =>
    request<{ message: string }>(`/api/social/friends/${userId}/accept`, {
      method: "POST"
    }),

  removeFriend: (userId: number) =>
    request<{ message: string }>(`/api/social/friends/${userId}`, {
      method: "DELETE"
    }),

  getSettings: () => request<{ settings: UserSettings }>("/api/social/settings"),

  updateSettings: (payload: Partial<UserSettings>) =>
    request<{ message: string; settings: UserSettings }>("/api/social/settings", {
      method: "PUT",
      body: JSON.stringify(payload)
    }),

  listNotifications: () => request<{ notifications: AppNotification[] }>("/api/social/notifications"),

  readNotification: (id: number) =>
    request<{ message: string }>(`/api/social/notifications/${id}/read`, {
      method: "PATCH"
    }),

  readAllNotifications: () =>
    request<{ message: string }>("/api/social/notifications/read-all", {
      method: "PATCH"
    }),

  // ─── Feed / Posts ───────────────────────────────────────────────
  listFeed: (limit = 30) =>
    request<{ posts: unknown[] }>(`/api/social/feed?limit=${limit}`),

  createPost: (payload: { content: string; mediaUrl?: string; visibility?: string }) =>
    request<{ post: unknown }>("/api/social/posts", {
      method: "POST",
      body: JSON.stringify(payload)
    }),

  leaveGroupConversation: (token: string, conversationId: string) =>
    request<{ message: string }>(`/chat/conversations/${conversationId}/leave`, { method: 'DELETE' }, token),

  updateGroupMemberAdmin: (token: string, conversationId: string, userId: number, isAdmin: boolean) =>
    request<{ message: string }>(
      `/chat/conversations/${conversationId}/admins`,
      { method: 'PATCH', body: JSON.stringify({ userId, isAdmin }) },
      token
    ),

  updatePost: (id: string, payload: { content?: string; mediaUrl?: string; visibility?: string }) =>
    request<{ post: unknown }>(`/api/social/posts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),

  deletePost: (id: string) =>
    request<{ message: string }>(`/api/social/posts/${id}`, {
      method: "DELETE"
    }),

  reactPost: (id: string, type = "like") =>
    request<{ message: string }>(`/api/social/posts/${id}/reaction`, {
      method: "POST",
      body: JSON.stringify({ type })
    }),

  unreactPost: (id: string) =>
    request<{ message: string }>(`/api/social/posts/${id}/reaction`, {
      method: "DELETE"
    }),

  uploadPostMediaBase64: (payload: { fileName: string; contentType: string; base64Data: string }) =>
    request<{ mediaUrl: string; key: string }>("/api/social/posts/media/upload-base64", {
      method: "POST",
      body: JSON.stringify(payload)
    }),

  // ─── Comments ──────────────────────────────────────────────────
  addComment: (postId: string, content: string, parentId?: string) =>
    request<{ comment: unknown }>(`/api/social/posts/${postId}/comments`, {
      method: "POST",
      body: JSON.stringify({ content, parentId })
    }),

  listComments: (postId: string) =>
    request<{ comments: unknown[] }>(`/api/social/posts/${postId}/comments`),

  reactComment: (id: string, type = "like") =>
    request<{ message: string }>(`/api/social/comments/${id}/reaction`, {
      method: "POST",
      body: JSON.stringify({ type })
    }),

  reactMessage: (token: string, messageId: string, type: string) =>
    request<{ message: string; chatMessage: ChatMessage }>(
      `/chat/messages/${messageId}/reaction`,
      { method: 'POST', body: JSON.stringify({ type }) },
      token
    ).then((data) => ({ ...data, chatMessage: normalizeChatMessage(data.chatMessage) })),

  deleteComment: (id: string) =>
    request<{ message: string }>(`/api/social/comments/${id}`, {
      method: "DELETE"
    }),

  // ─── Reports ────────────────────────────────────────────────────
  submitReport: (payload: { targetType: string; targetId: string | number; reason: string; details?: string }) =>
    request<{ message: string }>("/api/social/reports", {
      method: "POST",
      body: JSON.stringify(payload)
    }),

  // ─── Admin ──────────────────────────────────────────────────────
  adminStats: () =>
    request<{ stats: unknown }>("/api/admin/stats"),

  adminPosts: (page = 1, limit = 20) =>
    request<{ posts: unknown[]; total: number }>(`/api/admin/posts?page=${page}&limit=${limit}`),

  adminUsers: (page = 1, limit = 20) =>
    request<{ users: unknown[]; total: number }>(`/api/admin/users?page=${page}&limit=${limit}`),

  moderationUsers: (page = 1, limit = 20) =>
    request<{ users: unknown[]; total: number }>(`/api/admin/users?page=${page}&limit=${limit}`),

  moderationReports: (page = 1, limit = 20) =>
    request<{ reports: unknown[]; total: number }>(`/api/admin/reports?page=${page}&limit=${limit}`),

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

  deleteAdminPost: (id: number) =>
    request<{ message: string }>(`/api/admin/posts/${id}`, {
      method: "DELETE"
    }),

  updateAdminUser: (id: number, payload: { accountStatus?: string; role?: string }) =>
    request<{ message: string }>(`/api/admin/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),

  resolveReport: (id: number) =>
    request<{ message: string }>(`/api/admin/reports/${id}/resolve`, {
      method: "PATCH"
    }),

  // ─── AI Chat ────────────────────────────────────────────────────
  aiChat: (message: string, history?: Array<{ role: string; content: string }>) =>
    request<{ reply: string }>("/api/ai/chat", {
      method: "POST",
      body: JSON.stringify({ message, history })
    }),

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
      content?: string
      mediaUrl?: string | null
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
    payload: { role?: 'user' | 'moderator' | 'admin'; accountStatus?: 'active' | 'restricted' | 'hidden' | 'deleted' }
  ) =>
    request<{ message: string; user: User }>(
      `/social/admin/users/${userId}`,
      { method: 'PATCH', body: JSON.stringify(payload) },
      token
    ),
}

