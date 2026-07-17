export type MemberLike = {
  userId: number;
  username?: string;
  displayName?: string;
  fullName?: string;
  avatarUrl?: string | null;
  role?: string;
  roleInConversation?: string;
  notificationsEnabled?: boolean;
  lastReadAt?: Date | null;
};

export type SendMessageData = {
  type?: string;
  text?: string;
  mediaUrl?: string;
  fileName?: string;
  fileSize?: number;
  meta?: Record<string, any> | null;
};

export type BlockFlags = {
  isBlockedByMe: boolean;
  isBlockedMe: boolean;
};

export type NotifyPayload = {
  type: string;
  title: string;
  content: string;
  meta?: Record<string, any> | null;
};
