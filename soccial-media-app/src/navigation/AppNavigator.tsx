import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import type { AuthUser } from "../types";

interface Tab {
  key: string;
  label: string;
  icon: string;
}

const TABS: Tab[] = [
  { key: "feed", label: "Bảng tin", icon: "🏠" },
  { key: "search", label: "Tìm kiếm", icon: "🔍" },
  { key: "messages", label: "Tin nhắn", icon: "💬" },
  { key: "friends", label: "Bạn bè", icon: "👥" },
  { key: "ai-chat", label: "AI Chat", icon: "🤖" },
  { key: "notifications", label: "Thông báo", icon: "🔔" },
  { key: "profile", label: "Hồ sơ", icon: "👤" },
];

interface AppNavigatorProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function AppNavigator({ activeTab, onTabChange }: AppNavigatorProps) {
  return (
    <View
      className="absolute bottom-0 left-0 right-0 bg-surface border-t border-border flex-row items-center pb-2.5"
      style={{ height: 70 }}
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            className="flex-1 items-center justify-center py-1.5"
            onPress={() => onTabChange(tab.key)}
            activeOpacity={0.7}
          >
            {isActive && (
              <View className="absolute top-1 w-1 h-1 rounded-full bg-primary" />
            )}
            <Text className="text-2xl">{tab.icon}</Text>
            <Text
              className={`text-[10px] font-semibold mt-0.5 ${isActive ? "text-primary" : "text-muted-foreground"}`}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
