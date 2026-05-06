import React from 'react';
import { View, Text } from 'react-native';
import type { Message } from '../../types';
import { formatTime } from '../../utils';

interface MessageBubbleProps {
  message: Message;
  currentUserId: number;
}

export function MessageBubble({ message, currentUserId }: MessageBubbleProps) {
  const isMe = message.senderId === currentUserId;

  return (
    <View className={`flex-row justify-${isMe ? 'end' : 'start'} px-4 py-1`}>
      <View
        className={`max-w-[75%] rounded-2xl px-4 py-3 ${
          isMe ? 'bg-primary rounded-br-sm' : 'bg-surface border border-border rounded-bl-sm'
        }`}
      >
        {!isMe && (
          <Text className="text-primary text-xs font-semibold mb-0.5">{message.senderName}</Text>
        )}
        <Text className={`text-sm ${isMe ? 'text-white' : 'text-foreground'}`}>
          {message.content}
        </Text>
        <Text
          className={`text-[10px] mt-1 ${isMe ? 'text-white/70' : 'text-muted-foreground'} self-end`}
        >
          {formatTime(message.createdAt)}
        </Text>
      </View>
    </View>
  );
}

