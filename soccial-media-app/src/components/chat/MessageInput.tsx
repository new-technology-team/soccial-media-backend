import React from 'react';
import { View, TextInput, TouchableOpacity, Text } from 'react-native';

interface MessageInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  placeholder?: string;
}

export function MessageInput({ value, onChangeText, onSend, placeholder = 'Nhắn tin...' }: MessageInputProps) {
  return (
    <View className="flex-row items-center px-4 py-3 bg-surface border-t border-border">
      <TextInput
        className="flex-1 h-11 rounded-xl border border-border bg-surface-secondary px-4 text-sm text-foreground"
        placeholder={placeholder}
        placeholderTextColor="#7e8592"
        value={value}
        onChangeText={onChangeText}
        multiline
      />
      <TouchableOpacity
        className="ml-3 bg-primary rounded-xl px-5 py-2.5 items-center justify-center"
        onPress={onSend}
        activeOpacity={0.7}
      >
        <Text className="text-white font-bold text-sm">Gửi</Text>
      </TouchableOpacity>
    </View>
  );
}

