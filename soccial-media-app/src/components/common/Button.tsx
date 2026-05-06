import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, ViewStyle } from 'react-native';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
}: ButtonProps) {
  const baseClass = 'rounded-xl items-center justify-center';

  const variantClass = {
    primary: 'bg-primary shadow-md',
    secondary: 'bg-surface border border-border',
    ghost: 'bg-transparent',
    danger: 'bg-danger shadow-md',
  }[variant];

  const sizeClass = {
    sm: 'h-10 px-4',
    md: 'h-[50px] px-4',
    lg: 'h-14 px-6',
  }[size];

  const textColor = {
    primary: 'text-white',
    secondary: 'text-foreground',
    ghost: 'text-primary',
    danger: 'text-white',
  }[variant];

  const textSizeClass = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  }[size];

  const fontWeightClass = variant === 'primary' || variant === 'danger' ? 'font-bold' : 'font-semibold';

  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      className={`${baseClass} ${variantClass} ${sizeClass} ${isDisabled ? 'opacity-50' : ''}`}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
      style={style}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' || variant === 'danger' ? '#fff' : '#0052ce'} />
      ) : (
        <Text className={`${textColor} ${textSizeClass} ${fontWeightClass}`}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

