'use client'

import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link } from "react-router-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Bell,
  CircleHelp,
  Dot,
  Ellipsis,
  Heart,
  Image as ImageIcon,
  MessageCircle,
  MoreHorizontal,
  Settings,
  Share2,
  Smile,
  UserPlus,
  X,
  MapPin,
} from 'lucide-react'
import { api, isAuthExpiredError } from '@/api/client'
import type { FeedComment, FeedPost } from '@/types'
import { useAuthStore } from '@/contexts/auth-store'
import styles from './page.module.css'

const VN_TIMEZONE = "Asia/Ho_Chi_Minh";
const FEED_BATCH_SIZE = 4;
const VN_UTC_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Transform backend post response shape to FeedPost. */
function toFeedPost(
  raw: Record<string, unknown>,
): import("@/lib/types").FeedPost {
  const owner = raw.owner as Record<string, unknown> | undefined;
  const rawId = raw.id;
  const id: string | number =
    typeof rawId === "string" && /^[0-9a-fA-F]{24}$/.test(rawId)
      ? rawId
      : Number(rawId ?? 0);
  return {
    id,
    authorId: Number(owner?.userId ?? 0),
    authorName: String(owner?.displayName ?? raw.title ?? "Người dùng"),
    authorAvatar: (owner?.avatarUrl as string | undefined) ?? null,
    content: String(raw.content ?? raw.title ?? ""),
    mediaUrl: (raw.mediaUrl as string) || null,
    visibility: (raw.visibility as "public" | "private") || "public",
    status: (raw.status as "published" | "hidden" | "deleted") || "published",
    reactionCount: Number(raw.reactionCount ?? 0),
    commentCount: Number(raw.commentCount ?? 0),
    viewerReaction: (raw.viewerReaction as string | null) ?? null,
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
  };
}

const parseFeedDate = (value: string) => {
  const base = new Date(value);
  if (Number.isNaN(base.getTime())) return new Date();

  // Backend currently returns Z-suffixed values that are shifted by UTC offset.
  // Add 7h to align wall-clock posting time for feed display.
  if (typeof value === "string" && value.endsWith("Z")) {
    return new Date(base.getTime() + VN_UTC_OFFSET_MS);
  }

  return base;
};

const VN_LOCATIONS = [
  'Hà NĂ¡»™i',
  'Hà Nam',
  'Hà Giang',
  'Hà Tĩnh',
  'HĂ¡º£i Phòng',
  'HĂ¡º£i Dương',
  'ĐĂ  Nẵng',
  'HuĂ¡º¿',
  'NghĂ¡»‡ An',
  'Thanh Hóa',
  'QuĂ¡º£ng Ninh',
  'Nha Trang',
  'ĐĂ  Lạt',
  'TP. HĂ¡»“ Chí Minh',
  'Cần Thơ',
  'An Giang',
  'Kiên Giang',
]

const POST_REACTIONS = [
  { type: 'like', emoji: '👍', label: 'Thích' },
  { type: 'love', emoji: '❤️', label: 'Yêu thích' },
  { type: 'haha', emoji: '😆', label: 'Haha' },
  { type: 'wow', emoji: '😮', label: 'Wow' },
  { type: 'sad', emoji: '😢', label: 'Buồn' },
  { type: 'angry', emoji: '😡', label: 'Phẫn nộ' },
] as const

const getPostReactionMeta = (type: string | null | undefined) =>
  POST_REACTIONS.find((item) => item.type === type) || POST_REACTIONS[0]

const dedupePostsById = (items: FeedPost[]) => {
  const seen = new Set<string | number>();
  const result: FeedPost[] = [];
  items.forEach((item) => {
    if (seen.has(item.id)) return;
    seen.add(item.id);
    result.push(item);
  });
  return result;
};

const isVideoMediaUrl = (url: string) =>
  /\.(mp4|webm|ogg|mov|m4v|avi|mkv)(\?.*)?$/i.test(url) || url.includes('/video/')

type ComposerExtraPanel = 'tag' | 'location' | 'emoji' | null

type CommentPaging = {
  offset: number;
  total: number;
  hasMore: boolean;
};

export default function FeedPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = useAuthStore((state) => state.accessToken);
  const me = useAuthStore((state) => state.user);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [isLoadingFeed, setIsLoadingFeed] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [modalContent, setModalContent] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>(
    {},
  );
  const [isCommenting, setIsCommenting] = useState<Record<string, boolean>>({});
  const [modalMediaUrl, setModalMediaUrl] = useState("");
  const [modalVisibility, setModalVisibility] = useState<"public" | "private">(
    "public",
  );
  const [modalLocation, setModalLocation] = useState("");
  const [modalTaggedFriend, setModalTaggedFriend] = useState("");
  const [tagKeyword, setTagKeyword] = useState("");
  const [locationKeyword, setLocationKeyword] = useState("");
  const [tagSuggestions, setTagSuggestions] = useState<
    Array<{ id: number; name: string }>
  >([]);
  const [commentLists, setCommentLists] = useState<
    Record<string, FeedComment[]>
  >({});
  const [expandedComments, setExpandedComments] = useState<
    Record<string, boolean>
  >({});
  const [loadingComments, setLoadingComments] = useState<
    Record<string, boolean>
  >({});
  const [loadingMoreComments, setLoadingMoreComments] = useState<
    Record<string, boolean>
  >({});
  const [commentPaging, setCommentPaging] = useState<
    Record<string, CommentPaging>
  >({});
  const [shareTargetPostId, setShareTargetPostId] = useState<
    string | number | null
  >(null);
  const [shareConversations, setShareConversations] = useState<
    Array<{ id: string | number; name: string | null }>
  >([]);
  const [activePostMenuId, setActivePostMenuId] = useState<
    string | number | null
  >(null);
  const [hiddenPostIds, setHiddenPostIds] = useState<Record<string, boolean>>(
    {},
  );
  const [editingPostId, setEditingPostId] = useState<string | number | null>(
    null,
  );
  const [isSavingPostEdit, setIsSavingPostEdit] = useState(false);
  const [composerMoreMenuOpen, setComposerMoreMenuOpen] = useState(false);
  const [postEditDraft, setPostEditDraft] = useState<{
    content: string
    mediaUrl: string
    visibility: 'public' | 'private'
  } | null>(null)
  const [showEmojiTray, setShowEmojiTray] = useState(false)
  const [activeComposerPanel, setActiveComposerPanel] = useState<ComposerExtraPanel>(null)
  const [timeTick, setTimeTick] = useState(0)
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const [openReactionPostId, setOpenReactionPostId] = useState<number | null>(null)
  const [visiblePostsCount, setVisiblePostsCount] = useState(FEED_BATCH_SIZE)
  const mediaInputRef = useRef<HTMLInputElement | null>(null)
  const feedBottomSentinelRef = useRef<HTMLDivElement | null>(null)
  const isGuestView = !token

  const resetComposerPanels = () => {
    setShowEmojiTray(false);
    setActiveComposerPanel(null);
    setComposerMoreMenuOpen(false);
    setTagKeyword("");
    setLocationKeyword("");
    setTagSuggestions([]);
  };

  const closeComposerModal = () => {
    resetComposerPanels();
    setIsModalOpen(false);
  };

  const handleAuthExpired = useCallback((error: unknown, fallbackMessage = 'Phiên đăng nhĂ¡º­p đã hết hạn, vui lòng đăng nhĂ¡º­p lại.') => {
    if (!isAuthExpiredError(error)) return false
    setErrorText(fallbackMessage)
    clearAuth()
    navigate('/auth/login?reason=session-expired')
    return true
  }, [clearAuth, navigate])

  useEffect(() => {
    const loadFeed = async () => {
      setIsLoadingFeed(true);
      setFeedError(null);
      try {
        const response = await api.listFeed();
        const rawPosts = Array.isArray(response.posts) ? response.posts : [];
        const dedupedPosts = dedupePostsById(
          (rawPosts as Record<string, unknown>[]).map(toFeedPost),
        );
        setPosts(dedupedPosts);
        setVisiblePostsCount(
          Math.min(FEED_BATCH_SIZE, dedupedPosts.length || FEED_BATCH_SIZE),
        );
      } catch (error) {
        if (handleAuthExpired(error)) return;
        console.error("Failed to load feed", error);
        setFeedError(
          error instanceof Error ? error.message : "Không thể tải bảng tin.",
        );
      } finally {
        setIsLoadingFeed(false);
      }
    };

    loadFeed();
  }, [handleAuthExpired, token]);

  useEffect(() => {
    if (!posts.length) {
      setVisiblePostsCount(FEED_BATCH_SIZE);
      return;
    }

    setVisiblePostsCount((prev) => {
      if (prev < FEED_BATCH_SIZE) {
        return Math.min(FEED_BATCH_SIZE, posts.length);
      }
      return Math.min(prev, posts.length);
    });
  }, [posts.length]);

  useEffect(() => {
    if (searchParams.get("compose") === "1") {
      setIsModalOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!token || !tagKeyword.trim()) {
      setTagSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const result = await api.searchUsers(tagKeyword.trim());
        setTagSuggestions(
          (result.users || [])
            .map((item) => ({
              id: Number(item.id || 0),
              name: String(item.full_name || item.fullName || 'NgưĂ¡»i dùng'),
            }))
            .filter((item) => item.id > 0)
            .slice(0, 8),
        );
      } catch (error) {
        if (handleAuthExpired(error)) return;
        console.error("Failed to search users for tagging", error);
        setTagSuggestions([]);
      }
    }, 260);

    return () => clearTimeout(timer);
  }, [handleAuthExpired, tagKeyword, token]);

  useEffect(() => {
    if (!token) return;
    if (shareTargetPostId === null) return;

    api
      .listConversations()
      .then((result) =>
        setShareConversations(
          result.conversations.map((item) => ({
            id: item.id,
            name: item.name ?? null,
          })),
        ),
      )
      .catch((error) => {
        if (handleAuthExpired(error)) return;
        console.error("Failed to load conversations for sharing", error);
      });
  }, [handleAuthExpired, shareTargetPostId, token]);

  useEffect(() => {
    const timer = setInterval(() => setTimeTick((prev) => prev + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  const suggestedPeople = useMemo(() => {
    const byAuthor = new Map<
      number,
      { id: number; name: string; postCount: number }
    >();

    posts.forEach((post) => {
      if (me?.id && post.authorId === me.id) return;
      const current = byAuthor.get(post.authorId);
      if (current) {
        current.postCount += 1;
        return;
      }
      byAuthor.set(post.authorId, {
        id: post.authorId,
        name: post.authorName,
        postCount: 1,
      });
    });

    return Array.from(byAuthor.values())
      .sort((a, b) => b.postCount - a.postCount)
      .slice(0, 6);
  }, [me?.id, posts]);

  const filteredPosts = useMemo(
    () => posts.filter((post) => !hiddenPostIds[post.id]),
    [hiddenPostIds, posts],
  );
  const visiblePosts = useMemo(
    () => filteredPosts.slice(0, visiblePostsCount),
    [filteredPosts, visiblePostsCount],
  );
  const hasMorePosts = visiblePostsCount < filteredPosts.length;

  useEffect(() => {
    if (!hasMorePosts) return;
    const node = feedBottomSentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setVisiblePostsCount((prev) =>
          Math.min(filteredPosts.length, prev + FEED_BATCH_SIZE),
        );
      },
      {
        root: null,
        rootMargin: "260px 0px",
        threshold: 0.05,
      },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [filteredPosts.length, hasMorePosts]);

  useEffect(() => {
    if (!activePostMenuId) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('[data-post-menu-root="true"]')) return;
      setActivePostMenuId(null);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActivePostMenuId(null);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [activePostMenuId]);

  useEffect(() => {
    if (!composerMoreMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('[data-composer-more-root="true"]')) return;
      setComposerMoreMenuOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setComposerMoreMenuOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [composerMoreMenuOpen]);

  const hotTopics = useMemo(() => {
    const tags = new Map<string, number>();

    posts.forEach((post) => {
      const matches = post.content.match(/#[^\s#.,!?;:]+/g) || [];
      matches.forEach((rawTag) => {
        const tag = rawTag.trim();
        if (!tag || tag.length < 2) return;
        tags.set(tag, (tags.get(tag) || 0) + 1);
      });
    });

    return Array.from(tags.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([tag, count]) => ({
        tag,
        text: `Có ${count} bài viết gần đây nhĂ¡º¯c đến chĂ¡»§ đĂ¡» này`,
        count: `${count} bài viết`,
      }));
  }, [posts]);

  const formatTime = (value: string) => {
    void timeTick;
    const date = parseFeedDate(value);
    const diffMs = Math.max(0, Date.now() - date.getTime());
    const diffMinutes = Math.floor(diffMs / (60 * 1000));
    const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

    if (diffMinutes < 1) return 'vĂ¡»«a xong'
    if (diffMinutes < 60) return `${diffMinutes} phút`
    if (diffHours < 24) return `${diffHours} giĂ¡»`
    if (diffDays < 7) return `${diffDays} ngày`

    return new Intl.DateTimeFormat("vi-VN", {
      timeZone: VN_TIMEZONE,
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  };

  const formatExactTime = (value: string) =>
    new Intl.DateTimeFormat("vi-VN", {
      timeZone: VN_TIMEZONE,
      hour12: false,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(parseFeedDate(value));

  const submitPost = async (payload: {
    text: string;
    mediaUrl?: string;
    visibility?: "public" | "private";
    location?: string;
    taggedFriend?: string;
  }) => {
    const textWithMeta = [
      payload.text.trim(),
      payload.taggedFriend ? `\n\nÄ‘Ÿ‘¥ Cùng vĂ¡»›i: ${payload.taggedFriend.trim()}` : '',
      payload.location ? `\nÄ‘Ÿ“ ĐĂ¡»‹a điĂ¡»ƒm: ${payload.location.trim()}` : '',
    ]
      .filter(Boolean)
      .join("");

    if (!textWithMeta && !payload.mediaUrl?.trim()) return;
    if (!token) {
      setErrorText('Phiên đăng nhĂ¡º­p đã hết hạn, vui lòng đăng nhĂ¡º­p lại.')
      navigate('/auth/login')
      return
    }
    setIsPosting(true);
    setErrorText("");
    try {
      const response = await api.createPost({
        content: textWithMeta,
        mediaUrl: payload.mediaUrl?.trim() || undefined,
        visibility: payload.visibility || "public",
      });
      setPosts((prev) =>
        dedupePostsById([
          toFeedPost(response.post as Record<string, unknown>),
          ...prev,
        ]),
      );
      setContent("");
      setModalContent("");
      setModalMediaUrl("");
      setModalLocation("");
      setModalTaggedFriend("");
      resetComposerPanels();
      setModalVisibility("public");
      setIsModalOpen(false);
    } catch (error) {
      if (handleAuthExpired(error)) return;
      if (error instanceof Error) {
        setErrorText(error.message || "Không thể tạo bài viết");
      } else {
        setErrorText("Không thể tạo bài viết");
      }
      console.error("Failed to create post", error);
    } finally {
      setIsPosting(false);
    }
  };

  const handlePostReaction = async (post: FeedPost, reactionType: string) => {
    if (!token) {
      navigate("/auth/login");
      return;
    }
    try {
      const response = post.viewerReaction === reactionType
        ? await api.unreactPost(token, post.id)
        : await api.reactPost(token, post.id, reactionType)
      setPosts((prev) => prev.map((item) => (item.id === post.id ? response.post : item)))
      setOpenReactionPostId(null)
    } catch (error) {
      if (handleAuthExpired(error)) return;
      console.error("Failed to react post", error);
    }
  };

  const handleAddComment = async (postId: string | number) => {
    const value = (commentInputs[postId] || "").trim();
    if (!value) return;
    if (!token) {
      navigate("/auth/login");
      return;
    }

    setIsCommenting((prev) => ({ ...prev, [postId]: true }));
    try {
      const comment = await api.addComment(String(postId), value);
      setPosts((prev) =>
        prev.map((item) =>
          item.id === postId
            ? { ...item, commentCount: Number(item.commentCount || 0) + 1 }
            : item,
        ),
      );
      setCommentLists((prev) => ({
        ...prev,
        [postId]: [...(prev[postId] || []), comment as unknown as FeedComment],
      }));
      setCommentPaging((prev) => {
        const current = prev[postId];
        if (!current) return prev;
        return {
          ...prev,
          [postId]: {
            ...current,
            offset: current.offset + 1,
            total: current.total + 1,
          },
        };
      });
      setExpandedComments((prev) => ({ ...prev, [postId]: true }));
      setCommentInputs((prev) => ({ ...prev, [postId]: "" }));
    } catch (error) {
      if (handleAuthExpired(error)) return;
      console.error("Failed to add comment", error);
    } finally {
      setIsCommenting((prev) => ({ ...prev, [postId]: false }));
    }
  };

  const handleShare = async (post: FeedPost) => {
    try {
      setShareTargetPostId((prev) => (prev === post.id ? null : post.id));
    } catch (error) {
      console.error("Failed to share post", error);
    }
  };

  const handleShareToProfile = async (post: FeedPost) => {
    if (!token) {
      navigate("/auth/login");
      return;
    }

    const link = `${window.location.origin}/posts/${post.id}`;
    try {
      await api.createPost(token, {
        content: `Ä‘Ÿ” Chia sẻ tĂ¡»« ${post.authorName}\n\n${post.content.slice(0, 360)}\n\nXem bài gĂ¡»‘c: ${link}`,
        visibility: 'public',
      })
      const refreshed = await api.listFeed(token)
      setPosts(dedupePostsById(refreshed.posts))
      setErrorText('ĐĂ£ chia sẻ lên trang cá nhân.')
      setShareTargetPostId(null)
    } catch (error) {
      if (handleAuthExpired(error)) return;
      console.error("Failed to share to profile", error);
    }
  };

  const handleShareToConversation = async (
    post: FeedPost,
    conversationId: string | number,
  ) => {
    if (!token) {
      navigate("/auth/login");
      return;
    }

    const link = `${window.location.origin}/posts/${post.id}`;
    try {
      await api.sendMessage(token, conversationId, `Ä‘Ÿ“¨ ${me?.fullName || 'Bạn của bạn'} đã chia sẻ mĂ¡»™t bài viết:\n${post.content.slice(0, 240)}\n${link}`)
      setErrorText('ĐĂ£ chia sẻ bài viết vào tin nhĂ¡º¯n.')
      setShareTargetPostId(null)
    } catch (error) {
      if (handleAuthExpired(error)) return;
      console.error("Failed to share to conversation", error);
    }
  };

  const handleCopyLink = async (postId: string | number) => {
    const url = `${window.location.origin}/posts/${postId}`;
    try {
      await navigator.clipboard.writeText(url)
      setErrorText('ĐĂ£ sao chép liên kĂ¡º¿t bài viết.')
      setShareTargetPostId(null)
    } catch (error) {
      console.error("Failed to copy link", error);
    }
  };

  const handleCopyPostId = async (postId: string | number) => {
    try {
      await navigator.clipboard.writeText(String(postId))
      setErrorText(`ĐĂ£ sao chép ID bài viết: #${postId}`)
      setActivePostMenuId(null)
    } catch (error) {
      console.error("Failed to copy post id", error);
    }
  };

  const canManagePost = (post: FeedPost) => {
    if (!me) return false;
    return post.authorId === me.id;
  };

  const handleStartEditPost = (post: FeedPost) => {
    setPostEditDraft({
      content: post.content || "",
      mediaUrl: post.mediaUrl || "",
      visibility: post.visibility,
    });
    setEditingPostId(post.id);
    setActivePostMenuId(null);
  };

  const handleCancelEditPost = () => {
    setEditingPostId(null);
    setPostEditDraft(null);
  };

  const handleSaveEditPost = async (post: FeedPost) => {
    if (!token) {
      navigate("/auth/login");
      return;
    }
    if (!postEditDraft) return;

    const contentText = postEditDraft.content.trim();
    const mediaText = postEditDraft.mediaUrl.trim();
    if (!contentText && !mediaText) {
      setErrorText('Bài viĂ¡º¿t cần có nĂ¡»™i dung hoặc media.')
      return
    }

    try {
      setIsSavingPostEdit(true);
      const updated = await api.updatePost(String(post.id), {
        content: contentText,
        mediaUrl: mediaText || undefined,
        visibility: postEditDraft.visibility,
      })
      setPosts((prev) => prev.map((item) => (item.id === post.id ? updated.post : item)))
      setErrorText('ĐĂ£ cĂ¡º­p nhĂ¡º­t bài viết.')
      handleCancelEditPost()
    } catch (error) {
      if (handleAuthExpired(error)) return
      console.error('Failed to update post', error)
      setErrorText('Không thể cĂ¡º­p nhĂ¡º­t bài viết. Vui lòng thĂ¡»  lại.')
    } finally {
      setIsSavingPostEdit(false);
    }
  };

  const handleDeletePost = async (post: FeedPost) => {
    if (!token) {
      navigate("/auth/login");
      return;
    }

    const approved = window.confirm('Bạn có chĂ¡º¯c muĂ¡»‘n xóa bài viết này?')
    if (!approved) return

    try {
      await api.deletePost(String(post.id));
      setPosts((prev) => prev.filter((item) => item.id !== post.id));
      setShareTargetPostId((prev) => (prev === post.id ? null : prev));
      setActivePostMenuId(null);
      if (editingPostId === post.id) {
        handleCancelEditPost();
      }
      setErrorText('ĐĂ£ xóa bài viết.')
    } catch (error) {
      if (handleAuthExpired(error)) return
      console.error('Failed to delete post', error)
      setErrorText('Không thể xóa bài viết. Vui lòng thĂ¡»  lại.')
    }
  };

  const handleHidePost = (postId: number) => {
    setHiddenPostIds((prev) => ({ ...prev, [postId]: true }))
    setActivePostMenuId(null)
    setErrorText('ĐĂ£ ẩn bài viết khĂ¡»i bĂ¡º£ng tin của bạn.')
  }

  const handleReportPost = async (post: FeedPost) => {
    if (!token) {
      navigate("/auth/login");
      return;
    }

    try {
      await api.submitReport({
        targetType: "post",
        targetId: post.id,
        reason: 'NĂ¡»™i dung không phù hĂ¡»£p trên bĂ¡º£ng tin',
        details: `Bài viĂ¡º¿t tĂ¡»« ${post.authorName}`,
      })
      setActivePostMenuId(null)
      setErrorText('ĐĂ£ gĂ¡» i báo cáo bài viết. CĂ¡º£m ơn bạn đã phĂ¡º£n hĂ¡»“i.')
    } catch (error) {
      if (handleAuthExpired(error)) return
      console.error('Failed to report post', error)
      setErrorText('Không thể gĂ¡» i báo cáo bài viết. Vui lòng thĂ¡»  lại.')
    }
  };

  const fileToBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : ''
        resolve(result.includes(',') ? result.split(',')[1] : result)
      }
      reader.onerror = () => reject(new Error('Không thể đĂ¡»c file'))
      reader.readAsDataURL(file)
    })

  const handleChooseMediaFile = () => {
    mediaInputRef.current?.click();
  };

  const handleSelectedMedia = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !token) return;

    const maxBytes = 15 * 1024 * 1024
    if (file.size > maxBytes) {
      setErrorText('Media quá lớn. Vui lòng chọn tệp nhỏ hơn 15MB.')
      event.target.value = ''
      return
    }

    setUploadingMedia(true)
    setErrorText('')
    try {
      const base64Data = await fileToBase64(file);
      const uploaded = await api.uploadPostMediaBase64({
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        base64Data,
      })
      if (!uploaded.mediaUrl) {
        throw new Error('Upload media thất bại, không nhận được URL.')
      }
      setModalMediaUrl(uploaded.mediaUrl)
    } catch (error) {
      if (handleAuthExpired(error)) return
      console.error('Failed to upload post media', error)
      setErrorText(error instanceof Error ? error.message : 'Không thể tải ảnh/video lên bài viết.')
    } finally {
      setUploadingMedia(false);
      event.target.value = "";
    }
  };

  const handleToggleComments = async (postId: string | number) => {
    const opened = expandedComments[postId];
    setExpandedComments((prev) => ({ ...prev, [postId]: !opened }));
    if (opened) return;
    if (commentLists[postId]) return;

    setLoadingComments((prev) => ({ ...prev, [postId]: true }));
    try {
      const result = await api.listComments(String(postId));
      setCommentLists((prev) => ({
        ...prev,
        [postId]: (result.comments || []) as FeedComment[],
      }));
    } catch (error) {
      if (handleAuthExpired(error)) return;
      console.error("Failed to load comments list", error);
    } finally {
      setLoadingComments((prev) => ({ ...prev, [postId]: false }));
    }
  };

  const handleLoadMoreComments = async (postId: string | number) => {
    if (loadingMoreComments[postId]) return;
    const paging = commentPaging[postId];
    if (!paging?.hasMore) return;

    setLoadingMoreComments((prev) => ({ ...prev, [postId]: true }));
    try {
      const result = await api.listComments(String(postId));
      setCommentLists((prev) => ({
        ...prev,
        [postId]: [
          ...(prev[postId] || []),
          ...((result.comments || []) as FeedComment[]),
        ],
      }));
      setCommentPaging((prev) => ({
        ...prev,
        [postId]: {
          offset: paging.offset + (result.comments || []).length,
          total: paging.total,
          hasMore: false,
        },
      }));
    } catch (error) {
      if (handleAuthExpired(error)) return;
      console.error("Failed to load more comments", error);
    } finally {
      setLoadingMoreComments((prev) => ({ ...prev, [postId]: false }));
    }
  };

  const handleQuickCreate = async (event: FormEvent) => {
    event.preventDefault();
    await submitPost({ text: content, visibility: "public" });
  };

  const handleModalCreate = async (event: FormEvent) => {
    event.preventDefault();
    await submitPost({
      text: modalContent,
      mediaUrl: modalMediaUrl,
      visibility: modalVisibility,
      location: modalLocation,
      taggedFriend: modalTaggedFriend,
    });
  };

  const appendEmoji = (emoji: string) => {
    setModalContent((prev) => `${prev}${emoji}`);
  };

  const locationSuggestions = useMemo(() => {
    const q = locationKeyword.trim().toLowerCase();
    if (!q) return VN_LOCATIONS.slice(0, 8);
    return VN_LOCATIONS.filter((item) => item.toLowerCase().includes(q)).slice(
      0,
      8,
    );
  }, [locationKeyword]);

  return (
    <div className={styles.page}>
      <div className={styles.layout}>
        <aside className={styles.leftRail}>
          <div className={styles.brandWrap}>
            <div className={styles.brandIcon}>M</div>
            <div>
              <p className={styles.brandTitle}>ZChat</p>
              <p className={styles.brandSub}>Mạng xã hĂ¡»™i chuyên nghiĂ¡»‡p</p>
            </div>
          </div>

          <nav className={styles.railNav}>
            <Link to="/feed" className={`${styles.railItem} ${styles.railItemActive}`}>
              BĂ¡º£ng tin
            </Link>
            <Link to={`/profile/${me?.id || 1}`} className={styles.railItem}>
              HĂ¡»“ sơ
            </Link>
            <Link to="/messages" className={styles.railItem}>
              Trò chuyĂ¡»‡n
            </Link>
          </nav>

          <button
            type="button"
            className={styles.newPostBtn}
            onClick={() => {
              if (isGuestView) {
                navigate("/auth/login?next=/feed");
                return;
              }
              setIsModalOpen(true);
            }}
          >
            + Tạo bài viết
          </button>

          <div className={styles.railBottom}>
            <Link to="/settings" className={styles.bottomBtn}>
              <Settings size={15} />
              <span>Cài đặt</span>
            </Link>
            <button type="button" className={styles.bottomBtn}>
              <CircleHelp size={15} />
              <span>HĂ¡»— trĂ¡»£</span>
            </button>
          </div>
        </aside>

        <section className={styles.mainCol}>
          <header className={styles.topBar}>
            <input className={styles.searchInput} placeholder="Tìm kiĂ¡º¿m..." />
            <div className={styles.topActions}>
              <button type="button" className={styles.iconBtn}>
                <Bell size={16} />
              </button>
              <button type="button" className={styles.iconBtn}>
                <Settings size={16} />
              </button>
              <div className={styles.avatarBadge}>
                {(me?.fullName?.[0] || "U").toUpperCase()}
              </div>
            </div>
          </header>

          {isGuestView ? (
            <section className={styles.guestBanner}>
              <h3>ChĂ¡º¿ đĂ¡»™ khách vãng lai</h3>
              <p>Bạn đang xem bĂ¡º£ng tin Ă¡»Ÿ chĂ¡º¿ đĂ¡»™ chĂ¡»‰ đĂ¡»c. Ä ăng nhĂ¡º­p để đăng bài, bình luĂ¡º­n, chia sẻ và nhĂ¡º¯n tin.</p>
              <div className={styles.guestBannerActions}>
                <button type="button" className={styles.submitBtn} onClick={() => navigate('/auth/login?next=/feed')}>
                  Ä ăng nhĂ¡º­p để tương tác
                </button>
                <Link to="/ai-chat" className={styles.softBtn}>
                  <Smile size={15} /> Chat hĂ¡»— trĂ¡»£ vĂ¡»›i AI
                </Link>
              </div>
            </section>
          ) : (
            <form className={styles.composer} onSubmit={handleQuickCreate}>
              <div className={styles.composerHead}>
                <div className={styles.avatarBadge}>
                  {(me?.fullName?.[0] || "U").toUpperCase()}
                </div>
                <textarea
                  placeholder="Bạn đang nghĩ gì?"
                  className={styles.composerInput}
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                />
              </div>
              <div className={styles.composerFoot}>
                <div className={styles.composerActions}>
                  <button type="button" className={styles.softBtn} onClick={() => setIsModalOpen(true)}>
                    <ImageIcon size={15} /> Ă¡º¢nh/Video
                  </button>
                  <button type="button" className={styles.softBtn} onClick={() => setIsModalOpen(true)}>
                    <Smile size={15} /> CĂ¡º£m xúc
                  </button>
                </div>
                <button type="submit" className={styles.submitBtn} disabled={!content.trim() || isPosting}>
                  {isPosting ? 'Ä ang đăng...' : 'Ä ăng'}
                </button>
              </div>
            </form>
          )}

          {errorText ? <p className={styles.errorBanner}>{errorText}</p> : null}
          {feedError ? <p className={styles.errorBanner}>{feedError}</p> : null}

          <div className={styles.feedList}>
            {isLoadingFeed ? (
              <div className={styles.feedStatus}>Đang tải bảng tin...</div>
            ) : null}
            {!isLoadingFeed && visiblePosts.length === 0 ? (
              <div className={styles.feedStatus}>No posts available</div>
            ) : null}
            {visiblePosts.map((post) => {
              const postComments = commentLists[post.id] || [];
              const paging = commentPaging[post.id];
              const hasMoreComments = Boolean(paging?.hasMore);
              const hiddenCount = Math.max(
                0,
                Number(paging?.total || post.commentCount || 0) -
                  postComments.length,
              );
              const postIsManageable = canManagePost(post);

              return (
                <article
                  key={`${post.id}-${post.createdAt}`}
                  className={styles.postCard}
                >
                  <div className={styles.postHead}>
                    <div className={styles.authorInfo}>
                      <div className={styles.avatarBadge}>
                        {(post.authorName[0] || "U").toUpperCase()}
                      </div>
                      <div>
                        <Link
                          to={`/profile/${post.authorId}`}
                          className={styles.authorNameLink}
                        >
                          <p className={styles.authorName}>{post.authorName}</p>
                        </Link>
                        <p className={styles.postMeta}>
                          <time
                            dateTime={post.createdAt}
                            title={formatExactTime(post.createdAt)}
                          >
                            {formatTime(post.createdAt)}
                          </time>{" "}
                          <Dot size={12} />{" "}
                          {post.visibility === "public"
                            ? "Công khai"
                            : "Riêng tư"}
                        </p>
                      </div>
                    </div>
                    <div
                      className={styles.postHeadActions}
                      data-post-menu-root="true"
                    >
                      <button
                        type="button"
                        className={styles.iconBtn}
                        aria-label="Tùy chọn bài viết"
                        aria-expanded={activePostMenuId === post.id}
                        onClick={() =>
                          setActivePostMenuId((prev) =>
                            prev === post.id ? null : post.id,
                          )
                        }
                      >
                        <Ellipsis size={16} />
                      </button>
                      {activePostMenuId === post.id ? (
                        <div className={styles.postMenu} role="menu">
                          <button
                            type="button"
                            onClick={() => void handleCopyPostId(post.id)}
                          >
                            Sao chép ID bài viết (#{post.id})
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              void handleCopyLink(post.id);
                              setActivePostMenuId(null);
                            }}
                          >
                            Sao chép liên kết
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              void handleShare(post);
                              setActivePostMenuId(null);
                            }}
                          >
                            Chia sẻ ngay
                          </button>
                          {postIsManageable ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleStartEditPost(post)}
                              >
                                Chỉnh sửa bài viết
                              </button>
                              <button
                                type="button"
                                className={styles.postMenuDanger}
                                onClick={() => void handleDeletePost(post)}
                              >
                                Xóa bài viết
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => handleHidePost(post.id)}
                              >
                                Ẩn bài viết
                              </button>
                              <button
                                type="button"
                                className={styles.postMenuDanger}
                                onClick={() => void handleReportPost(post)}
                              >
                                Báo cáo bài viết
                              </button>
                            </>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className={styles.postHeadActions} data-post-menu-root="true">
                    <button
                      type="button"
                      className={styles.iconBtn}
                      aria-label="Tùy chĂ¡»n bài viết"
                      aria-expanded={activePostMenuId === post.id}
                      onClick={() => setActivePostMenuId((prev) => (prev === post.id ? null : post.id))}
                    >
                      <Ellipsis size={16} />
                    </button>
                    {activePostMenuId === post.id ? (
                      <div className={styles.postMenu} role="menu">
                        <button type="button" onClick={() => void handleCopyPostId(post.id)}>
                          Sao chép ID bài viết (#{post.id})
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void handleCopyLink(post.id)
                            setActivePostMenuId(null)
                          }}
                        >
                          Sao chép liên kĂ¡º¿t
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void handleShare(post)
                            setActivePostMenuId(null)
                          }}
                        >
                          Chia sẻ ngay
                        </button>
                        {postIsManageable ? (
                          <>
                            <button type="button" onClick={() => handleStartEditPost(post)}>
                              ChĂ¡»‰nh sĂ¡»­a bài viết
                            </button>
                            <button
                              type="button"
                              className={styles.postMenuDanger}
                              onClick={() => void handleDeletePost(post)}
                            >
                              Xóa bài viết
                            </button>
                          </>
                        ) : (
                          <>
                            <button type="button" onClick={() => handleHidePost(post.id)}>
                              Ă¡º¨n bài viết
                            </button>
                            <button
                              type="button"
                              className={styles.postMenuDanger}
                              onClick={() => void handleReportPost(post)}
                            >
                              Báo cáo bài viết
                            </button>
                          </>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>

                {editingPostId === post.id && postEditDraft ? (
                  <div className={styles.postEditPanel}>
                    <textarea
                      value={postEditDraft.content}
                      onChange={(event) =>
                        setPostEditDraft((prev) =>
                          prev
                            ? {
                                ...prev,
                                content: event.target.value,
                              }
                            : prev
                        )
                      }
                      placeholder="NhĂ¡º­p nĂ¡»™i dung bài viết..."
                    />
                    <input
                      value={postEditDraft.mediaUrl}
                      onChange={(event) =>
                        setPostEditDraft((prev) =>
                          prev
                            ? {
                                ...prev,
                                mediaUrl: event.target.value,
                              }
                            : prev
                        )
                      }
                      placeholder="Link media (tuĂ¡»³ chĂ¡»n)"
                    />
                    <div className={styles.postEditRow}>
                      <select
                        value={postEditDraft.visibility}
                        onChange={(event) =>
                          setPostEditDraft((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  content: event.target.value,
                                }
                              : prev,
                          )
                        }
                      >
                        <option value="public">Công khai</option>
                        <option value="private">Riêng tư</option>
                      </select>
                      <button type="button" onClick={handleCancelEditPost} disabled={isSavingPostEdit}>
                        Hủy
                      </button>
                      <button type="button" onClick={() => void handleSaveEditPost(post)} disabled={isSavingPostEdit}>
                        {isSavingPostEdit ? 'Ä ang lưu...' : 'Lưu'}
                      </button>
                    </div>
                  ) : null}

                  <p className={styles.postContent}>{post.content}</p>

                {post.mediaUrl ? (
                  <img
                    src={post.mediaUrl}
                    alt="Post media"
                    className={styles.postMedia}
                    loading="lazy"
                    onError={(event) => {
                      event.currentTarget.style.display = 'none'
                    }}
                  />
                ) : null}

                <div className={styles.postStats}>
<<<<<<< HEAD
                  <span>{post.reactionCount} lưĂ¡»£t thích</span>
                  <span>{post.commentCount} bình luĂ¡º­n</span>
=======
                  <span>{post.reactionCount} lượt cảm xúc</span>
                  <span>{post.commentCount} bình luận</span>
>>>>>>> e1e0f981eaeaaf7229c1f05934c42d2d9ef91993
                </div>

                <div className={styles.postActions}>
                  <div className={styles.reactionActionWrap}>
                    <button
                      type="button"
                      className={`${styles.actionBtn} ${post.viewerReaction ? styles.actionBtnActive : ''}`}
                      onClick={() => setOpenReactionPostId((current) => (current === post.id ? null : post.id))}
                      disabled={isGuestView}
                    >
                      {post.viewerReaction ? (
                        <>
                          <span className={styles.reactionActionEmoji}>{getPostReactionMeta(post.viewerReaction).emoji}</span>
                          {getPostReactionMeta(post.viewerReaction).label}
                        </>
                      ) : (
                        <>
                          <Heart size={16} /> Thả cảm xúc
                        </>
                      )}
                    </button>
                    {openReactionPostId === post.id ? (
                      <div className={styles.postReactionPicker}>
                        {POST_REACTIONS.map((reaction) => (
                          <button
                            key={reaction.type}
                            type="button"
                            className={post.viewerReaction === reaction.type ? styles.postReactionActive : ''}
                            title={reaction.label}
                            aria-label={reaction.label}
                            onClick={() => void handlePostReaction(post, reaction.type)}
                          >
                            {reaction.emoji}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className={styles.actionBtn}
                    onClick={() => handleToggleComments(post.id)}
                    disabled={isGuestView}
                  >
                    <MessageCircle size={16} /> {expandedComments[post.id] ? 'Ă¡º¨n bình luĂ¡º­n' : 'Bình luĂ¡º­n'}
                  </button>
                  <button
                    type="button"
                    className={styles.actionBtn}
                    onClick={() => handleShare(post)}
                    disabled={isGuestView}
                  >
                    <Share2 size={16} /> Chia sẻ
                  </button>
                </div>

                {!isGuestView && shareTargetPostId === post.id ? (
                  <div className={styles.sharePanel}>
                    <button type="button" onClick={() => handleShareToProfile(post)}>
                      Chia sẻ lên trang cá nhân
                    </button>
                    <button type="button" onClick={() => handleCopyLink(post.id)}>
                      Sao chép liên kĂ¡º¿t
                    </button>
                    {shareConversations.length > 0 ? (
                      <div className={styles.shareToMessageList}>
                        <p>Chia sẻ qua tin nhĂ¡º¯n:</p>
                        {shareConversations.slice(0, 6).map((conv) => (
                          <button
                            key={conv.id}
                            type="button"
                            onClick={() => handleShareToConversation(post, conv.id)}
                          >
                            {conv.name || `CuĂ¡»™c trò chuyĂ¡»‡n ${conv.id}`}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {!isGuestView ? (
                  <div className={styles.commentBar}>
                    <input
                      value={commentInputs[post.id] || ''}
                      onChange={(event) =>
                        setCommentInputs((prev) => ({ ...prev, [post.id]: event.target.value }))
                      }
                      placeholder="ViĂ¡º¿t bình luĂ¡º­n nhanh..."
                    />
                    <button type="button" onClick={() => handleAddComment(post.id)} disabled={isCommenting[post.id]}>
                      {isCommenting[post.id] ? 'Ä ang gĂ¡» i...' : 'GĂ¡»­i'}
                    </button>
                  </div>
                ) : (
                  <div className={styles.guestPostHint}>
                    Ä ăng nhĂ¡º­p để bình luĂ¡º­n và chia sẻ bài viết này.
                  </div>
                )}

                {expandedComments[post.id] ? (
                  <div className={`${styles.commentsList} ${styles.commentsListOpen}`}>
                    {loadingComments[post.id] ? <p className={styles.commentState}>Ä ang tĂ¡º£i bình luĂ¡º­n...</p> : null}
                    {postComments.map((comment) => (
                      <div key={comment.id} className={styles.commentItem}>
                        <div className={styles.commentAvatar}>{(comment.authorName[0] || 'U').toUpperCase()}</div>
                        <div className={styles.commentBody}>
                          <Link to={`/profile/${comment.userId}`}>
                            <b>{comment.authorName}</b>
                          </Link>
                          <p>{comment.content}</p>
                        </div>
                      </div>
                    ))}
                    {!loadingComments[post.id] && postComments.length === 0 ? (
                      <p className={styles.commentState}>Chưa có bình luĂ¡º­n nào.</p>
                    ) : null}
                    {!loadingComments[post.id] && hasMoreComments ? (
                      <button
                        type="button"
                        onClick={() => handleShareToProfile(post)}
                      >
                        {loadingMoreComments[post.id]
                          ? 'Ä ang tĂ¡º£i thêm...'
                          : hiddenCount > 0
                            ? `Xem thêm ${hiddenCount} cmt`
                            : 'Xem thêm cmt'}
                      </button>
                    ) : null}
                    <button type="button" className={styles.viewDetailBtn} onClick={() => navigate(`/posts/${post.id}`)}>
                      Xem chi tiết bình luĂ¡º­n
                    </button>
                  </div>
                ) : null}
                </article>
              );
            })}

            {filteredPosts.length === 0 && <div className={styles.empty}>Chưa có bài viết nào trong bĂ¡º£ng tin.</div>}
            {filteredPosts.length > 0 && hasMorePosts ? (
              <div ref={feedBottomSentinelRef} className={styles.feedLoadingMore}>
                Ä ang tĂ¡º£i thêm bài viết...
              </div>
            ) : null}
            {filteredPosts.length > 0 && !hasMorePosts ? (
              <div className={styles.feedEndMarker}>Bạn đã xem hĂ¡º¿t bài viết hiĂ¡»‡n có.</div>
            ) : null}
          </div>
        </section>

        <aside className={styles.rightCol}>
          <section className={styles.widget}>
            <h3>GĂ¡»£i ý cho bạn</h3>
            {suggestedPeople.length === 0 ? (
              <p className={styles.suggestionMeta}>Chưa đĂ¡»§ dĂ¡»¯ liĂ¡»‡u để gĂ¡»£i ý ngưĂ¡»i dùng.</p>
            ) : (
              suggestedPeople.map((person) => (
                <div key={person.id} className={styles.suggestionItem}>
                  <div className={styles.avatarSm}>
                    {(person.name[0] || "U").toUpperCase()}
                  </div>
                  <div>
                    <p className={styles.suggestionName}>{person.name}</p>
                    <p className={styles.suggestionMeta}>
                      {person.postCount} bài viết gần đây
                    </p>
                  </div>
                  <Link to={`/profile/${person.id}`} className={styles.followBtn}>
                    Xem hĂ¡»“ sơ
                  </Link>
                </div>
              ))
            )}
          </section>

          <section className={styles.widget}>
            <h3>Xu hưĂ¡»›ng hot</h3>
            {hotTopics.length === 0 ? (
              <p className={styles.topicCount}>Chưa có hashtag nào trong dĂ¡»¯ liĂ¡»‡u hiĂ¡»‡n tại.</p>
            ) : (
              hotTopics.map((topic) => (
                <div key={topic.tag} className={styles.topicItem}>
                  <p className={styles.topicTag}>{topic.tag}</p>
                  <p className={styles.topicText}>{topic.text}</p>
                  <p className={styles.topicCount}>{topic.count}</p>
                </div>
              ))
            )}
            <Link to="/explore" className={styles.moreBtn}>
              Xem thêm
            </Link>
          </section>
        </aside>
      </div>

      {isModalOpen ? (
        <div className={styles.modalOverlay}>
          <form className={styles.modal} onSubmit={handleModalCreate}>
            <header className={styles.modalHeader}>
              <h2>Tạo bài viết</h2>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={closeComposerModal}
              >
                <X size={16} />
              </button>
            </header>

            <div className={styles.modalUser}>
              <div className={styles.avatarBadge}>
                {(me?.fullName?.[0] || "U").toUpperCase()}
              </div>
              <div>
                <b>{me?.fullName || 'NgưĂ¡»i dùng'}</b>
                <small>{modalVisibility === 'public' ? 'Công khai' : 'Riêng tư'}</small>
              </div>
            </div>

            <label className={styles.visibilityRow}>
              <span>QuyĂ¡»n riêng tư</span>
              <select
                value={modalVisibility}
                onChange={(event) =>
                  setModalVisibility(event.target.value as "public" | "private")
                }
              >
                <option value="public">Công khai</option>
                <option value="private">Riêng tư</option>
              </select>
            </label>

            <textarea
              className={styles.modalInput}
              placeholder="Bạn đang nghĩ gì?"
              value={modalContent}
              onChange={(event) => setModalContent(event.target.value)}
            />

            <input
              ref={mediaInputRef}
              type="file"
              accept="image/*,video/*"
              className={styles.hiddenInput}
              onChange={handleSelectedMedia}
            />

            {activeComposerPanel === "emoji" && showEmojiTray ? (
              <div className={styles.emojiTray}>
                {['Ä‘Ÿ˜€', 'Ä‘Ÿ˜', 'Ä‘Ÿ”¥', 'Ä‘Ÿ‰', 'Ä‘Ÿ’™', 'Ä‘Ÿ‘', 'Ä‘Ÿ¥³', 'Ä‘Ÿ¤'].map((emoji) => (
                  <button key={emoji} type="button" onClick={() => appendEmoji(emoji)}>
                    {emoji}
                  </button>
                ))}
              </div>
            ) : null}

            {modalMediaUrl ? (
<<<<<<< HEAD
              <p className={styles.metaPreview}>ĐĂ£ chĂ¡»n media: {modalMediaUrl}</p>
=======
              <div className={styles.modalMediaPreview}>
                {isVideoMediaUrl(modalMediaUrl) ? (
                  <video src={modalMediaUrl} controls className={styles.modalMediaPreviewAsset} />
                ) : (
                  <img
                    src={modalMediaUrl}
                    alt="Media preview"
                    className={styles.modalMediaPreviewAsset}
                    onError={(event) => {
                      event.currentTarget.style.display = 'none'
                      setErrorText('Không thể hiển thị media đã tải lên. Vui lòng thử lại.')
                    }}
                  />
                )}
              </div>
>>>>>>> e1e0f981eaeaaf7229c1f05934c42d2d9ef91993
            ) : null}
            {modalTaggedFriend ? (
              <p className={styles.metaPreview}>ĐĂ£ gĂ¡º¯n thẻ: {modalTaggedFriend}</p>
            ) : null}
            {modalLocation ? <p className={styles.metaPreview}>ĐĂ¡»‹a điĂ¡»ƒm: {modalLocation}</p> : null}

            {activeComposerPanel === "tag" ? (
              <div className={styles.modalSection}>
                <p>GĂ¡º¯n thẻ bạn bè</p>
                <input
                  value={tagKeyword}
                  onChange={(event) => setTagKeyword(event.target.value)}
                  placeholder="NhĂ¡º­p tên, ví dĂ¡»¥: TuĂ¡º¥n"
                />
                {tagSuggestions.length > 0 ? (
                  <div className={styles.dropdownList}>
                    {tagSuggestions.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setModalTaggedFriend(item.name);
                          setTagKeyword(item.name);
                          setTagSuggestions([]);
                        }}
                      >
                        {item.name}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {activeComposerPanel === "location" ? (
              <div className={styles.modalSection}>
                <p>ĐĂ¡»‹a điĂ¡»ƒm (ViĂ¡»‡t Nam)</p>
                <input
                  value={locationKeyword}
                  onChange={(event) => setLocationKeyword(event.target.value)}
                  placeholder="NhĂ¡º­p Hà để gĂ¡»£i ý Hà NĂ¡»™i, Hà Nam..."
                />
                <div className={styles.dropdownList}>
                  {locationSuggestions.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        setModalLocation(item);
                        setLocationKeyword(item);
                      }}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className={styles.modalTools}>
              <span>Thêm vào bài viết của bạn</span>
              <div>
                <button type="button" onClick={handleChooseMediaFile} title="Thêm Ă¡º£nh/video" disabled={uploadingMedia}>
                  <ImageIcon size={16} />
                </button>
                <button
                  type="button"
                  className={
                    activeComposerPanel === "tag"
                      ? styles.modalToolBtnActive
                      : ""
                  }
                  onClick={() =>
                    setActiveComposerPanel((prev) => {
                      const next = prev === "tag" ? null : "tag";
                      setShowEmojiTray(false);
                      return next;
                    })
                  }
                  title="GĂ¡º¯n thẻ bạn bè"
                >
                  <UserPlus size={16} />
                </button>
                <button
                  type="button"
                  className={
                    activeComposerPanel === "emoji"
                      ? styles.modalToolBtnActive
                      : ""
                  }
                  onClick={() => {
                    setActiveComposerPanel((prev) =>
                      prev === "emoji" ? null : "emoji",
                    );
                    setShowEmojiTray((prev) => !prev);
                  }}
                  title="Thêm cĂ¡º£m xúc"
                >
                  <Smile size={16} />
                </button>
                <button
                  type="button"
                  className={
                    activeComposerPanel === "location"
                      ? styles.modalToolBtnActive
                      : ""
                  }
                  onClick={() =>
                    setActiveComposerPanel((prev) => {
                      const next = prev === "location" ? null : "location";
                      setShowEmojiTray(false);
                      return next;
                    })
                  }
                  title="Thêm vĂ¡»‹ trí"
                >
                  <MapPin size={16} />
                </button>
                <div
                  className={styles.composerMoreWrap}
                  data-composer-more-root="true"
                >
                  <button
                    type="button"
                    className={
                      composerMoreMenuOpen ? styles.modalToolBtnActive : ""
                    }
                    onClick={() => setComposerMoreMenuOpen((prev) => !prev)}
                    title="Tùy chĂ¡»n khác"
                  >
                    <MoreHorizontal size={16} />
                  </button>
                  {composerMoreMenuOpen ? (
                    <div className={styles.composerMoreMenu}>
                      <button
                        type="button"
                        className={
                          modalVisibility === "public"
                            ? styles.composerMoreMenuActive
                            : ""
                        }
                        onClick={() => {
                          setModalVisibility("public");
                          setComposerMoreMenuOpen(false);
                        }}
                      >
                        QuyĂ¡»n riêng tư: Công khai
                      </button>
                      <button
                        type="button"
                        className={
                          modalVisibility === "private"
                            ? styles.composerMoreMenuActive
                            : ""
                        }
                        onClick={() => {
                          setModalVisibility("private");
                          setComposerMoreMenuOpen(false);
                        }}
                      >
                        QuyĂ¡»n riêng tư: Riêng tư
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setModalMediaUrl("");
                          setComposerMoreMenuOpen(false);
                        }}
                        disabled={!modalMediaUrl}
                      >
                        Gỡ Ă¡º£nh/video đã chĂ¡»n
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setModalTaggedFriend("");
                          setTagKeyword("");
                          setTagSuggestions([]);
                          setComposerMoreMenuOpen(false);
                        }}
                        disabled={!modalTaggedFriend}
                      >
                        Gỡ gĂ¡º¯n thẻ bạn bè
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setModalLocation("");
                          setLocationKeyword("");
                          setComposerMoreMenuOpen(false);
                        }}
                        disabled={!modalLocation}
                      >
                        Gỡ vĂ¡»‹ trí
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <button
              type="submit"
              className={styles.modalSubmit}
              disabled={
                (!modalContent.trim() && !modalMediaUrl.trim()) || isPosting
              }
            >
              {isPosting ? 'Ä ang đăng...' : 'Ä ăng'}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

