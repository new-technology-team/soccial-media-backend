"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Check,
  Copy,
  Globe2,
  Link2,
  Lock,
  MessageCircle,
  MessagesSquare,
  UserCheck,
  UserRound,
  X,
} from "lucide-react";
import { api } from "@/api/client";
import type { Conversation, FeedPost, User } from "@/types";
import {
  isVideoMediaUrl,
  getPostReactionMeta,
  type ShareAudience,
  type ShareMode,
  type ShareRecipient,
} from "./feed-utils";

interface ShareModalProps {
  post: FeedPost | null;
  open: boolean;
  onClose: () => void;
  token: string | null;
  user: User | null;
  navigate: (path: string) => void;
  onShared: () => void;
  formatTime: (value: string) => string;
}

export default function ShareModal({
  post,
  open,
  onClose,
  token,
  user,
  navigate,
  onShared,
  formatTime,
}: ShareModalProps) {
  const [shareMode, setShareMode] = useState<ShareMode>("profile");
  const [shareAudience, setShareAudience] = useState<ShareAudience>("public");
  const [shareCaption, setShareCaption] = useState("");
  const [shareSearch, setShareSearch] = useState("");
  const [shareUserResults, setShareUserResults] = useState<
    Array<{ id: number; name: string; avatarUrl: string | null }>
  >([]);
  const [shareRecipients, setShareRecipients] = useState<ShareRecipient[]>([]);
  const [shareConversations, setShareConversations] = useState<Conversation[]>(
    [],
  );
  const [isSharing, setIsSharing] = useState(false);

  useEffect(() => {
    if (!token || !post) return;
    api
      .listConversations(token)
      .then((result) => setShareConversations(result.conversations))
      .catch(() => undefined);
  }, [token, post]);

  useEffect(() => {
    const q = shareSearch.trim();
    if (!token || q.length < 2 || shareMode !== "message") {
      setShareUserResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const result = await api.searchUsers(token, q);
        setShareUserResults(
          ((result.users || []) as Array<Record<string, unknown>>)
            .map((item) => ({
              id: Number(item.id || item.userId || 0),
              name: String(
                item.full_name ||
                  item.fullName ||
                  item.displayName ||
                  "Người dùng",
              ),
              avatarUrl: (item.avatarUrl || item.avatar_url || null) as
                | string
                | null,
            }))
            .filter((item) => item.id > 0)
            .slice(0, 8),
        );
      } catch {
        setShareUserResults([]);
      }
    }, 240);
    return () => clearTimeout(timer);
  }, [shareSearch, shareMode, token]);

  const reset = useCallback(() => {
    setShareMode("profile");
    setShareAudience("public");
    setShareCaption("");
    setShareSearch("");
    setShareRecipients([]);
    setShareUserResults([]);
    setIsSharing(false);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const filteredShareConversations = useMemo(() => {
    const q = shareSearch.trim().toLowerCase();
    return shareConversations.filter((conversation) => {
      const label =
        conversation.name ||
        conversation.members.map((member) => member.fullName).join(", ") ||
        `Cuộc trò chuyện ${conversation.id}`;
      if (shareMode === "group" && conversation.type !== "group") return false;
      if (!q) return true;
      return label.toLowerCase().includes(q);
    });
  }, [shareConversations, shareMode, shareSearch]);

  const sendSharedPostToConversation = async (
    p: FeedPost,
    conversationId: string,
  ) => {
    if (!token) return;
    await api.sendMessagePayload(token, conversationId, {
      type: "text",
      text: `${user?.fullName || "Bạn của bạn"} đã chia sẻ một bài viết của ${p.authorName}`,
      mediaUrl: p.mediaUrl || undefined,
      meta: {
        sharedPost: {
          id: p.id,
          authorId: p.authorId,
          authorName: p.authorName,
          authorAvatar: p.authorAvatar,
          content: p.content.slice(0, 240),
          mediaUrl: p.mediaUrl,
          reactionCount: p.reactionCount,
          commentCount: p.commentCount,
        },
      },
    });
  };

  const handleShareToProfile = async () => {
    if (!token || !post) {
      navigate("/auth/login");
      return;
    }
    setIsSharing(true);
    try {
      await api.createPost(token, {
        content: shareCaption.trim(),
        sharedPostId: post.id,
        visibility: shareAudience === "only-me" ? "private" : "public",
      });
      onShared();
      handleClose();
    } catch {
      // silent
    } finally {
      setIsSharing(false);
    }
  };

  const handleShareToConversation = async (conversationId: string) => {
    if (!token || !post) {
      navigate("/auth/login");
      return;
    }
    try {
      await sendSharedPostToConversation(post, conversationId);
      handleClose();
    } catch {
      // silent
    }
  };

  const toggleShareRecipient = (recipient: ShareRecipient) => {
    const key = `${recipient.kind}-${recipient.id}`;
    setShareRecipients((prev) =>
      prev.some((item) => `${item.kind}-${item.id}` === key)
        ? prev.filter((item) => `${item.kind}-${item.id}` !== key)
        : [...prev, recipient],
    );
  };

  const handleShareToRecipients = async () => {
    if (!token || !post) return;
    if (shareRecipients.length === 0) return;
    setIsSharing(true);
    try {
      for (const recipient of shareRecipients) {
        const conversationId =
          recipient.kind === "conversation"
            ? recipient.id
            : (await api.createDirectConversation(token, recipient.id))
                .conversation.id;
        await sendSharedPostToConversation(post, conversationId);
      }
      handleClose();
    } catch {
      // silent
    } finally {
      setIsSharing(false);
    }
  };

  const handleCopyLink = async () => {
    if (!post) return;
    const url = `${window.location.origin}/posts/${post.id}`;
    try {
      await navigator.clipboard.writeText(url);
      handleClose();
    } catch {
      // silent
    }
  };

  const canShare =
    (shareMode === "profile" && (shareCaption.trim() || !post?.content)) ||
    (shareMode === "group" && shareRecipients.length > 0) ||
    (shareMode === "message" && shareRecipients.length > 0) ||
    shareMode === "copy";

  if (!open || !post) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      role="presentation"
      onClick={handleClose}
    >
      <section
        className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl mx-3"
        role="dialog"
        aria-modal="true"
        aria-label="Chia sẻ bài viết"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-start justify-between gap-3 p-5 border-b border-border/60">
          <div>
            <h2 className="text-lg font-bold">Chia sẻ bài viết</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Gửi bài viết gốc dưới dạng thẻ đầy đủ, không phải đường dẫn trần.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Đóng"
            className="p-1.5 rounded-lg hover:bg-accent/10 transition-colors"
          >
            <X size={18} />
          </button>
        </header>

        {/* Original post preview */}
        <article className="mx-5 mt-4 p-3 rounded-xl bg-muted/20 border border-border/60">
          <div className="flex items-center gap-2.5 mb-2">
            {post.authorAvatar ? (
              <img
                src={post.authorAvatar}
                alt={post.authorName}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                {(post.authorName[0] || "U").toUpperCase()}
              </span>
            )}
            <div>
              <b className="text-sm">{post.authorName}</b>
              <small className="text-xs text-muted-foreground block">
                {formatTime(post.createdAt)} · Bài viết gốc
              </small>
            </div>
          </div>
          {post.content ? (
            <p className="text-sm line-clamp-3 whitespace-pre-wrap">{post.content}</p>
          ) : null}
          {post.mediaUrl ? (
            <div className="mt-2 rounded-lg overflow-hidden">
              {isVideoMediaUrl(post.mediaUrl) ? (
                <video src={post.mediaUrl} muted className="w-full max-h-40 object-cover" />
              ) : (
                <img
                  src={post.mediaUrl}
                  alt="Post media"
                  className="w-full max-h-40 object-cover"
                />
              )}
            </div>
          ) : null}
          <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
            <span>{Number(post.reactionCount || 0)} cảm xúc</span>
            <span>{Number(post.commentCount || 0)} bình luận</span>
          </div>
        </article>

        {/* Share mode grid */}
        <div className="grid grid-cols-2 gap-3 mx-5 mt-4">
          {(
            [
              {
                key: "profile" as ShareMode,
                icon: <UserRound size={18} />,
                title: "Share to my profile",
                text: "Đăng lên dòng thời gian của bạn",
              },
              {
                key: "group" as ShareMode,
                icon: <MessagesSquare size={18} />,
                title: "Share to a group",
                text: "Chọn nhóm trò chuyện để gửi",
              },
              {
                key: "message" as ShareMode,
                icon: <MessageCircle size={18} />,
                title: "Send via message",
                text: "Gửi cho nhiều người hoặc nhóm",
              },
              {
                key: "copy" as ShareMode,
                icon: <Copy size={18} />,
                title: "Copy link",
                text: "Sao chép liên kết bài viết",
              },
            ] as const
          ).map((action) => (
            <button
              key={action.key}
              type="button"
              onClick={() => {
                setShareMode(action.key);
                setShareSearch("");
              }}
              className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                shareMode === action.key
                  ? "border-primary/40 bg-primary/5"
                  : "border-border/60 hover:border-border hover:bg-accent/5"
              }`}
            >
              <span className="mt-0.5 text-muted-foreground">{action.icon}</span>
              <span>
                <b className="text-sm block">{action.title}</b>
                <small className="text-xs text-muted-foreground">{action.text}</small>
              </span>
            </button>
          ))}
        </div>

        {/* Share mode panels */}
        <div className="mx-5 my-4 space-y-3">
          {/* Profile share */}
          {shareMode === "profile" && (
            <div className="space-y-3">
              <div className="flex gap-2">
                {(
                  [
                    {
                      key: "public" as ShareAudience,
                      icon: <Globe2 size={16} />,
                      label: "Public",
                      text: "Ai cũng có thể xem",
                    },
                    {
                      key: "friends" as ShareAudience,
                      icon: <UserCheck size={16} />,
                      label: "Friends",
                      text: "Ưu tiên bạn bè của bạn",
                    },
                    {
                      key: "only-me" as ShareAudience,
                      icon: <Lock size={16} />,
                      label: "Only Me",
                      text: "Chỉ bạn xem được",
                    },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setShareAudience(item.key)}
                    className={`flex-1 flex flex-col items-center gap-1 p-2.5 rounded-xl border text-xs transition-all ${
                      shareAudience === item.key
                        ? "border-primary/40 bg-primary/5"
                        : "border-border/60 hover:border-border"
                    }`}
                  >
                    <span
                      className={
                        shareAudience === item.key
                          ? "text-primary"
                          : "text-muted-foreground"
                      }
                    >
                      {item.icon}
                    </span>
                    <b className="text-xs">{item.label}</b>
                    <small className="text-muted-foreground">{item.text}</small>
                  </button>
                ))}
              </div>
              <textarea
                value={shareCaption}
                onChange={(e) => setShareCaption(e.target.value)}
                placeholder="Thêm cảm nghĩ của bạn..."
                className="w-full min-h-[60px] p-3 rounded-xl bg-muted/30 border border-border text-sm outline-none resize-none focus:border-primary/40 transition-colors"
              />
              <button
                type="button"
                disabled={isSharing}
                onClick={handleShareToProfile}
                className="w-full py-2.5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all"
              >
                {isSharing ? "Đang chia sẻ..." : "Share"}
              </button>
            </div>
          )}

          {/* Group / Message share */}
          {(shareMode === "group" || shareMode === "message") && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/30 border border-border">
                <MessageCircle size={16} className="text-muted-foreground shrink-0" />
                <input
                  value={shareSearch}
                  onChange={(e) => setShareSearch(e.target.value)}
                  placeholder={
                    shareMode === "group"
                      ? "Tìm nhóm..."
                      : "Tìm người dùng hoặc nhóm..."
                  }
                  className="flex-1 bg-transparent text-sm outline-none"
                />
              </div>

              {shareRecipients.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {shareRecipients.map((recipient) => (
                    <button
                      key={`${recipient.kind}-${recipient.id}`}
                      type="button"
                      onClick={() => toggleShareRecipient(recipient)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-medium"
                    >
                      {recipient.name}
                      <X size={13} />
                    </button>
                  ))}
                </div>
              )}

              <div className="max-h-48 overflow-y-auto space-y-1 rounded-xl border border-border/60">
                {filteredShareConversations.slice(0, 8).map((conversation) => {
                  const label =
                    conversation.name ||
                    conversation.members
                      .map((member) => member.fullName)
                      .join(", ") ||
                    `Cuộc trò chuyện ${conversation.id}`;
                  const recipient: ShareRecipient = {
                    kind: "conversation",
                    id: conversation.id,
                    name: label,
                    avatarUrl: conversation.avatarUrl,
                    type: conversation.type,
                  };
                  const selected = shareRecipients.some(
                    (item) =>
                      item.kind === "conversation" &&
                      item.id === conversation.id,
                  );
                  return (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => toggleShareRecipient(recipient)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-accent/5 transition-colors ${
                        selected ? "bg-primary/5" : ""
                      }`}
                    >
                      {conversation.avatarUrl ? (
                        <img
                          src={conversation.avatarUrl}
                          alt={label}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                          {(label[0] || "C").toUpperCase()}
                        </span>
                      )}
                      <span className="flex-1 text-left truncate">
                        <b className="text-sm block truncate">{label}</b>
                        <small className="text-xs text-muted-foreground">
                          {conversation.type === "group" ? "Group" : "Message"}
                        </small>
                      </span>
                      {selected && <Check size={16} className="text-primary shrink-0" />}
                    </button>
                  );
                })}
                {shareMode === "message"
                  ? shareUserResults.map((person) => {
                      const recipient: ShareRecipient = {
                        kind: "user",
                        id: person.id,
                        name: person.name,
                        avatarUrl: person.avatarUrl,
                        type: "direct",
                      };
                      const selected = shareRecipients.some(
                        (item) => item.kind === "user" && item.id === person.id,
                      );
                      return (
                        <button
                          key={`user-${person.id}`}
                          type="button"
                          onClick={() => toggleShareRecipient(recipient)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-accent/5 transition-colors ${
                            selected ? "bg-primary/5" : ""
                          }`}
                        >
                          {person.avatarUrl ? (
                            <img
                              src={person.avatarUrl}
                              alt={person.name}
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                              {(person.name[0] || "U").toUpperCase()}
                            </span>
                          )}
                          <span className="flex-1 text-left">
                            <b className="text-sm block">{person.name}</b>
                            <small className="text-xs text-muted-foreground">User</small>
                          </span>
                          {selected && <Check size={16} className="text-primary shrink-0" />}
                        </button>
                      );
                    })
                  : null}
              </div>

              <button
                type="button"
                disabled={isSharing || shareRecipients.length === 0}
                onClick={handleShareToRecipients}
                className="w-full py-2.5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all"
              >
                {isSharing
                  ? "Đang gửi..."
                  : `Send ${shareRecipients.length ? `(${shareRecipients.length})` : ""}`}
              </button>
            </div>
          )}

          {/* Copy link */}
          {shareMode === "copy" && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-muted/30 border border-border text-sm">
                <Link2 size={18} className="text-muted-foreground shrink-0" />
                <span className="truncate text-muted-foreground">
                  {`${window.location.origin}/posts/${post.id}`}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyLink}
                className="w-full py-2.5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
              >
                Copy link
              </button>
            </div>
          )}
        </div>

        {/* Final preview */}
        <aside className="mx-5 mb-5 p-3 rounded-xl bg-muted/10 border border-border/40">
          <b className="text-xs text-muted-foreground block mb-1.5">
            Realtime preview
          </b>
          {shareCaption && shareMode === "profile" ? (
            <p className="text-sm mb-2">{shareCaption}</p>
          ) : null}
          <div className="p-2.5 rounded-lg bg-card border border-border/60">
            <div className="flex items-center gap-2 mb-1.5">
              {post.authorAvatar ? (
                <img
                  src={post.authorAvatar}
                  alt={post.authorName}
                  className="w-6 h-6 rounded-full object-cover"
                />
              ) : (
                <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold">
                  {(post.authorName[0] || "U").toUpperCase()}
                </span>
              )}
              <b className="text-xs">{post.authorName}</b>
            </div>
            {post.content ? (
              <p className="text-xs line-clamp-2">{post.content}</p>
            ) : null}
            {post.mediaUrl ? (
              <img
                src={post.mediaUrl}
                alt="Preview"
                className="w-full h-24 object-cover rounded-lg mt-1.5"
              />
            ) : null}
            <small className="text-xs text-muted-foreground block mt-1">
              {Number(post.reactionCount || 0)} cảm xúc ·{" "}
              {Number(post.commentCount || 0)} bình luận
            </small>
          </div>
        </aside>
      </section>
    </div>
  );
}
