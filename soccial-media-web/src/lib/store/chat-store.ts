import { create } from 'zustand'
import type { ChatMessage, Conversation } from '@/lib/types'

type ChatState = {
  conversations: Conversation[]
  selectedConversationId: string | null
  messagesByConversation: Record<string, ChatMessage[]>
  setConversations: (items: Conversation[]) => void
  selectConversation: (conversationId: string) => void
  setMessages: (conversationId: string, messages: ChatMessage[]) => void
  appendMessage: (conversationId: string, message: ChatMessage) => void
  upsertMessage: (conversationId: string, message: ChatMessage) => void
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  selectedConversationId: null,
  messagesByConversation: {},
  setConversations: (items) => set({ conversations: items }),
  selectConversation: (conversationId) => set({ selectedConversationId: conversationId }),
  setMessages: (conversationId, messages) =>
    set((state) => ({
      messagesByConversation: {
        ...state.messagesByConversation,
        [conversationId]: messages,
      },
    })),
  appendMessage: (conversationId, message) =>
    set((state) => ({
      messagesByConversation: {
        ...state.messagesByConversation,
        [conversationId]: [...(state.messagesByConversation[conversationId] || []), message],
      },
    })),
  upsertMessage: (conversationId, message) =>
    set((state) => {
      const items = state.messagesByConversation[conversationId] || []
      const index = items.findIndex((item) => item.id === message.id)
      const nextItems = [...items]

      if (index >= 0) {
        nextItems[index] = message
      } else {
        nextItems.push(message)
      }

      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: nextItems,
        },
      }
    }),
}))
