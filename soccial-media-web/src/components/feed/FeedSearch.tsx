"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Search, X } from "lucide-react";
import { api } from "@/api/client";
import type { FeedPost } from "@/types";

interface FeedSearchProps {
  token: string | null;
  onSearchChange: (query: string) => void;
  searchQuery: string;
  filteredPosts?: FeedPost[];
}

export default function FeedSearch({
  token,
  onSearchChange,
  searchQuery,
  filteredPosts,
}: FeedSearchProps) {
  const navigate = useNavigate();
  const [searchUsers, setSearchUsers] = useState<
    Array<{ id: number; name: string; avatarUrl: string | null }>
  >([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!token || q.length < 2) {
      setSearchUsers([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const result = await api.searchUsers(token, q);
        setSearchUsers(
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
            .slice(0, 5),
        );
      } catch {
        setSearchUsers([]);
      } finally {
        setSearching(false);
      }
    }, 240);
    return () => clearTimeout(timer);
  }, [searchQuery, token]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onSearchChange(e.target.value);
  };

  const showDropdown = searchQuery.trim().length > 0;

  return (
    <div className="relative">
      <div className="relative">
        <Search
          size={16}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
        />
        <input
          value={searchQuery}
          onChange={handleChange}
          placeholder="Tìm người, bài viết hoặc hashtag..."
          className="w-full h-10 pl-9 pr-9 rounded-xl border border-border bg-card text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
        />
        {searching && (
          <Loader2
            size={16}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin"
          />
        )}
        {!searching && searchQuery.length > 0 && (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1 z-40 rounded-xl border border-border bg-card shadow-xl overflow-hidden">
          {searchUsers.length > 0 && (
            <>
              <div className="px-3 py-2 bg-muted/20 border-b border-border/60">
                <p className="text-xs font-semibold text-muted-foreground">
                  Người dùng
                </p>
              </div>
              {searchUsers.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => navigate(`/profile/${user.id}`)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent/5 transition-colors text-left"
                >
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.name}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                      {(user.name[0] || "U").toUpperCase()}
                    </span>
                  )}
                  <b className="text-sm flex-1">{user.name}</b>
                  <small className="text-xs text-muted-foreground">
                    Tài khoản
                  </small>
                </button>
              ))}
            </>
          )}

          {filteredPosts && filteredPosts.length > 0 && (
            <>
              <div className="px-3 py-2 bg-muted/20 border-t border-border/60">
                <p className="text-xs font-semibold text-muted-foreground">
                  Bài viết
                </p>
              </div>
              {filteredPosts.slice(0, 4).map((post) => (
                <button
                  key={post.id}
                  type="button"
                  onClick={() => navigate(`/posts/${post.id}`)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent/5 transition-colors text-left"
                >
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
                  <div className="flex-1 min-w-0">
                    <b className="text-sm block truncate">
                      {post.content.slice(0, 54) ||
                        `Bài viết của ${post.authorName}`}
                    </b>
                  </div>
                  <small className="text-xs text-muted-foreground shrink-0">
                    Bài viết
                  </small>
                </button>
              ))}
            </>
          )}

          {searchUsers.length === 0 &&
            (!filteredPosts || filteredPosts.length === 0) &&
            !searching && (
              <p className="px-3 py-4 text-sm text-muted-foreground text-center">
                Không tìm thấy kết quả phù hợp.
              </p>
            )}
        </div>
      )}
    </div>
  );
}
