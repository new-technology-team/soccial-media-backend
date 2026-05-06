import React from 'react';
import { View, TextInput } from 'react-native';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChangeText, placeholder = 'Tìm kiếm...' }: SearchBarProps) {
  return (
    <View className="flex-row items-center bg-surface border border-border rounded-full px-4 mx-4 my-3 h-11">
      <TextInput
        className="flex-1 text-sm text-foreground ml-2"
        placeholder={placeholder}
        placeholderTextColor="#7e8592"
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
      />
    </View>
  );
}

