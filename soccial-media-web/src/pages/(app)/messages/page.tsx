'use client'

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Bell,
  CirclePlus,
  Info,
  MoreHorizontal,
  Paperclip,
  Phone,
  PhoneOff,
  Search,
  Send,
  Smile,
  Sticker,
  UserPlus,
  Video,
} from 'lucide-react'
import { ApiError, api } from '@/lib/api'
import { useAuthStore } from '@/lib/store/auth-store'
import { useChatStore } from '@/lib/store/chat-store'
import { connectSocket, disconnectSocket, getSocket } from '@/lib/socket'
import type { ChatMessage, FriendConnection } from '@/lib/types'
import styles from './page.module.css'

const EMOJI_SET = ['😀', '😄', '😂', '🥹', '😍', '😘', '🤝', '🙏', '🔥', '🎉', '💙', '👍', '🤔', '😎', '😢', '😡']
const STICKER_PACKS: Record<string, string[]> = {
  Cute: ['🐼', '🐱', '🐶', '🦊', '🐵', '🐸', '🐯', '🦄'],
  Meme: ['🤣', '🫠', '😏', '😵', '🤯', '🤡', '👀', '💀'],
  Animals: ['🐨', '🐻', '🦁', '🐮', '🐷', '🐔', '🐧', '🐙'],
  Party: ['🎉', '🥳', '🎊', '🔥', '💥', '✨', '🍾', '🎈'],
}

const REACTION_META = {
  like: { emoji: '👍', label: 'Thích' },
  love: { emoji: '❤️', label: 'Yêu thích' },
  care: { emoji: '🤗', label: 'Quan tâm' },
} as const

const VN_TIMEZONE = 'Asia/Ho_Chi_Minh'

const formatVietnamTime = (value: string) =>
  new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(parseChatDate(value))

const parseChatDate = (value: string) => {
  const base = new Date(value)
  if (Number.isNaN(base.getTime())) return new Date()
  // Backend returns Z values shifted by UTC offset, align display with VN wall-clock.
  if (typeof value === 'string' && value.endsWith('Z')) {
    return new Date(base.getTime() + 7 * 60 * 60 * 1000)
  }
  return base
}

const reactionSummaryText = (msg: ChatMessage) => {
  if (!msg.reactionCount) return null
  if (!msg.viewerReaction) return `${msg.reactionCount} cảm xúc`
  const reaction = REACTION_META[msg.viewerReaction]
  return `${reaction.emoji} Bạn đã ${reaction.label.toLowerCase()} · ${msg.reactionCount} cảm xúc`
}

const getConversationDisplayName = (
  conversation: { type: 'direct' | 'group'; name: string | null; members: Array<{ userId: number; fullName: string }> },
  currentUserId?: number
) => {
  if (conversation.type === 'group') {
    return conversation.name || 'Nhóm chat'
  }
  const peer = conversation.members.find((member) => member.userId !== currentUserId)
  return peer?.fullName || conversation.name || 'Cuộc trò chuyện'
}

type ActiveCall = {
  type: 'voice' | 'video'
  withName: string
  startedAt: number
}

type MessageNotificationItem = {
  id: number
  type: string
  title: string
  body: string | null
  created_at: string
  is_read: number
  meta?: Record<string, unknown> | null
}

type IncomingCallState = {
  fromUserId: number
  callType: 'voice' | 'video'
  conversationId: string | null
  offer: RTCSessionDescriptionInit
}

const resolveChatMediaUrl = (value: string | null | undefined) => {
  if (!value) return null
  if (/^https?:\/\//i.test(value) || value.startsWith('blob:') || value.startsWith('data:')) {
    return value
  }
  if (value.startsWith('/uploads/')) {
    return `/backend${value}`
  }
  return value
}

const normalizeIncomingMessage = (payload: ChatMessage): ChatMessage => ({
  ...payload,
  id: String(payload.id),
  conversationId: String(payload.conversationId),
  mediaUrl: resolveChatMediaUrl(payload.mediaUrl),
})

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
}

export default function MessagesPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = useAuthStore((state) => state.accessToken)
  const user = useAuthStore((state) => state.user)
  const {
    conversations,
    selectedConversationId,
    messagesByConversation,
    setConversations,
    selectConversation,
    setMessages,
    appendMessage,
    upsertMessage,
  } = useChatStore()
  const [message, setMessage] = useState('')
  const [callStatus, setCallStatus] = useState<string | null>(null)
  const [incomingCall, setIncomingCall] = useState<IncomingCallState | null>(null)
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null)
  const [callSeconds, setCallSeconds] = useState(0)
  const [busyUploading, setBusyUploading] = useState(false)
  const [busyActionId, setBusyActionId] = useState<string | null>(null)
  const [forwardingMessageId, setForwardingMessageId] = useState<string | null>(null)
  const [remoteStreams, setRemoteStreams] = useState<Array<{ userId: number; stream: MediaStream }>>([])
  const [actionMenu, setActionMenu] = useState<{ messageId: string; x: number; y: number } | null>(null)
  const [composerMenuOpen, setComposerMenuOpen] = useState(false)
  const [chatNotice, setChatNotice] = useState<string | null>(null)
  const [showEmojiPanel, setShowEmojiPanel] = useState(false)
  const [showStickerPanel, setShowStickerPanel] = useState(false)
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false)
  const [showNewMessageModal, setShowNewMessageModal] = useState(false)
  const [showNotificationsDrawer, setShowNotificationsDrawer] = useState(false)
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false)
  const [showManageGroupModal, setShowManageGroupModal] = useState(false)
  const [showGroupInfoModal, setShowGroupInfoModal] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [groupSearchKeyword, setGroupSearchKeyword] = useState('')
  const [groupMemberIds, setGroupMemberIds] = useState<number[]>([])
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [groupActionBusyId, setGroupActionBusyId] = useState<string | null>(null)
  const [newMessageKeyword, setNewMessageKeyword] = useState('')
  const [searchUsersResult, setSearchUsersResult] = useState<Array<{ id: number; name: string }>>([])
  const [notifications, setNotifications] = useState<Array<{ id: number; type: string; title: string; body: string | null; created_at: string; is_read: number; meta?: Record<string, unknown> | null }>>([])
  const [activeStickerPack, setActiveStickerPack] = useState<keyof typeof STICKER_PACKS>('Cute')
  const [loadedStickerPacks, setLoadedStickerPacks] = useState<Record<string, boolean>>({ Cute: true })
  const [showJumpToLatest, setShowJumpToLatest] = useState(false)
  const [hasMoreHistory, setHasMoreHistory] = useState<Record<string, boolean>>({})
  const [messageLimitByConversation, setMessageLimitByConversation] = useState<
    Record<string, { total: number; sent: number; remaining: number; isFriend: boolean } | null>
  >({})
  const [friendMap, setFriendMap] = useState<Record<number, FriendConnection>>({})
  const [pendingFriendRequestTo, setPendingFriendRequestTo] = useState<Record<number, boolean>>({})
  const [creatingDirectConversation, setCreatingDirectConversation] = useState(false)
  const [mutedMic, setMutedMic] = useState(false)
  const [mutedCam, setMutedCam] = useState(false)
  const [callAnswered, setCallAnswered] = useState(false)
  const [ringingStartedAt, setRingingStartedAt] = useState<number | null>(null)
  const [isSendingMessage, setIsSendingMessage] = useState(false)
  const sendingMessageRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const videoInputRef = useRef<HTMLInputElement | null>(null)
  const longPressTimer = useRef<number | null>(null)
  const localVideoRef = useRef<HTMLVideoElement | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const peersRef = useRef<Map<number, RTCPeerConnection>>(new Map())
  const messagesWrapRef = useRef<HTMLDivElement | null>(null)
  const actionMenuRef = useRef<HTMLDivElement | null>(null)

  const VIRTUAL_CHUNK = 50
  const virtualSlice = useMemo(() => {
    const allMessages = selectedConversationId ? messagesByConversation[selectedConversationId] || [] : []
    if (allMessages.length <= VIRTUAL_CHUNK) {
      return { items: allMessages, startIndex: 0, endIndex: allMessages.length }
    }
    return {
      items: allMessages.slice(-VIRTUAL_CHUNK),
      startIndex: Math.max(0, allMessages.length - VIRTUAL_CHUNK),
      endIndex: allMessages.length,
    }
  }, [messagesByConversation, selectedConversationId])

  const selectedConversation = conversations.find((c) => c.id === selectedConversationId) || null
  const queryConversationId = searchParams.get('conversation') || ''
  const parseNotificationMeta = useCallback((item: MessageNotificationItem) => {
    const rawMeta = item?.meta
    if (!rawMeta || typeof rawMeta !== 'object') return null
    const source = rawMeta as Record<string, unknown>
    const conversationId = source.conversationId ?? source.conversation_id ?? source.chatId ?? source.chat_id
    const requesterId = source.requesterId ?? source.requester_id ?? source.fromUserId ?? source.from_user_id
    const friendshipId = source.friendshipId ?? source.friendship_id
    return {
      conversationId: conversationId ? String(conversationId) : null,
      requesterId: requesterId ? Number(requesterId) : null,
      friendshipId: friendshipId ? Number(friendshipId) : null,
    }
  }, [])

  const reloadNotifications = useCallback(async () => {
    if (!token) return
    try {
      const result = await api.notifications(token)
      const items = (result.notifications || [])
        .filter((item) => item.type === 'missed-call' || item.type === 'message' || item.type === 'friend-request')
        .slice(0, 40)
      setNotifications(items)
    } catch {
      // Ignore transient notification reload issues.
    }
  }, [token])

  const reloadFriendMap = useCallback(async () => {
    if (!token || !user?.id) return
    try {
      const result = await api.listFriends(token)
      const map: Record<number, FriendConnection> = {}
      result.friends.forEach((friend) => {
        map[friend.id] = friend
      })
      setFriendMap(map)
    } catch (error) {
      console.error('Không thể tải danh sách bạn bè', error)
    }
  }, [token, user?.id])

  useEffect(() => {
    if (!token) return

    const loadConversations = async () => {
      const response = await api.listConversations(token)
      setConversations(response.conversations)

      if (!selectedConversationId && response.conversations.length > 0) {
        selectConversation(response.conversations[0].id)
      }

      if (queryConversationId && response.conversations.some((item) => item.id === queryConversationId)) {
        selectConversation(queryConversationId)
      }
    }

    loadConversations().catch(console.error)
  }, [queryConversationId, token, selectedConversationId, selectConversation, setConversations])

  useEffect(() => {
    if (!token || !selectedConversationId) return

    api
      .listMessages(token, selectedConversationId, { limit: 25 })
      .then((response) => {
        setMessages(selectedConversationId, response.messages)
        setHasMoreHistory((prev) => ({ ...prev, [selectedConversationId]: response.messages.length >= 25 }))
        setMessageLimitByConversation((prev) => ({
          ...prev,
          [selectedConversationId]: response.messageLimit || null,
        }))
      })
      .catch(console.error)
  }, [token, selectedConversationId, setMessages])

  useEffect(() => {
    reloadNotifications().catch(() => undefined)
  }, [reloadNotifications])

  useEffect(() => {
    if (!token || !newMessageKeyword.trim()) {
      setSearchUsersResult([])
      return
    }

    const timer = window.setTimeout(() => {
      api
        .searchUsers(token, newMessageKeyword.trim())
        .then((result) => {
          const users = (result.users || [])
            .map((item) => ({
              id: Number(item.id || 0),
              name: String(item.full_name || item.fullName || item.email || item.phone || ''),
            }))
            .filter((item) => item.id > 0)
          setSearchUsersResult(users)
        })
        .catch(() => setSearchUsersResult([]))
    }, 260)

    return () => window.clearTimeout(timer)
  }, [newMessageKeyword, token])

  useEffect(() => {
    if (!selectedConversationId) return
    setComposerMenuOpen(false)
    setShowEmojiPanel(false)
    setShowStickerPanel(false)
    setShowJumpToLatest(false)
  }, [selectedConversationId])

  useEffect(() => {
    if (!selectedConversationId || !queryConversationId) return
    if (selectedConversationId === queryConversationId) return
    selectConversation(queryConversationId)
  }, [queryConversationId, selectedConversationId, selectConversation])

  useEffect(() => {
    if (!token) return

    const socket = connectSocket(token)
    socket.on('message:new', (payload: ChatMessage) => {
      const normalized = normalizeIncomingMessage(payload)
      upsertMessage(normalized.conversationId, normalized)
    })

    socket.on('message:reaction', (payload: { conversationId: string; message: ChatMessage }) => {
      upsertMessage(String(payload.conversationId), normalizeIncomingMessage(payload.message))
    })

    socket.on('message:updated', (payload: { conversationId: string; message: ChatMessage | null }) => {
      if (!payload?.message) return
      upsertMessage(String(payload.conversationId), normalizeIncomingMessage(payload.message))
    })

    socket.on('notification:new', (payload) => {
      if (!payload) return
      reloadNotifications().catch(() => undefined)
      if (payload.type === 'message') {
        api
          .listConversations(token)
          .then((response) => setConversations(response.conversations))
          .catch(() => undefined)
      }

      if (payload.type === 'friend-request' || payload.type === 'friend-accepted') {
        reloadFriendMap().catch(() => undefined)
      }
    })

    socket.on('call:offer', (payload) => {
      if (!payload.offer) return
      const incomingConversationId = payload.conversationId ? String(payload.conversationId) : null
      setIncomingCall({
        fromUserId: Number(payload.fromUserId),
        callType: payload.callType || 'voice',
        conversationId: incomingConversationId,
        offer: payload.offer,
      })
      setCallStatus(`Cuộc gọi ${payload.callType === 'video' ? 'video' : 'thoại'} đến`)
    })

    socket.on('call:answer', async (payload) => {
      const fromUserId = Number(payload.fromUserId || 0)
      const peer = peersRef.current.get(fromUserId)
      if (peer && payload.answer) {
        await peer.setRemoteDescription(new RTCSessionDescription(payload.answer))
      }
      setCallAnswered(true)
      setRingingStartedAt(null)
      setCallStatus('Người nhận đã tham gia cuộc gọi')
    })

    socket.on('call:ice-candidate', async (payload) => {
      const fromUserId = Number(payload.fromUserId || 0)
      const peer = peersRef.current.get(fromUserId)
      if (!peer || !payload.candidate) return
      try {
        await peer.addIceCandidate(new RTCIceCandidate(payload.candidate))
      } catch (error) {
        console.error('Failed to add ICE candidate', error)
      }
    })

    socket.on('call:end', () => {
      setCallStatus('Cuộc gọi đã kết thúc')
      setIncomingCall(null)
      peersRef.current.forEach((peer) => peer.close())
      peersRef.current.clear()
      localStreamRef.current?.getTracks().forEach((track) => track.stop())
      localStreamRef.current = null
      setRemoteStreams([])
      setActiveCall(null)
      setCallSeconds(0)
      setCallAnswered(false)
      setRingingStartedAt(null)
    })

    return () => {
      socket.off('message:new')
      socket.off('message:reaction')
      socket.off('message:updated')
      socket.off('notification:new')
      socket.off('call:offer')
      socket.off('call:answer')
      socket.off('call:ice-candidate')
      socket.off('call:end')
      disconnectSocket()
    }
  }, [reloadFriendMap, reloadNotifications, setConversations, token, upsertMessage])

  useEffect(() => {
    if (!selectedConversationId) return
    const socket = getSocket()
    if (!socket) return

    socket.emit('join-conversation', selectedConversationId)
    return () => {
      socket.emit('leave-conversation', selectedConversationId)
    }
  }, [selectedConversationId])

  useEffect(() => {
    if (!actionMenu || !actionMenuRef.current) return
    actionMenuRef.current.style.left = `${actionMenu.x}px`
    actionMenuRef.current.style.top = `${actionMenu.y}px`
  }, [actionMenu])

  useEffect(() => {
    if (!activeCall) return
    setCallSeconds(Math.floor((Date.now() - activeCall.startedAt) / 1000))
    const timer = window.setInterval(() => {
      setCallSeconds(Math.floor((Date.now() - activeCall.startedAt) / 1000))
    }, 1000)

    return () => {
      window.clearInterval(timer)
    }
  }, [activeCall])

  const messages = useMemo(
    () => (selectedConversationId ? messagesByConversation[selectedConversationId] || [] : []),
    [messagesByConversation, selectedConversationId]
  )

  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    reloadFriendMap().catch(() => undefined)
  }, [reloadFriendMap])

  const filteredConversations = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter((conversation) =>
      getConversationDisplayName(conversation, user?.id).toLowerCase().includes(q)
    )
  }, [conversations, searchTerm, user?.id])

  const callTargetId = useMemo(() => {
    if (!selectedConversation || !user?.id) return null
    const directTarget = selectedConversation.members.find((m) => m.userId !== user.id)
    return directTarget?.userId || null
  }, [selectedConversation, user?.id])

  const callTargets = useMemo(() => {
    if (!selectedConversation || !user?.id) return []
    return selectedConversation.members.map((m) => m.userId).filter((id) => id !== user.id)
  }, [selectedConversation, user?.id])

  useEffect(() => {
    if (!activeCall || callAnswered || !ringingStartedAt) return

    const timeoutMs = 60_000 - (Date.now() - ringingStartedAt)
    const conversationId = selectedConversationId
    const targets = [...callTargets]

    const autoEnd = () => {
      const socket = getSocket()
      if (socket && conversationId) {
        targets.forEach((targetUserId) => {
          socket.emit('call:end', {
            targetUserId,
            conversationId,
          })
        })
      }
      closeCallResources()
      setCallStatus('Không có phản hồi sau 1 phút. Cuộc gọi đã tự kết thúc.')
      setIncomingCall(null)
      setActiveCall(null)
      setCallSeconds(0)
      setCallAnswered(false)
      setRingingStartedAt(null)
    }

    if (timeoutMs <= 0) {
      autoEnd()
      return
    }

    const timer = window.setTimeout(autoEnd, timeoutMs)
    return () => window.clearTimeout(timer)
  }, [activeCall, callAnswered, callTargets, ringingStartedAt, selectedConversationId])

  const directPeer = useMemo(() => {
    if (!selectedConversation || !user?.id) return null
    if (selectedConversation.type !== 'direct') return null
    const member = selectedConversation.members.find((m) => m.userId !== user.id)
    if (!member) return null
    return {
      id: member.userId,
      name: member.fullName,
    }
  }, [selectedConversation, user?.id])

  const selectedGroup = useMemo(() => {
    if (!selectedConversation || selectedConversation.type !== 'group') return null
    return selectedConversation
  }, [selectedConversation])

  const myGroupMember = useMemo(() => {
    if (!selectedGroup || !user?.id) return null
    return selectedGroup.members.find((item) => item.userId === user.id) || null
  }, [selectedGroup, user?.id])

  const myGroupRole = myGroupMember?.role || 'member'
  const canRemoveMembers = Boolean(selectedGroup && (myGroupRole === 'leader' || myGroupRole === 'deputy'))
  const canManageRoles = Boolean(selectedGroup && myGroupRole === 'leader')
  const canDissolveSelectedGroup = Boolean(selectedGroup && myGroupRole === 'leader')
  const canAddMembers = canRemoveMembers

  const groupLeader = useMemo(() => {
    if (!selectedGroup) return null
    const currentLeader = selectedGroup.members.find((member) => member.role === 'leader')
    if (currentLeader) return currentLeader
    return selectedGroup.members.find((member) => Number(member.userId) === Number(selectedGroup.createdBy)) || selectedGroup.members[0] || null
  }, [selectedGroup])

  const groupDeputy = useMemo(() => {
    if (!selectedGroup) return null
    return selectedGroup.members.find((member) => member.role === 'deputy') || null
  }, [selectedGroup])

  const groupInviteCandidates = useMemo(() => {
    if (!selectedGroup) return []
    const existingIds = new Set(selectedGroup.members.map((member) => member.userId))
    return Object.values(friendMap)
      .filter((friend) => friend.status === 'accepted')
      .filter((friend) => !existingIds.has(friend.id))
  }, [friendMap, selectedGroup])

  const filteredGroupInviteCandidates = useMemo(() => {
    const q = groupSearchKeyword.trim().toLowerCase()
    if (!q) return groupInviteCandidates
    return groupInviteCandidates.filter((friend) =>
      [friend.fullName, friend.email || '', friend.phone || '', String(friend.id)].join(' ').toLowerCase().includes(q)
    )
  }, [groupInviteCandidates, groupSearchKeyword])

  const pinnedMessageIds = useMemo(() => new Set((selectedConversation?.pinnedMessageIds || []).map((item) => String(item))), [selectedConversation])

  const directPeerFriendship = directPeer ? friendMap[directPeer.id] : null
  const isDirectPeerFriend = Boolean(directPeerFriendship && directPeerFriendship.status === 'accepted')
  const isDirectPeerPending = Boolean(directPeerFriendship && directPeerFriendship.status === 'pending')
  const isDirectPeerRequestedByMe = Boolean(directPeerFriendship?.requestedByMe)

  const ensureLocalStream = async (callType: 'voice' | 'video') => {
    if (localStreamRef.current) return localStreamRef.current
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: callType === 'video',
    })
    localStreamRef.current = stream
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream
    }
    return stream
  }

  const buildPeerConnection = async (targetUserId: number, callType: 'voice' | 'video') => {
    const socket = getSocket()
    if (!socket || !selectedConversationId) return null

    const pc = new RTCPeerConnection(RTC_CONFIG)
    const localStream = await ensureLocalStream(callType)

    localStream.getTracks().forEach((track) => {
      pc.addTrack(track, localStream)
    })

    pc.ontrack = (event) => {
      const [stream] = event.streams
      if (!stream) return
      setRemoteStreams((prev) => {
        const found = prev.find((item) => item.userId === targetUserId)
        if (found) {
          return prev.map((item) => (item.userId === targetUserId ? { userId: targetUserId, stream } : item))
        }
        return [...prev, { userId: targetUserId, stream }]
      })
    }

    pc.onicecandidate = (event) => {
      if (!event.candidate) return
      socket.emit('call:ice-candidate', {
        targetUserId,
        conversationId: selectedConversationId,
        candidate: event.candidate,
      })
    }

    peersRef.current.set(targetUserId, pc)
    return pc
  }

  const closeCallResources = () => {
    peersRef.current.forEach((peer) => peer.close())
    peersRef.current.clear()
    localStreamRef.current?.getTracks().forEach((track) => track.stop())
    localStreamRef.current = null
    setRemoteStreams([])
    setMutedCam(false)
    setMutedMic(false)
  }

  const handleRequestFriend = async () => {
    if (!token || !directPeer) return
    setPendingFriendRequestTo((prev) => ({ ...prev, [directPeer.id]: true }))
    try {
      await api.requestFriend(token, directPeer.id)
      setChatNotice('Đã gửi lời mời kết bạn. Hãy chờ đối phương chấp nhận để nhắn không giới hạn.')
      await reloadFriendMap()
    } catch (error) {
      if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('Không thể gửi lời mời kết bạn.')
      }
    } finally {
      setPendingFriendRequestTo((prev) => ({ ...prev, [directPeer.id]: false }))
    }
  }

  const handleCancelFriendRequest = async () => {
    if (!token || !directPeer) return
    setPendingFriendRequestTo((prev) => ({ ...prev, [directPeer.id]: true }))
    try {
      await api.deleteFriend(token, directPeer.id)
      await reloadFriendMap()
      setChatNotice('Đã hủy lời mời kết bạn.')
    } catch (error) {
      if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('Không thể hủy lời mời kết bạn.')
      }
    } finally {
      setPendingFriendRequestTo((prev) => ({ ...prev, [directPeer.id]: false }))
    }
  }

  const handleAcceptFriendRequestDirect = async () => {
    if (!token || !directPeer) return
    setPendingFriendRequestTo((prev) => ({ ...prev, [directPeer.id]: true }))
    try {
      await api.acceptFriend(token, directPeer.id)
      await reloadFriendMap()
      setChatNotice('Đã chấp nhận lời mời kết bạn.')
    } catch (error) {
      if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('Không thể chấp nhận lời mời kết bạn.')
      }
    } finally {
      setPendingFriendRequestTo((prev) => ({ ...prev, [directPeer.id]: false }))
    }
  }

  const handleOpenOrCreateDirectConversation = async (targetUserId: number) => {
    if (!token) return

    const existing = conversations.find(
      (conv) => conv.type === 'direct' && conv.members.some((m) => m.userId === targetUserId)
    )
    if (existing) {
      selectConversation(existing.id)
      return
    }

    setCreatingDirectConversation(true)
    try {
      const result = await api.createDirectConversation(token, targetUserId)
      const refreshed = await api.listConversations(token)
      setConversations(refreshed.conversations)
      selectConversation(result.conversation.id)
      setChatNotice('Đã mở cuộc trò chuyện trực tiếp.')
    } catch (error) {
      if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('Không thể mở cuộc trò chuyện.')
      }
    } finally {
      setCreatingDirectConversation(false)
    }
  }

  const handlePickAttachmentType = (type: 'image' | 'video' | 'file') => {
    if (!selectedConversationId) {
      setChatNotice('Vui lòng chọn cuộc trò chuyện trước khi gửi tệp.')
      setComposerMenuOpen(false)
      return
    }

    setComposerMenuOpen(false)
    if (type === 'image') {
      imageInputRef.current?.click()
      return
    }
    if (type === 'video') {
      videoInputRef.current?.click()
      return
    }
    fileInputRef.current?.click()
  }

  const handleCreateConversationWithUser = async (targetUserId: number) => {
    if (!token) return
    try {
      const created = await api.createDirectConversation(token, targetUserId)
      const refreshed = await api.listConversations(token)
      setConversations(refreshed.conversations)
      selectConversation(created.conversation.id)
      setShowNewMessageModal(false)
      setNewMessageKeyword('')
      setSearchUsersResult([])
    } catch (error) {
      if (error instanceof Error) {
        setChatNotice(error.message)
      }
    }
  }

  const handleOpenNotificationConversation = (conversationId: string | null | undefined) => {
    if (!conversationId) return
    selectConversation(String(conversationId))
    setShowNotificationsDrawer(false)
  }

  const handleAcceptFromNotification = async (item: MessageNotificationItem) => {
    if (!token) return
    const meta = parseNotificationMeta(item)
    const identifier = meta?.requesterId || meta?.friendshipId
    if (!identifier) return
    setBusyActionId(`notif-${item.id}`)
    try {
      await api.acceptFriend(token, identifier)
      await reloadFriendMap()
      await reloadNotifications()
      setChatNotice('Đã chấp nhận lời mời kết bạn.')
      if (meta?.conversationId) {
        handleOpenNotificationConversation(meta.conversationId)
      }
    } catch (error) {
      if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('Không thể chấp nhận lời mời từ thông báo.')
      }
    } finally {
      setBusyActionId(null)
    }
  }

  const acceptedFriends = useMemo(
    () => Object.values(friendMap).filter((friend) => friend.status === 'accepted'),
    [friendMap]
  )

  const toggleGroupMember = (friendId: number) => {
    setGroupMemberIds((prev) =>
      prev.includes(friendId) ? prev.filter((id) => id !== friendId) : [...prev, friendId]
    )
  }

  const refreshConversations = useCallback(async () => {
    if (!token) return
    const refreshed = await api.listConversations(token)
    setConversations(refreshed.conversations)
  }, [token, setConversations])

  const handleCreateGroupConversation = async () => {
    if (!token || !groupName.trim() || groupMemberIds.length === 0 || creatingGroup) return

    setCreatingGroup(true)
    try {
      const created = await api.createGroupConversation(token, {
        name: groupName.trim(),
        memberIds: groupMemberIds,
      })
      await refreshConversations()
      selectConversation(created.conversation.id)
      setShowCreateGroupModal(false)
      setGroupName('')
      setGroupSearchKeyword('')
      setGroupMemberIds([])
      setChatNotice('Đã tạo nhóm chat thành công.')
    } catch (error) {
      if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('Không thể tạo nhóm chat.')
      }
    } finally {
      setCreatingGroup(false)
    }
  }

  const handleAddMemberToGroup = async (targetUserId: number) => {
    if (!token || !selectedGroup || !canAddMembers) return
    setGroupActionBusyId(`add-${targetUserId}`)
    try {
      await api.addGroupMember(token, selectedGroup.id, targetUserId)
      await refreshConversations()
      setChatNotice('Đã thêm thành viên vào nhóm.')
    } catch (error) {
      if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('Không thể thêm thành viên.')
      }
    } finally {
      setGroupActionBusyId(null)
    }
  }

  const handleRemoveMemberFromGroup = async (targetUserId: number) => {
    if (!token || !selectedGroup || !canRemoveMembers) return
    setGroupActionBusyId(`remove-${targetUserId}`)
    try {
      await api.removeGroupMember(token, selectedGroup.id, targetUserId)
      await refreshConversations()
      setChatNotice('Đã xóa thành viên khỏi nhóm.')
    } catch (error) {
      if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('Không thể xóa thành viên.')
      }
    } finally {
      setGroupActionBusyId(null)
    }
  }

  const handleSetDeputyRole = async (targetUserId: number | null) => {
    if (!token || !selectedGroup || !canManageRoles) return
    setGroupActionBusyId(`deputy-${targetUserId ?? 'none'}`)
    try {
      await api.setGroupDeputy(token, selectedGroup.id, targetUserId)
      await refreshConversations()
      setChatNotice(targetUserId ? 'Đã cấp quyền phó nhóm.' : 'Đã thu hồi quyền phó nhóm.')
    } catch (error) {
      if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('Không thể cập nhật phó nhóm.')
      }
    } finally {
      setGroupActionBusyId(null)
    }
  }

  const handleTransferLeader = async (targetUserId: number) => {
    if (!token || !selectedGroup || !canManageRoles) return
    setGroupActionBusyId(`role-${targetUserId}`)
    try {
      await api.transferGroupLeader(token, selectedGroup.id, targetUserId)
      await refreshConversations()
      setChatNotice('Đã chuyển quyền trưởng nhóm.')
    } catch (error) {
      if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('Không thể chuyển quyền trưởng nhóm.')
      }
    } finally {
      setGroupActionBusyId(null)
    }
  }

  const handleDissolveGroup = async () => {
    if (!token || !selectedGroup || !canDissolveSelectedGroup) return
    const confirmed = window.confirm('Bạn chắc chắn muốn giải tán nhóm này? Hành động này không thể hoàn tác.')
    if (!confirmed) return
    setGroupActionBusyId('dissolve-group')
    try {
      await api.dissolveGroupConversation(token, selectedGroup.id)
      await refreshConversations()
      setShowManageGroupModal(false)
      setChatNotice('Đã giải tán nhóm chat.')
      const fallback = conversations.find((item) => item.id !== selectedGroup.id)
      if (fallback) {
        selectConversation(fallback.id)
      }
    } catch (error) {
      if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('Không thể giải tán nhóm.')
      }
    } finally {
      setGroupActionBusyId(null)
    }
  }

  const loadOlderMessages = async () => {
    if (!token || !selectedConversationId || loadingOlderMessages) return
    if (!hasMoreHistory[selectedConversationId]) return

    const currentMessages = messagesByConversation[selectedConversationId] || []
    if (currentMessages.length === 0) return
    const beforeId = currentMessages[0]?.id
    if (!beforeId) return

    setLoadingOlderMessages(true)
    const previousScrollHeight = messagesWrapRef.current?.scrollHeight || 0

    try {
      const response = await api.listMessages(token, selectedConversationId, {
        limit: 20,
        beforeId,
      })

      if (response.messages.length === 0) {
        setHasMoreHistory((prev) => ({ ...prev, [selectedConversationId]: false }))
        return
      }

      const merged = [...response.messages, ...currentMessages]
      setMessages(selectedConversationId, merged)
      setHasMoreHistory((prev) => ({ ...prev, [selectedConversationId]: response.messages.length >= 20 }))
      setMessageLimitByConversation((prev) => ({
        ...prev,
        [selectedConversationId]: response.messageLimit || prev[selectedConversationId] || null,
      }))

      requestAnimationFrame(() => {
        if (!messagesWrapRef.current) return
        const newScrollHeight = messagesWrapRef.current.scrollHeight
        messagesWrapRef.current.scrollTop = newScrollHeight - previousScrollHeight
      })
    } catch (error) {
      console.error('Không thể tải tin nhắn cũ hơn', error)
    } finally {
      setLoadingOlderMessages(false)
    }
  }

  const handleSend = async () => {
    if (!message.trim() || !token || !selectedConversationId || sendingMessageRef.current) return

    sendingMessageRef.current = true
    setIsSendingMessage(true)
    try {
      const response = await api.sendMessage(token, selectedConversationId, message)
      upsertMessage(selectedConversationId, response.message)
      setMessage('')
      setChatNotice(null)
      setShowEmojiPanel(false)
      setShowStickerPanel(false)

      setMessageLimitByConversation((prev) => {
        const current = prev[selectedConversationId]
        if (!current) return prev
        return {
          ...prev,
          [selectedConversationId]: {
            ...current,
            sent: current.sent + 1,
            remaining: Math.max(0, current.remaining - 1),
          },
        }
      })
    } catch (error) {
      if (error instanceof ApiError && error.code === 'MESSAGE_LIMIT_NON_FRIEND') {
        setChatNotice('Bạn chỉ gửi được tối đa 3 tin nhắn khi chưa kết bạn. Hãy kết bạn để tiếp tục.')
      } else if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('Không thể gửi tin nhắn.')
      }
      console.error('Failed to send message:', error)
    } finally {
      sendingMessageRef.current = false
      setIsSendingMessage(false)
    }
  }

  const fileToBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : ''
        const base64 = result.includes(',') ? result.split(',')[1] : result
        resolve(base64)
      }
      reader.onerror = () => reject(new Error('Không thể đọc file'))
      reader.readAsDataURL(file)
    })

  const mapTypeFromFile = (file: File): 'image' | 'video' | 'audio' | 'file' => {
    if (file.type.startsWith('image/')) return 'image'
    if (file.type.startsWith('video/')) return 'video'
    if (file.type.startsWith('audio/')) return 'audio'
    return 'file'
  }

  const handlePickAttachment = () => {
    if (!selectedConversationId) {
      setChatNotice('Vui lòng chọn cuộc trò chuyện trước khi gửi tệp.')
      return
    }
    setComposerMenuOpen((prev) => !prev)
  }

  const handleFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !token || !selectedConversationId) return

    const maxBytes = 12 * 1024 * 1024
    if (file.size > maxBytes) {
      setChatNotice('Tệp quá lớn. Vui lòng chọn tệp nhỏ hơn 12MB.')
      event.target.value = ''
      return
    }

    setBusyUploading(true)
    setChatNotice(null)
    try {
      const base64Data = await fileToBase64(file)
      const upload = await api.uploadMessageBase64(token, selectedConversationId, {
        fileName: file.name,
        contentType: file.type || 'application/octet-stream',
        base64Data,
      })

      if (!upload.mediaUrl) {
        throw new Error('Tải tệp lên thất bại, không nhận được đường dẫn file.')
      }

      const response = await api.sendMessagePayload(token, selectedConversationId, {
        type: mapTypeFromFile(file),
        mediaUrl: upload.mediaUrl,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        fileSize: file.size,
      })
      upsertMessage(selectedConversationId, response.message)
      setChatNotice('Đã gửi tệp thành công.')
      setMessageLimitByConversation((prev) => {
        const current = prev[selectedConversationId]
        if (!current) return prev
        return {
          ...prev,
          [selectedConversationId]: {
            ...current,
            sent: current.sent + 1,
            remaining: Math.max(0, current.remaining - 1),
          },
        }
      })
    } catch (error) {
      if (error instanceof ApiError && error.code === 'MESSAGE_LIMIT_NON_FRIEND') {
        setChatNotice('Bạn chỉ gửi được tối đa 3 tin nhắn khi chưa kết bạn. Hãy kết bạn để tiếp tục.')
      } else if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('Không thể gửi file đính kèm.')
      }
      console.error('Không thể gửi file đính kèm:', error)
    } finally {
      setBusyUploading(false)
      event.target.value = ''
    }
  }

  const handleReaction = async (chatMessage: ChatMessage, reaction: 'like' | 'love' | 'care') => {
    if (!token) return
    setBusyActionId(chatMessage.id)
    try {
      let response: { chatMessage: ChatMessage }
      if (chatMessage.viewerReaction === reaction) {
        response = await api.removeMessageReaction(token, chatMessage.id)
      } else {
        response = await api.reactMessage(token, chatMessage.id, reaction)
      }
      upsertMessage(chatMessage.conversationId, response.chatMessage)
    } catch (error) {
      console.error('Không thể cập nhật cảm xúc:', error)
      setChatNotice('Không thể cập nhật cảm xúc cho tin nhắn này.')
    } finally {
      setBusyActionId(null)
    }
  }

  const handleRecall = async (chatMessage: ChatMessage) => {
    if (!token || chatMessage.senderId !== user?.id) return
    setBusyActionId(chatMessage.id)
    try {
      const response = await api.recallMessage(token, chatMessage.id)
      upsertMessage(chatMessage.conversationId, response.chatMessage)
    } catch (error) {
      console.error('Không thể thu hồi tin nhắn:', error)
      setChatNotice('Không thể thu hồi tin nhắn này.')
    } finally {
      setBusyActionId(null)
    }
  }

  const handleForward = async (targetConversationId: string) => {
    if (!token || !forwardingMessageId) return
    setBusyActionId(forwardingMessageId)
    try {
      const response = await api.forwardMessage(token, forwardingMessageId, targetConversationId)
      if (selectedConversationId === targetConversationId) {
        upsertMessage(targetConversationId, response.chatMessage)
      }
      setForwardingMessageId(null)
      setChatNotice('Đã chuyển tiếp tin nhắn thành công.')
      api.listConversations(token).then((res) => setConversations(res.conversations)).catch(() => undefined)
    } catch (error) {
      console.error('Không thể chuyển tiếp tin nhắn:', error)
      if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('Không thể chuyển tiếp tin nhắn.')
      }
    } finally {
      setBusyActionId(null)
    }
  }

  const handleDeleteMessage = async (chatMessage: ChatMessage) => {
    if (!token) return
    setBusyActionId(chatMessage.id)
    try {
      await api.deleteMessage(token, chatMessage.id)
      if (!selectedConversationId) return
      const current = messagesByConversation[selectedConversationId] || []
      setMessages(
        selectedConversationId,
        current.filter((item) => item.id !== chatMessage.id),
      )
      setChatNotice('Đã xóa tin nhắn.')
    } catch (error) {
      console.error('Không thể xóa tin nhắn:', error)
      if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('Không thể xóa tin nhắn này.')
      }
    } finally {
      setBusyActionId(null)
    }
  }

  const handleTogglePinMessage = async (chatMessage: ChatMessage) => {
    if (!token) return
    const wasPinned = pinnedMessageIds.has(chatMessage.id)
    setBusyActionId(chatMessage.id)
    try {
      if (wasPinned) {
        await api.unpinMessage(token, chatMessage.id)
      } else {
        await api.pinMessage(token, chatMessage.id)
      }
      const refreshed = await api.listConversations(token)
      setConversations(refreshed.conversations)
      setChatNotice(wasPinned ? 'Đã bỏ ghim tin nhắn.' : 'Đã ghim tin nhắn.')
    } catch (error) {
      console.error('Không thể ghim/bỏ ghim tin nhắn:', error)
      if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('Không thể ghim/bỏ ghim tin nhắn.')
      }
    } finally {
      setBusyActionId(null)
    }
  }

  const handleClearChatForMe = async () => {
    if (!token || !selectedConversationId) return
    const confirmed = window.confirm('Xóa toàn bộ đoạn chat ở phía bạn? Hành động này không ảnh hưởng người khác.')
    if (!confirmed) return
    setBusyActionId(`clear-${selectedConversationId}`)
    try {
      await api.clearConversationMessages(token, selectedConversationId)
      const refreshed = await api.listMessages(token, selectedConversationId, { limit: 25 })
      setMessages(selectedConversationId, refreshed.messages)
      setChatNotice('Đã xóa đoạn chat ở phía bạn.')
    } catch (error) {
      console.error('Không thể xóa đoạn chat:', error)
      if (error instanceof Error) {
        setChatNotice(error.message)
      } else {
        setChatNotice('Không thể xóa đoạn chat.')
      }
    } finally {
      setBusyActionId(null)
    }
  }

  const openMessageActions = (event: React.MouseEvent<HTMLElement>, messageId: string) => {
    event.preventDefault()
    event.stopPropagation()
    const rect = event.currentTarget.getBoundingClientRect()
    const menuWidth = 180
    const x = Math.min(window.innerWidth - menuWidth - 12, Math.max(12, rect.right - menuWidth))
    const y = Math.max(12, Math.min(window.innerHeight - 240, rect.bottom + 8))
    setActionMenu({
      messageId,
      x,
      y,
    })
  }

  const handleStartCall = async (callType: 'voice' | 'video') => {
    const socket = getSocket()
    if (!socket || !selectedConversationId || callTargets.length === 0) return

    try {
      await ensureLocalStream(callType)
      for (const targetUserId of callTargets) {
        const pc = await buildPeerConnection(targetUserId, callType)
        if (!pc) continue
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)

        socket.emit('call:offer', {
          targetUserId,
          conversationId: selectedConversationId,
          callType,
          offer,
        })
      }
    } catch (error) {
      console.error('Không thể bắt đầu cuộc gọi:', error)
      return
    }

    setCallStatus(`Đang gọi ${callType === 'video' ? 'video' : 'thoại'} tới ${selectedConversation ? getConversationDisplayName(selectedConversation, user?.id) : 'người nhận'}`)
    setCallAnswered(false)
    setRingingStartedAt(Date.now())
    setActiveCall({
      type: callType,
      withName: selectedConversation
        ? getConversationDisplayName(selectedConversation, user?.id)
        : `Người dùng #${callTargetId}`,
      startedAt: Date.now(),
    })
  }

  const handleAcceptIncomingCall = async () => {
    const socket = getSocket()
    if (!socket || !incomingCall || !selectedConversationId) return

    try {
      const pc = (await buildPeerConnection(incomingCall.fromUserId, incomingCall.callType)) || undefined
      if (!pc) return
      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer))
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)

      socket.emit('call:answer', {
        targetUserId: incomingCall.fromUserId,
        conversationId: selectedConversationId,
        answer,
      })
    } catch (error) {
      console.error('Không thể chấp nhận cuộc gọi:', error)
      return
    }

    setCallStatus('Đã chấp nhận cuộc gọi')
    setCallAnswered(true)
    setRingingStartedAt(null)
    setActiveCall({
      type: incomingCall.callType,
      withName: selectedConversation
        ? getConversationDisplayName(selectedConversation, user?.id)
        : `Người dùng #${incomingCall.fromUserId}`,
      startedAt: Date.now(),
    })
    setIncomingCall(null)
  }

  const handleEndCall = () => {
    const socket = getSocket()
    if (!socket || !selectedConversationId) return
    callTargets.forEach((targetUserId) => {
      socket.emit('call:end', {
        targetUserId,
        conversationId: selectedConversationId,
      })
    })
    closeCallResources()
    setCallStatus('Bạn đã kết thúc cuộc gọi')
    setIncomingCall(null)
    setActiveCall(null)
    setCallSeconds(0)
    setCallAnswered(false)
    setRingingStartedAt(null)
  }

  useEffect(() => {
    return () => {
      closeCallResources()
    }
  }, [])

  useEffect(() => {
    const closeMenu = () => setActionMenu(null)
    window.addEventListener('click', closeMenu)
    return () => window.removeEventListener('click', closeMenu)
  }, [])

  const selectedName = selectedConversation
    ? getConversationDisplayName(selectedConversation, user?.id)
    : 'Chọn cuộc trò chuyện'
  const initials = (user?.fullName?.[0] || 'U').toUpperCase()
  const formattedCallTime = `${String(Math.floor(callSeconds / 60)).padStart(2, '0')}:${String(callSeconds % 60).padStart(2, '0')}`

  const renderMessagePreview = (msg: ChatMessage) => {
    const recalled = Boolean(msg.meta && (msg.meta as Record<string, unknown>).recalled)
    const forwarded = Boolean(msg.meta && (msg.meta as Record<string, unknown>).forwarded)

    if (recalled) {
      return <p className={styles.recalledText}>Tin nhắn đã được thu hồi</p>
    }

    if (msg.type === 'image' && msg.mediaUrl) {
      return (
        <div className={styles.mediaWrap}>
          {forwarded ? <small className={styles.forwardTag}>Đã chuyển tiếp</small> : null}
          <img
            src={msg.mediaUrl}
            alt={msg.fileName || 'image'}
            loading="lazy"
            onError={(event) => {
              event.currentTarget.style.display = 'none'
            }}
          />
        </div>
      )
    }

    if (msg.type === 'video' && msg.mediaUrl) {
      return (
        <div className={styles.mediaWrap}>
          {forwarded ? <small className={styles.forwardTag}>Đã chuyển tiếp</small> : null}
          <video controls src={msg.mediaUrl} />
        </div>
      )
    }

    if (msg.type === 'audio' && msg.mediaUrl) {
      return (
        <div className={styles.mediaWrap}>
          {forwarded ? <small className={styles.forwardTag}>Đã chuyển tiếp</small> : null}
          <audio controls src={msg.mediaUrl} />
        </div>
      )
    }

    if (msg.type === 'sticker') {
      const sticker = (msg.meta?.sticker as string) || msg.text || '😀'
      return <p className={styles.stickerBubble}>{sticker}</p>
    }

    if (msg.mediaUrl) {
      return (
        <div className={styles.mediaWrap}>
          {forwarded ? <small className={styles.forwardTag}>Đã chuyển tiếp</small> : null}
          <a href={msg.mediaUrl} target="_blank" rel="noreferrer" className={styles.fileLink}>
            {msg.fileName || 'Mở tệp đính kèm'}
          </a>
          {(msg.mimeType || msg.fileSize) ? (
            <small className={styles.fileMeta}>
              {[msg.mimeType, msg.fileSize ? `${Math.max(1, Math.round(msg.fileSize / 1024))} KB` : null]
                .filter(Boolean)
                .join(' • ')}
            </small>
          ) : null}
        </div>
      )
    }

    return (
      <p className={styles.messageText}>
        {forwarded ? <small className={styles.forwardTagInline}>[Đã chuyển tiếp] </small> : null}
        {msg.text || ''}
      </p>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.layout}>
        <aside className={styles.rail}>
          <div className={styles.railLogo}>M</div>
          <nav className={styles.railNav}>
            <button type="button" className={`${styles.railBtn} ${styles.railBtnActive}`} title="Tin nhắn" aria-label="Tin nhắn">
              <Send size={16} />
            </button>
            <button type="button" className={styles.railBtn} onClick={() => setShowNewMessageModal(true)} title="Tạo hội thoại mới" aria-label="Tạo hội thoại mới">
              <UserPlus size={16} />
            </button>
            <button
              type="button"
              className={styles.railBtn}
              onClick={() => {
                setShowCreateGroupModal(true)
                setGroupName('')
                setGroupSearchKeyword('')
                setGroupMemberIds([])
              }}
              title="Tạo nhóm"
              aria-label="Tạo nhóm"
            >
              <CirclePlus size={16} />
            </button>
            <button type="button" className={styles.railBtn} onClick={() => setShowNotificationsDrawer(true)} title="Thông báo" aria-label="Thông báo">
              <Bell size={16} />
            </button>
            <button type="button" className={`${styles.railBtn} ${styles.railBottomBtn}`} title="Thông tin" aria-label="Thông tin">
              <Info size={16} />
            </button>
          </nav>
          <div className={styles.railAvatar}>{initials}</div>
        </aside>

        <section className={styles.listPanel}>
          <div className={styles.listHeader}>
            <div className={styles.listHeaderTop}>
              <h1>Tất cả cuộc trò chuyện</h1>
              <button
                type="button"
                className={styles.headerNotifyBtn}
                onClick={() => setShowNotificationsDrawer(true)}
                title="Thông báo"
                aria-label="Thông báo"
              >
                <Bell size={14} />
                {notifications.some((item) => !item.is_read) ? <i /> : null}
              </button>
            </div>
            <div className={styles.searchWrap}>
              <Search size={14} />
              <input
                placeholder="Search conversations"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
          </div>

          <div className={styles.convList}>
            {filteredConversations.map((conv) => {
              const isActive = conv.id === selectedConversationId
              const name = getConversationDisplayName(conv, user?.id)
              const fallback = (name[0] || 'C').toUpperCase()
              return (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => selectConversation(conv.id)}
                  className={`${styles.convItem} ${isActive ? styles.convItemActive : ''}`}
                >
                  <div className={styles.convAvatar}>{fallback}</div>
                  <div className={styles.convText}>
                    <div className={styles.convLineTop}>
                      <strong>{name}</strong>
                      <span>Chat</span>
                    </div>
                    <p>{conv.unreadCount > 0 ? `${conv.unreadCount} tin nhắn chưa đọc` : 'Nhấn để mở hội thoại'}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        <section className={styles.chatPanel}>
          <header className={styles.chatHeader}>
            <div className={styles.chatIdentity}>
              <div className={styles.convAvatar}>{(selectedName[0] || 'C').toUpperCase()}</div>
              <div>
                <h2>
                  {directPeer ? <Link to={`/profile/${directPeer.id}`}>{selectedName}</Link> : selectedName}
                </h2>
                <p>
                  {directPeer
                    ? isDirectPeerFriend
                      ? 'Bạn bè • Online'
                      : 'Chưa kết bạn • Giới hạn 3 tin nhắn'
                    : 'Online'}
                </p>
              </div>
            </div>
            <div className={styles.chatActions}>
              <button type="button" onClick={() => handleStartCall('video')} disabled={!callTargetId} title="Gọi video" aria-label="Gọi video">
                <Video size={16} />
              </button>
              <button type="button" onClick={() => handleStartCall('voice')} disabled={!callTargetId} title="Gọi thoại" aria-label="Gọi thoại">
                <Phone size={16} />
              </button>
              <button
                type="button"
                title="Thêm người vào cuộc trò chuyện"
                aria-label="Thêm người vào cuộc trò chuyện"
                disabled={!selectedGroup || !canAddMembers}
                onClick={() => setShowManageGroupModal(true)}
              >
                <UserPlus size={16} />
              </button>
              <button
                type="button"
                title="Xem chi tiết cuộc trò chuyện"
                aria-label="Xem chi tiết cuộc trò chuyện"
                disabled={!selectedGroup}
                onClick={() => setShowGroupInfoModal(true)}
              >
                <Info size={16} />
              </button>
            </div>
          </header>

          {selectedConversationId && messageLimitByConversation[selectedConversationId] ? (
            <div className={styles.limitBadge}>
              Còn {messageLimitByConversation[selectedConversationId]?.remaining ?? 0}/{messageLimitByConversation[selectedConversationId]?.total ?? 3} tin nhắn miễn phí trước khi cần kết bạn.
            </div>
          ) : null}

          {selectedConversation?.pinnedMessageIds && selectedConversation.pinnedMessageIds.length > 0 ? (
            <div className={styles.limitBadge}>
              Đang ghim {selectedConversation.pinnedMessageIds.length} tin nhắn trong cuộc trò chuyện này.
            </div>
          ) : null}

          {directPeer ? (
            <div className={styles.chatSocialBar}>
              <button
                type="button"
                className={styles.socialActionBtn}
                onClick={() => handleOpenOrCreateDirectConversation(directPeer.id)}
                disabled={creatingDirectConversation}
              >
                {creatingDirectConversation ? 'Đang mở hội thoại...' : 'Nhắn tin'}
              </button>
              {!isDirectPeerFriend && !isDirectPeerPending ? (
                <button
                  type="button"
                  className={styles.socialActionBtnPrimary}
                  onClick={handleRequestFriend}
                  disabled={Boolean(pendingFriendRequestTo[directPeer.id])}
                >
                  {pendingFriendRequestTo[directPeer.id] ? 'Đang gửi lời mời...' : 'Kết bạn để nhắn không giới hạn'}
                </button>
              ) : null}
              {!isDirectPeerFriend && isDirectPeerPending && isDirectPeerRequestedByMe ? (
                <button
                  type="button"
                  className={styles.socialActionBtn}
                  onClick={handleCancelFriendRequest}
                  disabled={Boolean(pendingFriendRequestTo[directPeer.id])}
                >
                  {pendingFriendRequestTo[directPeer.id] ? 'Đang hủy...' : 'Hủy lời mời kết bạn'}
                </button>
              ) : null}
              {!isDirectPeerFriend && isDirectPeerPending && !isDirectPeerRequestedByMe ? (
                <button
                  type="button"
                  className={styles.socialActionBtnPrimary}
                  onClick={handleAcceptFriendRequestDirect}
                  disabled={Boolean(pendingFriendRequestTo[directPeer.id])}
                >
                  {pendingFriendRequestTo[directPeer.id] ? 'Đang xử lý...' : 'Đồng ý lời mời kết bạn'}
                </button>
              ) : null}
            </div>
          ) : null}

          {chatNotice ? <p className={styles.chatNotice}>{chatNotice}</p> : null}

          {(callStatus || incomingCall) && (
            <div className={styles.callBanner}>
              {callStatus ? <p>{callStatus}</p> : null}
              {incomingCall ? (
                <div className={styles.callBannerActions}>
                  <button type="button" onClick={handleAcceptIncomingCall} title="Chấp nhận cuộc gọi" aria-label="Chấp nhận cuộc gọi">
                    Chấp nhận
                  </button>
                  <button type="button" onClick={() => setIncomingCall(null)} title="Từ chối cuộc gọi" aria-label="Từ chối cuộc gọi">
                    Từ chối
                  </button>
                </div>
              ) : null}
              <button type="button" className={styles.endCallBtn} onClick={handleEndCall} disabled={!callTargetId} title="Kết thúc cuộc gọi" aria-label="Kết thúc cuộc gọi">
                <PhoneOff size={14} />
                Kết thúc
              </button>
            </div>
          )}

          <div className={styles.timeline}>TODAY</div>

          <div
            className={styles.messagesWrap}
            ref={messagesWrapRef}
            onScroll={(event) => {
              const element = event.currentTarget
              if (element.scrollTop <= 24) {
                loadOlderMessages().catch(() => undefined)
              }
              const fromBottom = element.scrollHeight - (element.scrollTop + element.clientHeight)
              setShowJumpToLatest(fromBottom > 260)
            }}
          >
            {loadingOlderMessages ? <p className={styles.historyLoading}>Đang tải tin nhắn cũ hơn...</p> : null}
            {virtualSlice.startIndex > 0 ? (
              <p className={styles.virtualHint}>Đang hiển thị {VIRTUAL_CHUNK} tin nhắn mới nhất. Cuộn lên để tải thêm lịch sử.</p>
            ) : null}
            {virtualSlice.items.map((msg) => {
              const mine = msg.senderId === user?.id
              const senderName = String(msg.senderName || msg.sender?.fullName || msg.sender?.name || 'Người dùng')
              return (
                <div key={msg.id} className={`${styles.messageRow} ${mine ? styles.messageRowMine : ''}`}>
                  {!mine ? <div className={styles.messageAvatar}>{(senderName[0] || 'U').toUpperCase()}</div> : null}
                  <div className={styles.messageBlock}>
                    {!mine ? (
                      <Link to={`/profile/${msg.senderId}`} className={styles.senderLink}>
                        {senderName}
                      </Link>
                    ) : null}
                    <div
                      className={`${styles.bubble} ${mine ? styles.bubbleMine : ''}`}
                      onContextMenu={(event) => {
                        event.preventDefault()
                        setActionMenu({ messageId: msg.id, x: event.clientX, y: event.clientY })
                      }}
                      onTouchStart={(event) => {
                        const touch = event.touches[0]
                        longPressTimer.current = window.setTimeout(() => {
                          setActionMenu({ messageId: msg.id, x: touch.clientX, y: touch.clientY })
                        }, 420)
                      }}
                      onTouchEnd={() => {
                        if (longPressTimer.current) {
                          window.clearTimeout(longPressTimer.current)
                          longPressTimer.current = null
                        }
                      }}
                    >
                      <button
                        type="button"
                        className={styles.messageActionTrigger}
                        title="Mở menu thao tác"
                        aria-label="Mở menu thao tác"
                        onClick={(event) => openMessageActions(event, msg.id)}
                      >
                        <MoreHorizontal size={14} />
                      </button>
                      {renderMessagePreview(msg)}
                      {pinnedMessageIds.has(msg.id) ? <small className={styles.forwardTag}>Đã ghim</small> : null}
                      {msg.reactionCount > 0 ? (
                        <div className={styles.reactionSummary}>{reactionSummaryText(msg)}</div>
                      ) : null}
                    </div>
                    <span className={styles.messageTime}>
                      {formatVietnamTime(msg.createdAt)}
                    </span>
                  </div>
                </div>
              )
            })}

            {messages.length === 0 ? <p className={styles.empty}>Chưa có tin nhắn trong cuộc trò chuyện này.</p> : null}
          </div>

          <footer className={styles.inputBar}>
            <input ref={fileInputRef} type="file" className={styles.hiddenFileInput} onChange={handleFileSelected} aria-label="Đính kèm tệp" title="Đính kèm tệp" />
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className={styles.hiddenFileInput}
              onChange={handleFileSelected}
              aria-label="Gửi hình ảnh"
              title="Gửi hình ảnh"
            />
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              className={styles.hiddenFileInput}
              onChange={handleFileSelected}
              aria-label="Gửi video"
              title="Gửi video"
            />
            <button type="button" className={styles.inputIcon} onClick={handlePickAttachment} disabled={busyUploading} title="Chọn tệp đính kèm" aria-label="Chọn tệp đính kèm">
              <CirclePlus size={18} />
            </button>
            {composerMenuOpen ? (
              <div className={styles.composerPlusMenu}>
                <button type="button" onClick={() => handlePickAttachmentType('image')} title="Gửi ảnh" aria-label="Gửi ảnh">
                  <span>🖼️</span>
                  <span>Gửi ảnh</span>
                </button>
                <button type="button" onClick={() => handlePickAttachmentType('video')} title="Gửi video" aria-label="Gửi video">
                  <span>🎬</span>
                  <span>Gửi video</span>
                </button>
                <button type="button" onClick={() => handlePickAttachmentType('file')} title="Gửi tệp" aria-label="Gửi tệp">
                  <span>📎</span>
                  <span>Gửi tệp</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEmojiPanel(true)
                    setShowStickerPanel(false)
                    setComposerMenuOpen(false)
                  }}
                  title="Chèn emoji"
                  aria-label="Chèn emoji"
                >
                  <span>😊</span>
                  <span>Chèn emoji</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowStickerPanel((prev) => !prev)
                    setShowEmojiPanel(false)
                    setComposerMenuOpen(false)
                  }}
                >
                  <Sticker size={16} />
                  <span>Gửi sticker</span>
                </button>
              </div>
            ) : null}
            <textarea
              placeholder="Type a message..."
              value={message}
              rows={1}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  handleSend()
                }
              }}
            />
            <button type="button" className={styles.inputIcon} onClick={() => fileInputRef.current?.click()} disabled={busyUploading} title="Chọn tệp" aria-label="Chọn tệp">
              <Paperclip size={16} />
            </button>
            <button
              type="button"
              className={styles.inputIcon}
              onClick={() => {
                setShowEmojiPanel((prev) => !prev)
                setShowStickerPanel(false)
                setComposerMenuOpen(false)
              }}
              disabled={busyUploading}
              title="Mở bảng emoji"
              aria-label="Mở bảng emoji"
            >
              <Smile size={16} />
            </button>
            <button
              type="button"
              className={styles.sendBtn}
              onClick={handleSend}
              disabled={!message.trim() || isSendingMessage}
              title="Gửi tin nhắn"
              aria-label="Gửi tin nhắn"
            >
              <Send size={17} />
            </button>

            {showEmojiPanel ? (
              <div className={styles.emojiPanel}>
                {EMOJI_SET.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setMessage((prev) => `${prev}${emoji}`)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            ) : null}

            {showStickerPanel ? (
              <div className={styles.stickerPanel}>
                <div className={styles.stickerTabs}>
                  {(Object.keys(STICKER_PACKS) as Array<keyof typeof STICKER_PACKS>).map((packName) => (
                    <button
                      key={packName}
                      type="button"
                      className={packName === activeStickerPack ? styles.stickerTabActive : ''}
                      onClick={() => {
                        setActiveStickerPack(packName)
                        if (!loadedStickerPacks[packName]) {
                          setTimeout(() => {
                            setLoadedStickerPacks((prev) => ({ ...prev, [packName]: true }))
                          }, 220)
                        }
                      }}
                    >
                      {packName}
                    </button>
                  ))}
                </div>
                {loadedStickerPacks[activeStickerPack] ? STICKER_PACKS[activeStickerPack].map((sticker) => (
                  <button
                    key={sticker}
                    type="button"
                    title="Gửi sticker"
                    aria-label="Gửi sticker"
                    onClick={async () => {
                      if (!token || !selectedConversationId) return
                      try {
                        const response = await api.sendMessagePayload(token, selectedConversationId, {
                          type: 'sticker',
                          text: sticker,
                          sticker,
                        })
                        upsertMessage(selectedConversationId, response.message)
                        setShowStickerPanel(false)
                        setMessageLimitByConversation((prev) => {
                          const current = prev[selectedConversationId]
                          if (!current) return prev
                          return {
                            ...prev,
                            [selectedConversationId]: {
                              ...current,
                              sent: current.sent + 1,
                              remaining: Math.max(0, current.remaining - 1),
                            },
                          }
                        })
                      } catch (error) {
                        if (error instanceof ApiError && error.code === 'MESSAGE_LIMIT_NON_FRIEND') {
                          setChatNotice('Bạn chỉ gửi được tối đa 3 tin nhắn khi chưa kết bạn. Hãy kết bạn để tiếp tục.')
                        } else if (error instanceof Error) {
                          setChatNotice(error.message)
                        }
                      }
                    }}
                  >
                    {sticker}
                  </button>
                )) : <p className={styles.stickerLoading}>Đang tải pack {activeStickerPack}...</p>}
              </div>
            ) : null}
          </footer>

          {showJumpToLatest ? (
            <button
              type="button"
              className={styles.jumpToLatestBtn}
              onClick={() => {
                if (!messagesWrapRef.current) return
                messagesWrapRef.current.scrollTop = messagesWrapRef.current.scrollHeight
                setShowJumpToLatest(false)
              }}
            >
              Về tin nhắn mới nhất
            </button>
          ) : null}

          {showNewMessageModal ? (
            <div className={styles.overlayBackdrop}>
              <div className={styles.overlayCard}>
                <h3>Tin nhắn mới</h3>
                <input
                  value={newMessageKeyword}
                  onChange={(event) => setNewMessageKeyword(event.target.value)}
                  placeholder="Nhập tên bạn bè hoặc email đăng ký"
                />
                <div className={styles.overlayList}>
                  {searchUsersResult.map((item) => (
                    <button key={item.id} type="button" onClick={() => handleCreateConversationWithUser(item.id)} title={`Tạo hội thoại với ${item.name}`} aria-label={`Tạo hội thoại với ${item.name}`}>
                      {item.name}
                    </button>
                  ))}
                  {searchUsersResult.length === 0 ? <p>Không có kết quả phù hợp.</p> : null}
                </div>
                <button type="button" className={styles.overlayCloseBtn} onClick={() => setShowNewMessageModal(false)} title="Đóng" aria-label="Đóng">
                  Đóng
                </button>
              </div>
            </div>
          ) : null}

          {showNotificationsDrawer ? (
            <div className={styles.overlayBackdrop}>
              <div className={styles.overlayCard}>
                <h3>Thông báo nâng cao</h3>
                <div className={styles.overlayList}>
                  {notifications.map((item) => {
                    const meta = parseNotificationMeta(item)
                    const conversationId = meta?.conversationId
                    const canAccept = item.type === 'friend-request' && !item.is_read && Boolean(meta?.requesterId || meta?.friendshipId)
                    return (
                      <div key={item.id} className={styles.notifyCard}>
                        <button
                          type="button"
                          className={styles.notifyMainBtn}
                          onClick={() => handleOpenNotificationConversation(conversationId)}
                        >
                          <strong>{item.title}</strong>
                          <span>{item.body || 'Thông báo hệ thống'}</span>
                          <small>{new Date(item.created_at).toLocaleString('vi-VN')}</small>
                        </button>
                        <div className={styles.notifyActions}>
                          {conversationId ? (
                            <button
                              type="button"
                              onClick={() => handleOpenNotificationConversation(conversationId)}
                            >
                              Mở đoạn chat
                            </button>
                          ) : null}
                          {canAccept ? (
                            <button
                              type="button"
                              className={styles.notifyAcceptBtn}
                              disabled={busyActionId === `notif-${item.id}`}
                              onClick={() => {
                                void handleAcceptFromNotification(item)
                              }}
                            >
                              {busyActionId === `notif-${item.id}` ? 'Đang đồng ý...' : 'Đồng ý'}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    )
                  })}
                  {notifications.length === 0 ? <p>Hiện chưa có thông báo quan trọng.</p> : null}
                </div>
                <button type="button" className={styles.overlayCloseBtn} onClick={() => setShowNotificationsDrawer(false)} title="Đóng" aria-label="Đóng">
                  Đóng
                </button>
              </div>
            </div>
          ) : null}

          {forwardingMessageId ? (
            <div className={styles.forwardDialogBackdrop}>
              <div className={styles.forwardDialog}>
                <h3>Chuyển tiếp tin nhắn</h3>
                <p>Chọn cuộc trò chuyện để chuyển tiếp:</p>
                <div className={styles.forwardList}>
                  {conversations
                    .filter((conv) => conv.id !== selectedConversationId)
                    .map((conv) => (
                      <button key={conv.id} type="button" onClick={() => handleForward(conv.id)} title={`Chuyển tiếp đến ${getConversationDisplayName(conv, user?.id)}`} aria-label={`Chuyển tiếp đến ${getConversationDisplayName(conv, user?.id)}`}>
                        {getConversationDisplayName(conv, user?.id)}
                      </button>
                    ))}
                </div>
                <button type="button" className={styles.forwardCancel} onClick={() => setForwardingMessageId(null)} title="Hủy chuyển tiếp" aria-label="Hủy chuyển tiếp">
                  Hủy
                </button>
              </div>
            </div>
          ) : null}

          {showCreateGroupModal ? (
            <div className={styles.overlayBackdrop}>
              <div className={styles.overlayCard}>
                <h3>Tạo nhóm chat</h3>
                <input
                  value={groupName}
                  onChange={(event) => setGroupName(event.target.value)}
                  placeholder="Nhập tên nhóm"
                />
                <input
                  value={groupSearchKeyword}
                  onChange={(event) => setGroupSearchKeyword(event.target.value)}
                  placeholder="Tìm bạn bè để thêm vào nhóm"
                />
                <div className={styles.overlayList}>
                  {filteredGroupInviteCandidates.map((friend) => {
                    const checked = groupMemberIds.includes(friend.id)
                    return (
                      <button key={friend.id} type="button" onClick={() => toggleGroupMember(friend.id)} title={`Chọn ${friend.fullName}`} aria-label={`Chọn ${friend.fullName}`}>
                        <strong>{checked ? '✓ ' : ''}{friend.fullName}</strong>
                        <span>{friend.email || friend.phone || `ID ${friend.id}`}</span>
                      </button>
                    )
                  })}
                  {acceptedFriends.length === 0 ? <p>Bạn chưa có bạn bè để tạo nhóm.</p> : null}
                  {acceptedFriends.length > 0 && filteredGroupInviteCandidates.length === 0 ? <p>Không tìm thấy bạn bè phù hợp.</p> : null}
                </div>
                <button
                  type="button"
                  className={styles.overlayCloseBtn}
                  disabled={!groupName.trim() || groupMemberIds.length === 0 || creatingGroup}
                  onClick={handleCreateGroupConversation}
                >
                  {creatingGroup ? 'Đang tạo nhóm...' : 'Tạo nhóm'}
                </button>
                <button type="button" className={styles.overlayCloseBtn} onClick={() => setShowCreateGroupModal(false)} title="Đóng" aria-label="Đóng">
                  Đóng
                </button>
              </div>
            </div>
          ) : null}

          {showManageGroupModal && selectedGroup ? (
            <div className={styles.overlayBackdrop}>
              <div className={styles.overlayCard}>
                <h3>Quản lý nhóm: {selectedGroup.name || 'Nhóm chat'}</h3>
                <p className={styles.groupManageHint}>
                  {canManageRoles
                    ? 'Bạn có thể chuyển quyền trưởng nhóm, cấp quyền phó nhóm, quản lý thành viên và giải tán nhóm.'
                    : canRemoveMembers
                      ? 'Bạn là phó nhóm: có thể thêm/xóa thành viên (không được giải tán nhóm và chuyển quyền trưởng nhóm).'
                      : 'Bạn chỉ có thể xem thành viên vì không có quyền quản lý nhóm.'}
                </p>

                <div className={styles.groupManageSection}>
                  <strong>Thành viên hiện tại ({selectedGroup.members.length})</strong>
                  <div className={styles.groupMemberList}>
                    {selectedGroup.members.map((member) => {
                      const isSelf = Number(member.userId) === Number(user?.id)
                      const role = member.role === 'leader' ? 'Trưởng nhóm' : member.role === 'deputy' ? 'Phó nhóm' : 'Thành viên'
                      const isLeader = member.role === 'leader'
                      const isDeputy = member.role === 'deputy'
                      return (
                        <div key={member.userId} className={styles.groupMemberRow}>
                          <div className={styles.groupMemberInfo}>
                            <b>{member.fullName}{isSelf ? ' (Bạn)' : ''}</b>
                            <small>{role} · ID {member.userId}</small>
                          </div>
                          {(canManageRoles || canRemoveMembers) && !isSelf ? (
                            <div className={styles.groupMemberActions}>
                              {canManageRoles ? (
                                <>
                                  {!isLeader ? (
                                    <button
                                      type="button"
                                      disabled={groupActionBusyId === `role-${member.userId}`}
                                      onClick={() => {
                                        void handleTransferLeader(member.userId)
                                      }}
                                    >
                                      {groupActionBusyId === `role-${member.userId}` ? 'Đang chuyển...' : 'Chuyển quyền trưởng nhóm'}
                                    </button>
                                  ) : null}
                                  {!isLeader ? (
                                    <button
                                      type="button"
                                      disabled={groupActionBusyId === `deputy-${isDeputy ? 'none' : member.userId}`}
                                      onClick={() => {
                                        void handleSetDeputyRole(isDeputy ? null : member.userId)
                                      }}
                                    >
                                      {groupActionBusyId === `deputy-${isDeputy ? 'none' : member.userId}`
                                        ? 'Đang cập nhật...'
                                        : isDeputy
                                          ? 'Gỡ phó nhóm'
                                          : 'Cấp phó nhóm'}
                                    </button>
                                  ) : null}
                                </>
                              ) : null}
                              <button
                                type="button"
                                className={styles.dangerBtn}
                                disabled={groupActionBusyId === `remove-${member.userId}`}
                                onClick={() => {
                                  void handleRemoveMemberFromGroup(member.userId)
                                }}
                              >
                                {groupActionBusyId === `remove-${member.userId}` ? 'Đang xóa...' : 'Xóa'}
                              </button>
                            </div>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {canAddMembers ? (
                  <div className={styles.groupManageSection}>
                    <strong>Thêm thành viên mới</strong>
                    <div className={styles.groupMemberList}>
                      {groupInviteCandidates.map((friend) => (
                        <div key={friend.id} className={styles.groupMemberRow}>
                          <div className={styles.groupMemberInfo}>
                            <b>{friend.fullName}</b>
                            <small>{friend.email || friend.phone || `ID ${friend.id}`}</small>
                          </div>
                          <div className={styles.groupMemberActions}>
                            <button
                              type="button"
                              disabled={groupActionBusyId === `add-${friend.id}`}
                              onClick={() => {
                                void handleAddMemberToGroup(friend.id)
                              }}
                            >
                              {groupActionBusyId === `add-${friend.id}` ? 'Đang thêm...' : 'Thêm'}
                            </button>
                          </div>
                        </div>
                      ))}
                      {groupInviteCandidates.length === 0 ? <p>Không còn bạn bè nào để thêm vào nhóm.</p> : null}
                    </div>
                  </div>
                ) : null}

                {canDissolveSelectedGroup ? (
                  <button
                    type="button"
                    className={styles.dangerBtn}
                    disabled={groupActionBusyId === 'dissolve-group'}
                    onClick={() => {
                      void handleDissolveGroup()
                    }}
                  >
                    {groupActionBusyId === 'dissolve-group' ? 'Đang giải tán nhóm...' : 'Giải tán nhóm'}
                  </button>
                ) : null}

                <button
                  type="button"
                  className={styles.overlayCloseBtn}
                  onClick={() => setShowManageGroupModal(false)}
                  title="Đóng"
                  aria-label="Đóng"
                >
                  Đóng
                </button>
              </div>
            </div>
          ) : null}

          {showGroupInfoModal && selectedGroup ? (
            <div className={styles.overlayBackdrop}>
              <div className={styles.overlayCard}>
                <h3>Thông tin nhóm: {selectedGroup.name || 'Nhóm chat'}</h3>
                <div className={styles.groupManageSection}>
                  <strong>Trưởng nhóm</strong>
                  <div className={styles.groupMemberRow}>
                    <div className={styles.groupMemberInfo}>
                      <b>{groupLeader?.fullName || 'Chưa xác định'}</b>
                      <small>ID {groupLeader?.userId ?? selectedGroup.createdBy}</small>
                    </div>
                  </div>
                </div>
                <div className={styles.groupManageSection}>
                  <strong>Phó nhóm</strong>
                  <div className={styles.groupMemberRow}>
                    <div className={styles.groupMemberInfo}>
                      <b>{groupDeputy?.fullName || 'Chưa có phó nhóm'}</b>
                      <small>{groupDeputy ? `ID ${groupDeputy.userId}` : 'Nhóm hiện chưa có phó nhóm'}</small>
                    </div>
                  </div>
                </div>
                <div className={styles.groupManageSection}>
                  <strong>Thành viên ({selectedGroup.members.length})</strong>
                  <div className={styles.groupMemberList}>
                    {selectedGroup.members.map((member) => (
                      <div key={member.userId} className={styles.groupMemberRow}>
                        <div className={styles.groupMemberInfo}>
                          <b>{member.fullName}{Number(member.userId) === Number(selectedGroup.createdBy) ? ' (Người tạo nhóm)' : ''}</b>
                          <small>
                            {member.role === 'leader' ? 'Trưởng nhóm' : member.role === 'deputy' ? 'Phó nhóm' : 'Thành viên'} · ID {member.userId}
                          </small>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className={styles.groupManageSection}>
                  <strong>Thao tác nhanh</strong>
                  <div className={styles.groupMemberActions}>
                    <button type="button" onClick={() => setShowManageGroupModal(true)}>
                      Thêm / xóa / gán quyền
                    </button>
                    <button type="button" onClick={() => void handleClearChatForMe()}>
                      Xóa đoạn chat
                    </button>
                    {selectedConversation?.pinnedMessageIds?.length ? (
                      <button type="button" onClick={() => setShowGroupInfoModal(false)}>
                        Xem tin đã ghim
                      </button>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.overlayCloseBtn}
                  onClick={() => {
                    void handleClearChatForMe()
                  }}
                  title="Xóa đoạn chat ở phía bạn"
                  aria-label="Xóa đoạn chat ở phía bạn"
                >
                  Xóa đoạn chat của bạn
                </button>
                <button
                  type="button"
                  className={styles.overlayCloseBtn}
                  onClick={() => setShowGroupInfoModal(false)}
                  title="Đóng"
                  aria-label="Đóng"
                >
                  Đóng
                </button>
              </div>
            </div>
          ) : null}

          {activeCall ? (
            <div className={styles.callOverlay}>
              <div className={styles.callBackdropGlow} />
              <div className={styles.callTopBar}>
                <div>
                  <small>Call in progress</small>
                  <h3>{activeCall.withName}</h3>
                </div>
                <div className={styles.callBadge}>{formattedCallTime}</div>
              </div>
              <div className={styles.callMainVideo}>
                {remoteStreams.length > 0 ? (
                  <div className={styles.remoteGrid}>
                    {remoteStreams.map((item) => (
                      <video
                        key={item.userId}
                        autoPlay
                        playsInline
                        ref={(node) => {
                          if (!node) return
                          node.srcObject = item.stream
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className={styles.callAvatarBig}>{(activeCall.withName[0] || 'U').toUpperCase()}</div>
                )}
              </div>
              <div className={styles.callMiniVideo}>
                <video ref={localVideoRef} autoPlay muted playsInline className={styles.localVideo} />
                <span>Bạn</span>
              </div>
              <div className={styles.callControls}>
                <button
                  type="button"
                  onClick={() => {
                    const stream = localStreamRef.current
                    if (!stream) return
                    const next = !mutedMic
                    stream.getAudioTracks().forEach((track) => {
                      track.enabled = !next
                    })
                    setMutedMic(next)
                  }}
                  title="Bật tắt micro"
                  aria-label="Bật tắt micro"
                >
                  <Phone size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const stream = localStreamRef.current
                    if (!stream) return
                    const next = !mutedCam
                    stream.getVideoTracks().forEach((track) => {
                      track.enabled = !next
                    })
                    setMutedCam(next)
                  }}
                  title="Bật tắt camera"
                  aria-label="Bật tắt camera"
                >
                  <Video size={16} />
                </button>
                <button type="button" title="Mời người khác" aria-label="Mời người khác">
                  <UserPlus size={16} />
                </button>
                <button type="button" className={styles.endCallOverlayBtn} onClick={handleEndCall} title="Kết thúc cuộc gọi" aria-label="Kết thúc cuộc gọi">
                  <PhoneOff size={16} />
                </button>
              </div>
            </div>
          ) : null}

          {actionMenu ? (
            <div ref={actionMenuRef} className={styles.actionMenu}>
              {messages
                .filter((msg) => msg.id === actionMenu.messageId)
                .map((msg) => {
                  const mine = msg.senderId === user?.id
                  return (
                    <div key={msg.id}>
                      <button type="button" onClick={() => {
                        handleReaction(msg, 'like')
                        setActionMenu(null)
                      }} title="Thích" aria-label="Thích">
                        Thích
                      </button>
                      <button type="button" onClick={() => {
                        handleReaction(msg, 'love')
                        setActionMenu(null)
                      }} title="Yêu thích" aria-label="Yêu thích">
                        Yêu thích
                      </button>
                      <button type="button" onClick={() => {
                        handleReaction(msg, 'care')
                        setActionMenu(null)
                      }} title="Quan tâm" aria-label="Quan tâm">
                        Quan tâm
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setForwardingMessageId(msg.id)
                          setActionMenu(null)
                        }}
                      >
                        Chuyển tiếp
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void handleTogglePinMessage(msg)
                          setActionMenu(null)
                        }}
                      >
                        {pinnedMessageIds.has(msg.id) ? 'Bỏ ghim' : 'Ghim'}
                      </button>
                      {mine ? (
                        <button
                          type="button"
                          onClick={() => {
                            handleRecall(msg)
                            setActionMenu(null)
                          }}
                        >
                          Thu hồi
                        </button>
                      ) : null}
                      {mine ? (
                        <button
                          type="button"
                          onClick={() => {
                            handleDeleteMessage(msg)
                            setActionMenu(null)
                          }}
                        >
                          Xóa
                        </button>
                      ) : null}
                    </div>
                  )
                })}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  )
}
