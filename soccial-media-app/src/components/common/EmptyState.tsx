import React from 'react';
import { View, Text } from 'react-native';

interface EmptyStateProps {
  icon?: string;
  title: string;
  subtitle?: string;
}

export function EmptyState({ icon = '📭', title, subtitle }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center py-20">
      <Text className="text-5xl mb-4">{icon}</Text>
      <Text className="text-base font-semibold text-muted-foreground text-center">{title}</Text>
      {subtitle && (
        <Text className="text-sm text-muted-foreground text-center mt-2 px-8">{subtitle}</Text>
      )}
    </View>
  );
}

