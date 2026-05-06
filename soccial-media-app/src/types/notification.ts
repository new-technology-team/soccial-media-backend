export type Notification = {
  id: string;
  type?: string;
  title: string;
  body?: string;
  isRead: boolean;
  is_read?: boolean;
  meta?: {
    postId?: string;
    commentId?: string;
    actorId?: number;
    [key: string]: unknown;
  } | null;
  createdAt: string;
};
