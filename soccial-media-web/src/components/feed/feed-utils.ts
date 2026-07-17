export const VN_TIMEZONE = "Asia/Ho_Chi_Minh";
export const FEED_BATCH_SIZE = 4;

export const parseFeedDate = (value: string) => {
  const base = new Date(value);
  if (Number.isNaN(base.getTime())) return null;
  return base;
};

export const VN_LOCATIONS = [
  "Hà Nội", "Cao Bằng", "Tuyên Quang", "Lào Cai", "Thái Nguyên",
  "Lai Châu", "Điện Biên", "Sơn La", "Lạng Sơn", "Quảng Ninh",
  "Bắc Ninh", "Phú Thọ", "Hải Phòng", "Hưng Yên", "Ninh Bình",
  "Thanh Hóa", "Nghệ An", "Hà Tĩnh", "Quảng Trị", "Huế",
  "Đà Nẵng", "Quảng Ngãi", "Gia Lai", "Khánh Hòa", "Đắk Lắk",
  "Lâm Đồng", "Đồng Nai", "TP. Hồ Chí Minh", "Tây Ninh", "Đồng Tháp",
  "Vĩnh Long", "An Giang", "Cần Thơ", "Cà Mau",
];

export const POST_REACTIONS = [
  { type: "like", emoji: "👍", label: "Thích" },
  { type: "love", emoji: "❤️", label: "Yêu thích" },
  { type: "haha", emoji: "😆", label: "Haha" },
  { type: "wow", emoji: "😮", label: "Wow" },
  { type: "sad", emoji: "😢", label: "Buồn" },
  { type: "angry", emoji: "😡", label: "Phẫn nộ" },
] as const;

export const getPostReactionMeta = (type: string | null | undefined) =>
  POST_REACTIONS.find((item) => item.type === type) || POST_REACTIONS[0];

export interface ConfirmModalState {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
}

export type ComposerExtraPanel = "tag" | "location" | "emoji" | null;

export interface CommentPaging {
  offset: number;
  total: number;
  hasMore: boolean;
}

export type ShareAudience = "public" | "friends" | "only-me";
export type ShareMode = "profile" | "group" | "message" | "copy";

export type ShareRecipient =
  | {
      kind: "conversation";
      id: string;
      name: string;
      avatarUrl?: string | null;
      type: "direct" | "group";
    }
  | {
      kind: "user";
      id: number;
      name: string;
      avatarUrl?: string | null;
      type: "direct";
    };

// ----- deduplication -----

export const dedupePostsById = <T>(items: T[]): T[] => {
  const seen = new Set<string>();
  const result: T[] = [];
  items.forEach((item) => {
    const id = String((item as Record<string, unknown>).id);
    if (!id || seen.has(id)) return;
    seen.add(id);
    result.push(item);
  });
  return result;
};

export const dedupeCommentsById = <T>(items: T[]): T[] => {
  const seen = new Set<string>();
  const result: T[] = [];
  items.forEach((item) => {
    const id = String((item as Record<string, unknown>).id);
    if (seen.has(id)) return;
    seen.add(id);
    result.push({
      ...item,
      replies: (item as Record<string, unknown>).replies
        ? dedupeCommentsById((item as Record<string, unknown>).replies as T[])
        : [],
    });
  });
  return result;
};

export const appendCommentOnce = <T>(
  items: T[],
  comment: T,
): T[] => {
  const commentId = String((comment as Record<string, unknown>).id);
  const parentId = (comment as Record<string, unknown>).parentCommentId
    ? String((comment as Record<string, unknown>).parentCommentId)
    : null;
  if (!parentId) {
    return items.some((item) => String((item as Record<string, unknown>).id) === commentId)
      ? items
      : [...items, comment];
  }
  return items.map((item) => {
    if (String((item as Record<string, unknown>).id) === parentId) {
      const replies = (item as Record<string, unknown>).replies as T[] | undefined;
      const alreadyExists = (replies || []).some(
        (r) => String((r as Record<string, unknown>).id) === commentId,
      );
      return {
        ...item,
        replies: alreadyExists
          ? replies || []
          : [...(replies || []), comment],
      } as T;
    }
    return {
      ...item,
      replies: (item as Record<string, unknown>).replies
        ? appendCommentOnce((item as Record<string, unknown>).replies as T[], comment)
        : [],
    } as T;
  });
};

export const removeCommentById = <T>(
  items: T[],
  commentId: number | string,
): T[] =>
  items
    .filter((item) => String((item as Record<string, unknown>).id) !== String(commentId))
    .map((item) => ({
      ...item,
      replies: (item as Record<string, unknown>).replies
        ? removeCommentById((item as Record<string, unknown>).replies as T[], commentId)
        : [],
    })) as T[];

export const isVideoMediaUrl = (url: string) =>
  /\.(mp4|webm|ogg|mov|m4v|avi|mkv)(\?.*)?$/i.test(url) ||
  url.includes("/video/");

export const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = () => reject(new Error("Không thể đọc file"));
    reader.readAsDataURL(file);
  });
