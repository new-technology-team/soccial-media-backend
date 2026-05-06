import React, { useEffect } from 'react';
import { Animated, Text, View, StyleSheet } from 'react-native';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  visible: boolean;
  onHide?: () => void;
  duration?: number;
}

export function Toast({ message, type = 'info', visible, onHide, duration = 3000 }: ToastProps) {
  const opacity = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.delay(duration),
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start(() => onHide?.());
    }
  }, [visible, duration, onHide, opacity]);

  if (!visible) return null;

  const bgClass = {
    success: 'bg-[#f0fdf4] border-[#bbf7d0]',
    error: 'bg-red-50 border-[#fecaca]',
    info: 'bg-blue-50 border-blue-200',
  }[type];

  const textClass = {
    success: 'text-success',
    error: 'text-danger',
    info: 'text-primary',
  }[type];

  return (
    <Animated.View
      className={`mx-4 mb-3 rounded-xl border px-4 py-3 ${bgClass}`}
      style={{ opacity }}
    >
      <Text className={`text-sm font-medium ${textClass}`}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({});

