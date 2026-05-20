import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Text, TouchableOpacity, View } from "react-native";
import { TopBar } from "../components/common/TopBar";
import { EmptyState } from "../components/common/EmptyState";
import { SearchBar } from "../components/search/SearchBar";
import { UserResultItem } from "../components/search/UserResultItem";
import { api } from "../lib/api";
import type { AuthUser, FeedPost } from "../types";

interface SearchScreenProps {
  onOpenPost?: (postId: string) => void;
  onOpenUserProfile?: (userId: number) => void;
  onOpenAIChat?: () => void;
}

export function SearchScreen({
  onOpenPost,
  onOpenUserProfile,
  onOpenAIChat,
}: SearchScreenProps) {
  const [keyword, setKeyword] = useState("");
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const combinedResults = [
    ...users.map((user) => ({
      id: `user-${user.id}`,
      kind: "user" as const,
      user,
    })),
    ...posts.map((post) => ({
      id: `post-${post.id}`,
      kind: "post" as const,
      post,
    })),
  ];

  const handleSearch = useCallback(async (q: string) => {
    if (!q.trim() || q.length < 2) {
      setUsers([]);
      setPosts([]);
      return;
    }

    setIsLoading(true);
    try {
      const query = q.trim().toLowerCase();
      const [userRes, feedRes] = await Promise.all([
        api.searchUsers(q.trim()),
        api.listFeed(),
      ]);
      setUsers((userRes.users || []).slice(0, 8));
      setPosts(
        (feedRes.posts || [])
          .filter(
            (item) =>
              String(item.authorName || "")
                .toLowerCase()
                .includes(query) ||
              String(item.content || "")
                .toLowerCase()
                .includes(query),
          )
          .slice(0, 8),
      );
    } catch {
      setUsers([]);
      setPosts([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void handleSearch(keyword);
    }, 280);
    return () => clearTimeout(timer);
  }, [keyword, handleSearch]);

  return (
    <View className="flex-1 bg-background">
      <TopBar
        title="Tìm kiếm"
        rightAction={
          onOpenAIChat ? (
            <TouchableOpacity
              className="px-3 py-1.5 rounded-full bg-primary"
              activeOpacity={0.8}
              onPress={onOpenAIChat}
            >
              <Text className="text-white text-xs font-semibold">AI</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />
      <SearchBar
        value={keyword}
        onChangeText={setKeyword}
        placeholder="Tìm người dùng hoặc bài viết..."
      />
      <FlatList
        data={combinedResults}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) =>
          item.kind === "user" ? (
            <UserResultItem
              user={item.user}
              onPress={() => onOpenUserProfile?.(item.user.id)}
            />
          ) : (
            <TouchableOpacity
              className="px-4 py-4 bg-surface border-b border-border"
              activeOpacity={0.75}
              onPress={() => onOpenPost?.(item.post.id)}
            >
              <Text className="text-primary text-xs font-semibold mb-1">
                Bài viết • {item.post.authorName}
              </Text>
              <Text className="text-foreground text-sm" numberOfLines={2}>
                {item.post.content || "Bài viết có media"}
              </Text>
            </TouchableOpacity>
          )
        }
        ListHeaderComponent={
          keyword.length >= 2 && combinedResults.length > 0 ? (
            <View className="px-4 pb-2 pt-1">
              <Text className="text-muted-foreground text-xs">
                {users.length} người dùng • {posts.length} bài viết
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          keyword.length >= 2 && !isLoading ? (
            <EmptyState icon="🔍" title="Không tìm thấy kết quả" />
          ) : keyword.length < 2 ? (
            <EmptyState
              icon="🔍"
              title="Tìm kiếm người dùng và bài viết"
              subtitle="Nhập tên, email hoặc nội dung bài viết"
            />
          ) : null
        }
      />
    </View>
  );
}
