import type { ChatMessage } from '@/types'
<<<<<<< HEAD
=======
import { API_BASE } from '@/config/api'
>>>>>>> e1e0f981eaeaaf7229c1f05934c42d2d9ef91993

export const resolveChatMediaUrl = (value: string | null | undefined) => {
  if (!value) return null
  if (/^https?:\/\//i.test(value) || value.startsWith('blob:') || value.startsWith('data:')) {
    return value
  }
  if (value.startsWith('/uploads/')) {
<<<<<<< HEAD
    return `/backend${value}`
=======
    if (API_BASE.startsWith('/backend')) {
      return `/backend${value}`
    }

    if (API_BASE.startsWith('/api')) {
      return value
    }

    try {
      const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'http://localhost'
      const base = new URL(API_BASE, origin)
      return new URL(value, `${base.origin}/`).toString()
    } catch {
      return value
    }
>>>>>>> e1e0f981eaeaaf7229c1f05934c42d2d9ef91993
  }
  return value
}

export const normalizeIncomingMessage = (payload: ChatMessage): ChatMessage => ({
  ...payload,
  id: String(payload.id),
  conversationId: String(payload.conversationId),
  mediaUrl: resolveChatMediaUrl(payload.mediaUrl),
})

export const normalizeIncomingMessageForViewer = (payload: ChatMessage, viewerUserId?: number): ChatMessage => {
  const normalized = normalizeIncomingMessage(payload)
  if (!viewerUserId || !normalized.reactions) return normalized
  return {
    ...normalized,
    viewerReaction:
      normalized.reactions.find((item) => Number(item.userId) === Number(viewerUserId))?.reaction || null,
  }
}
