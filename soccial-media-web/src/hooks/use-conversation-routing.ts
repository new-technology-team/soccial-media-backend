import { useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Conversation } from '@/types'
import { loadChatConversations } from '@/services/messages/chat-data-service'

type UseConversationRoutingParams = {
  token?: string | null
  queryConversationId: string
  selectedConversationId: string | null
  setConversations: (items: Conversation[]) => void
  selectConversation: (conversationId: string) => void
}

export function useConversationRouting({
  token,
  queryConversationId,
  selectedConversationId,
  setConversations,
  selectConversation,
}: UseConversationRoutingParams) {
  const navigate = useNavigate()
  const userSelectedConversationRef = useRef<string | null>(null)
  const loadRequestRef = useRef(0)
  const selectedConversationRef = useRef<string | null>(selectedConversationId)

  useEffect(() => {
    selectedConversationRef.current = selectedConversationId
  }, [selectedConversationId])

  const openConversation = useCallback(
    (conversationId: string) => {
      userSelectedConversationRef.current = conversationId
      selectConversation(conversationId)
      navigate(`/messages?conversation=${encodeURIComponent(conversationId)}`, { replace: true })
    },
    [navigate, selectConversation]
  )

  useEffect(() => {
    if (!token) return

    const requestId = loadRequestRef.current + 1
    loadRequestRef.current = requestId

    loadChatConversations(token)
      .then((conversations) => {
        if (requestId !== loadRequestRef.current) return

        setConversations(conversations)

        const userSelected = userSelectedConversationRef.current
        if (userSelected && conversations.some((item) => item.id === userSelected)) {
          return
        }

        const queryTarget =
          queryConversationId && conversations.find((item) => item.id === queryConversationId)
        if (queryTarget) {
          selectConversation(queryTarget.id)
          return
        }

        if (!selectedConversationRef.current && conversations.length > 0) {
          selectConversation(conversations[0].id)
        }
      })
      .catch(console.error)
  }, [queryConversationId, selectConversation, setConversations, token])

  useEffect(() => {
    if (!selectedConversationId || queryConversationId === selectedConversationId) return
    navigate(`/messages?conversation=${encodeURIComponent(selectedConversationId)}`, { replace: true })
  }, [navigate, queryConversationId, selectedConversationId])

  return { openConversation }
}
