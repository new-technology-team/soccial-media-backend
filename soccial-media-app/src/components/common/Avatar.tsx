import React from "react";
import { Image, View, Text } from "react-native";
import { getInitials } from "../../utils";

interface AvatarProps {
  name: string;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: { container: 32, text: 12 },
  md: { container: 44, text: 16 },
  lg: { container: 64, text: 24 },
};

export function Avatar({ name, avatarUrl, size = "md" }: AvatarProps) {
  const { container: cs, text: ts } = sizeMap[size];
  const radius = cs / 2;
  const hasAvatar = Boolean(String(avatarUrl || "").trim());

  return (
    <View
      className="bg-primary items-center justify-center"
      style={{ width: cs, height: cs, borderRadius: radius }}
    >
      {hasAvatar ? (
        <Image
          source={{ uri: String(avatarUrl) }}
          style={{ width: cs, height: cs, borderRadius: radius }}
          resizeMode="cover"
        />
      ) : (
        <Text className="text-white font-bold" style={{ fontSize: ts }}>
          {getInitials(name)}
        </Text>
      )}
    </View>
  );
}
