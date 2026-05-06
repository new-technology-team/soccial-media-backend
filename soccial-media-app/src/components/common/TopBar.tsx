import React, { ReactNode } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

interface TopBarProps {
  title: string;
  leftAction?: {
    label: string;
    onPress: () => void;
  };
  rightAction?: ReactNode;
  safeArea?: boolean;
}

export function TopBar({ title, leftAction, rightAction, safeArea = true }: TopBarProps) {
  return (
    <View className={`bg-surface border-b border-border ${safeArea ? 'pt-10' : ''}`}>
      <View className="h-14 flex-row items-center px-4">
        {leftAction ? (
          <TouchableOpacity onPress={leftAction.onPress} className="pr-4">
            <Text className="text-primary font-semibold text-sm">{leftAction.label}</Text>
          </TouchableOpacity>
        ) : (
          <View className="w-10" />
        )}
        <Text className="flex-1 text-base font-bold text-foreground text-center">{title}</Text>
        {rightAction ? rightAction : <View className="w-10" />}
      </View>
    </View>
  );
}

