import React, { ReactNode } from 'react';
import { View } from 'react-native';

interface CardProps {
  children?: ReactNode;
  style?: object;
  size?: 'sm' | 'md' | 'lg';
}

export function Card({ children, style, size = 'md' }: CardProps) {
  const paddingClass = {
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  }[size];

  return (
    <View className={`bg-surface rounded-2xl shadow-sm ${paddingClass}`} style={style}>
      {children}
    </View>
  );
}
