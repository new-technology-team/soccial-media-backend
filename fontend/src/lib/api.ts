import { authStorage } from "./auth";
import type {
  AppNotification,
  AuthResponse,
  AuthUser,
  ChatMessage,
  Conversation,
  FriendItem,
  RegisterResponse,
  UserSettings
} from "../types";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  const accessToken = authStorage.getAccessToken();

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
    const detailedMessage =
      data?.message ||
      data?.issues?.[0]?.message ||
      data?.issues?.[0]?.path?.join?.(".") ||
      "Request failed";
    throw new Error(detailedMessage);
  }

  return data as T;
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

  updateProfile: (payload: { fullName?: string; avatarUrl?: string; dateOfBirth?: string | null; gender?: "male" | "female" | "other" | null }) =>
    request<{ message: string; user: AuthUser }>("/api/auth/me", {
      method: "PUT",
      body: JSON.stringify(payload)
    }),

  getAvatarUploadUrl: (payload: { fileName: string; contentType: string }) =>
    request<{ signedUploadUrl: string; signedReadUrl: string; mediaUrl: string; key: string }>("/api/auth/avatar-upload-url", {
      method: "POST",
      body: JSON.stringify(payload)
    }),

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
      body: file
    });

    if (!response.ok) {
      throw new Error("Tải ảnh đại diện lên S3 thất bại");
    }
  },

  changePassword: (payload: { currentPassword: string; newPassword: string }) =>
    request<{ message: string }>("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify(payload)
    }),

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

  logout: () => request<{ message: string }>("/api/auth/logout", { method: "POST" })
};
