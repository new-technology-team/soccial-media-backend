export type AuthUser = {
  id: number;
  email?: string | null;
  phone?: string | null;
  fullName: string;
  dateOfBirth?: string | null;
  gender?: "male" | "female" | "other" | null;
  avatarUrl?: string | null;
  isVerified?: boolean;
  createdAt?: string;
};

export type AuthResponse = {
  access_token: string;
  refresh_token: string;
  user: AuthUser;
};

export type RegisterResponse = {
  message: string;
  requiresVerification: boolean;
  emailOrPhone: string;
  otpSent?: boolean;
  otpChannel?: "email" | "sms" | "debug";
  otpDestination?: string;
  otpReason?: string;
  otpError?: string;
  verificationCode?: string;
};

export type ConversationMember = {
  userId: number;
  fullName: string;
  avatarUrl?: string | null;
  email?: string | null;
  phone?: string | null;
  role: "admin" | "member";
  notificationsEnabled: boolean;
  joinedAt?: string;
  lastReadAt?: string | null;
};

export type Conversation = {
  id: number;
  type: "direct" | "group";
  name?: string | null;
  avatarUrl?: string | null;
  createdBy: number;
  createdAt?: string;
  updatedAt?: string;
  role?: "admin" | "member";
  unreadCount: number;
  notificationsEnabled: boolean;
  lastReadAt?: string | null;
  lastMessage?: {
    id: number;
    senderId: number;
    type: "text" | "image" | "video" | "audio" | "file" | "sticker";
    text?: string | null;
    mediaUrl?: string | null;
    createdAt?: string;
  } | null;
  members: ConversationMember[];
};

export type ChatMessage = {
  id: number;
  conversationId: number;
  senderId: number;
  senderName: string;
  senderAvatar?: string | null;
  type: "text" | "image" | "video" | "audio" | "file" | "sticker";
  text?: string | null;
  mediaUrl?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  meta?: {
    sticker?: string;
  } | null;
  createdAt?: string;
  updatedAt?: string;
};

export type FriendItem = {
  id: number;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  isVerified: boolean;
  status: "pending" | "accepted";
  requestedByMe: boolean;
  createdAt?: string;
};

export type AppNotification = {
  id: number;
  user_id: number;
  type: string;
  title: string;
  body?: string | null;
  meta_json?: string | null;
  is_read: number;
  created_at: string;
};

export type UserSettings = {
  privacyLastSeen: boolean;
  privacyProfilePhoto: boolean;
  allowFriendRequests: boolean;
  notificationMessages: boolean;
  notificationCalls: boolean;
  updatedAt?: string;
};
