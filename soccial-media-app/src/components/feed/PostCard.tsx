import React from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import { Avatar } from "../common/Avatar";
import type { FeedPost } from "../../types";
import { formatTime } from "../../utils";

interface PostCardProps {
  post: FeedPost;
  currentUserId: number;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onMenu: () => void;
}

export function PostCard({
  post,
  currentUserId,
  onLike,
  onComment,
  onShare,
  onMenu,
}: PostCardProps) {
  void currentUserId;

  return (
    <View className="bg-surface rounded-2xl p-4 mb-3 shadow-sm">
      {/* Header */}
      <View className="flex-row items-center mb-4">
        <Avatar
          name={post.authorName}
          avatarUrl={post.authorAvatar}
          size="md"
        />
        <View className="flex-1 ml-3">
          <Text className="text-foreground font-semibold text-sm">
            {post.authorName}
          </Text>
          <Text className="text-muted-foreground text-xs mt-0.5">
            {formatTime(post.createdAt)} ·{" "}
            {post.visibility === "public" ? "🌐 Công khai" : "🔒 Riêng tư"}
          </Text>
        </View>
        <TouchableOpacity onPress={onMenu} className="p-2">
          <Text className="text-muted-foreground text-lg leading-4">⋯</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <Text className="text-foreground text-sm leading-6 mb-4">
        {post.content}
      </Text>

      {/* Media */}
      {post.mediaUrl ? (
        <Image
          source={{ uri: post.mediaUrl }}
          className="w-full rounded-xl mb-4"
          style={{ height: 200 }}
          resizeMode="cover"
        />
      ) : null}

      {/* Stats */}
      <View className="flex-row border-b border-border pb-3 mb-3">
        <Text className="text-muted-foreground text-xs">
          ❤️ {post.reactionCount} · 💬 {post.commentCount} bình luận
        </Text>
      </View>

      {/* Actions */}
      <View className="flex-row">
        <TouchableOpacity className="flex-1 items-center py-2" onPress={onLike}>
          <Text className="text-xl">{post.viewerReaction ? "❤️" : "🤍"}</Text>
          <Text className="text-xs text-muted-foreground font-semibold mt-0.5">
            {post.viewerReaction ? "Đã thích" : "Thích"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 items-center py-2"
          onPress={onComment}
        >
          <Text className="text-xl">💬</Text>
          <Text className="text-xs text-muted-foreground font-semibold mt-0.5">
            Bình luận
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 items-center py-2"
          onPress={onShare}
        >
          <Text className="text-xl">📤</Text>
          <Text className="text-xs text-muted-foreground font-semibold mt-0.5">
            Chia sẻ
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
