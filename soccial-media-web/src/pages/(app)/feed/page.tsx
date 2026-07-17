"use client";

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
  Dot,
  Ellipsis,
  Heart,
  Image as ImageIcon,
  Lock,
  MessageCircle,
  MoreHorizontal,
  Share2,
  Smile,
  UserPlus,
  X,
  MapPin,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { api, isAuthExpiredError } from "@/api/client";
import { ConfirmDialog, ReportDialog } from "@/components/dialogs";
import type { FeedComment, FeedPost } from "@/types";
import { useAuthStore } from "@/contexts/auth-store";
import { useSocialRealtime } from "@/hooks/use-social-realtime";
import { toast } from "@/hooks/use-toast";
import { compressImageFile } from "@/services/messages/file-utils";
import FeedSearch from "@/components/feed/FeedSearch";
import ShareModal from "@/components/feed/ShareModal";
import EditPostModal from "@/components/feed/EditPostModal";
import ReactionViewer from "@/components/feed/ReactionViewer";
import WelcomeOnboarding from "@/components/feed/WelcomeOnboarding";
import TrendingWidget from "@/components/feed/TrendingWidget";
import {
  VN_TIMEZONE,
  FEED_BATCH_SIZE,
  parseFeedDate,
  VN_LOCATIONS,
  POST_REACTIONS,
  getPostReactionMeta,
  dedupePostsById,
  dedupeCommentsById,
  appendCommentOnce,
  removeCommentById,
  isVideoMediaUrl,
  fileToBase64,
  type ConfirmModalState,
  type ComposerExtraPanel,
  type CommentPaging,
} from "@/components/feed/feed-utils";
import styles from "./page.module.css";

export default function FeedPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = useAuthStore((state) => state.accessToken);
  const me = useAuthStore((state) => state.user);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [isLoadingFeed, setIsLoadingFeed] = useState(true);
  const [content, setContent] = useState("");
  const [modalContent, setModalContent] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [commentInputs, setCommentInputs] = useState<Record<number, string>>(
    {},
  );
  const [commentImageDrafts, setCommentImageDrafts] = useState<
    Record<number, { file: File; previewUrl: string } | null>
  >({});
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});
  const [replyImageDrafts, setReplyImageDrafts] = useState<
    Record<string, { file: File; previewUrl: string } | null>
  >({});
  const [replyingToCommentIds, setReplyingToCommentIds] = useState<
    Record<string, boolean>
  >({});
  const [expandedReplyIds, setExpandedReplyIds] = useState<
    Record<string, boolean>
  >({});
  const [isCommenting, setIsCommenting] = useState<Record<number, boolean>>({});
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
    Record<number, FeedComment[]>
  >({});
  const [reactionViewers, setReactionViewers] = useState<
    Record<
      number,
      Array<{
        userId: number;
        fullName: string;
        avatarUrl: string | null;
        reaction: string;
      }>
    >
  >({});
  const [reactionViewerPostId, setReactionViewerPostId] = useState<
    number | null
  >(null);
  const [busyCommentId, setBusyCommentId] = useState<number | string | null>(
    null,
  );
  const [expandedComments, setExpandedComments] = useState<
    Record<number, boolean>
  >({});
  const [loadingComments, setLoadingComments] = useState<
    Record<number, boolean>
  >({});
  const [loadingMoreComments, setLoadingMoreComments] = useState<
    Record<number, boolean>
  >({});
  const [commentPaging, setCommentPaging] = useState<
    Record<number, CommentPaging>
  >({});
  const [shareTargetPostId, setShareTargetPostId] = useState<number | null>(
    null,
  );
  const [activePostMenuId, setActivePostMenuId] = useState<number | null>(null);
  const [hiddenPostIds, setHiddenPostIds] = useState<Record<number, boolean>>(
    {},
  );
  const [editingPostId, setEditingPostId] = useState<number | null>(null);
  const [composerMoreMenuOpen, setComposerMoreMenuOpen] = useState(false);
  const [showEmojiTray, setShowEmojiTray] = useState(false);
  const [activeComposerPanel, setActiveComposerPanel] =
    useState<ComposerExtraPanel>(null);
  const [timeTick, setTimeTick] = useState(0);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [openReactionPostId, setOpenReactionPostId] = useState<number | null>(
    null,
  );
  const [visiblePostsCount, setVisiblePostsCount] = useState(FEED_BATCH_SIZE);
  const [feedSearchQuery, setFeedSearchQuery] = useState("");
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState | null>(
    null,
  );
  const [reportPost, setReportPost] = useState<FeedPost | null>(null);
  const [reportComment, setReportComment] = useState<FeedComment | null>(null);
  const [savedPostIds, setSavedPostIds] = useState<Set<number | string>>(
    new Set(),
  );
  const [trendingHashtags, setTrendingHashtags] = useState<
    Array<{ tag: string; count: number }>
  >([]);
  const [trendingPosts, setTrendingPosts] = useState<FeedPost[]>([]);
  const [loadingTrending, setLoadingTrending] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [hasFriends, setHasFriends] = useState(false);
  const [discoverReady, setDiscoverReady] = useState(false);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const feedBottomSentinelRef = useRef<HTMLDivElement | null>(null);
  const isGuestView = !token;
  const isSavedView = searchParams.get("saved") === "1";

  useEffect(() => {
    if (isSavedView && !token) {
      navigate("/auth/login?next=" + encodeURIComponent("/feed?saved=1"), {
        replace: true,
      });
    }
  }, [isSavedView, token, navigate]);

  useSocialRealtime({
    token,
    user: me,
    setPosts,
    setCommentLists,
  });

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

  const handleAuthExpired = useCallback(
    (
      error: unknown,
      _fallbackMessage = "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.",
    ) => {
      if (!isAuthExpiredError(error)) return false;
      clearAuth();
      navigate("/auth/login?reason=session-expired");
      return true;
    },
    [clearAuth, navigate],
  );

  useEffect(() => {
    const loadFeed = async () => {
      setIsLoadingFeed(true);
      setPosts([]);
      setCommentLists({});
      setCommentPaging({});
      setExpandedComments({});
      try {
        let fetchedPosts: FeedPost[];
        if (isSavedView && !token) {
          return;
        } else if (isSavedView && token) {
          const response = await api.listSavedPosts(token);
          fetchedPosts = response.posts;
        } else if (token) {
          // Use discover feed for logged-in users (intelligent recommendations)
          const response = await api.discoverFeed(token);
          fetchedPosts = response.posts;
          setDiscoverReady(true);
        } else {
          // Guest users still use the regular feed
          const response = await api.listFeed();
          fetchedPosts = response.posts;
        }
        const dedupedPosts = dedupePostsById(fetchedPosts);
        setPosts(dedupedPosts);
        setVisiblePostsCount(
          Math.min(FEED_BATCH_SIZE, dedupedPosts.length || FEED_BATCH_SIZE),
        );
      } catch (error) {
        if (handleAuthExpired(error)) return;
        console.error("Failed to load feed", error);
      } finally {
        setIsLoadingFeed(false);
      }
    };

    loadFeed();
  }, [handleAuthExpired, token, isSavedView]);

  // Load trending data
  useEffect(() => {
    if (!token) return;

    const loadTrending = async () => {
      setLoadingTrending(true);
      try {
        const [hashtagsRes, trendingRes] = await Promise.all([
          api.getTrendingHashtags(token),
          api.getTrendingPosts(token, 4),
        ]);
        setTrendingHashtags(hashtagsRes.hashtags);
        setTrendingPosts(trendingRes.posts);
      } catch {
        // Silently fail - non-critical data
      } finally {
        setLoadingTrending(false);
      }
    };

    loadTrending();
  }, [token]);

  // Check if user has friends
  useEffect(() => {
    if (!token) return;
    api
      .listFriends(token)
      .then((res) => {
        setHasFriends(res.friends.length > 0);
      })
      .catch(() => undefined);
  }, [token]);

  // Show onboarding for new users (no friends, no posts)
  useEffect(() => {
    if (!token || isGuestView) return;
    const shown = sessionStorage.getItem("onboarding_seen");
    if (shown) return;
    if (me?.id) {
      api
        .getUserPosts(token, me.id, 1)
        .then((res) => {
          const noPosts = res.posts.length === 0;
          if (noPosts || !hasFriends) {
            setShowOnboarding(true);
            sessionStorage.setItem("onboarding_seen", "1");
          }
        })
        .catch(() => undefined);
    }
  }, [token, isGuestView, me?.id, hasFriends]);

  useEffect(() => {
    if (!token) {
      setSavedPostIds(new Set());
      return;
    }
    api
      .listSavedPosts(token)
      .then((res) => setSavedPostIds(new Set(res.posts.map((p) => p.id))))
      .catch(() => undefined);
  }, [token]);

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
        const result = await api.searchUsers(token, tagKeyword.trim());
        setTagSuggestions(
          (result.users || [])
            .map((item) => ({
              id: Number(item.id || 0),
              name: String(item.full_name || item.fullName || "Người dùng"),
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
    const timer = setInterval(() => setTimeTick((prev) => prev + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  const filteredPosts = useMemo(() => {
    const q = feedSearchQuery.trim().toLowerCase();
    return posts.filter((post) => {
      if (hiddenPostIds[post.id]) return false;
      if (!q) return true;
      return (
        post.content.toLowerCase().includes(q) ||
        post.authorName.toLowerCase().includes(q) ||
        (post.content.match(/#[^\s#.,!?;:]+/g) || []).some((tag) =>
          tag.toLowerCase().includes(q),
        )
      );
    });
  }, [feedSearchQuery, hiddenPostIds, posts]);
  const visiblePosts = useMemo(
    () => filteredPosts.slice(0, visiblePostsCount),
    [filteredPosts, visiblePostsCount],
  );
  const hasMorePosts = visiblePostsCount < filteredPosts.length;
  const activeSharePost = posts.find((post) => post.id === shareTargetPostId) || null;

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

  const formatTime = (value: string) => {
    void timeTick;
    const date = parseFeedDate(value);
    if (!date) return "Không rõ thời gian";
    const diffMs = Math.max(0, Date.now() - date.getTime());
    const diffMinutes = Math.floor(diffMs / (60 * 1000));
    const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

    if (diffMinutes < 1) return "Vừa xong";
    if (diffMinutes < 60) return `${diffMinutes} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays === 1) return "Hôm qua";
    if (diffDays < 7) return `${diffDays} ngày trước`;

    return new Intl.DateTimeFormat("vi-VN", {
      timeZone: VN_TIMEZONE,
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  };

  const formatExactTime = (value: string) => {
    const date = parseFeedDate(value);
    if (!date) return "Không rõ thời gian";
    return new Intl.DateTimeFormat("vi-VN", {
      timeZone: VN_TIMEZONE,
      hour12: false,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(date);
  };

  const submitPost = async (payload: {
    text: string;
    mediaUrl?: string;
    visibility?: "public" | "private";
    location?: string;
    taggedFriend?: string;
  }) => {
    const textWithMeta = [
      payload.text.trim(),
      payload.taggedFriend
        ? `\n\n👥 Cùng với: ${payload.taggedFriend.trim()}`
        : "",
      payload.location ? `\n📍 Địa điểm: ${payload.location.trim()}` : "",
    ]
      .filter(Boolean)
      .join("");

    if (!textWithMeta && !payload.mediaUrl?.trim()) return;
    if (!token) {
      setErrorText("Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.");
      navigate("/auth/login");
      return;
    }
    setIsPosting(true);
    setErrorText("");
    try {
      const response = await api.createPost(token, {
        content: textWithMeta,
        mediaUrl: payload.mediaUrl?.trim() || undefined,
        visibility: payload.visibility || "public",
      });
      setPosts((prev) => dedupePostsById([response.post, ...prev]));
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
    const previousReaction = post.viewerReaction;
    const nextReaction =
      previousReaction === reactionType ? null : reactionType;
    const reactionDelta = previousReaction
      ? nextReaction
        ? 0
        : -1
      : nextReaction
        ? 1
        : 0;
    setPosts((prev) =>
      prev.map((item) =>
        String(item.id) === String(post.id)
          ? {
              ...item,
              viewerReaction: nextReaction,
              reactionCount: Math.max(
                0,
                Number(item.reactionCount || 0) + reactionDelta,
              ),
            }
          : item,
      ),
    );
    setOpenReactionPostId(null);
    try {
      const response =
        post.viewerReaction === reactionType
          ? await api.unreactPost(token, post.id)
          : await api.reactPost(token, post.id, reactionType);
      setPosts((prev) =>
        prev.map((item) =>
          String(item.id) === String(post.id) ? response.post : item,
        ),
      );
    } catch (error) {
      if (handleAuthExpired(error)) return;
      setPosts((prev) =>
        prev.map((item) => (String(item.id) === String(post.id) ? post : item)),
      );
      console.error("Failed to react post", error);
    }
  };

  const handleAddComment = async (postId: number) => {
    const value = (commentInputs[postId] || "").trim();
    const imageDraft = commentImageDrafts[postId];
    if (!value && !imageDraft) return;
    if (!token) {
      navigate("/auth/login");
      return;
    }

    setIsCommenting((prev) => ({ ...prev, [postId]: true }));
    try {
      let imageUrl: string | null = null;
      if (imageDraft?.file) {
        const file = await compressImageFile(imageDraft.file);
        const uploaded = await api.uploadCommentImageBase64(token, {
          fileName: file.name,
          contentType: file.type || "image/jpeg",
          base64Data: await fileToBase64(file),
        });
        imageUrl = uploaded.mediaUrl || null;
      }
      const response = await api.addComment(token, postId, value, imageUrl);
      setPosts((prev) =>
        prev.map((item) =>
          item.id === postId
            ? { ...item, commentCount: Number(item.commentCount || 0) + 1 }
            : item,
        ),
      );
      setCommentLists((prev) => ({
        ...prev,
        [postId]: appendCommentOnce(prev[postId] || [], response.comment),
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
      setCommentImageDrafts((prev) => {
        const current = prev[postId];
        if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
        return { ...prev, [postId]: null };
      });
    } catch (error) {
      if (handleAuthExpired(error)) return;
      console.error("Failed to add comment", error);
    } finally {
      setIsCommenting((prev) => ({ ...prev, [postId]: false }));
    }
  };

  const handleCommentImageSelected = (
    postId: number,
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Chỉ hỗ trợ ảnh cho bình luận", variant: "destructive" });
      return;
    }
    setCommentImageDrafts((prev) => {
      const current = prev[postId];
      if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
      return {
        ...prev,
        [postId]: { file, previewUrl: URL.createObjectURL(file) },
      };
    });
  };

  const handleReplyImageSelected = (
    commentId: number | string,
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Chỉ hỗ trợ ảnh cho phản hồi", variant: "destructive" });
      return;
    }
    const key = String(commentId);
    setReplyImageDrafts((prev) => {
      const current = prev[key];
      if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
      return {
        ...prev,
        [key]: { file, previewUrl: URL.createObjectURL(file) },
      };
    });
  };

  const handleAddReply = async (postId: number, comment: FeedComment) => {
    const key = String(comment.id);
    const value = (replyInputs[key] || "").trim();
    const imageDraft = replyImageDrafts[key];
    if (!token || (!value && !imageDraft)) return;
    setBusyCommentId(comment.id);
    try {
      let imageUrl: string | null = null;
      if (imageDraft?.file) {
        const file = await compressImageFile(imageDraft.file);
        const uploaded = await api.uploadCommentImageBase64(token, {
          fileName: file.name,
          contentType: file.type || "image/jpeg",
          base64Data: await fileToBase64(file),
        });
        imageUrl = uploaded.mediaUrl || null;
      }
      const response = await api.addCommentReply(
        token,
        comment.id,
        value,
        imageUrl,
      );
      setPosts((prev) =>
        prev.map((item) =>
          item.id === postId
            ? { ...item, commentCount: Number(item.commentCount || 0) + 1 }
            : item,
        ),
      );
      setCommentLists((prev) => ({
        ...prev,
        [postId]: appendCommentOnce(prev[postId] || [], response.comment),
      }));
      setReplyInputs((prev) => ({ ...prev, [key]: "" }));
      setExpandedReplyIds((prev) => ({ ...prev, [key]: true }));
      setReplyingToCommentIds((prev) => ({ ...prev, [key]: false }));
      setReplyImageDrafts((prev) => {
        const current = prev[key];
        if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
        return { ...prev, [key]: null };
      });
    } catch (error) {
      if (handleAuthExpired(error)) return;
      toast({
        title: "Không thể gửi phản hồi",
        description:
          error instanceof Error ? error.message : "Vui lòng thử lại.",
        variant: "destructive",
      });
    } finally {
      setBusyCommentId(null);
    }
  };

  const handleOpenReactionViewers = async (post: FeedPost) => {
    setReactionViewerPostId(post.id);
    if (reactionViewers[post.id]) return;
    try {
      const response = await api.listPostReactions(post.id);
      setReactionViewers((prev) => ({
        ...prev,
        [post.id]: response.reactions,
      }));
    } catch (error) {
      if (handleAuthExpired(error)) return;
      console.error("Failed to load reaction viewers", error);
    }
  };

  const handleDeleteComment = async (post: FeedPost, comment: FeedComment) => {
    const canDeleteComment =
      Number(comment.userId) === Number(me?.id) ||
      Number(post.authorId) === Number(me?.id) ||
      me?.role === "admin" ||
      me?.role === "moderator";
    if (!token || !canDeleteComment) return;
    setConfirmModal({
      title: "Xóa bình luận?",
      description: "Bình luận này sẽ bị xóa khỏi bài viết.",
      confirmLabel: "Xóa",
      onConfirm: async () => {
        setBusyCommentId(comment.id);
        try {
          await api.deleteComment(token, comment.id);
          setCommentLists((prev) => ({
            ...prev,
            [post.id]: removeCommentById(prev[post.id] || [], comment.id),
          }));
          setPosts((prev) =>
            prev.map((item) =>
              item.id === post.id
                ? { ...item, commentCount: Math.max(0, item.commentCount - 1) }
                : item,
            ),
          );
          toast({ title: "Đã xóa bình luận" });
        } catch (error) {
          if (handleAuthExpired(error)) return;
          const message =
            error instanceof Error ? error.message : "Không thể xóa bình luận.";
          toast({
            title: "Không thể xóa bình luận",
            description: message,
            variant: "destructive",
          });
          throw error;
        } finally {
          setBusyCommentId(null);
        }
      },
    });
  };

  const handleReportComment = async (comment: FeedComment) => {
    if (!token) {
      navigate("/auth/login");
      return;
    }
    setReportComment(comment);
  };

  const submitReportComment = async (payload: {
    reason: string;
    details?: string;
  }) => {
    if (!token || !reportComment) return;
    setBusyCommentId(reportComment.id);
    try {
      await api.submitReport(token, {
        targetType: "comment",
        targetId: reportComment.id,
        reason: payload.reason,
        details: payload.details,
      });
      setErrorText("Đã gửi báo cáo bình luận.");
      toast({ title: "Đã gửi báo cáo bình luận" });
    } catch (error) {
      if (handleAuthExpired(error)) return;
      const message =
        error instanceof Error
          ? error.message
          : "Không thể gửi báo cáo bình luận.";
      console.error("Failed to report comment", error);
      toast({
        title: "Không thể gửi báo cáo",
        description: message,
        variant: "destructive",
      });
      throw error;
    } finally {
      setBusyCommentId(null);
    }
  };

  const handleShare = async (post: FeedPost) => {
    setShareTargetPostId(post.id);
  };

  const handleCopyLink = async (postId: number) => {
    const url = `${window.location.origin}/posts/${postId}`;
    try {
      await navigator.clipboard.writeText(url);
      setErrorText("Đã sao chép liên kết bài viết.");
    } catch (error) {
      console.error("Failed to copy link", error);
    }
  };

  const handleCopyPostId = async (postId: number) => {
    try {
      await navigator.clipboard.writeText(String(postId));
      setErrorText(`Đã sao chép ID bài viết: #${postId}`);
      setActivePostMenuId(null);
    } catch (error) {
      console.error("Failed to copy post id", error);
    }
  };

  const handleStartEditPost = (post: FeedPost) => {
    setEditingPostId(post.id);
    setActivePostMenuId(null);
  };

  const handleDeletePost = async (post: FeedPost) => {
    if (!token) {
      navigate("/auth/login");
      return;
    }

    setConfirmModal({
      title: "Xóa bài viết?",
      description: "Bài viết này sẽ bị xóa khỏi bảng tin của bạn.",
      confirmLabel: "Xóa",
      onConfirm: async () => {
        try {
          await api.deletePost(token, post.id);
          setPosts((prev) => prev.filter((item) => item.id !== post.id));
          setShareTargetPostId((prev) => (prev === post.id ? null : prev));
          setActivePostMenuId(null);
          if (editingPostId === post.id) {
            setEditingPostId(null);
          }
          setErrorText("Đã xóa bài viết.");
          toast({ title: "Đã xóa bài viết" });
        } catch (error) {
          if (handleAuthExpired(error)) return;
          console.error("Failed to delete post", error);
          const message = "Không thể xóa bài viết. Vui lòng thử lại.";
          setErrorText(message);
          toast({
            title: "Không thể xóa bài viết",
            description: message,
            variant: "destructive",
          });
          throw error;
        }
      },
    });
  };

  const handleToggleSave = async (postId: number | string) => {
    if (!token) {
      navigate("/auth/login");
      return;
    }
    const wasSaved = savedPostIds.has(postId);
    setSavedPostIds((prev) => {
      const next = new Set(prev);
      if (wasSaved) next.delete(postId);
      else next.add(postId);
      return next;
    });
    setActivePostMenuId(null);
    try {
      if (wasSaved) await api.unsavePost(token, postId);
      else await api.savePost(token, postId);
      if (isSavedView && wasSaved) {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
      }
    } catch {
      setSavedPostIds((prev) => {
        const next = new Set(prev);
        if (wasSaved) next.add(postId);
        else next.delete(postId);
        return next;
      });
    }
  };

  const handleHidePost = (postId: number) => {
    setHiddenPostIds((prev) => ({ ...prev, [postId]: true }));
    setActivePostMenuId(null);
    setErrorText("Đã ẩn bài viết khỏi bảng tin của bạn.");
  };

  const handleReportPost = async (post: FeedPost) => {
    if (!token) {
      navigate("/auth/login");
      return;
    }
    setReportPost(post);
    setActivePostMenuId(null);
  };

  const submitReportPost = async (payload: {
    reason: string;
    details?: string;
  }) => {
    if (!token || !reportPost) return;
    try {
      await api.submitReport(token, {
        targetType: "post",
        targetId: reportPost.id,
        reason: payload.reason,
        details: payload.details || `Bài viết từ ${reportPost.authorName}`,
      });
      setReportPost(null);
      setErrorText("Đã gửi báo cáo bài viết. Cảm ơn bạn đã phản hồi.");
    } catch (error) {
      if (handleAuthExpired(error)) return;
      console.error("Failed to report post", error);
      setErrorText("Không thể gửi báo cáo bài viết. Vui lòng thử lại.");
      throw error;
    }
  };




  const handleChooseMediaFile = () => {
    mediaInputRef.current?.click();
  };

  const handleSelectedMedia = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !token) return;

    const isVideo = file.type.startsWith("video/");
    const maxBytes = isVideo ? 100 * 1024 * 1024 : 15 * 1024 * 1024;
    if (file.size > maxBytes) {
      setErrorText(
        isVideo
          ? "Video quá lớn. Vui lòng chọn tệp nhỏ hơn 100MB."
          : "Ảnh quá lớn. Vui lòng chọn tệp nhỏ hơn 15MB.",
      );
      event.target.value = "";
      return;
    }

    setUploadingMedia(true);
    setErrorText("");
    try {
      const uploadFile = isVideo ? file : await compressImageFile(file);
      const base64Data = await fileToBase64(uploadFile);
      const uploaded = await api.uploadPostMediaBase64(token, {
        fileName: uploadFile.name,
        contentType: uploadFile.type || "application/octet-stream",
        base64Data,
      });
      if (!uploaded.mediaUrl) {
        throw new Error("Upload media thất bại, không nhận được URL.");
      }
      setModalMediaUrl(uploaded.mediaUrl);
    } catch (error) {
      if (handleAuthExpired(error)) return;
      console.error("Failed to upload post media", error);
      setErrorText(
        error instanceof Error
          ? error.message
          : "Không thể tải ảnh/video lên bài viết.",
      );
    } finally {
      setUploadingMedia(false);
      event.target.value = "";
    }
  };

  const handleToggleComments = async (postId: number) => {
    const opened = expandedComments[postId];
    setExpandedComments((prev) => ({ ...prev, [postId]: !opened }));
    if (opened) return;
    if (commentLists[postId]) return;

    setLoadingComments((prev) => ({ ...prev, [postId]: true }));
    try {
      const result = await api.listComments(postId, token || undefined, {
        limit: 3,
        offset: 0,
      });
      setCommentLists((prev) => ({
        ...prev,
        [postId]: dedupeCommentsById(result.comments),
      }));
      setCommentPaging((prev) => ({
        ...prev,
        [postId]: {
          offset: result.comments.length,
          total: Number(result.total || result.comments.length),
          hasMore: Boolean(result.hasMore),
        },
      }));
    } catch (error) {
      if (handleAuthExpired(error)) return;
      console.error("Failed to load comments list", error);
    } finally {
      setLoadingComments((prev) => ({ ...prev, [postId]: false }));
    }
  };

  const handleLoadMoreComments = async (postId: number) => {
    if (loadingMoreComments[postId]) return;
    const paging = commentPaging[postId];
    if (!paging?.hasMore) return;

    setLoadingMoreComments((prev) => ({ ...prev, [postId]: true }));
    try {
      const result = await api.listComments(postId, token || undefined, {
        limit: 5,
        offset: paging.offset,
      });
      setCommentLists((prev) => ({
        ...prev,
        [postId]: dedupeCommentsById([
          ...(prev[postId] || []),
          ...result.comments,
        ]),
      }));
      setCommentPaging((prev) => ({
        ...prev,
        [postId]: {
          offset: paging.offset + result.comments.length,
          total: Number(result.total || paging.total),
          hasMore: Boolean(result.hasMore),
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

  const renderCommentItem = (
    post: FeedPost,
    comment: FeedComment,
    depth = 0,
  ) => {
    const commentKey = String(comment.id);
    const replies = comment.replies || [];
    const showReplies = expandedReplyIds[commentKey] || replies.length <= 2;
    const visibleReplies = showReplies ? replies : replies.slice(0, 2);
    const replyDraft = replyImageDrafts[commentKey];

    return (
      <div
        key={comment.id}
        className={`${styles.commentItem} ${depth > 0 ? styles.commentReplyItem : ""}`}
      >
        <Avatar className="w-7 h-7 shrink-0 mt-0.5">
          <AvatarImage src={comment.authorAvatar || undefined} alt={comment.authorName} />
          <AvatarFallback className="text-[10px] font-semibold">
            {(comment.authorName[0] || "U").toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className={styles.commentBody}>
          <Link to={`/profile/${comment.userId}`}>
            <b>{comment.authorName}</b>
          </Link>
          {comment.content ? <p>{comment.content}</p> : null}
          {comment.imageUrl ? (
            <img
              src={comment.imageUrl}
              alt="Comment attachment"
              className={styles.commentImage}
              loading="lazy"
            />
          ) : null}
          {token ? (
            <div className={styles.commentActions}>
              <button
                type="button"
                onClick={() =>
                  setReplyingToCommentIds((prev) => ({
                    ...prev,
                    [commentKey]: !prev[commentKey],
                  }))
                }
              >
                Trả lời
              </button>
              <button
                type="button"
                onClick={() => void handleReportComment(comment)}
                disabled={busyCommentId === comment.id}
              >
                Báo cáo
              </button>
              {Number(comment.userId) === Number(me?.id) ||
              Number(post.authorId) === Number(me?.id) ||
              me?.role === "admin" ||
              me?.role === "moderator" ? (
                <button
                  type="button"
                  onClick={() => void handleDeleteComment(post, comment)}
                  disabled={busyCommentId === comment.id}
                >
                  Xóa
                </button>
              ) : null}
            </div>
          ) : null}

          {replyingToCommentIds[commentKey] ? (
            <div className={styles.replyComposer}>
              <input
                value={replyInputs[commentKey] || ""}
                onChange={(event) =>
                  setReplyInputs((prev) => ({
                    ...prev,
                    [commentKey]: event.target.value,
                  }))
                }
                placeholder={`Trả lời ${comment.authorName}...`}
              />
              <label className={styles.commentImageBtn}>
                Ảnh
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) =>
                    handleReplyImageSelected(comment.id, event)
                  }
                />
              </label>
              <button
                type="button"
                onClick={() => void handleAddReply(post.id, comment)}
                disabled={busyCommentId === comment.id}
              >
                Gửi
              </button>
              {replyDraft ? (
                <button
                  type="button"
                  className={styles.commentImagePreviewBtn}
                  onClick={() => {
                    if (replyDraft.previewUrl)
                      URL.revokeObjectURL(replyDraft.previewUrl);
                    setReplyImageDrafts((prev) => ({
                      ...prev,
                      [commentKey]: null,
                    }));
                  }}
                >
                  <img src={replyDraft.previewUrl} alt="Reply preview" />X
                </button>
              ) : null}
            </div>
          ) : null}

          {replies.length > 0 ? (
            <div className={styles.replyList}>
              {visibleReplies.map((reply) =>
                renderCommentItem(post, reply, depth + 1),
              )}
              {replies.length > 2 ? (
                <button
                  type="button"
                  className={styles.replyToggle}
                  onClick={() =>
                    setExpandedReplyIds((prev) => ({
                      ...prev,
                      [commentKey]: !prev[commentKey],
                    }))
                  }
                >
                  {showReplies
                    ? "Thu gọn phản hồi"
                    : `Xem thêm ${replies.length - 2} phản hồi`}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <div className={`${styles.page} flex gap-4`}>
      <section className={`${styles.mainCol} flex-1 min-w-0`}>
        <FeedSearch
          token={token}
          searchQuery={feedSearchQuery}
          onSearchChange={setFeedSearchQuery}
          filteredPosts={filteredPosts}
        />

        {isGuestView ? (
          <section className={styles.guestBanner}>
            <h3>Chế độ khách vãng lai</h3>
            <p>
              Bạn đang xem bảng tin ở chế độ chỉ đọc. Đăng nhập để đăng bài,
              bình luận, chia sẻ và nhắn tin.
            </p>
            <div className={styles.guestBannerActions}>
              <button
                type="button"
                className={styles.submitBtn}
                onClick={() => navigate("/auth/login?next=/feed")}
              >
                Đăng nhập để tương tác
              </button>
              <Link to="/ai-chat" className={styles.softBtn}>
                <Smile size={15} /> Chat hỗ trợ với AI
              </Link>
            </div>
          </section>
        ) : (
          <>
            {showOnboarding && me && (
              <WelcomeOnboarding
                fullName={me.fullName}
                onDismiss={() => setShowOnboarding(false)}
                hasFriends={hasFriends}
                hasPosts={posts.some((p) => Number(p.authorId) === Number(me.id))}
              />
            )}

            <form className={styles.composer} onSubmit={handleQuickCreate}>
              <div className={styles.composerHead}>
                <div className={styles.avatarBadge}>
                  {me?.avatarUrl ? (
                    <img
                      src={me.avatarUrl}
                      alt={me.fullName || "avatar"}
                      className={styles.inlineAvatarImg}
                    />
                  ) : (
                    (me?.fullName?.[0] || "U").toUpperCase()
                  )}
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
                  <button
                    type="button"
                    className={styles.softBtn}
                    onClick={() => setIsModalOpen(true)}
                  >
                    <ImageIcon size={15} /> Ảnh/Video
                  </button>
                  <button
                    type="button"
                    className={styles.softBtn}
                    onClick={() => setIsModalOpen(true)}
                  >
                    <Smile size={15} /> Cảm xúc
                  </button>
                </div>
                <button
                  type="submit"
                  className={styles.submitBtn}
                  disabled={!content.trim() || isPosting}
                >
                  {isPosting ? "Đang đăng..." : "Đăng"}
                </button>
              </div>
            </form>
          </>
        )}

        {errorText ? <p className={styles.errorBanner}>{errorText}</p> : null}

        {isSavedView ? (
          <div className={styles.feedHeading}>
            <h1>Bài viết đã lưu</h1>
            <p>Các bài viết bạn đã lưu để xem lại</p>
          </div>
        ) : null}

        <div className={styles.feedList}>
          {isLoadingFeed ? (
            <>
              <div className={styles.postSkeleton} aria-hidden="true" />
              <div className={styles.postSkeleton} aria-hidden="true" />
              <div className={styles.postSkeleton} aria-hidden="true" />
            </>
          ) : null}

          {!isLoadingFeed && filteredPosts.length === 0 ? (
            <div className={styles.emptyFeed}>
              {isSavedView ? (
                <p>Bạn chưa lưu bài viết nào.</p>
              ) : (
                <>
                  <p>Chưa có bài viết nào trong bảng tin.</p>
                  <Link
                    to="/explore"
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-[rgb(37,99,235)] text-white font-semibold rounded-lg shadow-md hover:bg-[rgb(29,78,216)] transition duration-300"
                  >
                    <UserPlus size={15} />
                    <span>Khám phá nội dung thịnh hành</span>
                  </Link>
                </>
              )}
            </div>
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
            const postIsManageable = Boolean(me && post.authorId === me.id);

            return (
              <article
                key={`${post.id}-${post.createdAt}`}
                className={styles.postCard}
              >
                <div className={styles.postHead}>
                  <div className={styles.authorInfo}>
                    <div className={styles.avatarBadge}>
                      {post.authorAvatar ? (
                        <img
                          src={post.authorAvatar}
                          alt={post.authorName}
                          className={styles.inlineAvatarImg}
                        />
                      ) : (
                        (post.authorName[0] || "U").toUpperCase()
                      )}
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
                          onClick={() => void handleToggleSave(post.id)}
                        >
                          {savedPostIds.has(post.id)
                            ? "Bỏ lưu bài viết"
                            : "Lưu bài viết"}
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

                {post._recommended ? (
                  <div className="px-4 pt-1 pb-0">
                    <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-orange-50 to-yellow-50 px-2.5 py-0.5 text-[11px] font-medium text-orange-600 border border-orange-200">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                      </svg>
                      Đề xuất
                    </span>
                  </div>
                ) : null}

                {post.sharedPost ? (
                  <p className={styles.sharedByLine}>
                    {post.authorName} đã chia sẻ bài viết
                  </p>
                ) : null}

                {post.content ? (
                  <p className={styles.postContent}>{post.content}</p>
                ) : null}

                {post.mediaUrl ? (
                  isVideoMediaUrl(post.mediaUrl) ? (
                    <video
                      src={post.mediaUrl}
                      className={styles.postMedia}
                      controls
                      preload="metadata"
                    />
                  ) : (
                    <img
                      src={post.mediaUrl}
                      alt="Post media"
                      className={styles.postMedia}
                      loading="lazy"
                      onError={(event) => {
                        event.currentTarget.style.display = "none";
                      }}
                    />
                  )
                ) : null}

                {post.sharedPost ? (
                  <Link
                    to={
                      post.sharedPost.unavailable
                        ? "#"
                        : `/posts/${post.sharedPost.id}`
                    }
                    className={styles.sharedPostEmbed}
                  >
                    {post.sharedPost.unavailable ? (
                      <p className={styles.sharedUnavailable}>
                        Bài viết gốc không còn khả dụng
                      </p>
                    ) : (
                      <>
                        <div className={styles.sharedPostAuthor}>
                          {post.sharedPost.authorAvatar ? (
                            <img
                              src={post.sharedPost.authorAvatar}
                              alt={post.sharedPost.authorName || "Tác giả"}
                            />
                          ) : (
                            <span>
                              {(
                                post.sharedPost.authorName?.[0] || "U"
                              ).toUpperCase()}
                            </span>
                          )}
                          <b>
                            {post.sharedPost.authorName || "Người dùng ZChat"}
                          </b>
                        </div>
                        {post.sharedPost.content ? (
                          <p>{post.sharedPost.content}</p>
                        ) : null}
                        {post.sharedPost.mediaUrl ? (
                          isVideoMediaUrl(post.sharedPost.mediaUrl) ? (
                            <video
                              src={post.sharedPost.mediaUrl}
                              controls
                              preload="metadata"
                              style={{
                                width: "100%",
                                borderRadius: 8,
                                marginTop: 6,
                              }}
                            />
                          ) : (
                            <img
                              src={post.sharedPost.mediaUrl}
                              alt="Shared post media"
                            />
                          )
                        ) : null}
                        <small>
                          {Number(post.sharedPost.reactionCount || 0)} cảm xúc •{" "}
                          {Number(post.sharedPost.commentCount || 0)} bình luận
                        </small>
                      </>
                    )}
                  </Link>
                ) : null}

                <div className={styles.postStats}>
                  <button
                    type="button"
                    onClick={() => void handleOpenReactionViewers(post)}
                  >
                    {post.reactionCount} lượt cảm xúc
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleComments(post.id)}
                    disabled={isGuestView}
                  >
                    {post.commentCount} bình luận
                  </button>
                </div>

                <div className={styles.postActions}>
                  <div className={styles.reactionActionWrap}>
                    <button
                      type="button"
                      className={`${styles.actionBtn} ${post.viewerReaction ? styles.actionBtnActive : ""}`}
                      onClick={() =>
                        setOpenReactionPostId((current) =>
                          current === post.id ? null : post.id,
                        )
                      }
                      disabled={isGuestView}
                    >
                      {post.viewerReaction ? (
                        <>
                          <span className={styles.reactionActionEmoji}>
                            {getPostReactionMeta(post.viewerReaction).emoji}
                          </span>
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
                            className={
                              post.viewerReaction === reaction.type
                                ? styles.postReactionActive
                                : ""
                            }
                            title={reaction.label}
                            aria-label={reaction.label}
                            onClick={() =>
                              void handlePostReaction(post, reaction.type)
                            }
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
                    <MessageCircle size={16} />{" "}
                    {expandedComments[post.id] ? "Ẩn bình luận" : "Bình luận"}
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

                {!isGuestView ? (
                  <div className={styles.commentBar}>
                    <input
                      value={commentInputs[post.id] || ""}
                      onChange={(event) =>
                        setCommentInputs((prev) => ({
                          ...prev,
                          [post.id]: event.target.value,
                        }))
                      }
                      placeholder={
                        commentImageDrafts[post.id]
                          ? "Thêm chú thích cho ảnh..."
                          : "Viết bình luận nhanh..."
                      }
                    />
                    <label className={styles.commentImageBtn}>
                      Ảnh
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(event) =>
                          handleCommentImageSelected(post.id, event)
                        }
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => handleAddComment(post.id)}
                      disabled={isCommenting[post.id]}
                    >
                      {isCommenting[post.id] ? "Đang gửi..." : "Gửi"}
                    </button>
                    {commentImageDrafts[post.id] ? (
                      <button
                        type="button"
                        className={styles.commentImagePreviewBtn}
                        onClick={() => {
                          const current = commentImageDrafts[post.id];
                          if (current?.previewUrl)
                            URL.revokeObjectURL(current.previewUrl);
                          setCommentImageDrafts((prev) => ({
                            ...prev,
                            [post.id]: null,
                          }));
                        }}
                      >
                        <img
                          src={commentImageDrafts[post.id]?.previewUrl}
                          alt="Comment preview"
                        />
                        X
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <div className={styles.guestPostHint}>
                    Đăng nhập để bình luận và chia sẻ bài viết này.
                  </div>
                )}

                {expandedComments[post.id] ? (
                  <div
                    className={`${styles.commentsList} ${styles.commentsListOpen}`}
                  >
                    {loadingComments[post.id] ? (
                      <p className={styles.commentState}>
                        Đang tải bình luận...
                      </p>
                    ) : null}
                    {postComments.map((comment) =>
                      renderCommentItem(post, comment),
                    )}
                    {!loadingComments[post.id] && postComments.length === 0 ? (
                      <p className={styles.commentState}>
                        Chưa có bình luận nào.
                      </p>
                    ) : null}
                    {!loadingComments[post.id] && hasMoreComments ? (
                      <button
                        type="button"
                        className={styles.showMoreCommentsBtn}
                        onClick={() => handleLoadMoreComments(post.id)}
                        disabled={loadingMoreComments[post.id]}
                      >
                        {loadingMoreComments[post.id]
                          ? "Đang tải thêm..."
                          : hiddenCount > 0
                            ? `Xem thêm ${hiddenCount} cmt`
                            : "Xem thêm cmt"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className={styles.viewDetailBtn}
                      onClick={() => navigate(`/posts/${post.id}`)}
                    >
                      Xem chi tiết bình luận
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })}

          {filteredPosts.length > 0 && hasMorePosts ? (
            <div ref={feedBottomSentinelRef} className={styles.feedLoadingMore}>
              Đang tải thêm bài viết...
            </div>
          ) : null}
          {filteredPosts.length > 0 && !hasMorePosts ? (
            <div className={styles.feedEndMarker}>
              Bạn đã xem hết bài viết hiện có.
            </div>
          ) : null}
        </div>
      </section>

      {/* Right Sidebar - Trending Widgets */}
      {!isGuestView && !isSavedView ? (
        <aside className="hidden xl:block w-80 shrink-0">
          <div className="sticky top-4 space-y-4">
            <TrendingWidget
              hashtags={trendingHashtags}
              trendingPosts={trendingPosts}
              loading={loadingTrending}
            />
          </div>
        </aside>
      ) : null}

      <ReactionViewer
        open={Boolean(reactionViewerPostId)}
        postId={reactionViewerPostId}
        viewers={reactionViewerPostId ? reactionViewers[reactionViewerPostId] || [] : []}
        onClose={() => setReactionViewerPostId(null)}
      />

      <ShareModal
        post={activeSharePost}
        open={Boolean(activeSharePost)}
        onClose={() => setShareTargetPostId(null)}
        token={token}
        user={me}
        navigate={navigate}
        onShared={async () => {
          if (!token) return;
          try {
            const refreshed = await api.discoverFeed(token);
            setPosts(dedupePostsById(refreshed.posts));
          } catch { /* ignore */ }
        }}
        formatTime={formatTime}
      />

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
                {me?.avatarUrl ? (
                  <img
                    src={me.avatarUrl}
                    alt={me.fullName || "avatar"}
                    className={styles.inlineAvatarImg}
                  />
                ) : (
                  (me?.fullName?.[0] || "U").toUpperCase()
                )}
              </div>
              <div>
                <b>{me?.fullName || "Người dùng"}</b>
                <small>
                  {modalVisibility === "public" ? "Công khai" : "Riêng tư"}
                </small>
              </div>
            </div>

            <label className={styles.visibilityRow}>
              <span>Quyền riêng tư</span>
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
                {["😀", "😍", "🔥", "🎉", "💙", "👍", "🥳", "🤝"].map(
                  (emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => appendEmoji(emoji)}
                    >
                      {emoji}
                    </button>
                  ),
                )}
              </div>
            ) : null}

            {modalMediaUrl ? (
              <div className={`${styles.modalMediaPreview} relative`}>
                {isVideoMediaUrl(modalMediaUrl) ? (
                  <video
                    src={modalMediaUrl}
                    controls
                    className={styles.modalMediaPreviewAsset}
                  />
                ) : (
                  <img
                    src={modalMediaUrl}
                    alt="Media preview"
                    className={styles.modalMediaPreviewAsset}
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                      setErrorText(
                        "Không thể hiển thị media đã tải lên. Vui lòng thử lại.",
                      );
                    }}
                  />
                )}
                <button
                  type="button"
                  onClick={() => setModalMediaUrl("")}
                  className="absolute top-2 right-2 px-2.5 py-1.5 rounded-lg bg-black/70 text-white text-xs font-medium flex items-center gap-1 hover:bg-black/90 transition-colors"
                  title="Xoá ảnh"
                >
                  <X size={14} /> Xoá
                </button>
              </div>
            ) : null}
            {modalTaggedFriend ? (
              <p className={styles.metaPreview}>
                Đã gắn thẻ: {modalTaggedFriend}
              </p>
            ) : null}
            {modalLocation ? (
              <p className={styles.metaPreview}>Địa điểm: {modalLocation}</p>
            ) : null}

            {activeComposerPanel === "tag" ? (
              <div className={styles.modalSection}>
                <p>Gắn thẻ bạn bè</p>
                <input
                  value={tagKeyword}
                  onChange={(event) => setTagKeyword(event.target.value)}
                  placeholder="Nhập tên, ví dụ: Tuấn"
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
                <p>Địa điểm (Việt Nam)</p>
                <input
                  value={locationKeyword}
                  onChange={(event) => setLocationKeyword(event.target.value)}
                  placeholder="Nhập Hà để gợi ý Hà Nội, Hà Nam..."
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
                <button
                  type="button"
                  onClick={handleChooseMediaFile}
                  title="Thêm ảnh/video"
                  disabled={uploadingMedia}
                >
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
                  title="Gắn thẻ bạn bè"
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
                  title="Thêm cảm xúc"
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
                  title="Thêm vị trí"
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
                    title="Tùy chọn khác"
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
                        Quyền riêng tư: Công khai
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
                        Quyền riêng tư: Riêng tư
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setModalMediaUrl("");
                          setComposerMoreMenuOpen(false);
                        }}
                        disabled={!modalMediaUrl}
                      >
                        Gỡ ảnh/video đã chọn
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
                        Gỡ gắn thẻ bạn bè
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
                        Gỡ vị trí
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
              {isPosting ? "Đang đăng..." : "Đăng"}
            </button>
          </form>
        </div>
      ) : null}
      <EditPostModal
        open={Boolean(editingPostId)}
        post={posts.find((p) => p.id === editingPostId) || null}
        onClose={() => setEditingPostId(null)}
        onSaved={(updatedPost) => {
          setPosts((prev) =>
            prev.map((item) =>
              item.id === updatedPost.id ? updatedPost : item,
            ),
          );
          setEditingPostId(null);
        }}
        token={token}
        user={me}
        navigate={navigate}
      />
      <ConfirmDialog
        open={Boolean(confirmModal)}
        onOpenChange={(open) => {
          if (!open) setConfirmModal(null);
        }}
        title={confirmModal?.title || ""}
        description={confirmModal?.description || ""}
        confirmLabel={confirmModal?.confirmLabel || "Xác nhận"}
        onConfirm={async () => {
          await confirmModal?.onConfirm();
        }}
      />
      <ReportDialog
        open={Boolean(reportPost)}
        onOpenChange={(open) => {
          if (!open) setReportPost(null);
        }}
        title="Báo cáo bài viết"
        onSubmit={submitReportPost}
      />
      <ReportDialog
        open={Boolean(reportComment)}
        onOpenChange={(open) => {
          if (!open) setReportComment(null);
        }}
        title="Báo cáo bình luận"
        onSubmit={submitReportComment}
      />
    </div>
  );
}
