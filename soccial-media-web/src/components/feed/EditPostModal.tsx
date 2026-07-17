"use client";

import { useState, useRef, useEffect, type ChangeEvent } from "react";
import { ImageIcon, X } from "lucide-react";
import { api } from "@/api/client";
import type { FeedPost, User } from "@/types";
import { isVideoMediaUrl, fileToBase64 } from "./feed-utils";
import { compressImageFile } from "@/services/messages/file-utils";
import { toast } from "@/hooks/use-toast";

interface EditPostModalProps {
  open: boolean;
  post: FeedPost | null;
  onClose: () => void;
  onSaved: (updatedPost: FeedPost) => void;
  token: string | null;
  user: User | null;
  navigate: (path: string) => void;
}

export default function EditPostModal({
  open,
  post,
  onClose,
  onSaved,
  token,
  user,
  navigate,
}: EditPostModalProps) {
  const [draft, setDraft] = useState<{
    content: string;
    mediaUrl: string;
    visibility: "public" | "private";
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Initialize draft when post changes
  useEffect(() => {
    if (post) {
      setDraft({
        content: post.content || "",
        mediaUrl: post.mediaUrl || "",
        visibility: post.visibility,
      });
    }
  }, [post]);

  const close = () => {
    if (!isSaving) {
      setDraft(null);
      onClose();
    }
  };

  const handleMediaSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !token) return;
    setUploadingMedia(true);
    try {
      const uploadFile = await compressImageFile(file);
      const upload = await api.uploadPostMediaBase64(token, {
        fileName: uploadFile.name,
        contentType: uploadFile.type || "application/octet-stream",
        base64Data: await fileToBase64(uploadFile),
      });
      if (!upload.mediaUrl) throw new Error("Không thể tải media bài viết.");
      setDraft((prev) =>
        prev ? { ...prev, mediaUrl: upload.mediaUrl } : prev,
      );
      toast({ title: "Đã tải media" });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Không thể tải media bài viết.";
      toast({ title: "Không thể tải media", description: message, variant: "destructive" });
    } finally {
      setUploadingMedia(false);
      event.target.value = "";
    }
  };

  const handleSave = async () => {
    if (!token || !post || !draft) {
      navigate("/auth/login");
      return;
    }
    const contentText = draft.content.trim();
    const mediaText = draft.mediaUrl.trim();
    if (!contentText && !mediaText) return;

    setIsSaving(true);
    try {
      const updated = await api.updatePost(token, post.id, {
        content: contentText,
        mediaUrl: mediaText,
        visibility: draft.visibility,
      });
      onSaved(updated.post);
      close();
    } catch {
      // silent
    } finally {
      setIsSaving(false);
    }
  };

  if (!open || !post || !draft) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <form
        className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl mx-3"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSave();
        }}
      >
        <header className="flex items-center justify-between p-5 border-b border-border/60">
          <h2 className="text-lg font-bold">Chỉnh sửa bài viết</h2>
          <button
            type="button"
            onClick={close}
            disabled={isSaving}
            className="p-1.5 rounded-lg hover:bg-accent/10 transition-colors disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </header>

        {/* User info */}
        <div className="flex items-center gap-3 px-5 pt-4 pb-2">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold shrink-0">
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.fullName || "avatar"}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              (user?.fullName?.[0] || "U").toUpperCase()
            )}
          </div>
          <div>
            <b className="text-sm block">{user?.fullName || "Người dùng"}</b>
            <small className="text-xs text-muted-foreground">
              {draft.visibility === "public" ? "Công khai" : "Riêng tư"}
            </small>
          </div>
        </div>

        {/* Visibility */}
        <label className="flex items-center justify-between px-5 py-2">
          <span className="text-sm">Quyền riêng tư</span>
          <select
            value={draft.visibility}
            onChange={(e) =>
              setDraft((prev) =>
                prev
                  ? {
                      ...prev,
                      visibility: e.target.value as "public" | "private",
                    }
                  : prev,
              )
            }
            className="text-sm bg-muted/30 border border-border rounded-lg px-3 py-1.5 outline-none focus:border-primary/40"
          >
            <option value="public">Công khai</option>
            <option value="private">Riêng tư</option>
          </select>
        </label>

        {/* Content */}
        <textarea
          value={draft.content}
          onChange={(e) => {
            e.currentTarget.style.height = "auto";
            e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
            setDraft((prev) =>
              prev ? { ...prev, content: e.target.value } : prev,
            );
          }}
          placeholder="Bạn muốn cập nhật điều gì?"
          className="w-full min-h-[100px] px-5 py-3 bg-transparent text-sm outline-none resize-none"
        />

        {/* File input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={handleMediaSelect}
        />

        {/* Media area */}
        <div className="px-5 pb-3">
          {draft.mediaUrl ? (
            <div className="relative rounded-xl overflow-hidden border border-border/60">
              {isVideoMediaUrl(draft.mediaUrl) ? (
                <video
                  src={draft.mediaUrl}
                  controls
                  className="w-full max-h-64 object-contain bg-black/5"
                />
              ) : (
                <img
                  src={draft.mediaUrl}
                  alt="Media preview"
                  className="w-full max-h-64 object-contain bg-black/5"
                />
              )}
              <button
                type="button"
                onClick={() =>
                  setDraft((prev) =>
                    prev ? { ...prev, mediaUrl: "" } : prev,
                  )
                }
                className="absolute top-2 right-2 px-3 py-1 rounded-lg bg-black/60 text-white text-xs hover:bg-black/80 transition-colors"
              >
                Gỡ media
              </button>
            </div>
          ) : (
            <label className="flex items-center justify-center gap-2 py-8 rounded-xl border-2 border-dashed border-border/60 cursor-pointer hover:border-primary/40 hover:bg-muted/20 transition-all">
              <ImageIcon size={18} className="text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {uploadingMedia
                  ? "Đang tải media..."
                  : "Chọn ảnh/video cho bài viết"}
              </span>
              <input
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={handleMediaSelect}
                disabled={uploadingMedia}
              />
            </label>
          )}
        </div>

        {/* Change media button */}
        {draft.mediaUrl && (
          <div className="px-5 pb-3">
            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm cursor-pointer hover:bg-accent/5 transition-colors">
              <ImageIcon size={16} />
              <span>{uploadingMedia ? "Đang tải..." : "Đổi media"}</span>
              <input
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={handleMediaSelect}
                disabled={uploadingMedia}
              />
            </label>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-border/60">
          <button
            type="button"
            onClick={close}
            disabled={isSaving}
            className="px-5 py-2 rounded-xl text-sm font-medium border border-border hover:bg-accent/10 transition-colors disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={
              isSaving ||
              uploadingMedia ||
              (!draft.content.trim() && !draft.mediaUrl.trim())
            }
            className="px-5 py-2 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all"
          >
            {isSaving ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        </div>
      </form>
    </div>
  );
}
