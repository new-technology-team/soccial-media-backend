"use client";

import { Link } from "react-router-dom";
import { X } from "lucide-react";
import { getPostReactionMeta } from "./feed-utils";

interface ReactionViewerProps {
  open: boolean;
  postId: number | null;
  viewers: Array<{
    userId: number;
    fullName: string;
    avatarUrl: string | null;
    reaction: string;
  }>;
  onClose: () => void;
  loading?: boolean;
}

export default function ReactionViewer({
  open,
  postId,
  viewers,
  onClose,
  loading,
}: ReactionViewerProps) {
  if (!open || postId === null) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      role="presentation"
      onClick={onClose}
    >
      <section
        className="bg-card border border-border rounded-2xl w-full max-w-sm max-h-[70vh] overflow-hidden shadow-2xl mx-3"
        role="dialog"
        aria-label="Người thả cảm xúc"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/60">
          <h3 className="text-base font-semibold">Người thả cảm xúc</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="p-1.5 rounded-lg hover:bg-accent/10 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto max-h-[calc(70vh-60px)]">
          {loading && viewers.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground text-center">
              Đang tải danh sách...
            </p>
          ) : viewers.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground text-center">
              Chưa có lượt cảm xúc.
            </p>
          ) : (
            viewers.map((viewer) => (
              <Link
                key={`${viewer.userId}-${viewer.reaction}`}
                to={`/profile/${viewer.userId}`}
                className="flex items-center gap-3 px-5 py-3 hover:bg-accent/5 transition-colors"
              >
                {viewer.avatarUrl ? (
                  <img
                    src={viewer.avatarUrl}
                    alt={viewer.fullName}
                    className="w-9 h-9 rounded-full object-cover"
                  />
                ) : (
                  <span className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold">
                    {(viewer.fullName[0] || "U").toUpperCase()}
                  </span>
                )}
                <b className="text-sm flex-1">{viewer.fullName}</b>
                <span className="text-lg">
                  {getPostReactionMeta(viewer.reaction).emoji}
                </span>
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
