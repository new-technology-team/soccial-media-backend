import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import type { Notification } from "../../types";
import { formatTime } from "../../utils";

interface NotificationItemProps {
  notification: Notification;
  onPress?: () => void;
}

export function NotificationItem({
  notification,
  onPress,
}: NotificationItemProps) {
  const isRead = Boolean(notification.isRead ?? notification.is_read);

  return (
    <TouchableOpacity
      className="flex-row items-start px-4 py-4 bg-surface border-b border-border"
      activeOpacity={0.75}
      onPress={onPress}
    >
      <View
        className={`w-2 h-2 rounded-full mt-1.5 mr-3 ${isRead ? "bg-[#7e8592]" : "bg-primary"}`}
      />
      <View className="flex-1">
        <Text
          className={`text-sm font-semibold text-foreground ${isRead ? "font-medium" : ""}`}
        >
          {notification.title}
        </Text>
        {notification.body && (
          <Text className="text-muted-foreground text-xs mt-0.5">
            {notification.body}
          </Text>
        )}
        <Text className="text-muted-foreground text-xs mt-1">
          {formatTime(notification.createdAt)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
