import { create } from 'zustand'
import type { ChatMessage, Conversation } from '@/types'

type ChatState = {
  conversations: Conversation[]
  selectedConversationId: string | null
  messagesByConversation: Record<string, ChatMessage[]>
  locallyReadConversationIds: Record<string, true>
  setConversations: (items: Conversation[] | ((prev: Conversation[]) => Conversation[])) => void
  selectConversation: (conversationId: string) => void
  markConversationRead: (conversationId: string) => void
  setMessages: (conversationId: string, messages: ChatMessage[]) => void
  appendMessage: (conversationId: string, message: ChatMessage) => void
  upsertMessage: (conversationId: string, message: ChatMessage) => void
  updateUserAvatar: (userId: number, avatarUrl: string | null) => void
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  selectedConversationId: null,
  messagesByConversation: {},
  locallyReadConversationIds: {},
  setConversations: (items) =>
    set((state) => {
      const list = typeof items === 'function' ? items(state.conversations) : items
      return {
        conversations: list.map((conversation) =>
          state.locallyReadConversationIds[conversation.id]
            ? {
                ...conversation,
                unreadCount: 0,
              }
            : conversation
        ),
      }
    }),
  selectConversation: (conversationId) => set({ selectedConversationId: conversationId }),
  markConversationRead: (conversationId) =>
    set((state) => ({
      locallyReadConversationIds: {
        ...state.locallyReadConversationIds,
        [conversationId]: true,
      },
      conversations: state.conversations.map((conversation) =>
        conversation.id === conversationId
          ? {
              ...conversation,
              unreadCount: 0,
            }
          : conversation
      ),
    })),
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
  updateUserAvatar: (userId, avatarUrl) =>
    set((state) => {
      const sameUser = (value: unknown) => Number(value || 0) === Number(userId)
      const messagesByConversation = Object.fromEntries(
        Object.entries(state.messagesByConversation).map(([conversationId, messages]) => [
          conversationId,
          messages.map((message) =>
            sameUser(message.senderId)
              ? {
                  ...message,
                  senderAvatar: avatarUrl,
                }
              : message
          ),
        ])
      )

      return {
        conversations: state.conversations.map((conversation) => ({
          ...conversation,
          avatarUrl: sameUser((conversation as any).peerId) ? avatarUrl : conversation.avatarUrl,
          members: conversation.members?.map((member) =>
            sameUser(member.userId)
              ? {
                  ...member,
                  avatarUrl,
                }
              : member
          ),
          lastMessage: conversation.lastMessage && sameUser(conversation.lastMessage.senderId)
            ? {
                ...conversation.lastMessage,
                senderAvatar: avatarUrl,
              }
            : conversation.lastMessage,
        })),
        messagesByConversation,
      }
    }),
}))

