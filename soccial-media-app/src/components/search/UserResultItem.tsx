import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Avatar } from '../common/Avatar';
import type { AuthUser } from '../../types';

interface UserResultItemProps {
  user: AuthUser;
  onPress?: () => void;
}

export function UserResultItem({ user, onPress }: UserResultItemProps) {
  return (
    <TouchableOpacity
      className="flex-row items-center px-4 py-4 bg-surface border-b border-border"
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Avatar name={user.fullName} size="md" />
      <View className="flex-1 ml-3">
        <Text className="text-foreground font-semibold text-sm">{user.fullName}</Text>
        <Text className="text-muted-foreground text-xs mt-0.5">{user.email || user.phone || ''}</Text>
      </View>
    </TouchableOpacity>
  );
}

