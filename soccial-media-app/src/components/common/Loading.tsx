import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface LoadingProps {
  message?: string;
}

export function Loading({ message }: LoadingProps) {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <Text className="text-3xl mb-4">⏳</Text>
      {message && <Text className="text-muted-foreground text-sm font-medium">{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({});

