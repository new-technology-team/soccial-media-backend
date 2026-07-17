'use client'

import { ChangeEvent, CSSProperties, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSearchParams } from 'react-router-dom'
import {
  BadgeCheck,
  BadgeQuestionMark,
  ArrowLeft,
  Bell,
  BicepsFlexed,
  CirclePlus,
  File,
  Flame,
  Handshake,
  Heart,
  Info,
  MoreHorizontal,
  PartyPopper,
  Phone,
  PhoneOff,
  Rocket,
  Search,
  Send,
  Smile,
  SmilePlus,
  Sparkles,
  Star,
  Sticker as StickerIcon,
  ThumbsUp,
  UserPlus,
  Video,
  Wand2,
  BrainCircuit,
  ChevronDown,
  Languages,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import styles from './page.module.css'
import { ApiError, api, resolveApiAssetUrl, type CallHistoryItem } from '@/api/client'
import {
  ActiveCallWindow,
  CallHistoryMessage,
  CallSettingsPanel,
  IncomingCallModal,
  type CallParticipant,
  type CallSettings,
  type CallState,
} from '@/components/call'
import {
  AppDialog,
  AutoDeleteMessageDialog,
  ConfirmDialog,
  InputDialog,
  NotificationMuteDialog,
  ReportDialog,
  UploadImageDialog,
  type MuteOptionValue,
} from '@/components/dialogs'
import { useAuthStore } from '@/contexts/auth-store'
import { useChatStore } from '@/contexts/chat-store'
import { useCallStore, type IncomingCallState, type ActiveCall } from '@/contexts/call-store'
import { cn } from '@/utils'
import { callSession, resetCallSession } from '@/services/call-session'
import { toast } from '@/hooks/use-toast'
import { connectSocket, getSocket } from '@/services/socket'
import { useConversationRouting } from '@/hooks/use-conversation-routing'
import { compressImageFile, fileToBase64, mapTypeFromFile } from '@/services/messages/file-utils'
import {
  loadChatConversations,
  loadChatMessages,
  loadChatNotifications,
  loadFriendMap,
  searchMessageUsers,
} from '@/services/messages/chat-data-service'
import {
  formatVietnamTime,
  getAvatarInitial,
  getConversationDisplayName,
} from '@/services/messages/formatters'
import { normalizeIncomingMessageForViewer } from '@/services/messages/message-normalizer'
import { parseNotificationMeta, type MessageNotificationItem } from '@/services/messages/notification-meta'
import type { ChatMessage, Conversation, FriendConnection } from '@/types'
import { MessageComposer } from './components/message-composer'
import { ConversationDetailsPanel } from './components/conversation-details-panel'
import { MessagesSidebar } from './components/messages-sidebar'
import { MessageThread } from './components/message-thread'
import { MessagesOverlays } from './components/messages-overlays'

// ActiveCall type is imported from call-store

type AttachmentDraft = {
  file: File
  type: 'image' | 'video' | 'audio' | 'file'
  previewUrl: string | null
}

type ConfirmModalState = {
  title: string
  description: string
  confirmLabel: string
  destructive?: boolean
  icon?: 'warning' | 'lock'
  onConfirm: () => void | Promise<void>
}

type ReactionPickerState = {
  messageId: string
  x: number
  y: number
  placement: 'above' | 'below'
}

type NicknameDialogState = {
  memberId: number
  name: string
  avatarUrl?: string | null
  currentValue: string
}

type ReportDialogState = {
  targetType: 'user' | 'message' | 'group'
  targetId: number | string
  title: string
}

type ConversationUiPrefs = {
  largeText: boolean
  roundBubbles: boolean
  themeColor?: string | null
  backgroundUrl?: string | null
}

const MESSAGE_REACTION_ICONS: Array<{ type: string; label: string; emoji: string }> = [
  { type: 'smile', label: 'Cười', emoji: '😄' },
  { type: 'sad', label: 'Buồn', emoji: '😔' },
  { type: 'like', label: 'Thích', emoji: '👍' },
  { type: 'love', label: 'Yêu thích', emoji: '❤️' },
  { type: 'wow', label: 'Bất ngờ', emoji: '😮' },
  { type: 'cry', label: 'Khóc', emoji: '😭' },
  { type: 'angry', label: 'Tức giận', emoji: '😡' },
]

const TURN_URLS = String(import.meta.env.VITE_TURN_URLS || import.meta.env.VITE_TURN_URL || '')
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean)

const RTC_CONFIG: RTCConfiguration = {
  iceCandidatePoolSize: 10,
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    ...(TURN_URLS.length
      ? [
        {
          urls: TURN_URLS,
          username: import.meta.env.VITE_TURN_USERNAME || undefined,
          credential: import.meta.env.VITE_TURN_CREDENTIAL || undefined,
        },
      ]
      : []),
  ],
}

const CALL_RING_TIMEOUT_MS = 60_000
const GROUP_CALL_RING_TIMEOUT_MS = 60_000
const GROUP_CALL_MAX_PARTICIPANTS = 6
const CALL_LOG_PREFIX = '[ZChat Call]'

const callLog = (event: string, details?: Record<string, unknown>) => {
  console.info(CALL_LOG_PREFIX, event, details || {})
}

// Jitsi dùng để liên thông với mobile (mobile gọi qua Jitsi, không phải WebRTC).
const JITSI_BASE_URL = String(import.meta.env.VITE_VIDEO_CALL_BASE_URL || 'https://meet.jit.si').replace(/\/+$/, '')

const sanitizeRoomName = (input: string): string =>
  String(input || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '') || `zchat-${Date.now()}`

// Fallback (cố định theo hội thoại) khi server không cấp phát được phòng — vẫn hội tụ về 1 phòng.
const buildJitsiRoomId = (conversationId: string): string =>
  sanitizeRoomName(`zchat-${conversationId}`)

// Lấy phòng Jitsi của phiên gọi từ server (tái dùng nếu cuộc gọi đang diễn ra). Có timeout fallback.
const acquireCallRoom = (socket: { emit: (ev: string, data: unknown, ack?: (resp: unknown) => void) => void }, conversationId: string): Promise<string> =>
  new Promise((resolve) => {
    let done = false
    const finish = (roomId: string) => {
      if (done) return
      done = true
      resolve(roomId || buildJitsiRoomId(conversationId))
    }
    const timer = window.setTimeout(() => finish(''), 4000)
    try {
      socket.emit('call:room:acquire', { conversationId }, (resp: unknown) => {
        window.clearTimeout(timer)
        finish(String((resp as { roomId?: string })?.roomId || ''))
      })
    } catch {
      window.clearTimeout(timer)
      finish('')
    }
  })

const resolveJitsiUrl = (roomId: string, displayName?: string): string => {
  const hash = [
    'config.prejoinConfig.enabled=false',
    'config.prejoinPageEnabled=false',
    displayName ? `userInfo.displayName=${encodeURIComponent(`"${displayName}"`)}` : '',
  ]
    .filter(Boolean)
    .join('&')
  return `${JITSI_BASE_URL}/${encodeURIComponent(roomId)}${hash ? `#${hash}` : ''}`
}

const DEFAULT_CALL_SETTINGS: CallSettings = {
  sound: true,
  vibration: true,
  floatingWindow: true,
  autoTimeout: true,
  allowVoice: true,
  allowVideo: true,
  allowGroup: true,
  ringGroup: true,
  missedNotifications: true,
  showSpeaker: true,
  autoMuteOnJoin: false,
  autoCameraOffOnJoin: false,
  blockStrangers: false,
}

const MESSAGE_ICON_TOKENS: Record<string, { label: string; Icon: LucideIcon }> = {
  ':smile:': { label: 'Cười', Icon: Smile },
  ':smile-plus:': { label: 'Vui vẻ', Icon: SmilePlus },
  ':like:': { label: 'Thích', Icon: ThumbsUp },
  ':love:': { label: 'Yêu thích', Icon: Heart },
  ':thanks:': { label: 'Cảm ơn', Icon: Handshake },
  ':sparkles:': { label: 'Lấp lánh', Icon: Sparkles },
  ':fire:': { label: 'Nổi bật', Icon: Flame },
  ':party:': { label: 'Ăn mừng', Icon: PartyPopper },
  ':strong:': { label: 'Mạnh mẽ', Icon: BicepsFlexed },
  ':rocket:': { label: 'Bứt phá', Icon: Rocket },
  ':star:': { label: 'Ngôi sao', Icon: Star },
  ':zap:': { label: 'Nhanh', Icon: Zap },
}

const STICKER_ICON_TOKENS: Record<string, { label: string; Icon: LucideIcon }> = {
  'icon:smile': { label: 'Cười', Icon: Smile },
  'icon:smile-plus': { label: 'Vui vẻ', Icon: SmilePlus },
  'icon:heart': { label: 'Yêu thích', Icon: Heart },
  'icon:sparkles': { label: 'Lấp lánh', Icon: Sparkles },
  'icon:flame': { label: 'Nổi bật', Icon: Flame },
  'icon:party': { label: 'Ăn mừng', Icon: PartyPopper },
  'icon:rocket': { label: 'Bứt phá', Icon: Rocket },
  'icon:star': { label: 'Ngôi sao', Icon: Star },
  'icon:like': { label: 'Thích', Icon: ThumbsUp },
  'icon:thanks': { label: 'Cảm ơn', Icon: Handshake },
  'icon:strong': { label: 'Mạnh mẽ', Icon: BicepsFlexed },
  'icon:zap': { label: 'Nhanh', Icon: Zap },
  'icon:badge-check': { label: 'Đã xong', Icon: BadgeCheck },
  'icon:question': { label: 'Cần hỏi', Icon: BadgeQuestionMark },
  'icon:sticker': { label: 'Sticker', Icon: StickerIcon },
  'icon:file': { label: 'Tệp', Icon: File },
}

const STICKER_EMOJI_TOKENS: Record<string, { label: string; emoji: string }> = {
  'emoji:🤩': { label: 'Mắt sao', emoji: '🤩' },
  'emoji:🥰': { label: 'Ấm áp', emoji: '🥰' },
  'emoji:😂': { label: 'Cười lớn', emoji: '😂' },
  'emoji:🥹': { label: 'Cảm động', emoji: '🥹' },
  'emoji:🔥': { label: 'Nổi bật', emoji: '🔥' },
  'emoji:🎉': { label: 'Ăn mừng', emoji: '🎉' },
  'emoji:🚀': { label: 'Bứt phá', emoji: '🚀' },
  'emoji:🌈': { label: 'Rực rỡ', emoji: '🌈' },
  'emoji:👏': { label: 'Vỗ tay', emoji: '👏' },
  'emoji:🙌': { label: 'Tuyệt vời', emoji: '🙌' },
  'emoji:💪': { label: 'Mạnh mẽ', emoji: '💪' },
  'emoji:🤝': { label: 'Cảm ơn', emoji: '🤝' },
  'emoji:✅': { label: 'Đã xong', emoji: '✅' },
  'emoji:❓': { label: 'Cần hỏi', emoji: '❓' },
  'emoji:💡': { label: 'Ý tưởng', emoji: '💡' },
  'emoji:📎': { label: 'Đính kèm', emoji: '📎' },
}

export default function MessagesPage() {
  const [searchParams] = useSearchParams()
  const token = useAuthStore((state) => state.accessToken)
  const user = useAuthStore((state) => state.user)
  const {
    conversations,
    selectedConversationId,
    messagesByConversation,
    setConversations,
    selectConversation,
    markConversationRead,
    setMessages,
    appendMessage,
    upsertMessage,
    updateUserAvatar,
  } = useChatStore()
  const [message, setMessage] = useState('')
  const [callStatus, setCallStatus] = useState<string | null>(null)
  const [jitsiCallUrl, setJitsiCallUrl] = useState<string | null>(null)
  const [activeGroupCallSessionIds, setActiveGroupCallSessionIds] = useState<Set<string>>(() => new Set())
  const [callState, setCallState] = useState<CallState>(() => useCallStore.getState().callState)
  const [incomingCall, setIncomingCall] = useState<IncomingCallState | null>(null)
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(() => useCallStore.getState().activeCall)
  const [joinedCallUserIds, setJoinedCallUserIds] = useState<number[]>([])
  const [remoteMediaState, setRemoteMediaState] = useState<Record<number, { micMuted?: boolean; cameraOff?: boolean }>>({})
  const [speakingUserIds, setSpeakingUserIds] = useState<number[]>([])
  const [incomingSecondsLeft, setIncomingSecondsLeft] = useState(0)
  const [callSeconds, setCallSeconds] = useState(() => useCallStore.getState().callSeconds)
  const [callMinimized, setCallMinimized] = useState(() => useCallStore.getState().callMinimized)
  const [callSettingsOpen, setCallSettingsOpen] = useState(false)
  const [cameraAvailable, setCameraAvailable] = useState(() => useCallStore.getState().cameraAvailable)
  const [localStreamState, setLocalStreamState] = useState<MediaStream | null>(() => useCallStore.getState().localStream)
  const [callSettings, setCallSettings] = useState<CallSettings>(() => {
    if (typeof window === 'undefined') return DEFAULT_CALL_SETTINGS
    try {
      const raw = window.localStorage.getItem('zchat:call-settings')
      return raw ? { ...DEFAULT_CALL_SETTINGS, ...JSON.parse(raw) } : DEFAULT_CALL_SETTINGS
    } catch {
      return DEFAULT_CALL_SETTINGS
    }
  })
  const [busyUploading, setBusyUploading] = useState(false)
  const [busyActionId, setBusyActionId] = useState<string | null>(null)
  const [forwardingMessageId, setForwardingMessageId] = useState<string | null>(null)
  const [remoteStreams, setRemoteStreams] = useState<Array<{ userId: number; stream: MediaStream }>>(() => useCallStore.getState().remoteStreams)
  const [actionMenu, setActionMenu] = useState<{ messageId: string; x: number; y: number } | null>(null)
  const [reactionPicker, setReactionPicker] = useState<ReactionPickerState | null>(null)
  const [composerMenuOpen, setComposerMenuOpen] = useState(false)
  const [chatNotice, setChatNotice] = useState<string | null>(null)
  const [showEmojiPanel, setShowEmojiPanel] = useState(false)
  const [showStickerPanel, setShowStickerPanel] = useState(false)
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false)
  const [showNewMessageModal, setShowNewMessageModal] = useState(false)
  const [showNotificationsDrawer, setShowNotificationsDrawer] = useState(false)
  const [showCallHistoryDrawer, setShowCallHistoryDrawer] = useState(false)
  const [callHistoryFilter, setCallHistoryFilter] = useState<'all' | 'missed' | 'incoming' | 'outgoing' | 'group'>('all')
  const [callHistory, setCallHistory] = useState<CallHistoryItem[]>([])
  const [mediaLightbox, setMediaLightbox] = useState<{ url: string; alt: string } | null>(null)
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false)
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false)
  const [pendingLockedConversationId, setPendingLockedConversationId] = useState<string | null>(null)
  const [pendingUnlockPassword, setPendingUnlockPassword] = useState('')
  const [pendingUnlockError, setPendingUnlockError] = useState<string | null>(null)
  const [unlockedConversationIds, setUnlockedConversationIds] = useState<Set<string>>(() => new Set())
  const [hiddenSearchUnlockedIds, setHiddenSearchUnlockedIds] = useState<Set<string>>(() => new Set())
  const [lockedSearchUnlockedIds, setLockedSearchUnlockedIds] = useState<Set<string>>(() => new Set())
  const previousSelectedConversationIdRef = useRef<string | null>(null)
  const [isDirectPeerBlocked, setIsDirectPeerBlocked] = useState(false)
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState | null>(null)
  const [nicknameDialog, setNicknameDialog] = useState<NicknameDialogState | null>(null)
  const [groupNameDialogOpen, setGroupNameDialogOpen] = useState(false)
  const [groupAvatarDialogOpen, setGroupAvatarDialogOpen] = useState(false)
  const [reportDialog, setReportDialog] = useState<ReportDialogState | null>(null)
  const [muteDialogOpen, setMuteDialogOpen] = useState(false)
  const [autoDeleteDialogOpen, setAutoDeleteDialogOpen] = useState(false)
  const [lockDialogOpen, setLockDialogOpen] = useState(false)
  const [hideDialogOpen, setHideDialogOpen] = useState(false)
  const [hideDialogMode, setHideDialogMode] = useState<'hide' | 'unhide'>('hide')
  const [rightPanelSection, setRightPanelSection] = useState<'overview' | 'members' | 'manage'>('overview')
  const [groupName, setGroupName] = useState('')
  const [groupSearchKeyword, setGroupSearchKeyword] = useState('')
  const [groupMemberIds, setGroupMemberIds] = useState<number[]>([])
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [groupActionBusyId, setGroupActionBusyId] = useState<string | null>(null)
  const [newMessageKeyword, setNewMessageKeyword] = useState('')
  const [searchUsersResult, setSearchUsersResult] = useState<Array<{ id: number; name: string; username?: string }>>([])
  const [notifications, setNotifications] = useState<Array<{ id: number; type: string; title: string; body: string | null; created_at: string; is_read: number; meta?: Record<string, unknown> | null }>>([])
  const [showJumpToLatest, setShowJumpToLatest] = useState(false)
  const [hasMoreHistory, setHasMoreHistory] = useState<Record<string, boolean>>({})
  const [messageLimitByConversation, setMessageLimitByConversation] = useState<
    Record<string, { total: number; sent: number; remaining: number; isFriend: boolean } | null>
  >({})
  const [friendMap, setFriendMap] = useState<Record<number, FriendConnection>>({})
  const [pendingFriendRequestTo, setPendingFriendRequestTo] = useState<Record<number, boolean>>({})
  const [mutedMic, setMutedMic] = useState(() => useCallStore.getState().mutedMic)
  const [mutedCam, setMutedCam] = useState(() => useCallStore.getState().mutedCam)
  const [callAnswered, setCallAnswered] = useState(() => useCallStore.getState().callAnswered)
  const [ringingStartedAt, setRingingStartedAt] = useState<number | null>(null)
  const [isSendingMessage, setIsSendingMessage] = useState(false)
  const [attachmentDraft, setAttachmentDraft] = useState<AttachmentDraft | null>(null)
  const [typingUserIds, setTypingUserIds] = useState<Set<number>>(new Set())
  const [messageSearchDraft, setMessageSearchDraft] = useState('')
  const [messageSearchKeyword, setMessageSearchKeyword] = useState('')
  const [showMessageFilters, setShowMessageFilters] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [isLoadingConversations, setIsLoadingConversations] = useState(true)
  const [sharedContent, setSharedContent] = useState<{ photosVideos: ChatMessage[]; files: ChatMessage[]; links: ChatMessage[] }>({
    photosVideos: [],
    files: [],
    links: [],
  })
  const [loadingSharedContent, setLoadingSharedContent] = useState(false)
  const [conversationUiPrefs, setConversationUiPrefs] = useState<Record<string, Partial<ConversationUiPrefs>>>(() => {
    if (typeof window === 'undefined') return {}
    try {
      const raw = window.localStorage.getItem('zchat:conversation-ui-prefs')
      return raw ? JSON.parse(raw) : {}
    } catch {
      return {}
    }
  })
  const typingTimeoutRef = useRef<number | null>(null)
  const remoteTypingTimeoutsRef = useRef<Map<number, number>>(new Map())
  const sendingMessageRef = useRef(false)

  // AI States
  const [isSummarizing, setIsSummarizing] = useState(false)
  const [chatSummary, setChatSummary] = useState<string | null>(null)

  const [isSuggesting, setIsSuggesting] = useState(false)
  const [replySuggestions, setReplySuggestions] = useState<string[]>([])

  const [isAnalyzingSentiment, setIsAnalyzingSentiment] = useState(false)
  const [sentimentResult, setSentimentResult] = useState<{ sentiment: 'positive' | 'neutral' | 'negative'; score: number; detail: string; emotions: string[] } | null>(null)

  const [translatedMessages, setTranslatedMessages] = useState<Record<string, string>>({})
  const [translatingIds, setTranslatingIds] = useState<Record<string, boolean>>({})
  const [chatSummaryCollapsed, setChatSummaryCollapsed] = useState(false)
  const [sentimentCollapsed, setSentimentCollapsed] = useState(false)
  const [showDetailsPanelDesktop, setShowDetailsPanelDesktop] = useState(true)

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const videoInputRef = useRef<HTMLInputElement | null>(null)
  const longPressTimer = useRef<number | null>(null)
  const actionMenuRef = useRef<HTMLDivElement | null>(null)
  const reactionPickerRef = useRef<HTMLDivElement | null>(null)
  const localStreamRef = useRef<MediaStream | null>(useCallStore.getState().localStream)
  const localVideoRef = useRef<HTMLVideoElement | null>(null)
  // Share Map reference with callSession so WebRTC state survives navigation
  const peersRef = useRef<Map<number, RTCPeerConnection>>(callSession.peers)
  const pendingCandidatesRef = useRef<Map<number, RTCIceCandidateInit[]>>(callSession.pendingCandidates)
  const messagesWrapRef = useRef<HTMLDivElement | null>(null)
  const ringtoneRef = useRef<{ context: AudioContext; intervalId: number } | null>(null)
  // Metadata cuộc gọi hiện tại để ghi lịch sử (chỉ phía người khởi tạo ghi để tránh trùng).
  const callMetaRef = useRef<{
    initiatorId: number
    participantIds: number[]
    callType: 'voice' | 'video'
    mode: 'private' | 'group'
    conversationId: string
    callSessionId?: string
    startedAt: number
    answeredAt: number | null
    withName: string
  } | null>(null)
  const callLoggedRef = useRef(false)
  const lastCallTypeRef = useRef<'voice' | 'video'>('voice')
  const callRoomIdRef = useRef<string>('')
  const clearCallTimerRef = useRef<number | null>(null)
  const isEndingCallRef = useRef(false)
  const screenShareTrackRef = useRef<MediaStreamTrack | null>(null)
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null)
  const negotiationLocksRef = useRef<Set<number>>(new Set())
  const lastRenderedMessageIdRef = useRef<string | null>(null)

  const scrollConversationToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    window.setTimeout(() => {
      const node = messagesWrapRef.current
      if (!node) return
      node.scrollTo({ top: node.scrollHeight, behavior })
    }, 0)
  }, [])

  const isMessagesNearBottom = useCallback((threshold = 140) => {
    const node = messagesWrapRef.current
    if (!node) return true
    return node.scrollHeight - (node.scrollTop + node.clientHeight) <= threshold
  }, [])

  const getSenderName = (senderId: number, msg?: ChatMessage) => {
    if (senderId === user?.id) return user?.fullName || 'Tôi'
    if (msg?.senderName) return msg.senderName
    if ((msg as any)?.sender?.fullName) return (msg as any).sender.fullName
    if ((msg as any)?.sender?.name) return (msg as any).sender.name

    if (selectedConversation) {
      const member = selectedConversation.members?.find(m => m.userId === senderId)
      if (member) return member.fullName
    }
    return `Người dùng ${senderId}`
  }

  const handleSummarizeChat = async () => {
    if (!token || !selectedConversationId) return
    setIsSummarizing(true)
    setChatSummary(null)
    try {
      const msgs = messagesByConversation[selectedConversationId] || []
      const recentMsgs = msgs.slice(-50).map(m => ({
        sender: getSenderName(m.senderId, m),
        content: m.text || '',
        timestamp: m.createdAt
      })).filter(m => m.content)

      if (recentMsgs.length === 0) {
        setChatNotice('Chưa có tin nhắn văn bản nào để tóm tắt.')
        return
      }

      const res = await api.summarizeChat(token, recentMsgs)
      setChatSummary(res.summary)
      setChatSummaryCollapsed(false)
    } catch (error) {
      setChatNotice('Không thể tóm tắt đoạn chat.')
    } finally {
      setIsSummarizing(false)
    }
  }

  const handleSuggestReplies = async () => {
    if (!token || !selectedConversationId) return
    setIsSuggesting(true)
    setReplySuggestions([])
    try {
      const msgs = messagesByConversation[selectedConversationId] || []
      const recentMsgs = msgs.slice(-10).map(m => ({
        sender: getSenderName(m.senderId, m),
        content: m.text || ''
      })).filter(m => m.content)

      if (recentMsgs.length === 0) {
        return
      }

      const res = await api.suggestReplies(token, recentMsgs, user?.fullName || 'Tôi')
      setReplySuggestions(res.suggestions || [])
    } catch (error) {
      setChatNotice('Không thể lấy gợi ý trả lời.')
    } finally {
      setIsSuggesting(false)
    }
  }

  const handleAnalyzeSentiment = async () => {
    if (!token || !selectedConversationId) return
    setIsAnalyzingSentiment(true)
    setSentimentResult(null)
    try {
      const msgs = messagesByConversation[selectedConversationId] || []
      const recentMsgs = msgs.slice(-50).map(m => ({
        sender: getSenderName(m.senderId, m),
        content: m.text || '',
        timestamp: m.createdAt
      })).filter(m => m.content)

      if (recentMsgs.length === 0) {
        setChatNotice('Chưa có tin nhắn văn bản nào để phân tích.')
        return
      }

      const res = await api.analyzeSentiment(token, recentMsgs)
      setSentimentResult(res)
      setSentimentCollapsed(false)
    } catch (error) {
      setChatNotice('Không thể phân tích cảm xúc.')
    } finally {
      setIsAnalyzingSentiment(false)
    }
  }

  const handleTranslateMessage = async (msgId: string, text: string) => {
    if (!token || !text) return
    setTranslatingIds(prev => ({ ...prev, [msgId]: true }))
    try {
      const res = await api.translateMessage(token, text, 'vi')
      setTranslatedMessages(prev => ({ ...prev, [msgId]: res.translatedText }))
    } catch (error) {
      setChatNotice('Không thể dịch tin nhắn.')
    } finally {
      setTranslatingIds(prev => ({ ...prev, [msgId]: false }))
    }
  }

  useEffect(() => {
    try {
      window.localStorage.setItem('zchat:conversation-ui-prefs', JSON.stringify(conversationUiPrefs))
    } catch {
      // Local display preferences are optional.
    }
  }, [conversationUiPrefs])

  useEffect(() => {
    try {
      window.localStorage.setItem('zchat:call-settings', JSON.stringify(callSettings))
    } catch {
      // Local call settings are optional.
    }
  }, [callSettings])

  const VIRTUAL_CHUNK = 50
  const virtualSlice = useMemo(() => {
    if (!selectedConversationId) return { items: [], startIndex: 0, endIndex: 0 }
    const allMessages = messagesByConversation[selectedConversationId] || []
    if (allMessages.length <= VIRTUAL_CHUNK) {
      return { items: allMessages, startIndex: 0, endIndex: allMessages.length }
    }
    return {
      items: allMessages.slice(-VIRTUAL_CHUNK),
      startIndex: Math.max(0, allMessages.length - VIRTUAL_CHUNK),
      endIndex: allMessages.length,
    }
  }, [messagesByConversation, selectedConversationId])

  useEffect(() => {
    const socket = getSocket()
    if (!socket || !selectedConversationId) {
      setActiveGroupCallSessionIds(new Set())
      return
    }
    const sessionIds = Array.from(new Set(
      virtualSlice.items
        .filter((item) => {
          if (item.type !== 'call-history') return false
          const meta = (item.meta || {}) as Record<string, unknown>
          return meta.mode === 'group' && meta.status === 'active' && meta.callSessionId
        })
        .map((item) => String(((item.meta || {}) as Record<string, unknown>).callSessionId))
        .filter(Boolean)
    ))
    if (sessionIds.length === 0) {
      setActiveGroupCallSessionIds(new Set())
      return
    }
    setActiveGroupCallSessionIds(new Set(sessionIds))
    if (!socket.connected) return

    let cancelled = false
    Promise.all(sessionIds.map((callSessionId) => new Promise<string | null>((resolve) => {
      socket.emit('call:room:status', { conversationId: selectedConversationId, callSessionId }, (resp: unknown) => {
        const active = Boolean((resp as { active?: boolean })?.active)
        resolve(active ? callSessionId : null)
      })
      window.setTimeout(() => resolve(null), 2500)
    }))).then((activeIds) => {
      if (cancelled) return
      setActiveGroupCallSessionIds(new Set(activeIds.filter((id): id is string => Boolean(id))))
    }).catch(() => {
      if (!cancelled) setActiveGroupCallSessionIds(new Set())
    })
    return () => {
      cancelled = true
    }
  }, [selectedConversationId, virtualSlice.items])

  const selectedConversation = conversations.find((c) => c.id === selectedConversationId) || null
  const selectedConversationUiPrefs = useMemo<ConversationUiPrefs>(
    () => ({
      largeText: false,
      roundBubbles: true,
      ...(selectedConversation?.id ? conversationUiPrefs[selectedConversation.id] : {}),
    }),
    [conversationUiPrefs, selectedConversation?.id]
  )
  const queryConversationId = searchParams.get('conversation') || ''
  const globalIncomingCall = useCallStore((state) => state.incomingCall)
  const globalCallMinimized = useCallStore((state) => state.callMinimized)
  const setGlobalIncomingCall = useCallStore((state) => state.setIncomingCall)
  const acceptPending = useCallStore((state) => state.acceptPending)
  const setAcceptPending = useCallStore((state) => state.setAcceptPending)
  const clearIncomingCall = useCallback(() => {
    setGlobalIncomingCall(null)
    setIncomingCall(null)
  }, [setGlobalIncomingCall])

  // Stable Zustand setters (don't change between renders)
  const {
    setActiveCall: setGlobalActiveCall,
    setCallAnswered: setGlobalCallAnswered,
    setCallState: setGlobalCallState,
    setCallMinimized: setGlobalCallMinimized,
    setMutedMic: setGlobalMutedMic,
    setMutedCam: setGlobalMutedCam,
    setCallSeconds: setGlobalCallSeconds,
    setCameraAvailable: setGlobalCameraAvailable,
    setLocalStream: setGlobalLocalStream,
    setRemoteStreams: setGlobalRemoteStreams,
    setCallParticipants: setGlobalCallParticipants,
    setMicDenied: setGlobalMicDenied,
    setCallErrorMessage: setGlobalCallErrorMessage,
    setAddMembersAction: setGlobalAddMembersAction,
    setRetryCallAction: setGlobalRetryCallAction,
  } = useCallStore.getState()
  const { openConversation: routeOpenConversation } = useConversationRouting({
    token,
    queryConversationId,
    selectedConversationId,
    setConversations,
    selectConversation,
    onLockedConversation: setPendingLockedConversationId,
  })

  const [mobileShowList, setMobileShowList] = useState(true)
  const [isMobileViewport, setIsMobileViewport] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)')
    setIsMobileViewport(mql.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobileViewport(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  const refreshConversations = useCallback(async () => {
    if (!token) return
    setConversations(await loadChatConversations(token))
  }, [token, setConversations])

  const verifyHiddenConversationAccess = useCallback(
    async (conversationId: string, hiddenPassword: string, options?: { syncConversation?: boolean }) => {
      if (!token) throw new Error('Bạn cần đăng nhập để mở hội thoại ẩn.')
      const syncConversation = options?.syncConversation !== false
      try {
        const result = await api.verifyHiddenConversation(token, conversationId, hiddenPassword)
        if (syncConversation) {
          setConversations((current) => current.map((item) => (item.id === conversationId ? result.conversation : item)))
        }
        return true
      } catch (verifyError) {
        try {
          await api.updateConversationPreferences(token, conversationId, { hidden: false, hiddenPassword })
          const restored = await api.updateConversationPreferences(token, conversationId, { hidden: true, hiddenPassword })
          if (syncConversation) {
            setConversations((current) => current.map((item) => (item.id === conversationId ? restored.conversation : item)))
          }
          return true
        } catch {
          throw verifyError
        }
      }
    },
    [setConversations, token]
  )

  const verifyLockedConversationAccess = useCallback(
    async (conversationId: string, lockedPassword: string) => {
      if (!token) throw new Error('Bạn cần đăng nhập để mở hội thoại khóa.')
      await api.updateConversationPreferences(token, conversationId, { locked: false, lockedPassword })
      await api.updateConversationPreferences(token, conversationId, { locked: true, lockedPassword })
      return true
    },
    [token]
  )

  const requestConversationAccess = useCallback(
    async (conversationId: string) => {
      if (!token) return false
      const targetConversation = conversations.find((item) => item.id === conversationId) || null
      if (!targetConversation) return false

      const hiddenAllowed = !targetConversation.isHidden || hiddenSearchUnlockedIds.has(conversationId) || unlockedConversationIds.has(conversationId)
      const lockedAllowed = !targetConversation.isLocked || lockedSearchUnlockedIds.has(conversationId) || unlockedConversationIds.has(conversationId)
      if (!hiddenAllowed || !lockedAllowed) {
        setPendingLockedConversationId(conversationId)
        setPendingUnlockError(null)
        setPendingUnlockPassword('')
        return false
      }

      return true
    },
    [conversations, hiddenSearchUnlockedIds, lockedSearchUnlockedIds, token, unlockedConversationIds]
  )

  const handleOpenConversation = useCallback(
    (conversationId: string) => {
      void (async () => {
        const allowed = await requestConversationAccess(conversationId)
        if (!allowed) return
        routeOpenConversation(conversationId)
        markConversationRead(conversationId)
        const openedConversation = conversations.find((item) => item.id === conversationId)
        if (openedConversation?.isHidden) {
          setSearchTerm('')
          setHiddenSearchUnlockedIds(new Set())
        }
        if (openedConversation?.isLocked) {
          setLockedSearchUnlockedIds(new Set())
        }
        setMobileShowList(false)
      })()
    },
    [conversations, markConversationRead, requestConversationAccess, routeOpenConversation]
  )

  const handleUnlockPendingConversation = async () => {
    if (!pendingLockedConversationId) return
    try {
      const allowed = await requestConversationAccess(pendingLockedConversationId)
      if (!allowed) return
      routeOpenConversation(pendingLockedConversationId)
      markConversationRead(pendingLockedConversationId)
      setPendingLockedConversationId(null)
    } catch (error) {
      setChatNotice(error instanceof Error ? error.message : 'Không thể mở khóa hội thoại.')
    }
  }

  const handleSubmitPendingUnlock = async () => {
    if (!token || !pendingLockedConversationId) return
    const password = pendingUnlockPassword.trim()
    if (!password) {
      setPendingUnlockError('Nhập mật khẩu để mở khóa hội thoại.')
      return
    }

    try {
      setPendingUnlockError(null)
      const targetConversation = conversations.find((item) => item.id === pendingLockedConversationId) || null
      if (!targetConversation) return

      if (targetConversation.isHidden) {
        await verifyHiddenConversationAccess(pendingLockedConversationId, password)
        setHiddenSearchUnlockedIds((current) => {
          const next = new Set(current)
          next.add(pendingLockedConversationId)
          return next
        })
      }
      if (targetConversation.isLocked) {
        await verifyLockedConversationAccess(pendingLockedConversationId, password)
      }
      setUnlockedConversationIds((current) => {
        const next = new Set(current)
        next.add(pendingLockedConversationId)
        return next
      })
      await refreshConversations()
      routeOpenConversation(pendingLockedConversationId)
      markConversationRead(pendingLockedConversationId)
      setPendingLockedConversationId(null)
      setPendingUnlockPassword('')
    } catch (error) {
      setPendingUnlockError(error instanceof Error ? error.message : 'Không thể mở khóa hội thoại.')
    }
  }

  const reloadNotifications = useCallback(async () => {
    if (!token) return
    try {
      setNotifications(await loadChatNotifications(token))
    } catch {
      // Ignore transient notification reload issues.
    }
  }, [token])

  useEffect(() => {
    const previousId = previousSelectedConversationIdRef.current
    if (previousId && previousId !== selectedConversationId) {
      setUnlockedConversationIds((current) => {
        if (!current.has(previousId)) return current
        const next = new Set(current)
        next.delete(previousId)
        return next
      })
      setHiddenSearchUnlockedIds((current) => {
        if (!current.has(previousId)) return current
        const next = new Set(current)
        next.delete(previousId)
        return next
      })
      setSearchTerm('')
    }
    previousSelectedConversationIdRef.current = selectedConversationId
  }, [selectedConversationId])

  const reloadCallHistory = useCallback(async () => {
    if (!token) return
    try {
      const data = await api.getCallHistory(token, 80)
      setCallHistory(data.calls || [])
    } catch {
      // Call history should never block the chat surface.
    }
  }, [token])

  const reloadFriendMap = useCallback(async () => {
    if (!token || !user?.id) return
    try {
      setFriendMap(await loadFriendMap(token))
    } catch (error) {
      console.error('Không thể tải danh sách bạn bè', error)
    }
  }, [token, user?.id])

  function stopRingtone() {
    const ringtone = ringtoneRef.current
    if (!ringtone) return
    window.clearInterval(ringtone.intervalId)
    ringtone.context.close().catch(() => undefined)
    ringtoneRef.current = null
  }

  function startRingtone(tone: 'incoming' | 'outgoing') {
    if (!callSettings.sound || ringtoneRef.current) return
    const AudioContextClass = window.AudioContext
    if (!AudioContextClass) return
    const context = new AudioContextClass()
    const playPulse = () => {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = tone === 'incoming' ? 'sine' : 'triangle'
      oscillator.frequency.value = tone === 'incoming' ? 880 : 520
      gain.gain.setValueAtTime(0.0001, context.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.09, context.currentTime + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.34)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start()
      oscillator.stop(context.currentTime + 0.36)
    }
    playPulse()
    const intervalId = window.setInterval(playPulse, tone === 'incoming' ? 1450 : 1900)
    ringtoneRef.current = { context, intervalId }
  }

  function addLocalCallHistory(text: string, conversationId = selectedConversationId || '') {
    if (!conversationId || !user?.id) return
    const systemMessage: ChatMessage = {
      id: `local-call-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      conversationId,
      senderId: user.id,
      senderName: user.fullName || 'Bạn',
      senderAvatar: user.avatarUrl || null,
      type: 'call-history',
      text,
      mediaUrl: null,
      meta: { system: true, callHistory: true },
      reactionCount: 0,
      viewerReaction: null,
      createdAt: new Date().toISOString(),
    }
    appendMessage(conversationId, systemMessage)
    scrollConversationToBottom('smooth')
  }

  useEffect(() => {
    if (conversations.length > 0) setIsLoadingConversations(false)
  }, [conversations.length])

  useEffect(() => {
    const timer = window.setTimeout(() => setIsLoadingConversations(false), 4000)
    return () => clearTimeout(timer)
  }, [token])

  useEffect(() => {
    if (!token || !selectedConversationId) return

    setLoadingMessages(true)
    api.listMessages(token, selectedConversationId, {
      limit: 25,
      q: messageSearchKeyword.trim() || undefined,
    })
      .then((response) => {
        setMessages(selectedConversationId, response.messages)
        setHasMoreHistory((prev) => ({ ...prev, [selectedConversationId]: response.messages.length >= 25 }))
        setMessageLimitByConversation((prev) => ({
          ...prev,
          [selectedConversationId]: response.messageLimit || null,
        }))
        const lastMessageId = response.messages[response.messages.length - 1]?.id || null
        api.markConversationRead(token, selectedConversationId, lastMessageId).catch(() => undefined)
        scrollConversationToBottom('auto')
      })
      .catch(console.error)
      .finally(() => setLoadingMessages(false))
  }, [messageSearchKeyword, scrollConversationToBottom, token, selectedConversationId, setMessages])

  useEffect(() => {
    if (!token || !selectedConversationId) return
    setLoadingSharedContent(true)
    api.getConversationSharedContent(token, selectedConversationId)
      .then(setSharedContent)
      .catch(() => setSharedContent({ photosVideos: [], files: [], links: [] }))
      .finally(() => setLoadingSharedContent(false))
  }, [token, selectedConversationId, messagesByConversation[selectedConversationId || '']?.length])

  useEffect(() => {
    reloadNotifications().catch(() => undefined)
  }, [reloadNotifications])

  useEffect(() => {
    reloadCallHistory().catch(() => undefined)
  }, [reloadCallHistory])

  useEffect(() => {
    if (!mediaLightbox) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMediaLightbox(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mediaLightbox])

  useEffect(() => {
    if (!token || !newMessageKeyword.trim()) {
      setSearchUsersResult([])
      return
    }

    const timer = window.setTimeout(() => {
      searchMessageUsers(token, newMessageKeyword.trim())
        .then((result) => {
          setSearchUsersResult(result)
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
    setReactionPicker(null)
    setTypingUserIds(new Set())
    remoteTypingTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId))
    remoteTypingTimeoutsRef.current.clear()
    setMessage('')
    setAttachmentDraft((current) => {
      if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl)
      return null
    })
    setMessageSearchDraft('')
    markConversationRead(selectedConversationId)
    const socket = getSocket()
    socket?.emit('stopTyping', { conversationId: selectedConversationId })
    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = null
    }
  }, [markConversationRead, selectedConversationId])

  const emitTypingState = useCallback((isTyping: boolean, conversationId = selectedConversationId) => {
    const socket = getSocket()
    if (!socket || !conversationId) return
    socket.emit(isTyping ? 'typing' : 'stopTyping', { conversationId })
    socket.emit('message:typing', { conversationId, isTyping })
  }, [selectedConversationId])

  const stopComposerTyping = useCallback((conversationId = selectedConversationId) => {
    if (!conversationId) return
    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = null
    }
    emitTypingState(false, conversationId)
  }, [emitTypingState, selectedConversationId])

  const handleComposerMessageChange = useCallback((value: string) => {
    setMessage(value)
    if (!selectedConversationId) return
    const socket = getSocket()
    socket?.emit('join-conversation', selectedConversationId)
    socket?.emit('conversation:join', { conversationId: selectedConversationId })
    emitTypingState(Boolean(value.trim()), selectedConversationId)
    if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current)
    if (value.trim()) {
      typingTimeoutRef.current = window.setTimeout(() => {
        emitTypingState(false, selectedConversationId)
        typingTimeoutRef.current = null
      }, 1800)
    }
  }, [emitTypingState, selectedConversationId])

  useEffect(() => {
    if (!token) return

    const socket = connectSocket(token, user?.id)
    socket.on('message:new', (payload: ChatMessage) => {
      const normalized = normalizeIncomingMessageForViewer(payload, user?.id)
      upsertMessage(normalized.conversationId, normalized)
      if (normalized.conversationId === selectedConversationId) {
        setTypingUserIds((prev) => {
          const next = new Set(prev)
          next.delete(normalized.senderId)
          return next
        })
      }
      refreshConversations().catch(() => undefined)
    })

    socket.on('message:reaction', (payload: { conversationId: string; message: ChatMessage }) => {
      upsertMessage(String(payload.conversationId), normalizeIncomingMessageForViewer(payload.message, user?.id))
      refreshConversations().catch(() => undefined)
    })

    socket.on('message:updated', (payload: { conversationId: string; message: ChatMessage | null; unpinnedMessageId?: string }) => {
      if (!payload?.message) return
      upsertMessage(String(payload.conversationId), normalizeIncomingMessageForViewer(payload.message, user?.id))
      refreshConversations().catch(() => undefined)
    })

    socket.on('message:deleted', (payload: { conversationId: string; messageId?: string; unpinnedMessageId?: string }) => {
      if (!payload?.messageId) return
      const convId = String(payload.conversationId)
      const msgId = String(payload.messageId)
      setMessages(convId, (messagesByConversation[convId] || []).filter((m) => m.id !== msgId))
      refreshConversations().catch(() => undefined)
    })

    socket.on('conversation:updated', () => {
      refreshConversations().catch(() => undefined)
    })

    socket.on('conversation:seen', () => {
      refreshConversations().catch(() => undefined)
    })

    socket.on('conversation:nickname', () => {
      refreshConversations().catch(() => undefined)
    })

    socket.on('conversation:members', () => {
      refreshConversations().catch(() => undefined)
    })

    socket.on('presence:updated', () => {
      refreshConversations().catch(() => undefined)
    })

    socket.on('user:avatar-updated', (payload: { userId?: number; avatarUrl?: string }) => {
      if (!payload?.userId) return
      const nextAvatar = resolveApiAssetUrl(payload.avatarUrl) ?? payload.avatarUrl ?? null
      updateUserAvatar(Number(payload.userId), nextAvatar)
    })

    socket.on('message:seen', () => {
      refreshConversations().catch(() => undefined)
    })

    const handleTypingPayload = (payload: { conversationId: string; fromUserId: number; isTyping?: boolean }) => {
      if (!payload || String(payload.conversationId) !== String(selectedConversationId) || Number(payload.fromUserId) === Number(user?.id)) return
      setTypingUserIds((prev) => {
        const next = new Set(prev)
        if (payload.isTyping !== false) {
          next.add(payload.fromUserId)
          const existing = remoteTypingTimeoutsRef.current.get(payload.fromUserId)
          if (existing) window.clearTimeout(existing)
          const timeoutId = window.setTimeout(() => {
            setTypingUserIds((current) => {
              const updated = new Set(current)
              updated.delete(payload.fromUserId)
              return updated
            })
            remoteTypingTimeoutsRef.current.delete(payload.fromUserId)
          }, 2500)
          remoteTypingTimeoutsRef.current.set(payload.fromUserId, timeoutId)
        } else {
          next.delete(payload.fromUserId)
          const existing = remoteTypingTimeoutsRef.current.get(payload.fromUserId)
          if (existing) window.clearTimeout(existing)
          remoteTypingTimeoutsRef.current.delete(payload.fromUserId)
        }
        return next
      })
    }

    socket.on('message:typing', handleTypingPayload)
    socket.on('typing', (payload: { conversationId: string; fromUserId: number }) => handleTypingPayload({ ...payload, isTyping: true }))
    socket.on('stopTyping', (payload: { conversationId: string; fromUserId: number }) => handleTypingPayload({ ...payload, isTyping: false }))

    const handleSocketNotification = (payload: { type?: string } | null) => {
      if (!payload) return
      reloadNotifications().catch(() => undefined)
      if (payload.type === 'message') {
        refreshConversations().catch(() => undefined)
      }

      if (payload.type === 'friend-request' || payload.type === 'friend-accepted') {
        reloadFriendMap().catch(() => undefined)
      }
    }
    socket.on('notification:new', handleSocketNotification)

    socket.on('call:offer', async (payload) => {
      const fromUserId = Number(payload.fromUserId)
      const incomingConversationId = payload.conversationId ? String(payload.conversationId) : null

      // Liên thông với mobile: offer chỉ kèm roomId (Jitsi), không có SDP → hiển thị cuộc gọi đến
      // dạng Jitsi; khi chấp nhận sẽ mở meet.jit.si thay vì WebRTC.
      if (!payload.offer?.sdp && payload.roomId) {
        const incomingConv = incomingConversationId
          ? conversations.find((c) => c.id === incomingConversationId) || null
          : null
        const callerMember = incomingConv?.members.find((m) => m.userId === fromUserId)
        const jitsiIncoming: IncomingCallState = {
          fromUserId,
          callType: payload.callType || 'video',
          mode: incomingConv?.type === 'group' ? 'group' : 'private',
          conversationId: incomingConversationId,
          roomId: String(payload.roomId),
          useJitsi: true,
          fromUserName: callerMember?.fullName || payload.fromUserName || undefined,
          conversationName: incomingConv ? getConversationDisplayName(incomingConv, user?.id) : payload.conversationName || undefined,
          fromUserAvatar: callerMember?.avatarUrl || null,
        }
        setIncomingCall(jitsiIncoming)
        setGlobalIncomingCall(jitsiIncoming)
        setCallStatus('Cuộc gọi video đến')
        setCallState('incoming')
        startRingtone('incoming')
        if (callSettings.vibration && navigator.vibrate) navigator.vibrate([180, 90, 180])
        return
      }

      if (!payload.offer) return

      // Mesh nhóm: nếu đang trong cuộc gọi cùng hội thoại và nhận offer từ người mới tham gia,
      // tự động thiết lập kết nối (tạo answer) mà KHÔNG hiện modal cuộc gọi đến.
      const state = useCallStore.getState()
      const activeConvId = state.activeCall?.conversationId
      if (state.callAnswered && state.activeCall && incomingConversationId && incomingConversationId === activeConvId) {
        clearIncomingCall()
        try {
          const pc = peersRef.current.get(fromUserId) || await buildPeerConnection(fromUserId, state.activeCall.type, incomingConversationId)
          if (pc) {
            await pc.setRemoteDescription({ type: 'offer', sdp: payload.offer.sdp })
            await flushPendingCandidates(fromUserId)
            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)
            socket.emit('call:answer', {
              targetUserId: fromUserId,
              conversationId: incomingConversationId,
              answer: { type: answer.type, sdp: answer.sdp },
            })
            setJoinedCallUserIds((prev) => (prev.includes(fromUserId) ? prev : [...prev, fromUserId]))
            callLog(payload.renegotiate ? 'Peer renegotiated' : 'User joined call', {
              fromUserId,
              conversationId: incomingConversationId,
            })
          }
        } catch {
          // bỏ qua: thiết lập peer mesh thất bại
        }
        return
      }

      const incomingConv = incomingConversationId
        ? conversations.find((c) => c.id === incomingConversationId) || null
        : null
      const callerMember = incomingConv?.members.find((m) => m.userId === fromUserId)
      const incomingPayload: IncomingCallState = {
        fromUserId,
        callType: payload.callType || 'voice',
        mode: incomingConv?.type === 'group' ? 'group' : 'private',
        conversationId: incomingConversationId,
        offer: payload.offer,
        roomId: payload.roomId ? String(payload.roomId) : undefined,
        fromUserName: callerMember?.fullName || payload.fromUserName || undefined,
        conversationName: incomingConv ? getConversationDisplayName(incomingConv, user?.id) : payload.conversationName || undefined,
        fromUserAvatar: callerMember?.avatarUrl || null,
      }
      setIncomingCall(incomingPayload)
      setGlobalIncomingCall(incomingPayload)
      setCallStatus(`Cuộc gọi ${payload.callType === 'video' ? 'video' : 'thoại'} đến`)
      setCallState('incoming')
      startRingtone('incoming')
      if (callSettings.vibration && navigator.vibrate) navigator.vibrate([180, 90, 180])
    })

    // Mesh: chủ động gửi offer tới người mới (quy ước: id nhỏ hơn là bên gọi để tránh glare).
    const meshInitiate = async (newUserId: number) => {
      const st = useCallStore.getState()
      const active = st.activeCall
      const myId = Number(user?.id || 0)
      if (!active || !myId || newUserId <= 0 || newUserId === myId) return
      if (!st.callAnswered) return
      if (peersRef.current.has(newUserId)) return
      if (myId > newUserId) return // bên kia sẽ gửi offer cho mình
      const convId = active.conversationId
      if (!convId) return
      try {
        const pc = await buildPeerConnection(newUserId, active.type, convId)
        if (!pc) return
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        socket.emit('call:offer', {
          targetUserId: newUserId,
          conversationId: convId,
          callType: active.type,
          offer: { type: offer.type, sdp: offer.sdp },
        })
      } catch {
        // bỏ qua: khởi tạo mesh thất bại
      }
    }

    socket.on('call:answer', async (payload) => {
      const fromUserId = Number(payload.fromUserId || 0)

      // Liên thông: đối phương (mobile) trả lời bằng Jitsi → bên gọi web đang WebRTC phải chuyển
      // sang mở Jitsi cùng phòng (nhả camera WebRTC, mở tab meet.jit.si).
      if (payload?.useJitsi || (!payload?.answer?.sdp && payload?.roomId)) {
        const roomId = String(payload?.roomId || callRoomIdRef.current || '')
        if (roomId) {
          stopRingtone()
          const currentActiveCall = useCallStore.getState().activeCall || activeCall
          if (currentActiveCall?.mode !== 'group') logCall('completed')
          const myName = user?.fullName || 'Bạn'
          closeCallResources()
          setJitsiCallUrl(resolveJitsiUrl(roomId, myName))
          setCallState('connected')
          setCallStatus('Đã kết nối cuộc gọi video')
          setActiveCall(null)
          setCallAnswered(false)
          setRingingStartedAt(null)
          setCallSeconds(0)
          callMetaRef.current = null
          toast({ title: 'Đang mở cuộc gọi video qua Jitsi...' })
        }
        return
      }

      const peer = peersRef.current.get(fromUserId)
      if (peer && payload.answer) {
        await peer.setRemoteDescription({
          type: (payload.answer.type as RTCSdpType) || 'answer',
          sdp: payload.answer.sdp,
        })
        await flushPendingCandidates(fromUserId)
      }
      const answeredAt = Number(payload?.answeredAt || 0) || Date.now()
      if (callMetaRef.current && !callMetaRef.current.answeredAt) callMetaRef.current.answeredAt = answeredAt
      setCallAnswered(true)
      setRingingStartedAt(null)
      setCallSeconds(0)
      setActiveCall((prev) => (prev ? { ...prev, startedAt: answeredAt } : prev))
      setCallState('connected')
      stopRingtone()
      setCallStatus('Đã kết nối')
    })

    socket.on('call:join', (payload) => {
      const fromUserId = Number(payload?.fromUserId || 0)
      if (fromUserId > 0) {
        setJoinedCallUserIds((prev) => (prev.includes(fromUserId) ? prev : [...prev, fromUserId]))
        callLog('User joined call', { fromUserId, conversationId: payload?.conversationId })
        void meshInitiate(fromUserId)
      }
    })

    socket.on('call:leave', (payload) => {
      const fromUserId = Number(payload?.fromUserId || 0)
      if (fromUserId > 0) {
        setJoinedCallUserIds((prev) => prev.filter((id) => id !== fromUserId))
        setRemoteMediaState((prev) => { const next = { ...prev }; delete next[fromUserId]; return next })
        callLog('User left call', { fromUserId, conversationId: payload?.conversationId })
      }
    })

    socket.on('call:ice-candidate', async (payload) => {
      const fromUserId = Number(payload.fromUserId || 0)
      const peer = peersRef.current.get(fromUserId)
      if (!peer || !payload.candidate) return
      if (!peer.remoteDescription) {
        const pending = pendingCandidatesRef.current.get(fromUserId) || []
        pending.push(payload.candidate as RTCIceCandidateInit)
        pendingCandidatesRef.current.set(fromUserId, pending)
        return
      }
      try {
        await peer.addIceCandidate(new RTCIceCandidate(payload.candidate))
      } catch {
        // ignore
      }
    })

    const handleRemoteCallEnd = (payload: any) => {
      if (Number(payload?.fromUserId || 0) === Number(user?.id || 0) && isEndingCallRef.current) return
      logCall(payload?.reason === 'disconnected' ? 'completed' : (callMetaRef.current?.answeredAt ? 'completed' : 'cancelled'))
      setCallState('ended')
      stopRingtone()
      setCallStatus(payload?.reason === 'disconnected' ? 'Đối phương đã ngắt kết nối' : 'Cuộc gọi đã kết thúc')
      clearIncomingCall()
      closeCallResources()
      setActiveCall(null)
      setCallSeconds(0)
      setCallAnswered(false)
      setRingingStartedAt(null)
      callMetaRef.current = null
      isEndingCallRef.current = false
    }

    socket.on('call:end', handleRemoteCallEnd)
    socket.on('call:ended', handleRemoteCallEnd)

    const handleRemoteCallLeave = (payload: any) => {
      const fromUserId = Number(payload?.fromUserId || payload?.userId || 0)
      if (fromUserId > 0) {
        callLog('User left call', { fromUserId, conversationId: payload?.conversationId })
        const peer = peersRef.current.get(fromUserId)
        if (peer) { peer.close(); peersRef.current.delete(fromUserId) }
        setRemoteStreams((prev) => prev.filter((item) => item.userId !== fromUserId))
        setJoinedCallUserIds((prev) => prev.filter((id) => id !== fromUserId))
        setRemoteMediaState((prev) => { const next = { ...prev }; delete next[fromUserId]; return next })
      }
    }

    socket.on('call:leave', handleRemoteCallLeave)
    socket.on('call:left', handleRemoteCallLeave)

    socket.on('call:participants', (payload) => {
      // Update participant display for group calls
      if (payload?.participantIds) {
        const ids: number[] = (payload.participantIds as unknown[]).map((id) => Number(id)).filter((id) => id > 0)
        setJoinedCallUserIds(ids)
        setCallStatus(`Cuộc gọi đang có ${payload.participantCount} người tham gia`)
        ids.forEach((id) => { void meshInitiate(id) })
      }
      if (Array.isArray(payload?.participants)) {
        setRemoteMediaState((prev) => {
          const next = { ...prev }
          for (const participant of payload.participants) {
            const id = Number(participant?.userId || 0)
            if (!id || id === user?.id) continue
            next[id] = {
              ...next[id],
              micMuted: Boolean(participant?.micMuted),
              cameraOff: Boolean(participant?.cameraOff),
            }
          }
          return next
        })
      }
    })

    socket.on('group_call_joined', (payload) => {
      const fromUserId = Number(payload?.fromUserId || payload?.userId || 0)
      if (fromUserId > 0) {
        setJoinedCallUserIds((prev) => (prev.includes(fromUserId) ? prev : [...prev, fromUserId]))
        setCallStatus('Cuộc gọi nhóm đang diễn ra')
        callLog('User joined call', { fromUserId, conversationId: payload?.conversationId })
        void meshInitiate(fromUserId)
      }
    })

    socket.on('group_call_left', handleRemoteCallLeave)

    socket.on('group_call_ended', () => {
      logCall(callMetaRef.current?.answeredAt ? 'completed' : 'cancelled')
      setCallState('ended')
      setCallStatus('Cuộc gọi nhóm đã kết thúc')
      closeCallResources()
      setActiveCall(null)
      setCallAnswered(false)
      setCallSeconds(0)
      callMetaRef.current = null
      isEndingCallRef.current = false
    })

    // Người được gọi không trực tuyến (backend phản hồi trực tiếp cho người gọi).
    socket.on('call:unavailable', () => {
      stopRingtone()
      closeCallResources()
      logCall('no_answer')
      setCallState('no_answer')
      setGlobalCallErrorMessage('Người dùng hiện không trực tuyến')
      setCallStatus('Người dùng hiện không trực tuyến')
      scheduleClearCall()
    })

    // Người được gọi từ chối cuộc gọi.
    socket.on('call:reject', (payload) => {
      const currentActiveCall = useCallStore.getState().activeCall || activeCall
      if (currentActiveCall?.mode === 'group' || payload?.mode === 'group') {
        const fromUserId = Number(payload?.fromUserId || payload?.userId || 0)
        if (fromUserId > 0) {
          setJoinedCallUserIds((prev) => prev.filter((id) => id !== fromUserId))
          setRemoteMediaState((prev) => { const next = { ...prev }; delete next[fromUserId]; return next })
        }
        setCallStatus('Một thành viên đã từ chối, cuộc gọi nhóm vẫn đang diễn ra')
        return
      }
      stopRingtone()
      closeCallResources()
      logCall('rejected')
      setCallState('rejected')
      setGlobalCallErrorMessage('Cuộc gọi đã bị từ chối')
      setCallStatus('Đã từ chối')
      scheduleClearCall()
    })

    socket.on('participant_muted', (payload) => {
      const id = Number(payload?.fromUserId || 0)
      if (id > 0) updateRemoteMedia(id, { micMuted: payload?.micMuted !== false })
    })
    socket.on('participant_camera_off', (payload) => {
      const id = Number(payload?.fromUserId || 0)
      if (id > 0) updateRemoteMedia(id, { cameraOff: true })
    })
    socket.on('participant_camera_on', (payload) => {
      const id = Number(payload?.fromUserId || 0)
      if (id > 0) updateRemoteMedia(id, { cameraOff: false })
    })

    socket.on('participant_updated', (payload) => {
      if (payload?.participantIds) {
        const ids: number[] = (payload.participantIds as unknown[]).map((id) => Number(id)).filter((id) => id > 0)
        setJoinedCallUserIds(ids)
      }
      const id = Number(payload?.fromUserId || 0)
      if (id > 0 && typeof payload?.micMuted === 'boolean') updateRemoteMedia(id, { micMuted: payload.micMuted })
    })

    socket.on('participant_speaking', () => {
      // Trạng thái "đang nói" được tính cục bộ từ luồng âm thanh (xem effect bên dưới).
    })

    return () => {
      socket.off('message:new')
      socket.off('message:reaction')
      socket.off('message:updated')
      socket.off('message:deleted')
      socket.off('message:typing', handleTypingPayload)
      socket.off('typing')
      socket.off('stopTyping')
      socket.off('message:seen')
      socket.off('conversation:updated')
      socket.off('conversation:seen')
      socket.off('conversation:nickname')
      socket.off('conversation:members')
      socket.off('presence:updated')
      socket.off('user:avatar-updated')
      socket.off('notification:new', handleSocketNotification)
      socket.off('call:offer')
      socket.off('call:answer')
      socket.off('call:join')
      socket.off('call:leave')
      socket.off('call:ice-candidate')
      socket.off('call:end')
      socket.off('call:ended')
      socket.off('call:left')
      socket.off('call:participants')
      socket.off('group_call_joined')
      socket.off('group_call_left')
      socket.off('group_call_ended')
      socket.off('call:unavailable')
      socket.off('call:reject')
      socket.off('participant_muted')
      socket.off('participant_camera_off')
      socket.off('participant_camera_on')
      socket.off('participant_updated')
      socket.off('participant_speaking')
      remoteTypingTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId))
      remoteTypingTimeoutsRef.current.clear()
    }
  }, [activeCall, clearIncomingCall, joinedCallUserIds, refreshConversations, reloadFriendMap, reloadNotifications, selectedConversationId, setGlobalIncomingCall, token, updateUserAvatar, upsertMessage, user?.id])

  useEffect(() => {
    if (!globalIncomingCall || incomingCall) return
    const activeConversationId = useCallStore.getState().activeCall?.conversationId
    if (useCallStore.getState().callAnswered && activeConversationId && globalIncomingCall.conversationId === activeConversationId) {
      clearIncomingCall()
      return
    }
    setIncomingCall(globalIncomingCall)
    setCallStatus(`Cuộc gọi ${globalIncomingCall.callType === 'video' ? 'video' : 'thoại'} đến`)
    setCallState('incoming')
    startRingtone('incoming')
  }, [clearIncomingCall, globalIncomingCall, incomingCall, startRingtone])

  // Auto-accept when user navigated from AppLayout's accept button
  useEffect(() => {
    if (!acceptPending || !globalIncomingCall) return
    setAcceptPending(false)
    void handleAcceptIncomingCall(globalIncomingCall)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acceptPending, globalIncomingCall])

  useEffect(() => {
    if (!selectedConversationId) return
    const socket = getSocket()
    if (!socket) return

    socket.emit('join-conversation', selectedConversationId)
    socket.emit('conversation:join', { conversationId: selectedConversationId })
    return () => {
      socket.emit('stopTyping', { conversationId: selectedConversationId })
      socket.emit('leave-conversation', selectedConversationId)
      socket.emit('conversation:leave', { conversationId: selectedConversationId })
    }
  }, [selectedConversationId])

  useEffect(() => {
    if (!chatNotice) return
    const timer = window.setTimeout(() => {
      setChatNotice(null)
    }, 3000)
    return () => window.clearTimeout(timer)
  }, [chatNotice])

  useEffect(() => {
    return () => {
      if (attachmentDraft?.previewUrl) {
        URL.revokeObjectURL(attachmentDraft.previewUrl)
      }
    }
  }, [attachmentDraft])

  useEffect(() => {
    if (!callStatus || incomingCall || activeCall) return
    const timer = window.setTimeout(() => {
      setCallStatus(null)
    }, 3000)
    return () => window.clearTimeout(timer)
  }, [callStatus, incomingCall, activeCall])

  // Call timer has been moved to AppLayout so it persists across navigation

  // Sync local call state → Zustand so AppLayout can render call windows across navigation
  useEffect(() => {
    setCallMinimized((current) => (current === globalCallMinimized ? current : globalCallMinimized))
  }, [globalCallMinimized])

  useEffect(() => { setGlobalActiveCall(activeCall) }, [activeCall]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setGlobalCallAnswered(callAnswered) }, [callAnswered]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setGlobalCallState(callState) }, [callState]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setGlobalCallMinimized(callMinimized) }, [callMinimized]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setGlobalMutedMic(mutedMic) }, [mutedMic]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setGlobalMutedCam(mutedCam) }, [mutedCam]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setGlobalCallSeconds(callSeconds) }, [callSeconds]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setGlobalCameraAvailable(cameraAvailable) }, [cameraAvailable]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setGlobalLocalStream(localStreamState); callSession.localStream = localStreamState }, [localStreamState]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setGlobalRemoteStreams(remoteStreams) }, [remoteStreams]) // eslint-disable-line react-hooks/exhaustive-deps

  const messages = useMemo(
    () => (selectedConversationId ? messagesByConversation[selectedConversationId] || [] : []),
    [messagesByConversation, selectedConversationId]
  )

  useEffect(() => {
    if (!selectedConversationId) {
      lastRenderedMessageIdRef.current = null
      return
    }
    const lastMessageId = messages[messages.length - 1]?.id || null
    const previousLastMessageId = lastRenderedMessageIdRef.current
    lastRenderedMessageIdRef.current = lastMessageId
    if (!lastMessageId || loadingOlderMessages) return
    if (!previousLastMessageId || previousLastMessageId === lastMessageId) return
    if (isMessagesNearBottom(180)) scrollConversationToBottom('smooth')
  }, [isMessagesNearBottom, loadingOlderMessages, messages, scrollConversationToBottom, selectedConversationId])

  useEffect(() => {
    if (!selectedConversationId || typingUserIds.size === 0) return
    if (isMessagesNearBottom(220)) scrollConversationToBottom('smooth')
  }, [isMessagesNearBottom, scrollConversationToBottom, selectedConversationId, typingUserIds])

  const activeActionMessage = useMemo(
    () => (actionMenu ? messages.find((msg) => msg.id === actionMenu.messageId) || null : null),
    [actionMenu, messages]
  )

  const activeReactionMessage = useMemo(
    () => (reactionPicker ? messages.find((msg) => msg.id === reactionPicker.messageId) || null : null),
    [messages, reactionPicker]
  )

  useLayoutEffect(() => {
    if (!reactionPicker || !reactionPickerRef.current) return
    reactionPickerRef.current.style.left = `${reactionPicker.x}px`
    reactionPickerRef.current.style.top = `${reactionPicker.y}px`
  }, [reactionPicker])

  useEffect(() => {
    if (!reactionPicker || !reactionPickerRef.current) return
    const buttons = Array.from(reactionPickerRef.current.querySelectorAll('button')) as HTMLButtonElement[]
    if (buttons.length === 0) return
    const activeIndex = buttons.findIndex((btn) => btn.classList.contains(styles.reactionPickerActive))
    const focusIndex = activeIndex >= 0 ? activeIndex : 0
    buttons[focusIndex]?.focus()
  }, [reactionPicker])

  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    if (!token) return
    const password = searchTerm.trim()
    if (!password) {
      setHiddenSearchUnlockedIds(new Set())
      setLockedSearchUnlockedIds(new Set())
      return
    }

    const hiddenConversations = conversations.filter((conversation) => conversation.isHidden)
    const lockedConversations = conversations.filter((conversation) => conversation.isLocked)
    if (hiddenConversations.length === 0 && lockedConversations.length === 0) return

    let cancelled = false
    const timer = window.setTimeout(() => {
      Promise.all([
        Promise.all(
          hiddenConversations.map((conversation) =>
            verifyHiddenConversationAccess(conversation.id, password, { syncConversation: false })
              .then(() => conversation.id)
              .catch(() => null)
          )
        ),
        Promise.all(
          lockedConversations.map((conversation) =>
            verifyLockedConversationAccess(conversation.id, password)
              .then(() => conversation.id)
              .catch(() => null)
          )
        ),
      ]).then(([hiddenMatchedIds, lockedMatchedIds]) => {
        if (cancelled) return
        setHiddenSearchUnlockedIds(new Set(hiddenMatchedIds.filter((id): id is string => Boolean(id))))
        setLockedSearchUnlockedIds(new Set(lockedMatchedIds.filter((id): id is string => Boolean(id))))
      })
    }, 260)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [conversations, searchTerm, token, verifyHiddenConversationAccess, verifyLockedConversationAccess])

  const selectedConversationMembers = useMemo(
    () => new Map((selectedConversation?.members || []).map((member) => [member.userId, member])),
    [selectedConversation]
  )

  const resolveConversationActor = useCallback(
    (userId: number, fallbackName?: string | null, fallbackAvatar?: string | null) => {
      const member = selectedConversationMembers.get(userId)
      if (member) {
        return {
          name: member.fullName || fallbackName || `Người dùng #${userId}`,
          avatarUrl: member.avatarUrl || fallbackAvatar || null,
        }
      }

      if (user?.id === userId) {
        return {
          name: user.fullName || 'Bạn',
          avatarUrl: user.avatarUrl || null,
        }
      }

      return {
        name: fallbackName || `Người dùng #${userId}`,
        avatarUrl: fallbackAvatar || null,
      }
    },
    [selectedConversationMembers, user?.avatarUrl, user?.fullName, user?.id]
  )

  const getConversationActivityTime = (conversation: Conversation) => {
    const raw = conversation.lastMessage?.createdAt || conversation.lastMessage?.updatedAt || conversation.updatedAt || null
    const value = raw ? new Date(raw).getTime() : 0
    return Number.isNaN(value) ? 0 : value
  }

  const getMessageReadLabel = useCallback(
    (message: ChatMessage) => {
      if (!selectedConversation || message.senderId !== user?.id) return null

      const readByIds = new Set((message.readBy || []).map((item) => Number(item.userId)))
      if (readByIds.size > 0) {
        const otherMembers = selectedConversation.members.filter((member) => member.userId !== user.id)
        const names = otherMembers
          .filter((member) => readByIds.has(Number(member.userId)))
          .map((member) => member.fullName)
        if (selectedConversation.type === 'direct') return names.length ? '✓✓ Seen' : message.status === 'delivered' ? '✓✓ Delivered' : '✓ Sent'
        if (names.length > 0) return names.length === 1 ? '✓✓ Seen' : `✓✓ Seen by ${names.length}`
      }

      const sentAt = new Date(message.createdAt).getTime()
      if (Number.isNaN(sentAt)) return '✓ Sent'

      const otherMembers = selectedConversation.members.filter((member) => member.userId !== user.id)
      const seenCount = otherMembers.filter((member) => {
        if (!member.lastReadAt) return false
        const readAt = new Date(member.lastReadAt).getTime()
        return !Number.isNaN(readAt) && readAt >= sentAt
      }).length

      if (seenCount === 0) return message.status === 'delivered' ? '✓✓ Delivered' : '✓ Sent'
      if (selectedConversation.type === 'direct' || seenCount >= otherMembers.length) return '✓✓ Seen'
      return `✓✓ Seen by ${seenCount}`
    },
    [selectedConversation, user?.id]
  )

  useEffect(() => {
    reloadFriendMap().catch(() => undefined)
  }, [reloadFriendMap])

  const filteredConversations = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    const items = conversations.filter((conversation) => {
      const name = getConversationDisplayName(conversation, user?.id).toLowerCase()
      const searchable = [name, conversation.name || '', conversation.id].join(' ').toLowerCase()
      if (conversation.isHidden && !q) return false
      if (conversation.isHidden) return hiddenSearchUnlockedIds.has(conversation.id)
      if (conversation.isLocked && lockedSearchUnlockedIds.has(conversation.id)) return true
      if (!q) return true
      return searchable.includes(q)
    })

    return [...items].sort((a, b) => {
      if (Boolean(a.isPinned) !== Boolean(b.isPinned)) return Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned))
      return getConversationActivityTime(b) - getConversationActivityTime(a)
    })
  }, [conversations, hiddenSearchUnlockedIds, lockedSearchUnlockedIds, searchTerm, user?.id])

  const callTargetId = useMemo(() => {
    if (!selectedConversation || !user?.id) return null
    const directTarget = selectedConversation.members.find((m) => m.userId !== user.id)
    return directTarget?.userId || null
  }, [selectedConversation, user?.id])

  const callTargets = useMemo(() => {
    if (!selectedConversation || !user?.id) return []
    return selectedConversation.members.map((m) => m.userId).filter((id) => id !== user.id)
  }, [selectedConversation, user?.id])

  const checkUserPresence = useCallback(async (targetUserId: number) => {
    const socket = getSocket()
    if (!socket || !targetUserId) {
      return { userId: targetUserId, online: false, lastActiveAt: null as string | null }
    }

    return await new Promise<{ userId: number; online: boolean; lastActiveAt: string | null }>((resolve) => {
      let settled = false
      const fallback = window.setTimeout(() => {
        if (settled) return
        settled = true
        resolve({ userId: targetUserId, online: false, lastActiveAt: null })
      }, 1200)

      socket.emit('presence:check', { userId: targetUserId }, (payload: { userId?: number; online?: boolean; lastActiveAt?: string | null }) => {
        if (settled) return
        settled = true
        window.clearTimeout(fallback)
        resolve({
          userId: Number(payload?.userId || targetUserId),
          online: Boolean(payload?.online),
          lastActiveAt: payload?.lastActiveAt || null,
        })
      })
    })
  }, [])

  // Ghi lịch sử cuộc gọi — chỉ phía người khởi tạo ghi để tránh trùng bản ghi.
  const logCall = useCallback((status: 'completed' | 'missed' | 'rejected' | 'no_answer' | 'cancelled' | 'failed') => {
    const meta = callMetaRef.current
    if (!meta || !token || callLoggedRef.current) return
    if (Number(user?.id || 0) !== meta.initiatorId) return
    callLoggedRef.current = true
    const endedAt = Date.now()
    const durationSec = meta.answeredAt
      ? Math.max(0, Math.round((endedAt - meta.answeredAt) / 1000))
      : Math.max(0, Math.round((endedAt - meta.startedAt) / 1000))
      api.createCall(token, {
      conversationId: meta.conversationId,
      initiatorId: meta.initiatorId,
      participantIds: meta.participantIds,
      callSessionId: meta.callSessionId,
      participantStatuses: meta.participantIds.map((participantId) => ({
        userId: participantId,
        joinedAt: meta.answeredAt || meta.startedAt,
        leftAt: endedAt,
        durationSec,
        role: participantId === meta.initiatorId ? 'caller' : (meta.mode === 'group' ? 'member' : 'receiver'),
      })),
      callType: meta.callType,
      mode: meta.mode,
      status,
      startedAt: meta.startedAt,
      answeredAt: meta.answeredAt,
      endedAt,
      durationSec,
      withName: meta.withName,
    }).then(() => reloadCallHistory()).catch(() => undefined)
  }, [reloadCallHistory, token, user?.id])

  // Giữ cửa sổ lỗi hiển thị ngắn rồi tự dọn để người dùng kịp đọc lý do.
  const scheduleClearCall = useCallback((delayMs = 4000) => {
    if (clearCallTimerRef.current) window.clearTimeout(clearCallTimerRef.current)
    clearCallTimerRef.current = window.setTimeout(() => {
      setActiveCall(null)
      setCallState('idle')
      setCallStatus(null)
      setCallSeconds(0)
      setCallAnswered(false)
      setRingingStartedAt(null)
      setGlobalCallErrorMessage(null)
      callMetaRef.current = null
    }, delayMs)
  }, [setGlobalCallErrorMessage])

  const updateRemoteMedia = useCallback((userId: number, patch: { micMuted?: boolean; cameraOff?: boolean }) => {
    if (!userId) return
    setRemoteMediaState((prev) => ({ ...prev, [userId]: { ...prev[userId], ...patch } }))
  }, [])

  useEffect(() => {
    if (!activeCall || callAnswered || !ringingStartedAt) return

    const timeoutLimit = activeCall.mode === 'group' ? GROUP_CALL_RING_TIMEOUT_MS : CALL_RING_TIMEOUT_MS
    const timeoutMs = timeoutLimit - (Date.now() - ringingStartedAt)
    const conversationId = selectedConversationId

    const autoEnd = () => {
      const socket = getSocket()
      if (socket && conversationId) {
        socket.emit('call:end', { conversationId, mode: activeCall.mode, callType: activeCall.type, reason: 'timeout' })
      }
      closeCallResources()
      logCall('no_answer')
      setCallState('no_answer')
      addLocalCallHistory(activeCall.mode === 'group' ? 'Cuộc gọi nhóm đã bị hủy' : 'Không có phản hồi')
      setGlobalCallErrorMessage(activeCall.mode === 'group' ? 'Không ai tham gia cuộc gọi' : 'Không có phản hồi')
      setCallStatus('Không có phản hồi')
      clearIncomingCall()
      setRingingStartedAt(null)
      scheduleClearCall()
    }

    if (timeoutMs <= 0) {
      autoEnd()
      return
    }

    const timer = window.setTimeout(autoEnd, timeoutMs)
    return () => window.clearTimeout(timer)
  }, [activeCall, addLocalCallHistory, callAnswered, clearIncomingCall, logCall, ringingStartedAt, scheduleClearCall, selectedConversationId, setGlobalCallErrorMessage])

  const directPeer = useMemo(() => {
    if (!selectedConversation || !user?.id) return null
    if (selectedConversation.type !== 'direct') return null
    const member = selectedConversation.members.find((m) => m.userId !== user.id)
    if (!member) return null
    return {
      id: member.userId,
      name: member.fullName,
      username: member.username || null,
      online: Boolean(member.online),
      lastActiveAt: member.lastActiveAt || null,
      avatarUrl: member.avatarUrl || null,
    }
  }, [selectedConversation, user?.id])

  const directPeerActivityLabel = useMemo(() => {
    if (!directPeer) return ''
    if (directPeer.online) return 'Đang hoạt động'
    if (!directPeer.lastActiveAt) return 'Ngoại tuyến'
    const minutes = Math.max(1, Math.round((Date.now() - new Date(directPeer.lastActiveAt).getTime()) / 60000))
    if (!Number.isFinite(minutes)) return 'Ngoại tuyến'
    return minutes < 60 ? `Hoạt động ${minutes} phút trước` : `Hoạt động ${Math.round(minutes / 60)} giờ trước`
  }, [directPeer])

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

  const canLeaveGroup = Boolean(selectedGroup && myGroupMember)
  const canLeaderLeaveGroup = Boolean(selectedGroup && selectedGroup.members.some((member) => Number(member.userId) !== Number(user?.id)))

  const groupInviteCandidates = useMemo(() => {
    if (!selectedGroup) return []
    const existingIds = new Set(selectedGroup.members.map((member) => member.userId))
    return Object.values(friendMap)
      .filter((friend) => friend.status === 'accepted')
      .filter((friend) => !existingIds.has(friend.id))
  }, [friendMap, selectedGroup])

  const createGroupInviteCandidates = useMemo(
    () => Object.values(friendMap).filter((friend) => friend.status === 'accepted'),
    [friendMap]
  )

  const filteredGroupInviteCandidates = useMemo(() => {
    const q = groupSearchKeyword.trim().toLowerCase()
    if (!q) return groupInviteCandidates
    return groupInviteCandidates.filter((friend) =>
      [friend.fullName, friend.username || '', friend.email || '', friend.phone || '', String(friend.id)].join(' ').toLowerCase().includes(q)
    )
  }, [groupInviteCandidates, groupSearchKeyword])

  const filteredCreateGroupInviteCandidates = useMemo(() => {
    const q = groupSearchKeyword.trim().toLowerCase()
    if (!q) return createGroupInviteCandidates
    return createGroupInviteCandidates.filter((friend) =>
      [friend.fullName, friend.username || '', friend.email || '', friend.phone || '', String(friend.id)].join(' ').toLowerCase().includes(q)
    )
  }, [createGroupInviteCandidates, groupSearchKeyword])

  const pinnedMessageIds = useMemo(() => new Set((selectedConversation?.pinnedMessageIds || []).map((item) => String(item))), [selectedConversation])
  const pinnedMessages = useMemo(() => {
    if (!selectedConversationId || pinnedMessageIds.size === 0) return []
    const byId = new Map<string, ChatMessage>()
    for (const item of selectedConversation?.pinnedMessages || []) {
      if (pinnedMessageIds.has(item.id)) byId.set(item.id, item)
    }
    for (const item of messagesByConversation[selectedConversationId] || []) {
      if (pinnedMessageIds.has(item.id)) byId.set(item.id, item)
    }
    return (selectedConversation?.pinnedMessageIds || [])
      .map((messageId) => byId.get(String(messageId)))
      .filter((item): item is ChatMessage => Boolean(item))
  }, [messagesByConversation, pinnedMessageIds, selectedConversation, selectedConversationId])
  const pinnedMessageMap = useMemo(() => new Map(pinnedMessages.map((item) => [item.id, item])), [pinnedMessages])

  const getPinnedMessagePreview = useCallback((item: ChatMessage | null | undefined) => {
    if (!item) return 'Đang tải nội dung tin nhắn đã ghim'
    if (item.isDeleted || (item.meta && (item.meta as Record<string, unknown>).recalled)) return 'Tin nhắn đã được thu hồi'
    if (item.text?.trim()) return item.text.trim()
    if (item.fileName?.trim()) return item.fileName.trim()
    if (item.type === 'image') return 'Ảnh'
    if (item.type === 'video') return 'Video'
    if (item.type === 'audio') return 'Tin nhắn âm thanh'
    if (item.type === 'file') return 'Tệp đính kèm'
    if (item.type === 'sticker') return 'Sticker'
    if (item.type === 'call-history') return 'Lịch sử cuộc gọi'
    return 'Tin nhắn đã ghim'
  }, [])

  const jumpToMessage = useCallback(async (messageId: string) => {
    const escapedId = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(messageId) : messageId.replace(/"/g, '\\"')
    let target = messagesWrapRef.current?.querySelector<HTMLElement>(`[data-message-id="${escapedId}"]`)
    if (!target && token && selectedConversationId) {
      const result = await loadChatMessages(token, selectedConversationId, 100).catch(() => null)
      if (result?.messages?.length) {
        setMessages(selectedConversationId, result.messages)
        await new Promise((resolve) => window.setTimeout(resolve, 0))
        target = messagesWrapRef.current?.querySelector<HTMLElement>(`[data-message-id="${escapedId}"]`)
      }
    }
    if (!target) {
      setChatNotice('Tin nhắn đã ghim chưa có trong phần lịch sử đang tải hoặc đã bị xóa.')
      return
    }
    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    target.classList.add(styles.messageRowHighlighted)
    window.setTimeout(() => target.classList.remove(styles.messageRowHighlighted), 1400)
  }, [selectedConversationId, setMessages, token])

  const chatPanelThemeClass = useMemo(() => {
    const themeColor = selectedConversationUiPrefs.themeColor ?? selectedConversation?.themeColor
    const backgroundUrl = selectedConversationUiPrefs.backgroundUrl ?? selectedConversation?.backgroundUrl
    if (!themeColor && !backgroundUrl) return ''
    const safeKey = [themeColor || 'default', backgroundUrl || ''].join('|').replace(/[^a-z0-9_-]/gi, '_').slice(0, 120)
    return `chat-panel-theme-${safeKey}`
  }, [selectedConversation?.backgroundUrl, selectedConversation?.themeColor, selectedConversationUiPrefs.backgroundUrl, selectedConversationUiPrefs.themeColor])

  const chatPanelThemeStyle = useMemo(() => {
    const themeColor = selectedConversationUiPrefs.themeColor ?? selectedConversation?.themeColor
    const backgroundUrl = selectedConversationUiPrefs.backgroundUrl ?? selectedConversation?.backgroundUrl
    if (!themeColor && !backgroundUrl) return ''
    const rules: string[] = []
    if (themeColor) {
      rules.push(`--chat-primary: ${themeColor};`)
      rules.push(`--chat-mine: linear-gradient(135deg, color-mix(in srgb, ${themeColor} 88%, #ffffff) 0%, ${themeColor} 100%);`)
    }
    if (backgroundUrl) {
      rules.push(`--conversation-bg-image: url("${backgroundUrl.replace(/"/g, '\\"')}");`)
    }
    return `.${chatPanelThemeClass} { ${rules.join(' ')} }`
  }, [chatPanelThemeClass, selectedConversation?.backgroundUrl, selectedConversation?.themeColor, selectedConversationUiPrefs.backgroundUrl, selectedConversationUiPrefs.themeColor])

  const directPeerFriendship = directPeer ? friendMap[directPeer.id] : null
  const isDirectPeerFriend = Boolean(directPeerFriendship && directPeerFriendship.status === 'accepted')
  const isDirectPeerPending = Boolean(directPeerFriendship && directPeerFriendship.status === 'pending')
  const isDirectPeerRequestedByMe = Boolean(directPeerFriendship?.requestedByMe)

  useEffect(() => {
    setRightPanelSection('overview')
    setMessageSearchKeyword('')
    setPendingUnlockError(null)
    setPendingUnlockPassword('')
  }, [selectedConversationId])

  const handleToggleConversationPin = async () => {
    if (!token || !selectedConversation) return
    try {
      await api.pinConversation(token, selectedConversation.id, !selectedConversation.isPinned)
      await refreshConversations()
      const title = selectedConversation.isPinned ? 'Đã bỏ ghim hội thoại' : 'Đã ghim hội thoại'
      setChatNotice(title)
      toast({ title })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể cập nhật ghim hội thoại.'
      setChatNotice(message)
      toast({ title: 'Không thể cập nhật ghim hội thoại', description: message, variant: 'destructive' })
    }
  }

  const handleToggleConversationMute = async () => {
    if (!token || !selectedConversation) return
    if (!selectedConversation.isMuted) {
      setMuteDialogOpen(true)
      return
    }

    try {
      await api.muteConversation(token, selectedConversation.id, false)
      await refreshConversations()
      setChatNotice('Đã bật thông báo.')
      toast({ title: 'Đã bật thông báo' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể cập nhật thông báo.'
      setChatNotice(message)
      toast({ title: 'Không thể cập nhật thông báo', description: message, variant: 'destructive' })
    }
  }

  const handleApplyConversationMute = async (durationSeconds: MuteOptionValue) => {
    if (!token || !selectedConversation) return
    const mutedUntil = durationSeconds ? new Date(Date.now() + durationSeconds * 1000).toISOString() : null
    await api.muteConversation(token, selectedConversation.id, true, mutedUntil)
    await refreshConversations()
    setChatNotice('Đã tắt thông báo hội thoại.')
    toast({ title: 'Đã tắt thông báo hội thoại' })
  }

  const updateLocalConversationUiPrefs = useCallback((conversationId: string, prefs: Partial<ConversationUiPrefs>) => {
    setConversationUiPrefs((current) => ({
      ...current,
      [conversationId]: {
        ...current[conversationId],
        ...prefs,
      },
    }))
  }, [])

  const handleSetLargeText = useCallback(
    (largeText: boolean) => {
      if (!selectedConversation) return
      updateLocalConversationUiPrefs(selectedConversation.id, { largeText })
    },
    [selectedConversation, updateLocalConversationUiPrefs]
  )

  const handleSetRoundBubbles = useCallback(
    (roundBubbles: boolean) => {
      if (!selectedConversation) return
      updateLocalConversationUiPrefs(selectedConversation.id, { roundBubbles })
    },
    [selectedConversation, updateLocalConversationUiPrefs]
  )

  const handleUpdateConversationPreferences = async (payload: {
    backgroundUrl?: string | null
    themeColor?: string | null
    autoDeleteAfterSeconds?: number | null
    hidden?: boolean
    locked?: boolean
    hiddenPassword?: string | null
    lockedPassword?: string | null
  }) => {
    if (!token || !selectedConversation) return
    try {
      const response = await api.updateConversationPreferences(token, selectedConversation.id, payload)
      setConversations(conversations.map((item) => (item.id === selectedConversation.id ? response.conversation : item)))
      if (payload.backgroundUrl !== undefined || payload.themeColor !== undefined) {
        updateLocalConversationUiPrefs(selectedConversation.id, {
          ...(payload.backgroundUrl !== undefined ? { backgroundUrl: payload.backgroundUrl } : {}),
          ...(payload.themeColor !== undefined ? { themeColor: payload.themeColor } : {}),
        })
      }
      await refreshConversations()
      let successMessage = 'Đã cập nhật thiết lập hội thoại.'
      if (payload.hidden) {
        successMessage = 'Đã ẩn hội thoại.'
      } else if (payload.hidden === false) {
        successMessage = 'Đã bỏ ẩn hội thoại.'
      } else if (payload.locked === false) {
        setPendingLockedConversationId((current) => (current === selectedConversation.id ? null : current))
        successMessage = 'Đã mở khóa hội thoại.'
      } else if (payload.locked) {
        successMessage = 'Đã khóa hội thoại.'
      } else if (payload.autoDeleteAfterSeconds !== undefined) {
        successMessage = 'Đã cập nhật thời hạn tự động xóa tin nhắn.'
      } else if (payload.backgroundUrl !== undefined || payload.themeColor !== undefined) {
        successMessage = 'Đã cập nhật tùy biến hội thoại.'
      }
      setChatNotice(successMessage)
      toast({ title: successMessage })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể cập nhật thiết lập hội thoại.'
      setChatNotice(message)
      toast({ title: 'Không thể cập nhật thiết lập hội thoại', description: message, variant: 'destructive' })
    }
  }

  const handleUpdateNickname = async (memberId: number) => {
    if (!selectedConversation) return
    const member = selectedConversation.members.find((item) => item.userId === memberId)
    if (!member) return
    setNicknameDialog({
      memberId,
      name: member.fullName,
      avatarUrl: member.avatarUrl,
      currentValue: member.nickname || '',
    })
  }

  const handleSubmitNickname = async (nextNickname: string) => {
    if (!token || !selectedConversation || !nicknameDialog) return
    try {
      await api.updateConversationNickname(token, selectedConversation.id, nicknameDialog.memberId, nextNickname.trim() || null)
      await refreshConversations()
      const message = nextNickname.trim() ? 'Đã cập nhật biệt danh.' : 'Đã xóa biệt danh.'
      setChatNotice(message)
      toast({ title: message })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể cập nhật biệt danh.'
      setChatNotice(message)
      toast({ title: 'Không thể cập nhật biệt danh', description: message, variant: 'destructive' })
      throw error
    }
  }

  const handleUpdateGroupProfile = async (payload: { name: string; avatarUrl?: string | null }) => {
    if (!token || !selectedGroup || !canAddMembers) return
    try {
      await api.updateGroupProfile(token, selectedGroup.id, { name: payload.name, avatarUrl: payload.avatarUrl ?? selectedGroup.avatarUrl ?? null })
      await refreshConversations()
      setChatNotice('Đã cập nhật tên nhóm.')
      toast({ title: 'Đã cập nhật tên nhóm' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể cập nhật tên nhóm.'
      setChatNotice(message)
      toast({ title: 'Không thể cập nhật tên nhóm', description: message, variant: 'destructive' })
      throw error
    }
  }

  const handleUpdateGroupAvatar = () => {
    if (!selectedGroup || !canAddMembers) return
    setGroupAvatarDialogOpen(true)
  }

  const handleSubmitGroupAvatar = async ({ dataUrl }: { dataUrl: string }) => {
    if (!token || !selectedGroup || !canAddMembers) return
    try {
      await api.updateGroupProfile(token, selectedGroup.id, {
        name: selectedGroup.name || 'Nhóm chat',
        avatarUrl: dataUrl,
      })
      await refreshConversations()
      setChatNotice('Đã cập nhật ảnh nhóm.')
      toast({ title: 'Đã cập nhật ảnh nhóm' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể cập nhật ảnh nhóm.'
      setChatNotice(message)
      toast({ title: 'Không thể cập nhật ảnh nhóm', description: message, variant: 'destructive' })
      throw error
    }
  }

  const handleOpenHideConversation = (mode: 'hide' | 'unhide' = 'hide') => {
    if (!selectedConversation) return
    setHideDialogMode(mode)
    setHideDialogOpen(true)
  }

  const handleSubmitHideConversation = async (pin: string) => {
    if (!pin.trim()) {
      throw new Error(hideDialogMode === 'unhide' ? 'Vui lòng nhập mã để bỏ ẩn hội thoại.' : 'Vui lòng nhập mã để ẩn hội thoại.')
    }
    await handleUpdateConversationPreferences({
      hidden: hideDialogMode !== 'unhide',
      hiddenPassword: pin.trim(),
    })
  }

  const handleOpenLockConversation = () => {
    if (!selectedConversation) return
    setLockDialogOpen(true)
  }

  const handleSubmitLockConversation = async (pin: string) => {
    if (!pin.trim()) {
      throw new Error('Vui lòng nhập mã PIN để khóa hội thoại.')
    }
    await handleUpdateConversationPreferences({
      locked: true,
      lockedPassword: pin.trim(),
    })
  }

  const handleSubmitAutoDelete = async (seconds: number | null) => {
    await handleUpdateConversationPreferences({ autoDeleteAfterSeconds: seconds })
  }

  const handleOpenReportConversation = () => {
    if (!selectedConversation) return
    const targetType = selectedConversation.type === 'group' ? 'group' : 'user'
    const targetId = selectedConversation.type === 'group' ? selectedConversation.id : directPeer?.id
    if (!targetId) return
    setReportDialog({
      targetType,
      targetId,
      title: selectedConversation.type === 'group' ? 'Báo cáo nhóm' : 'Báo cáo người dùng',
    })
  }

  const handleReportMessage = (message: ChatMessage) => {
    setReportDialog({
      targetType: 'message',
      targetId: message.id,
      title: 'Báo cáo tin nhắn',
    })
  }

  const handleSubmitReport = async (payload: { reason: string; details?: string }) => {
    if (!token || !reportDialog) return
    await api.submitReport(token, {
      targetType: reportDialog.targetType === 'group' ? 'message' : reportDialog.targetType,
      targetId: reportDialog.targetId,
      reason: payload.reason,
      details: payload.details,
    })
    toast({ title: 'Đã gửi báo cáo', description: 'Báo cáo sẽ được gửi đến quản trị viên để xem xét.' })
  }

  const handleBlockPeer = async () => {
    if (!token || !directPeer) return
    setConfirmModal({
      title: `Chặn ${directPeer.name}?`,
      description: 'Hai bên sẽ không thể gửi tin nhắn trực tiếp trong hội thoại này.',
      confirmLabel: 'Chặn',
      onConfirm: async () => {
        try {
          await api.blockUser(token, directPeer.id)
          setIsDirectPeerBlocked(true)
          setChatNotice(`Đã chặn ${directPeer.name}.`)
          toast({ title: `Đã chặn ${directPeer.name}` })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Không thể chặn người dùng.'
          setChatNotice(message)
          toast({ title: 'Không thể chặn người dùng', description: message, variant: 'destructive' })
          throw error
        }
      },
    })
  }

  const handleUnblockPeer = async () => {
    if (!token || !directPeer) return
    setConfirmModal({
      title: `Bỏ chặn ${directPeer.name}?`,
      description: 'Hai bên sẽ có thể nhắn tin lại trong hội thoại trực tiếp.',
      confirmLabel: 'Bỏ chặn',
      destructive: false,
      onConfirm: async () => {
        try {
          await api.unblockUser(token, directPeer.id)
          setIsDirectPeerBlocked(false)
          setChatNotice(`Đã bỏ chặn ${directPeer.name}.`)
          toast({ title: `Đã bỏ chặn ${directPeer.name}` })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Không thể bỏ chặn người dùng.'
          setChatNotice(message)
          toast({ title: 'Không thể bỏ chặn người dùng', description: message, variant: 'destructive' })
          throw error
        }
      },
    })
  }

  useEffect(() => {
    if (!token || !directPeer) {
      setIsDirectPeerBlocked(false)
      return
    }

    api.isUserBlocked(token, directPeer.id)
      .then((result) => setIsDirectPeerBlocked(Boolean(result.blocked)))
      .catch(() => setIsDirectPeerBlocked(false))
  }, [directPeer, token])

  const stopRingtoneLegacy = useCallback(() => {
    const ringtone = ringtoneRef.current
    if (!ringtone) return
    window.clearInterval(ringtone.intervalId)
    ringtone.context.close().catch(() => undefined)
    ringtoneRef.current = null
  }, [])

  const startRingtoneLegacy = useCallback(
    (tone: 'incoming' | 'outgoing') => {
      if (!callSettings.sound || ringtoneRef.current) return
      const AudioContextClass = window.AudioContext
      if (!AudioContextClass) return
      const context = new AudioContextClass()
      const playPulse = () => {
        const oscillator = context.createOscillator()
        const gain = context.createGain()
        oscillator.type = tone === 'incoming' ? 'sine' : 'triangle'
        oscillator.frequency.value = tone === 'incoming' ? 880 : 520
        gain.gain.setValueAtTime(0.0001, context.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.09, context.currentTime + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.34)
        oscillator.connect(gain)
        gain.connect(context.destination)
        oscillator.start()
        oscillator.stop(context.currentTime + 0.36)
      }
      playPulse()
      const intervalId = window.setInterval(playPulse, tone === 'incoming' ? 1450 : 1900)
      ringtoneRef.current = { context, intervalId }
    },
    [callSettings.sound]
  )

  const addLocalCallHistoryLegacy = useCallback(
    (text: string, conversationId = selectedConversationId || '') => {
      if (!conversationId || !user?.id) return
      const systemMessage: ChatMessage = {
        id: `local-call-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        conversationId,
        senderId: user.id,
        senderName: user.fullName || 'Bạn',
        senderAvatar: user.avatarUrl || null,
        type: 'call-history',
        text,
        mediaUrl: null,
        meta: { system: true, callHistory: true },
        reactionCount: 0,
        viewerReaction: null,
        createdAt: new Date().toISOString(),
      }
      appendMessage(conversationId, systemMessage)
      scrollConversationToBottom('smooth')
    },
    [appendMessage, scrollConversationToBottom, selectedConversationId, user?.avatarUrl, user?.fullName, user?.id]
  )

  const syncLocalStreamState = (stream: MediaStream | null) => {
    localStreamRef.current = stream
    callSession.localStream = stream
    setLocalStreamState(stream ? new MediaStream(stream.getTracks()) : null)
  }

  const ensureLocalStream = async (callType: 'voice' | 'video') => {
    const existing = localStreamRef.current
    if (existing) {
      if (callType === 'video' && !mutedCam && existing.getVideoTracks().length === 0) {
        try {
          const videoStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
          const [videoTrack] = videoStream.getVideoTracks()
          if (videoTrack) {
            existing.addTrack(videoTrack)
            cameraTrackRef.current = videoTrack
            setCameraAvailable(true)
            callLog('Camera enabled', { userId: user?.id, source: 'ensureLocalStream' })
            syncLocalStreamState(existing)
          }
        } catch {
          setCameraAvailable(false)
        }
      }
      if (callType === 'video' && !mutedCam) {
        existing.getVideoTracks().forEach((track) => {
          track.enabled = true
        })
        syncLocalStreamState(existing)
      }
      return existing
    }
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 48000,
        },
        video: callType === 'video',
      })
      setCameraAvailable(callType === 'video' ? stream.getVideoTracks().length > 0 : true)
      cameraTrackRef.current = stream.getVideoTracks()[0] || null
    } catch (error) {
      const denied = error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError')
      if (callType !== 'video' || denied) {
        if (denied) {
          setGlobalMicDenied(true)
          toast({ title: 'Chưa được cấp quyền micro/camera', description: 'Hãy cho phép truy cập trong trình duyệt để thực hiện cuộc gọi.', variant: 'destructive' })
        }
        throw error
      }
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1, sampleRate: 48000 },
        video: false,
      })
      setCameraAvailable(false)
      setChatNotice('Không tìm thấy camera trên thiết bị này. Bạn vẫn có thể tham gia bằng âm thanh.')
      toast({ title: 'Không tìm thấy camera trên thiết bị này', description: 'Bạn vẫn có thể tham gia bằng âm thanh.' })
    }
    setGlobalMicDenied(false)
    if (callSettings.autoMuteOnJoin) {
      stream.getAudioTracks().forEach((track) => {
        track.enabled = false
      })
      setMutedMic(true)
    }
    if (callSettings.autoCameraOffOnJoin || callType === 'voice') {
      stream.getVideoTracks().forEach((track) => {
        track.enabled = false
      })
      setMutedCam(callType === 'video' && callSettings.autoCameraOffOnJoin)
    } else if (callType === 'video') {
      stream.getVideoTracks().forEach((track) => {
        track.enabled = true
      })
      setMutedCam(false)
    }
    syncLocalStreamState(stream)
    callLog('Local media acquired', {
      userId: user?.id,
      callType,
      audioTracks: stream.getAudioTracks().length,
      videoTracks: stream.getVideoTracks().length,
    })
    return stream
  }

  const renegotiatePeer = async (targetUserId: number, conversationIdOverride?: string | null) => {
    const socket = getSocket()
    const pc = peersRef.current.get(targetUserId)
    const convId = conversationIdOverride || useCallStore.getState().activeCall?.conversationId || selectedConversationId
    if (!socket || !pc || !convId || negotiationLocksRef.current.has(targetUserId)) return
    negotiationLocksRef.current.add(targetUserId)
    try {
      const offer = await pc.createOffer({ iceRestart: pc.iceConnectionState === 'failed' })
      await pc.setLocalDescription(offer)
      socket.emit('call:offer', {
        targetUserId,
        conversationId: convId,
        callType: useCallStore.getState().activeCall?.type || lastCallTypeRef.current,
        offer: { type: offer.type, sdp: offer.sdp },
        renegotiate: true,
      })
      callLog('Peer renegotiation offer sent', { targetUserId, conversationId: convId })
    } catch (error) {
      console.warn(CALL_LOG_PREFIX, 'Peer renegotiation failed', { targetUserId, error })
    } finally {
      negotiationLocksRef.current.delete(targetUserId)
    }
  }

  const renegotiateAllPeers = async (conversationIdOverride?: string | null) => {
    await Promise.all([...peersRef.current.keys()].map((targetUserId) => renegotiatePeer(targetUserId, conversationIdOverride)))
  }

  const buildPeerConnection = async (targetUserId: number, callType: 'voice' | 'video', conversationIdOverride?: string | null) => {
    const socket = getSocket()
    const convId = conversationIdOverride || selectedConversationId
    if (!socket || !convId) return null

    const existingPeer = peersRef.current.get(targetUserId)
    if (existingPeer && existingPeer.signalingState !== 'closed') return existingPeer

    const pc = new RTCPeerConnection(RTC_CONFIG)
    const localStream = await ensureLocalStream(callType)

    localStream.getTracks().forEach((track) => {
      if (!pc.getSenders().some((sender) => sender.track === track)) {
        pc.addTrack(track, localStream)
        callLog('Track added', { targetUserId, kind: track.kind, trackId: track.id })
      }
    })

    pc.ontrack = (event) => {
      const [stream] = event.streams
      if (!stream) return
      setJoinedCallUserIds((prev) => (prev.includes(targetUserId) ? prev : [...prev, targetUserId]))
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
        conversationId: convId,
        candidate: event.candidate.toJSON(),
      })
    }

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState
      callLog('Peer ICE state', { targetUserId, state })
      if (state === 'failed' || state === 'disconnected') {
        // Mất kết nối tạm thời: hiện trạng thái "đang kết nối lại" và thử khôi phục.
        if (useCallStore.getState().callAnswered) setCallState('connecting')
        if (state === 'failed') {
          pc.restartIce()
          void renegotiatePeer(targetUserId, convId)
        }
      } else if (state === 'connected' || state === 'completed') {
        if (useCallStore.getState().callAnswered) setCallState('connected')
      }
    }

    pc.onconnectionstatechange = () => {
      callLog('Peer connection state', { targetUserId, state: pc.connectionState })
      if (pc.connectionState === 'failed') {
        void renegotiatePeer(targetUserId, convId)
      }
    }

    peersRef.current.set(targetUserId, pc)
    return pc
  }

  const flushPendingCandidates = async (targetUserId: number) => {
    const peer = peersRef.current.get(targetUserId)
    if (!peer) return
    const pending = pendingCandidatesRef.current.get(targetUserId) || []
    pendingCandidatesRef.current.delete(targetUserId)
    for (const candidate of pending) {
      try {
        await peer.addIceCandidate(new RTCIceCandidate(candidate))
      } catch {
        // ignore stale candidates
      }
    }
  }

  const closeCallResources = () => {
    resetCallSession()
    screenShareTrackRef.current?.stop()
    screenShareTrackRef.current = null
    cameraTrackRef.current = null
    localStreamRef.current = null
    setLocalStreamState(null)
    setRemoteStreams([])
    setJoinedCallUserIds([])
    setRemoteMediaState({})
    setSpeakingUserIds([])
    setMutedCam(false)
    setMutedMic(false)
    setJitsiCallUrl(null)
    useCallStore.getState().setScreenSharing(false)
    useCallStore.getState().setConnectionQuality('unknown')
    stopRingtone()
  }

  const handleRequestFriend = async () => {
    if (!token || !directPeer) return
    setPendingFriendRequestTo((prev) => ({ ...prev, [directPeer.id]: true }))
    try {
      await api.requestFriend(token, directPeer.id)
      setChatNotice('Đã gửi lời mời kết bạn. Hãy chờ đối phương chấp nhận để nhắn không giới hạn.')
      await reloadFriendMap()
    } catch (error) {
      const msg = error instanceof ApiError ? error.message : ''
      if (msg.includes('Already') || msg.includes('already')) {
        await reloadFriendMap()
        setChatNotice('Đã gửi lời mời kết bạn trước đó rồi.')
      } else if (error instanceof Error) {
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
      setChatNotice('Đã chấp nhận lời mời kết bạn. Hãy gửi lời chào đến người bạn mới của bạn!')
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
      await refreshConversations()
      handleOpenConversation(created.conversation.id)
      setShowNewMessageModal(false)
      setNewMessageKeyword('')
      setSearchUsersResult([])
    } catch (error) {
      if (error instanceof Error) {
        setChatNotice(error.message)
      }
    }
  }

  const handleOpenNotificationConversation = (conversationId: string | null | undefined, notificationId?: number | string) => {
    if (notificationId !== undefined) {
      setNotifications((current) => current.map((item) => String(item.id) === String(notificationId) ? { ...item, is_read: 1 } : item))
      if (token) api.readNotification(token, notificationId).catch(() => undefined)
    }
    if (conversationId) {
      handleOpenConversation(String(conversationId))
    }
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

  const handleCreateGroupConversation = async () => {
    if (!token || !groupName.trim() || groupMemberIds.length === 0 || creatingGroup) return

    setCreatingGroup(true)
    try {
      const created = await api.createGroupConversation(token, {
        name: groupName.trim(),
        memberIds: groupMemberIds,
      })
      await refreshConversations()
      handleOpenConversation(created.conversation.id)
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
    setConfirmModal({
      title: 'Giải tán nhóm?',
      description: 'Hành động này sẽ xóa nhóm chat và không thể hoàn tác.',
      confirmLabel: 'Xóa',
      onConfirm: async () => {
        setGroupActionBusyId('dissolve-group')
        try {
          await api.dissolveGroupConversation(token, selectedGroup.id)
          await refreshConversations()
          setChatNotice('Đã giải tán nhóm chat.')
          toast({ title: 'Đã giải tán nhóm chat' })
          const fallback = conversations.find((item) => item.id !== selectedGroup.id)
          if (fallback) {
            handleOpenConversation(fallback.id)
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Không thể giải tán nhóm.'
          setChatNotice(message)
          toast({ title: 'Không thể giải tán nhóm', description: message, variant: 'destructive' })
          throw error
        } finally {
          setGroupActionBusyId(null)
        }
      },
    })
  }

  const handleLeaveGroup = async () => {
    if (!token || !selectedGroup || !canLeaveGroup) return
    if (myGroupRole === 'leader' && !canLeaderLeaveGroup) {
      setChatNotice('Nhóm cần có thành viên khác trước khi trưởng nhóm rời đi.')
      setRightPanelSection('manage')
      return
    }

    setConfirmModal({
      title: 'Rời nhóm?',
      description: 'Bạn sẽ không còn nhận tin nhắn mới từ nhóm này sau khi rời đi.',
      confirmLabel: 'Rời nhóm',
      onConfirm: async () => {
        setGroupActionBusyId('leave-group')
        try {
          await api.leaveGroupConversation(token, selectedGroup.id)
          await refreshConversations()
          const message =
            myGroupRole === 'leader'
              ? 'Bạn đã rời nhóm. Quyền trưởng nhóm đã tự động chuyển cho phó nhóm.'
              : 'Bạn đã rời nhóm chat.'
          setChatNotice(message)
          toast({ title: message })

          const fallback = conversations.find((item) => item.id !== selectedGroup.id)
          if (fallback) {
            handleOpenConversation(fallback.id)
          } else {
            await refreshConversations()
            const refreshed = useChatStore.getState().conversations
            if (refreshed.length > 0) {
              handleOpenConversation(refreshed[0].id)
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Không thể rời nhóm lúc này.'
          setChatNotice(message)
          toast({ title: 'Không thể rời nhóm', description: message, variant: 'destructive' })
          throw error
        } finally {
          setGroupActionBusyId(null)
        }
      },
    })
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
    const previousScrollTop = messagesWrapRef.current?.scrollTop || 0

    try {
      const response = await api.listMessages(token, selectedConversationId, {
        limit: 20,
        beforeId,
        q: messageSearchKeyword.trim() || undefined,
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
        messagesWrapRef.current.scrollTop = previousScrollTop + (newScrollHeight - previousScrollHeight)
      })
    } catch (error) {
      console.error('Không thể tải tin nhắn cũ hơn', error)
    } finally {
      setLoadingOlderMessages(false)
    }
  }

  const decrementMessageAllowance = useCallback(() => {
    if (!selectedConversationId) return

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
  }, [selectedConversationId])

  const clearAttachmentDraft = useCallback(() => {
    setAttachmentDraft((current) => {
      if (current?.previewUrl) {
        URL.revokeObjectURL(current.previewUrl)
      }
      return null
    })
  }, [])

  const handleSend = async () => {
    if ((!message.trim() && !attachmentDraft) || !token || !selectedConversationId || sendingMessageRef.current) return

    sendingMessageRef.current = true
    setIsSendingMessage(true)
    setBusyUploading(Boolean(attachmentDraft))
    try {
      const trimmedMessage = message.trim()
      const response = attachmentDraft
        ? await (async () => {
            const uploadFile = await compressImageFile(attachmentDraft.file)
            const base64Data = await fileToBase64(uploadFile)
            const upload = await api.uploadMessageBase64(token, selectedConversationId, {
              fileName: uploadFile.name,
              contentType: uploadFile.type || 'application/octet-stream',
              base64Data,
            })

            if (!upload.mediaUrl) {
              throw new Error('Tải tệp lên thất bại, không nhận được đường dẫn file.')
            }

            return api.sendMessagePayload(token, selectedConversationId, {
              type: attachmentDraft.type,
              text: trimmedMessage || undefined,
              mediaUrl: upload.mediaUrl,
              fileName: uploadFile.name,
              mimeType: uploadFile.type || 'application/octet-stream',
              fileSize: uploadFile.size,
            })
          })()
        : await api.sendMessage(token, selectedConversationId, trimmedMessage)
      upsertMessage(selectedConversationId, response.message)
      handleComposerMessageChange('')
      stopComposerTyping(selectedConversationId)
      clearAttachmentDraft()
      setChatNotice(null)
      setShowEmojiPanel(false)
      setShowStickerPanel(false)
      decrementMessageAllowance()
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
      setBusyUploading(false)
    }
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

    const fileType = mapTypeFromFile(file)
    const previewUrl = fileType === 'image' || fileType === 'video' ? URL.createObjectURL(file) : null

    setAttachmentDraft((current) => {
      if (current?.previewUrl) {
        URL.revokeObjectURL(current.previewUrl)
      }
      return {
        file,
        type: fileType,
        previewUrl,
      }
    })
    setChatNotice(null)
    setComposerMenuOpen(false)
    event.target.value = ''
  }
  const handleSendSticker = useCallback(
    async (sticker: string) => {
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
    },
    [selectedConversationId, setChatNotice, setMessageLimitByConversation, setShowStickerPanel, token, upsertMessage]
  )

  const handleReaction = async (chatMessage: ChatMessage, reaction: string) => {
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
      await refreshConversations()
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
      await refreshConversations()
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
    setConfirmModal({
      title: 'Xóa đoạn chat?',
      description: 'Toàn bộ tin nhắn sẽ bị xóa ở phía bạn. Hành động này không ảnh hưởng người khác.',
      confirmLabel: 'Xóa',
      onConfirm: async () => {
        setBusyActionId(`clear-${selectedConversationId}`)
        try {
          await api.clearConversationMessages(token, selectedConversationId)
          const refreshed = await loadChatMessages(token, selectedConversationId, 25)
          setMessages(selectedConversationId, refreshed.messages)
          setChatNotice('Đã xóa đoạn chat ở phía bạn.')
          toast({ title: 'Đã xóa đoạn chat ở phía bạn' })
        } catch (error) {
          console.error('Không thể xóa đoạn chat:', error)
          const message = error instanceof Error ? error.message : 'Không thể xóa đoạn chat.'
          setChatNotice(message)
          toast({ title: 'Không thể xóa đoạn chat', description: message, variant: 'destructive' })
          throw error
        } finally {
          setBusyActionId(null)
        }
      },
    })
  }

  const openMessageActions = (event: React.MouseEvent<HTMLElement>, messageId: string) => {
    event.preventDefault()
    event.stopPropagation()
    setReactionPicker(null)
    const rect = event.currentTarget.getBoundingClientRect()
    const menuWidth = 220
    const menuHeight = 320
    const preferredX = rect.left + rect.width / 2
    const x = Math.min(window.innerWidth - menuWidth - 12, Math.max(12, preferredX - menuWidth / 2))
    const y = rect.bottom + menuHeight + 12 > window.innerHeight
      ? Math.max(12, rect.top - menuHeight - 8)
      : Math.max(12, rect.bottom + 8)
    setActionMenu({
      messageId,
      x,
      y,
    })
  }

  const openReactionPicker = (event: React.MouseEvent<HTMLElement>, messageId: string) => {
    event.preventDefault()
    event.stopPropagation()

    if (reactionPicker?.messageId === messageId) {
      setReactionPicker(null)
      return
    }

    setActionMenu(null)

    const messageRow = event.currentTarget.closest(`[data-message-id="${messageId}"]`) as HTMLElement | null
    const bubble = messageRow?.querySelector('[data-message-bubble="true"]') as HTMLElement | null
    const anchorRect = bubble?.getBoundingClientRect() || event.currentTarget.getBoundingClientRect()
    const wrapRect = messagesWrapRef.current?.getBoundingClientRect() || { left: 0, right: window.innerWidth, top: 0, bottom: window.innerHeight }
    const pickerHeight = 40
    const pickerWidth = Math.min(wrapRect.right - wrapRect.left - 16, MESSAGE_REACTION_ICONS.length * 32 + 16)
    const preferredX = anchorRect.left + anchorRect.width / 2 - pickerWidth / 2
    const minX = wrapRect.left + 8
    const maxX = wrapRect.right - pickerWidth - 8
    const x = Math.min(maxX, Math.max(minX, preferredX))

    const spaceBelow = wrapRect.bottom - anchorRect.bottom
    const spaceAbove = anchorRect.top - wrapRect.top
    const placement = spaceBelow >= pickerHeight + 10 || spaceBelow >= spaceAbove ? 'below' : 'above'
    const preferredY = placement === 'below'
      ? anchorRect.bottom + 8
      : anchorRect.top - pickerHeight - 8
    const minY = wrapRect.top + 8
    const maxY = wrapRect.bottom - pickerHeight - 8
    const y = Math.min(maxY, Math.max(minY, preferredY))

    setReactionPicker({
      messageId,
      x,
      y,
      placement,
    })
  }

  const handleStartCall = async (callType: 'voice' | 'video') => {
    const socket = getSocket()
    if (!socket || !selectedConversationId || callTargets.length === 0) return
    const isGroupCall = selectedConversation?.type === 'group'
    if (callType === 'voice' && !callSettings.allowVoice) {
      toast({ title: 'Cuộc gọi thoại đang bị tắt trong cài đặt.', variant: 'destructive' })
      return
    }
    if (callType === 'video' && !callSettings.allowVideo) {
      toast({ title: 'Cuộc gọi video đang bị tắt trong cài đặt.', variant: 'destructive' })
      return
    }
    if (isGroupCall && !callSettings.allowGroup) {
      toast({ title: 'Cuộc gọi nhóm đang bị tắt trong cài đặt.', variant: 'destructive' })
      return
    }

    const activeCallTargets = [...callTargets]
    if (isGroupCall && activeCallTargets.length + 1 > GROUP_CALL_MAX_PARTICIPANTS) {
      toast({ title: `Cuộc gọi nhóm chỉ hỗ trợ tối đa ${GROUP_CALL_MAX_PARTICIPANTS} người.`, variant: 'destructive' })
      return
    }

    if (clearCallTimerRef.current) { window.clearTimeout(clearCallTimerRef.current); clearCallTimerRef.current = null }
    setGlobalCallErrorMessage(null)
    callLoggedRef.current = false
    lastCallTypeRef.current = callType
    const previewStartedAt = Date.now()
    const previewCallMode: 'private' | 'group' = isGroupCall ? 'group' : 'private'
    const previewWithName = selectedConversation ? getConversationDisplayName(selectedConversation, user?.id) : `Người dùng #${callTargetId}`
    const callSessionId = `${selectedConversationId}-${previewStartedAt}`
    const previewInitialParticipants = user?.id ? [user.id] : []
    callMetaRef.current = {
      initiatorId: Number(user?.id || 0),
      participantIds: [...previewInitialParticipants, ...activeCallTargets],
      callType,
      mode: previewCallMode,
      conversationId: selectedConversationId,
      callSessionId,
      startedAt: previewStartedAt,
      answeredAt: null,
      withName: previewWithName,
    }
    setCallState(isGroupCall ? 'ringing' : 'calling')
    startRingtone('outgoing')
    setCallStatus(isGroupCall ? 'Đang gọi nhóm...' : 'Đang gọi...')
    setCallAnswered(false)
    setRingingStartedAt(previewStartedAt)
    setCallSeconds(0)
    setActiveCall({
      type: callType,
      withName: previewWithName,
      startedAt: previewStartedAt,
      mode: previewCallMode,
      avatarUrl: selectedConversation?.avatarUrl || selectedConversation?.members.find((member) => member.userId === directPeer?.id)?.avatarUrl || null,
      conversationId: selectedConversationId,
      targetUserIds: [...activeCallTargets],
    })
    setCallMinimized(false)
    setJoinedCallUserIds(previewInitialParticipants)
    const presenceResults = await Promise.all(callTargets.map((targetUserId) => checkUserPresence(targetUserId)))
    const onlineCallTargets = presenceResults.filter((item) => item.online).map((item) => item.userId)
    // roomId Jitsi do server cấp phát (tái dùng phòng phiên đang diễn ra); dùng luôn làm
    // callSessionId cho tin active và lịch sử kết thúc để nút tham gia được dọn đúng phiên.
    const callRoomId = await acquireCallRoom(socket, selectedConversationId)
    callRoomIdRef.current = callRoomId

    try {
      await ensureLocalStream(callType)
      for (const targetUserId of (isGroupCall ? onlineCallTargets : activeCallTargets)) {
        const pc = await buildPeerConnection(targetUserId, callType)
        if (!pc) continue
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)

        socket.emit('call:offer', {
          targetUserId,
          conversationId: selectedConversationId,
          callType,
          offer: { type: offer.type, sdp: offer.sdp },
          roomId: callRoomId,
          platform: 'web',
        })
        socket.emit(selectedConversation?.type === 'group' ? 'group_call_started' : 'call_started', {
          targetUserId,
          conversationId: selectedConversationId,
          callType,
        })
      }
    } catch (error) {
      console.error('Không thể bắt đầu cuộc gọi:', error)
      closeCallResources()
      setCallState('failed')
      setGlobalCallErrorMessage('Không thể truy cập micro/camera để bắt đầu cuộc gọi')
      setCallStatus('Cuộc gọi thất bại')
      setActiveCall({
        type: callType,
        withName: selectedConversation ? getConversationDisplayName(selectedConversation, user?.id) : `Người dùng #${callTargetId}`,
        startedAt: Date.now(),
        mode: selectedConversation?.type === 'group' ? 'group' : 'private',
        avatarUrl: selectedConversation?.avatarUrl || null,
        conversationId: selectedConversationId,
        targetUserIds: [...activeCallTargets],
      })
      scheduleClearCall()
      return
    }

    const startedAt = Date.now()
    const callMode: 'private' | 'group' = isGroupCall ? 'group' : 'private'
    const withName = selectedConversation ? getConversationDisplayName(selectedConversation, user?.id) : `Người dùng #${callTargetId}`
    callMetaRef.current = {
      initiatorId: Number(user?.id || 0),
      participantIds: [...(user?.id ? [user.id] : []), ...activeCallTargets],
      callType,
      mode: callMode,
      conversationId: selectedConversationId,
      callSessionId: callMode === 'group' ? callRoomId : callSessionId,
      startedAt,
      answeredAt: null,
      withName,
    }
    setCallState(isGroupCall ? 'ringing' : 'calling')
    startRingtone('outgoing')
    setCallStatus(isGroupCall ? 'Đang gọi nhóm...' : 'Đang gọi...')
    setCallAnswered(false)
    setRingingStartedAt(Date.now())
    setCallSeconds(0)
    const initialParticipants = user?.id ? [user.id] : []
    setActiveCall({
      type: callType,
      withName,
      startedAt,
      mode: callMode,
      avatarUrl: selectedConversation?.avatarUrl || selectedConversation?.members.find((member) => member.userId === directPeer?.id)?.avatarUrl || null,
      conversationId: selectedConversationId,
      targetUserIds: [...activeCallTargets],
    })
    setCallMinimized(false)
    setJoinedCallUserIds(initialParticipants)
    socket.emit('join-conversation', selectedConversationId)
    socket.emit('conversation:join', { conversationId: selectedConversationId })
    socket.emit('call:join', {
      conversationId: selectedConversationId,
      callType,
      mode: callMode,
      micMuted: mutedMic,
      cameraOff: mutedCam || callType === 'voice' || localStreamRef.current?.getVideoTracks().length === 0,
    })
    
    if (activeCallTargets.length > 1) {
      socket.emit('call:participants', {
        conversationId: selectedConversationId,
        participantCount: 1 + activeCallTargets.length,
        participantIds: [...initialParticipants, ...activeCallTargets],
      })
    }
    if (token && callMode === 'group') {
      void api.sendMessagePayload(token, selectedConversationId, {
        type: 'call-history',
        text: `${callType === 'video' ? 'Cuộc gọi video nhóm' : 'Cuộc gọi thoại nhóm'} đang diễn ra`,
        meta: {
          system: true,
          callHistory: true,
          status: 'active',
          mode: 'group',
          callType,
          callSessionId: callRoomId,
          initiatorId: user?.id || 0,
          participantIds: [...initialParticipants, ...activeCallTargets],
          startedAt,
        },
      }).catch(() => undefined)
    }
  }

  const handleAcceptIncomingCall = async (callData?: IncomingCallState, audioOnly = false) => {
    const socket = getSocket()
    const call = callData || incomingCall
    if (!socket || !call) {
      clearIncomingCall()
      stopRingtone()
      setCallState('failed')
      setGlobalCallErrorMessage('Không thể kết nối cuộc gọi')
      setCallStatus('Cuộc gọi thất bại')
      return
    }

    const activeConversationId = call.conversationId || selectedConversationId
    if (!activeConversationId) {
      clearIncomingCall()
      stopRingtone()
      closeCallResources()
      setCallState('failed')
      setGlobalCallErrorMessage('Không tìm thấy cuộc trò chuyện cho cuộc gọi')
      setCallStatus('Cuộc gọi thất bại')
      return
    }
    const answeredAt = Date.now()
    const effectiveType: 'voice' | 'video' = audioOnly ? 'voice' : call.callType
    clearIncomingCall()
    stopRingtone()
    setCallState('connecting')
    setCallStatus('Đang kết nối')

    // Liên thông: cuộc gọi đến từ mobile (Jitsi) → mở meet.jit.si cùng phòng, báo lại bằng useJitsi.
    if (call.useJitsi && call.roomId) {
      const conv = conversations.find((c) => c.id === activeConversationId) || selectedConversation
      const isGroup = call.mode === 'group' || conv?.type === 'group'
      socket.emit('call:answer', {
        targetUserId: call.fromUserId,
        conversationId: activeConversationId,
        callType: 'video',
        mode: isGroup ? 'group' : 'private',
        roomId: call.roomId,
        useJitsi: true,
        answeredAt,
      })
      socket.emit('call:join', {
        conversationId: activeConversationId,
        callType: 'video',
        mode: isGroup ? 'group' : 'private',
        roomId: call.roomId,
        useJitsi: true,
      })
      setJitsiCallUrl(resolveJitsiUrl(call.roomId, user?.fullName || 'Bạn'))
      setCallState('connected')
      setCallStatus('Đã kết nối cuộc gọi video')
      toast({ title: 'Đang mở cuộc gọi video...' })
      return
    }

    // Open the right conversation if not already
    if (call.conversationId && selectedConversationId !== call.conversationId) {
      routeOpenConversation(call.conversationId)
    }

    if (!call.offer?.sdp) {
      closeCallResources()
      setCallState('failed')
      setGlobalCallErrorMessage('Không có dữ liệu kết nối cuộc gọi')
      setCallStatus('Cuộc gọi thất bại')
      return
    }

    callLoggedRef.current = false
    setGlobalCallErrorMessage(null)

    try {
      const pc = (await buildPeerConnection(call.fromUserId, effectiveType, activeConversationId)) || undefined
      if (!pc) return
      await pc.setRemoteDescription({
        type: (call.offer.type as RTCSdpType) || 'offer',
        sdp: call.offer.sdp,
      })
      await flushPendingCandidates(call.fromUserId)
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)

      socket.emit('call:answer', {
        targetUserId: call.fromUserId,
        conversationId: activeConversationId,
        answer: { type: answer.type, sdp: answer.sdp },
        answeredAt,
      })
    } catch (error) {
      console.error('Không thể chấp nhận cuộc gọi:', error)
      closeCallResources()
      setCallState('failed')
      setGlobalCallErrorMessage('Không thể truy cập micro/camera')
      setCallStatus('Cuộc gọi thất bại')
      return
    }

    const conv = conversations.find((c) => c.id === activeConversationId) || selectedConversation
    const isGroup = conv?.type === 'group'
    // Người nhận: initiator là người gọi → phía này KHÔNG ghi log (tránh trùng).
    callMetaRef.current = {
      initiatorId: Number(call.fromUserId || 0),
      participantIds: [...(user?.id ? [user.id] : []), call.fromUserId],
      callType: effectiveType,
      mode: isGroup ? 'group' : 'private',
      conversationId: activeConversationId,
      startedAt: answeredAt,
      answeredAt,
      withName: call.conversationName || call.fromUserName || (conv ? getConversationDisplayName(conv, user?.id) : `Người dùng #${call.fromUserId}`),
    }
    stopRingtone()
    setCallState('connected')
    setCallStatus('Đã kết nối')
    setCallAnswered(true)
    setRingingStartedAt(null)
    setCallSeconds(0)
    setActiveCall({
      type: effectiveType,
      withName: call.conversationName || call.fromUserName ||
        (conv ? getConversationDisplayName(conv, user?.id) : `Người dùng #${call.fromUserId}`),
      startedAt: answeredAt,
      mode: isGroup ? 'group' : 'private',
      avatarUrl: call.fromUserAvatar || conv?.avatarUrl || null,
      conversationId: activeConversationId,
      // Với nhóm: cho phép kết nối tới mọi thành viên khác (mesh) qua call:join/participants.
      targetUserIds: isGroup ? (conv?.members.map((m) => m.userId).filter((id) => id !== user?.id) || [call.fromUserId]) : [call.fromUserId],
    })
    setCallMinimized(false)
    const newJoinedIds = user?.id ? [user.id, call.fromUserId] : [call.fromUserId]
    setJoinedCallUserIds(newJoinedIds)
    socket.emit('join-conversation', activeConversationId)
    socket.emit('conversation:join', { conversationId: activeConversationId })
    socket.emit('call:join', {
      conversationId: activeConversationId,
      callType: effectiveType,
      mode: isGroup ? 'group' : 'private',
      micMuted: mutedMic,
      cameraOff: mutedCam || effectiveType === 'voice' || localStreamRef.current?.getVideoTracks().length === 0,
    })
    socket.emit(isGroup ? 'group_call_joined' : 'call_joined', {
      conversationId: activeConversationId,
      callType: effectiveType,
    })
    socket.emit('call:participants', {
      conversationId: activeConversationId,
      participantCount: newJoinedIds.length,
      participantIds: newJoinedIds,
    })
    clearIncomingCall()
  }

  const handleDeclineIncomingCall = () => {
    const socket = getSocket()
    if (!socket || !incomingCall) {
      clearIncomingCall()
      return
    }

    const activeConversationId = incomingCall.conversationId || selectedConversationId
    if (activeConversationId) {
      const decliningGroupCall = incomingCall.mode === 'group'
      if (!decliningGroupCall) {
        socket.emit('call:leave', {
          conversationId: activeConversationId,
        })
      }
      // Từ chối khác với kết thúc: báo riêng để người gọi hiển thị "Đã từ chối".
      socket.emit('call:reject', {
        targetUserId: incomingCall.fromUserId,
        conversationId: activeConversationId,
        reason: 'declined',
      })
    }

    clearIncomingCall()
    stopRingtone()
    setCallState('idle')
    setCallStatus(null)
    addLocalCallHistory(selectedConversation?.type === 'group' ? 'Bạn đã bỏ lỡ cuộc gọi nhóm' : 'Cuộc gọi đã bị từ chối', activeConversationId || undefined)
  }

  const handleJoinGroupCallFromMessage = async (chatMessage: ChatMessage) => {
    const socket = getSocket()
    const conversationId = chatMessage.conversationId || selectedConversationId
    const meta = (chatMessage.meta || {}) as Record<string, unknown>
    if (!socket || !conversationId || !user?.id) return
    if (activeCall?.conversationId === conversationId && callAnswered) {
      toast({ title: 'Bạn đang ở trong cuộc gọi này.' })
      return
    }
    const callSessionId = String(meta.callSessionId || '')
    if (callSessionId) {
      const isActive = await new Promise<boolean>((resolve) => {
        socket.emit('call:room:status', { conversationId, callSessionId }, (resp: unknown) => {
          resolve(Boolean((resp as { active?: boolean })?.active))
        })
        window.setTimeout(() => resolve(false), 2500)
      })
      if (!isActive) {
        setActiveGroupCallSessionIds((prev) => {
          const next = new Set(prev)
          next.delete(callSessionId)
          return next
        })
        toast({ title: 'Cuộc gọi nhóm đã kết thúc.' })
        return
      }
    }

    const conv = conversations.find((item) => item.id === conversationId) || selectedConversation
    const callType: 'voice' | 'video' = meta.callType === 'video' ? 'video' : 'voice'
    const startedAt = Date.now()
    try {
      await ensureLocalStream(callType)
    } catch (error) {
      console.error('Không thể tham gia cuộc gọi nhóm:', error)
      setGlobalCallErrorMessage('Không thể truy cập micro/camera')
      toast({ title: 'Không thể tham gia cuộc gọi', description: 'Hãy cấp quyền micro/camera rồi thử lại.', variant: 'destructive' })
      return
    }

    if (selectedConversationId !== conversationId) routeOpenConversation(conversationId)
    const peerIds = conv?.members.map((member) => member.userId).filter((id) => id !== user.id) || []
    callMetaRef.current = {
      initiatorId: Number(meta.initiatorId || 0),
      participantIds: [user.id, ...peerIds],
      callType,
      mode: 'group',
      conversationId,
      callSessionId: String(meta.callSessionId || ''),
      startedAt,
      answeredAt: startedAt,
      withName: conv ? getConversationDisplayName(conv, user.id) : 'Cuộc gọi nhóm',
    }
    setActiveCall({
      type: callType,
      withName: conv ? getConversationDisplayName(conv, user.id) : 'Cuộc gọi nhóm',
      startedAt,
      mode: 'group',
      avatarUrl: conv?.avatarUrl || null,
      conversationId,
      targetUserIds: peerIds,
    })
    setCallState('connected')
    setCallAnswered(true)
    setCallMinimized(false)
    setCallStatus('Đã tham gia cuộc gọi nhóm')
    setRingingStartedAt(null)
    setCallSeconds(0)
    setJoinedCallUserIds((prev) => Array.from(new Set([...prev, user.id])))
    socket.emit('join-conversation', conversationId)
    socket.emit('conversation:join', { conversationId })
    socket.emit('call:join', {
      conversationId,
      callType,
      mode: 'group',
      micMuted: mutedMic,
      cameraOff: mutedCam || callType === 'voice' || localStreamRef.current?.getVideoTracks().length === 0,
    })
    socket.emit('group_call_joined', { conversationId, callType })
  }

  const handleEndCall = () => {
    if (isEndingCallRef.current) return
    const socket = getSocket()
    if (!socket || !selectedConversationId) return
    isEndingCallRef.current = true
    
    const endingCall = activeCall
    const conversationId = endingCall?.conversationId || selectedConversationId
    if (endingCall?.mode === 'group') {
      socket.emit('group_call_left', {
        conversationId,
        callType: endingCall.type,
      })
    } else {
      socket.emit('call:end', {
        conversationId,
        callType: endingCall?.type,
        mode: endingCall?.mode,
      })
    }
    
    const finalStatus = callAnswered ? 'completed' : 'no_answer'
    logCall(finalStatus)
    closeCallResources()
    setCallState(callAnswered ? 'ended' : 'no_answer')
    setCallStatus(endingCall?.mode === 'group' ? 'Bạn đã rời cuộc gọi nhóm' : callAnswered ? 'Cuộc gọi đã kết thúc' : 'Không có phản hồi')
    clearIncomingCall()
    setGlobalCallErrorMessage(null)
    setActiveCall(null)
    setCallSeconds(0)
    setCallAnswered(false)
    setRingingStartedAt(null)
    callMetaRef.current = null
    window.setTimeout(() => {
      isEndingCallRef.current = false
    }, 500)
  }

  const handleToggleMic = () => {
    const nextMuted = !mutedMic
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted
    })
    setMutedMic(nextMuted)
    const socket = getSocket()
    if (socket && selectedConversationId) {
      // Luôn dùng participant_muted kèm cờ micMuted để các bên đồng bộ chính xác.
      socket.emit('participant_muted', {
        conversationId: selectedConversationId,
        micMuted: nextMuted,
      })
    }
  }

  const handleToggleCamera = async () => {
    if (activeCall?.type === 'voice') {
      toast({ title: 'Không tìm thấy camera trên thiết bị này.', variant: 'destructive' })
      return
    }
    const nextMuted = !mutedCam
    const stream = localStreamRef.current || await ensureLocalStream('video')

    if (nextMuted) {
      stream.getVideoTracks().forEach((track) => {
        track.enabled = false
        stream.removeTrack(track)
        track.stop()
        callLog('Track removed', { kind: 'video', trackId: track.id })
      })
      cameraTrackRef.current = null
      peersRef.current.forEach((pc) => {
        pc.getSenders()
          .filter((sender) => sender.track?.kind === 'video')
          .forEach((sender) => {
            sender.replaceTrack(null).catch(() => undefined)
          })
      })
      setMutedCam(true)
      syncLocalStreamState(stream)
      callLog('Camera disabled', { userId: user?.id })
    } else {
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        const [videoTrack] = videoStream.getVideoTracks()
        if (!videoTrack) throw new Error('No video track')
        videoTrack.enabled = true
        stream.addTrack(videoTrack)
        cameraTrackRef.current = videoTrack
        peersRef.current.forEach((pc) => {
          const sender = pc.getSenders().find((item) => item.track?.kind === 'video' || item.track === null)
          if (sender) {
            sender.replaceTrack(videoTrack).catch(() => undefined)
          } else {
            pc.addTrack(videoTrack, stream)
            callLog('Track added', { kind: 'video', trackId: videoTrack.id })
          }
        })
        setCameraAvailable(true)
        setMutedCam(false)
        syncLocalStreamState(stream)
        callLog('Camera enabled', { userId: user?.id, trackId: videoTrack.id })
      } catch (error) {
        setCameraAvailable(false)
        toast({ title: 'Không thể bật camera', description: 'Hãy kiểm tra quyền camera hoặc thiết bị đang được ứng dụng khác sử dụng.', variant: 'destructive' })
        return
      }
    }
    const socket = getSocket()
    if (socket && selectedConversationId) {
      socket.emit(nextMuted ? 'participant_camera_off' : 'participant_camera_on', {
        conversationId: selectedConversationId,
      })
      socket.emit('participant_updated', {
        conversationId: selectedConversationId,
        cameraOff: nextMuted,
      })
    }
    await renegotiateAllPeers(selectedConversationId)
  }

  // Mời thêm thành viên nhóm đang chưa tham gia (đổ chuông lại tới họ).
  const handleAddMembers = async () => {
    const socket = getSocket()
    const active = useCallStore.getState().activeCall
    if (!socket || !active || active.mode !== 'group' || !active.conversationId) return
    const conv = conversations.find((c) => c.id === active.conversationId)
    if (!conv) return
    const joined = new Set(useCallStore.getState().callParticipants.filter((p) => p.status === 'joined').map((p) => p.userId))
    const absent = conv.members.map((m) => m.userId).filter((id) => id !== user?.id && !joined.has(id) && !peersRef.current.has(id))
    if (!absent.length) {
      toast({ title: 'Tất cả thành viên đã ở trong cuộc gọi.' })
      return
    }
    if (joined.size + absent.length > GROUP_CALL_MAX_PARTICIPANTS) {
      toast({ title: `Cuộc gọi nhóm chỉ hỗ trợ tối đa ${GROUP_CALL_MAX_PARTICIPANTS} người.`, variant: 'destructive' })
      return
    }
    for (const targetUserId of absent) {
      try {
        const pc = await buildPeerConnection(targetUserId, active.type, active.conversationId)
        if (!pc) continue
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        socket.emit('call:offer', { targetUserId, conversationId: active.conversationId, callType: active.type, offer: { type: offer.type, sdp: offer.sdp } })
        socket.emit('group_call_started', { targetUserId, conversationId: active.conversationId, callType: active.type })
      } catch {
        // bỏ qua mời thất bại
      }
    }
    toast({ title: `Đã mời thêm ${absent.length} người vào cuộc gọi.` })
  }

  // Đăng ký callback cho AppLayout (cửa sổ cuộc gọi nằm ở AppLayout) khi trang đang mở.
  const addMembersRef = useRef<() => void>(() => {})
  const retryRef = useRef<() => void>(() => {})
  addMembersRef.current = () => { void handleAddMembers() }
  retryRef.current = () => {
    if (clearCallTimerRef.current) { window.clearTimeout(clearCallTimerRef.current); clearCallTimerRef.current = null }
    setGlobalCallErrorMessage(null)
    setActiveCall(null)
    setCallState('idle')
    void handleStartCall(lastCallTypeRef.current)
  }
  useEffect(() => {
    const addMembers = () => addMembersRef.current()
    const retry = () => retryRef.current()
    setGlobalAddMembersAction(addMembers)
    setGlobalRetryCallAction(retry)
    return () => {
      setGlobalAddMembersAction(null)
      setGlobalRetryCallAction(null)
    }
  }, [setGlobalAddMembersAction, setGlobalRetryCallAction])

  // Phát hiện "đang nói" cục bộ từ luồng âm thanh (cho cả local và remote).
  useEffect(() => {
    if (!activeCall || !callAnswered) {
      setSpeakingUserIds((prev) => (prev.length ? [] : prev))
      return
    }
    const sources: Array<{ id: number; stream: MediaStream }> = []
    if (user?.id && localStreamState) sources.push({ id: user.id, stream: localStreamState })
    remoteStreams.forEach((r) => sources.push({ id: r.userId, stream: r.stream }))
    const audible = sources.filter((s) => s.stream.getAudioTracks().length > 0)
    if (!audible.length) return
    const AudioCtx: typeof AudioContext | undefined = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const nodes = audible.map(({ id, stream }) => {
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      ctx.createMediaStreamSource(stream).connect(analyser)
      return { id, analyser, data: new Uint8Array(analyser.frequencyBinCount) }
    })
    let last: number[] = []
    const interval = window.setInterval(() => {
      const speaking: number[] = []
      nodes.forEach(({ id, analyser, data }) => {
        analyser.getByteFrequencyData(data)
        let sum = 0
        for (let i = 0; i < data.length; i++) sum += data[i]
        if (sum / data.length > 16) speaking.push(id)
      })
      if (speaking.length !== last.length || speaking.some((x, i) => x !== last[i])) {
        last = speaking
        setSpeakingUserIds(speaking)
      }
    }, 220)
    return () => {
      window.clearInterval(interval)
      ctx.close().catch(() => undefined)
    }
  }, [activeCall, callAnswered, localStreamState, remoteStreams, user?.id])

  useEffect(() => {
    return () => {
      closeCallResources()
    }
  }, [])

  // Đếm ngược thời gian còn lại cho cuộc gọi đến (chỉ hiển thị).
  useEffect(() => {
    if (!incomingCall) { setIncomingSecondsLeft(0); return }
    setIncomingSecondsLeft(Math.ceil(CALL_RING_TIMEOUT_MS / 1000))
    const id = window.setInterval(() => setIncomingSecondsLeft((s) => (s > 0 ? s - 1 : 0)), 1000)
    return () => window.clearInterval(id)
  }, [incomingCall])

  useEffect(() => {
    const closeMenu = () => {
      setActionMenu(null)
      setReactionPicker(null)
    }
    window.addEventListener('click', closeMenu)
    return () => window.removeEventListener('click', closeMenu)
  }, [])

  const selectedName = selectedConversation
    ? getConversationDisplayName(selectedConversation, user?.id)
    : 'Chọn cuộc trò chuyện'
  const initials = (user?.fullName?.[0] || 'U').toUpperCase()
  const formattedCallTime = `${String(Math.floor(callSeconds / 60)).padStart(2, '0')}:${String(callSeconds % 60).padStart(2, '0')}`
  const incomingConversation = incomingCall?.conversationId
    ? conversations.find((conversation) => conversation.id === incomingCall.conversationId) || selectedConversation
    : selectedConversation
  const incomingCaller = incomingConversation?.members.find((member) => member.userId === incomingCall?.fromUserId)
  const incomingCallName = incomingConversation?.type === 'group'
    ? getConversationDisplayName(incomingConversation, user?.id)
    : incomingCaller?.fullName || `Người dùng #${incomingCall?.fromUserId || ''}`
  const incomingCallAvatar = incomingConversation?.type === 'group'
    ? incomingConversation.avatarUrl
    : incomingCaller?.avatarUrl || null

  const callParticipantProfiles = useMemo(() => {
    if (!activeCall) return [] as CallParticipant[]

    const ids = new Set<number>()
    if (user?.id) ids.add(user.id)
    joinedCallUserIds.forEach((id) => ids.add(id))
    remoteStreams.forEach((item) => ids.add(item.userId))

    return Array.from(ids)
      .filter((id) => id > 0)
      .map((id) => {
        const member = selectedConversation?.members.find((item) => item.userId === id)
        const stream = remoteStreams.find((item) => item.userId === id)?.stream || (id === user?.id ? localStreamState : null)
        const isLocal = id === user?.id
        const remoteMedia = remoteMediaState[id] || {}
        const micMuted = isLocal ? mutedMic : Boolean(remoteMedia.micMuted)
        const cameraOff = activeCall.type === 'voice' || (isLocal ? mutedCam : Boolean(remoteMedia.cameraOff))
        const speaking = speakingUserIds.includes(id) && !micMuted
        if (member) {
          return {
            userId: id,
            name: member.fullName,
            avatarUrl: member.avatarUrl,
            role: member.role,
            status: joinedCallUserIds.includes(id) ? 'joined' as const : 'ringing' as const,
            micMuted,
            cameraOff,
            speaking,
            stream,
            isLocal,
          }
        }
        if (isLocal) {
          return {
            userId: id,
            name: user.fullName || 'Bạn',
            avatarUrl: user.avatarUrl || null,
            role: 'Bạn',
            status: 'joined' as const,
            micMuted: mutedMic,
            cameraOff: activeCall.type === 'voice' || mutedCam,
            speaking,
            stream: localStreamState,
            isLocal: true,
          }
        }
        return {
          userId: id,
          name: `Người dùng #${id}`,
          avatarUrl: null,
          status: joinedCallUserIds.includes(id) ? 'joined' as const : 'ringing' as const,
          micMuted,
          cameraOff,
          speaking,
          stream,
          isLocal: false,
        }
      })
  }, [activeCall, joinedCallUserIds, localStreamState, mutedCam, mutedMic, remoteMediaState, remoteStreams, selectedConversation, speakingUserIds, user?.avatarUrl, user?.fullName, user?.id])

  useEffect(() => { setGlobalCallParticipants(callParticipantProfiles) }, [callParticipantProfiles]) // eslint-disable-line react-hooks/exhaustive-deps

  const renderMessagePreview = (msg: ChatMessage) => {
    const renderRichMessageText = (text: string) => {
      const richTokenRegex = /(https?:\/\/[^\s]+|:[a-z-]+:)/g
      const parts = text.split(richTokenRegex)
      if (parts.length === 1) return text

      return parts.map((part, index) => {
        const iconToken = MESSAGE_ICON_TOKENS[part]
        if (iconToken) {
          return (
            <span key={`icon-${index}`} className={styles.inlineMessageIcon} title={iconToken.label} aria-label={iconToken.label}>
              <iconToken.Icon size={16} />
            </span>
          )
        }

        if (!/^https?:\/\//i.test(part)) {
          return <span key={`text-${index}`}>{part}</span>
        }

        const isSharedPostLink = /\/posts\/\d+(?:\?.*)?$/i.test(part)
        return (
          <a
            key={`link-${index}`}
            href={part}
            target="_blank"
            rel="noreferrer"
            className={styles.fileLink}
            title={isSharedPostLink ? 'Mở bài viết được chia sẻ' : 'Mở liên kết'}
          >
            {isSharedPostLink ? 'Xem bài viết được chia sẻ' : part}
          </a>
        )
      })
    }

    const recalled = Boolean(msg.meta && (msg.meta as Record<string, unknown>).recalled)
    const forwarded = Boolean(msg.meta && (msg.meta as Record<string, unknown>).forwarded)
    const forwardedTag = forwarded ? <small className={styles.forwardTag}>Đã chuyển tiếp</small> : null

    if (recalled) {
      return <p className={styles.recalledText}>Tin nhắn đã được thu hồi</p>
    }

    const sharedPost = msg.meta?.sharedPost as
      | {
          id?: number | string
          authorName?: string
          authorAvatar?: string | null
          content?: string
          mediaUrl?: string | null
          reactionCount?: number
          commentCount?: number
        }
      | undefined

    if (sharedPost) {
      return (
        <div className={styles.sharedPostMessage}>
          {msg.text ? <p className={styles.messageText}>{msg.text}</p> : null}
          <Link to={sharedPost.id ? `/posts/${sharedPost.id}` : '/feed'} className={styles.sharedPostCard}>
            <div className={styles.sharedPostAuthor}>
              {sharedPost.authorAvatar ? <img src={sharedPost.authorAvatar} alt={sharedPost.authorName || 'Tác giả'} /> : <span>{(sharedPost.authorName?.[0] || 'U').toUpperCase()}</span>}
              <b>{sharedPost.authorName || 'Người dùng ZChat'}</b>
            </div>
            {sharedPost.content ? <p>{sharedPost.content}</p> : <p>Bài viết gốc không còn khả dụng</p>}
            {sharedPost.mediaUrl ? <img src={sharedPost.mediaUrl} alt="Shared post" className={styles.sharedPostImage} loading="lazy" /> : null}
            <small>
              {Number(sharedPost.reactionCount || 0)} cảm xúc • {Number(sharedPost.commentCount || 0)} bình luận
            </small>
          </Link>
        </div>
      )
    }

    if (msg.type === 'image' && msg.mediaUrl) {
      return (
        <div className={styles.mediaWrap}>
          {forwardedTag}
          <button
            type="button"
            className={styles.imagePreviewButton}
            onClick={() => setMediaLightbox({ url: msg.mediaUrl!, alt: msg.fileName || 'Ảnh trong tin nhắn' })}
            aria-label="Xem ảnh"
          >
            <img
              src={msg.mediaUrl}
              alt={msg.fileName || 'image'}
              loading="lazy"
              onError={(event) => {
                event.currentTarget.style.display = 'none'
              }}
            />
          </button>
          {msg.text ? <p className={styles.messageText}>{renderRichMessageText(msg.text)}</p> : null}
        </div>
      )
    }

    if (msg.type === 'video' && msg.mediaUrl) {
      return (
        <div className={styles.mediaWrap}>
          {forwardedTag}
          <video controls src={msg.mediaUrl} />
          {msg.text ? <p className={styles.messageText}>{renderRichMessageText(msg.text)}</p> : null}
        </div>
      )
    }

    if (msg.type === 'audio' && msg.mediaUrl) {
      return (
        <div className={styles.mediaWrap}>
          {forwardedTag}
          <audio controls src={msg.mediaUrl} />
          {msg.text ? <p className={styles.messageText}>{renderRichMessageText(msg.text)}</p> : null}
        </div>
      )
    }

    if (msg.type === 'sticker') {
      const sticker = (msg.meta?.sticker as string) || msg.text || ':)'
      const stickerEmoji = STICKER_EMOJI_TOKENS[sticker]
      if (stickerEmoji) {
        return (
          <p className={styles.stickerBubble} title={stickerEmoji.label} aria-label={stickerEmoji.label}>
            <span className={styles.stickerMessageGlyph}>{stickerEmoji.emoji}</span>
          </p>
        )
      }
      const stickerIcon = STICKER_ICON_TOKENS[sticker]
      if (stickerIcon) {
        return (
          <p className={styles.stickerBubble} title={stickerIcon.label} aria-label={stickerIcon.label}>
            <stickerIcon.Icon size={34} />
          </p>
        )
      }
      return <p className={styles.stickerBubble}>{sticker}</p>
    }

    if (msg.mediaUrl) {
      return (
        <div className={styles.mediaWrap}>
          {forwardedTag}
          <a href={msg.mediaUrl} target="_blank" rel="noreferrer" className={styles.fileLink}>
            {msg.fileName || 'Mở tệp đính kèm'}
          </a>
          {(msg.mimeType || msg.fileSize) ? (
            <small className={styles.fileMeta}>
              {[msg.mimeType, msg.fileSize ? `${Math.max(1, Math.round(msg.fileSize / 1024))} KB` : null]
                .filter(Boolean)
                .join(' - ')}
            </small>
          ) : null}
          {msg.text ? <p className={styles.messageText}>{renderRichMessageText(msg.text)}</p> : null}
        </div>
      )
    }

    return (
      <div className={styles.messageText}>
        {forwarded ? <small className={styles.forwardTagInline}>[Đã chuyển tiếp] </small> : null}
        {msg.text ? renderRichMessageText(msg.text) : ''}
        {translatedMessages[msg.id] && (
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(0,0,0,0.1)' }}>
            <strong style={{ fontSize: '0.8em', color: 'var(--color-primary-dark)', display: 'block', marginBottom: 4 }}>
              <Languages size={12} style={{ display: 'inline', marginBottom: -2 }} /> Bản dịch AI:
            </strong>
            <p>{translatedMessages[msg.id]}</p>
          </div>
        )}
      </div>
    )
  }
  const activeRailTab = showCallHistoryDrawer ? 'calls' as const
    : showNotificationsDrawer ? 'notifications' as const
    : showNewMessageModal ? 'newMessage' as const
    : showCreateGroupModal ? 'createGroup' as const
    : 'messages' as const
  const filteredCallHistory = callHistory.filter((item) => {
    if (callHistoryFilter === 'all') return true
    if (callHistoryFilter === 'missed') return item.status === 'missed' || item.status === 'no_answer'
    if (callHistoryFilter === 'incoming') return item.initiatorId !== user?.id
    if (callHistoryFilter === 'outgoing') return item.initiatorId === user?.id
    return item.mode === 'group'
  })
  const formatCallDuration = (seconds: number) => {
    if (!seconds) return '0 giây'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return mins ? `${mins} phút ${secs}s` : `${secs}s`
  }
  const formatRelativeTime = (value: string) => {
    const diffSeconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000))
    if (diffSeconds < 60) return 'Vừa xong'
    const diffMinutes = Math.floor(diffSeconds / 60)
    if (diffMinutes < 60) return `${diffMinutes} phút trước`
    const diffHours = Math.floor(diffMinutes / 60)
    if (diffHours < 24) return `${diffHours} giờ trước`
    const diffDays = Math.floor(diffHours / 24)
    return diffDays < 7 ? `${diffDays} ngày trước` : new Date(value).toLocaleDateString('vi-VN')
  }
  return (
    <div className={styles.page}>
      <div className={`${styles.layout} ${isMobileViewport && mobileShowList ? styles.layoutShowList : ''} ${!showDetailsPanelDesktop ? styles.layoutNarrow : ''}`}>
        <MessagesSidebar
          initials={initials}
          userId={user?.id}
          conversations={filteredConversations}
          selectedConversationId={selectedConversationId}
          notifications={notifications}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          isLoadingConversations={isLoadingConversations}
          activeRailTab={activeRailTab}
          onOpenConversation={handleOpenConversation}
          onShowMessages={() => {
            setShowCallHistoryDrawer(false)
            setShowNotificationsDrawer(false)
            setShowNewMessageModal(false)
            setShowCreateGroupModal(false)
          }}
          onShowNotifications={() => {
            if (activeCall && callAnswered) setGlobalCallMinimized(true)
            setShowCallHistoryDrawer(false)
            setShowNotificationsDrawer(true)
            setShowNewMessageModal(false)
            setShowCreateGroupModal(false)
          }}
          onShowCalls={() => {
            if (activeCall && callAnswered) setGlobalCallMinimized(true)
            setShowCallHistoryDrawer(true)
            setShowNotificationsDrawer(false)
            setShowNewMessageModal(false)
            setShowCreateGroupModal(false)
            reloadCallHistory().catch(() => undefined)
          }}
          onShowNewMessage={() => {
            if (activeCall && callAnswered) setGlobalCallMinimized(true)
            setShowCallHistoryDrawer(false)
            setShowNewMessageModal(true)
            setShowNotificationsDrawer(false)
            setShowCreateGroupModal(false)
          }}
          onShowCreateGroup={() => {
            if (activeCall && callAnswered) setGlobalCallMinimized(true)
            setShowCallHistoryDrawer(false)
            setShowCreateGroupModal(true)
            setShowNotificationsDrawer(false)
            setShowNewMessageModal(false)
            setGroupName('')
            setGroupSearchKeyword('')
            setGroupMemberIds([])
          }}
        />

        {chatPanelThemeStyle ? <style>{chatPanelThemeStyle}</style> : null}
        <section
          className={[
            styles.chatPanel,
            chatPanelThemeClass,
            selectedConversationUiPrefs.largeText ? styles.chatPanelLargeText : '',
            selectedConversationUiPrefs.roundBubbles ? '' : styles.chatPanelSquareBubbles,
          ].filter(Boolean).join(' ')}
        >
          <header className={styles.chatHeader}>
            <button type="button" className={styles.backToListBtn} onClick={() => setMobileShowList(true)} aria-label="Quay lại danh sách">
              <ArrowLeft size={18} />
            </button>
            <div className={styles.chatIdentity}>
              <div className={styles.chatHeaderAvatar}>
                {selectedConversation?.avatarUrl || directPeer?.avatarUrl ? (
                  <img
                    src={selectedConversation?.avatarUrl || directPeer?.avatarUrl || ''}
                    alt={selectedName}
                    loading="lazy"
                    onError={(event) => {
                      event.currentTarget.style.display = 'none'
                    }}
                  />
                ) : null}
                <span>{(selectedName[0] || 'C').toUpperCase()}</span>
                {directPeer ? <i className={directPeer.online ? styles.presenceDotOnline : styles.presenceDotOffline} /> : null}
              </div>
              <div className={styles.chatIdentityText}>
                <h2>
                  {directPeer ? <Link to={`/profile/${directPeer.username || directPeer.id}`}>{selectedName}</Link> : selectedName}
                </h2>
                {directPeer?.username ? <p className={styles.chatUsername}>@{directPeer.username}</p> : null}
                <p>
                  {directPeer
                    ? isDirectPeerFriend
                      ? `Bạn bè • ${directPeerActivityLabel}`
                      : 'Chưa kết bạn • Giới hạn 3 tin nhắn'
                    : `${selectedConversation?.onlineCount || 0} thành viên online`}
                </p>
              </div>
            </div>
            <div className={styles.chatActions}>
              <button
                type="button"
                className={chatSummary ? styles.chatActionActive : undefined}
                onClick={handleSummarizeChat}
                disabled={isSummarizing || !selectedConversationId}
                data-tooltip="Summarize chat"
                data-tooltip-description="Create an AI summary"
                title="Tóm tắt đoạn chat (AI)"
                aria-label="Tóm tắt"
              >
                <Wand2 size={18} />
              </button>
              <button
                type="button"
                className={sentimentResult ? styles.chatActionActive : undefined}
                onClick={handleAnalyzeSentiment}
                disabled={isAnalyzingSentiment || !selectedConversationId}
                data-tooltip="Analyze sentiment"
                data-tooltip-description="Review conversation tone"
                title="Phân tích cảm xúc (AI)"
                aria-label="Phân tích cảm xúc"
              >
                <BrainCircuit size={18} />
              </button>
              <button type="button" onClick={() => handleStartCall('video')} disabled={callTargets.length === 0} title="Gọi video" aria-label="Gọi video">
                <Video size={18} />
              </button>
              <button type="button" onClick={() => handleStartCall('voice')} disabled={callTargets.length === 0} title="Gọi thoại" aria-label="Gọi thoại">
                <Phone size={18} />
              </button>
              <button type="button" onClick={() => setCallSettingsOpen(true)} title="Cài đặt cuộc gọi" aria-label="Cài đặt cuộc gọi">
                <Info size={16} />
              </button>
              <button
                type="button"
                className={showMessageFilters || messageSearchKeyword ? styles.chatActionActive : undefined}
                title="Tìm tin nhắn"
                aria-label="Tìm tin nhắn"
                disabled={!selectedConversation}
                data-tooltip="Search"
                data-tooltip-description="Find messages in this conversation"
                onClick={() => setShowMessageFilters((value) => !value)}
              >
                <Search size={16} />
              </button>
              <button
                type="button"
                title="Thêm người vào cuộc trò chuyện"
                aria-label="Thêm người vào cuộc trò chuyện"
                disabled={!selectedGroup || !canAddMembers}
                data-tooltip="Add Friend"
                data-tooltip-description="Add people to this conversation"
                onClick={() => {
                  setRightPanelSection('manage')
                  setShowSettingsDrawer(true)
                }}
              >
                <UserPlus size={16} />
              </button>
              <button
                type="button"
                title="Xem chi tiết cuộc trò chuyện"
                aria-label="Xem chi tiết cuộc trò chuyện"
                className={showDetailsPanelDesktop ? styles.chatActionActive : undefined}
                disabled={!selectedConversation}
                data-tooltip="Conversation Info"
                data-tooltip-description="Open custom chat features"
                onClick={() => {
                  if (window.innerWidth > 1180) {
                    setShowDetailsPanelDesktop(v => !v)
                  } else {
                    setRightPanelSection('overview')
                    setShowSettingsDrawer(true)
                  }
                }}
              >
                <Info size={16} />
              </button>
            </div>
          </header>

          {showMessageFilters ? (
            <form
              className={styles.messageFilters}
              onSubmit={(event) => {
                event.preventDefault()
                setMessageSearchKeyword(messageSearchDraft.trim())
              }}
            >
              <input
                value={messageSearchDraft}
                onChange={(event) => setMessageSearchDraft(event.target.value)}
                placeholder="Tìm theo nội dung tin nhắn"
                aria-label="Tìm theo nội dung tin nhắn"
              />
              <button type="submit">Tìm</button>
              {messageSearchKeyword ? (
                <button
                  type="button"
                  onClick={() => {
                    setMessageSearchDraft('')
                    setMessageSearchKeyword('')
                  }}
                >
                  Xóa tìm kiếm
                </button>
              ) : null}
            </form>
          ) : null}

          {selectedConversationId && messageLimitByConversation[selectedConversationId] ? (
            <div className={styles.limitBadge}>
              Còn {messageLimitByConversation[selectedConversationId]?.remaining ?? 0}/{messageLimitByConversation[selectedConversationId]?.total ?? 3} tin nhắn miễn phí trước khi cần kết bạn.
            </div>
          ) : null}

          {chatSummary && (
            <div className={`${styles.aiCard} ${chatSummaryCollapsed ? styles.aiCardCollapsed : ''}`}>
              <div className={styles.aiCardHead}>
                <span className={styles.aiCardTitle}>
                  <Sparkles size={12} /> Tóm tắt AI
                </span>
                <div className={styles.aiCardControls}>
                  <button
                    type="button"
                    className={styles.aiCardBtn}
                    title={chatSummaryCollapsed ? 'Mở rộng' : 'Thu gọn'}
                    onClick={() => setChatSummaryCollapsed(c => !c)}
                  >
                    <ChevronDown size={13} />
                  </button>
                  <button
                    type="button"
                    className={styles.aiCardBtn}
                    title="Đóng"
                    onClick={() => { setChatSummary(null); setChatSummaryCollapsed(false) }}
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>
              <div className={styles.aiCardBody}>{chatSummary}</div>
            </div>
          )}

          {sentimentResult && (
            <div
              className={`${styles.aiCard} ${sentimentCollapsed ? styles.aiCardCollapsed : ''}`}
              data-sentiment={sentimentResult.sentiment}
            >
              <div className={styles.aiCardHead}>
                <span className={styles.aiCardTitle}>
                  <BrainCircuit size={12} />
                  {sentimentResult.sentiment === 'positive' ? '✨ Tích cực' : sentimentResult.sentiment === 'negative' ? '🌧️ Tiêu cực' : '⚖️ Trung lập'}
                  <span className={styles.aiCardScore}>{Math.round(sentimentResult.score * 100)}%</span>
                </span>
                <div className={styles.aiCardControls}>
                  <button
                    type="button"
                    className={styles.aiCardBtn}
                    title={sentimentCollapsed ? 'Mở rộng' : 'Thu gọn'}
                    onClick={() => setSentimentCollapsed(c => !c)}
                  >
                    <ChevronDown size={13} />
                  </button>
                  <button
                    type="button"
                    className={styles.aiCardBtn}
                    title="Đóng"
                    onClick={() => { setSentimentResult(null); setSentimentCollapsed(false) }}
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>
              <div className={styles.aiCardBody}>
                <div className={styles.aiScoreBar}>
                  <div className={styles.aiScoreBarFill} style={{ width: `${sentimentResult.score * 100}%` }} />
                </div>
                {sentimentResult.emotions && sentimentResult.emotions.length > 0 && (
                  <div className={styles.aiEmotionTags}>
                    {sentimentResult.emotions.map((emo, idx) => (
                      <span key={idx} className={styles.aiEmotionTag}>{emo}</span>
                    ))}
                  </div>
                )}
                <p className={styles.aiDetail}>"{sentimentResult.detail}"</p>
              </div>
            </div>
          )}

          {selectedConversation?.pinnedMessageIds && selectedConversation.pinnedMessageIds.length > 0 ? (
            <div className={styles.pinnedBanner}>
              Đang ghim {selectedConversation.pinnedMessageIds.length} tin nhắn trong cuộc trò chuyện này.
            </div>
          ) : null}

          {selectedConversation?.pinnedMessageIds && selectedConversation.pinnedMessageIds.length > 0 ? (
            <div className={styles.pinnedQuickList}>
              {selectedConversation.pinnedMessageIds.map((messageId) => {
                const item = pinnedMessageMap.get(String(messageId))
                return (
                  <button key={String(messageId)} type="button" onClick={() => void jumpToMessage(String(messageId))}>
                    {getPinnedMessagePreview(item)}
                  </button>
                )
              })} {false && (
                <span>Tin nhắn đã ghim chưa nằm trong phần lịch sử đang tải.</span>
              )}
            </div>
          ) : null}

          {directPeer ? (
            <div className={styles.chatSocialBar}>
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
                  <button type="button" onClick={() => void handleAcceptIncomingCall()} title="Chấp nhận cuộc gọi" aria-label="Chấp nhận cuộc gọi">
                    Chấp nhận
                  </button>
                  <button type="button" onClick={handleDeclineIncomingCall} title="Từ chối cuộc gọi" aria-label="Từ chối cuộc gọi">
                    Từ chối
                  </button>
                </div>
              ) : null}
              <button type="button" className={styles.endCallBtn} onClick={handleEndCall} disabled={!activeCall && !incomingCall} title="Kết thúc cuộc gọi" aria-label="Kết thúc cuộc gọi">
                <PhoneOff size={14} />
                Kết thúc
              </button>
            </div>
          )}

          {!selectedConversationId ? (
            <div className={styles.noConversationPlaceholder}>
              <Send size={36} />
              <p>Chọn một cuộc trò chuyện để bắt đầu nhắn tin</p>
            </div>
          ) : (
            <MessageThread
              userId={user?.id}
              selectedConversation={selectedConversation}
              virtualSlice={virtualSlice}
              activeGroupCallSessionIds={activeGroupCallSessionIds}
              messagesWrapRef={messagesWrapRef}
              loadingOlderMessages={loadingOlderMessages || loadingMessages}
              typingUserIds={typingUserIds}
              pinnedMessageIds={pinnedMessageIds}
              reactionPickerMessageId={reactionPicker?.messageId || null}
              reactionPickerPlacement={reactionPicker?.placement || null}
              openReactionPicker={openReactionPicker}
              openMessageActions={openMessageActions}
              renderMessagePreview={renderMessagePreview}
              getMessageReadLabel={getMessageReadLabel}
              onJoinGroupCall={handleJoinGroupCallFromMessage}
              onLoadOlderMessages={loadOlderMessages}
              onScroll={(event) => {
                const element = event.currentTarget
                const fromBottom = element.scrollHeight - (element.scrollTop + element.clientHeight)
                setShowJumpToLatest(fromBottom > 260)
              }}
            />
          )}

          {replySuggestions.length > 0 && (
            <div className={styles.aiSuggestBar}>
              <span className={styles.aiSuggestLabel}><Sparkles size={12} /> Gợi ý:</span>
              <div className={styles.aiSuggestList}>
                {replySuggestions.map((suggestion, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={styles.aiSuggestBtn}
                  onClick={() => { handleComposerMessageChange(suggestion); setReplySuggestions([]) }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className={styles.aiCardBtn}
                title="Đóng gợi ý"
                onClick={() => setReplySuggestions([])}
              >
                <X size={13} />
              </button>
            </div>
          )}
          {selectedConversationId ? (
            <MessageComposer
              message={message}
              setMessage={handleComposerMessageChange}
              onStopTyping={stopComposerTyping}
              handleSend={handleSend}
              handleFileSelected={handleFileSelected}
              handlePickAttachment={handlePickAttachment}
              handlePickAttachmentType={handlePickAttachmentType}
              busyUploading={busyUploading}
              isSendingMessage={isSendingMessage}
              composerMenuOpen={composerMenuOpen}
              setComposerMenuOpen={setComposerMenuOpen}
              showEmojiPanel={showEmojiPanel}
              setShowEmojiPanel={setShowEmojiPanel}
              showStickerPanel={showStickerPanel}
              setShowStickerPanel={setShowStickerPanel}
              onSendSticker={handleSendSticker}
              attachmentDraft={attachmentDraft}
              onRemoveAttachment={clearAttachmentDraft}
              fileInputRef={fileInputRef}
              imageInputRef={imageInputRef}
              videoInputRef={videoInputRef}
              onSuggestReplies={handleSuggestReplies}
              isSuggesting={isSuggesting}
            />
          ) : null}

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
                      <span className={styles.listEntryIdentity}>
                        <span className={styles.listEntryAvatar}>{getAvatarInitial(item.name)}</span>
                        <span className={styles.listEntryMeta}>
                          <strong className={styles.listEntryTitle}>{item.name}</strong>
                          <small className={styles.listEntrySubtitle}>ID {item.id}</small>
                        </span>
                      </span>
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

          {showCallHistoryDrawer ? (
            <div className={styles.overlayBackdrop}>
              <div className={styles.overlayCard}>
                <h3>Lịch sử cuộc gọi</h3>
                <div className={styles.notifyActions}>
                  {(['all', 'missed', 'incoming', 'outgoing', 'group'] as const).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      className={callHistoryFilter === filter ? styles.notifyAcceptBtn : undefined}
                      onClick={() => setCallHistoryFilter(filter)}
                    >
                      {filter === 'all' ? 'Gần đây' : filter === 'missed' ? 'Nhỡ' : filter === 'incoming' ? 'Đến' : filter === 'outgoing' ? 'Đi' : 'Nhóm'}
                    </button>
                  ))}
                </div>
                <div className={styles.overlayList}>
                  {filteredCallHistory.map((item) => {
                    const outgoing = item.initiatorId === user?.id
                    const conv = conversations.find((conversation) => conversation.id === item.conversationId)
                    const title = conv ? getConversationDisplayName(conv, user?.id) : `Hội thoại #${item.conversationId}`
                    const statusLabel = item.status === 'completed'
                      ? 'Hoàn tất'
                      : item.status === 'missed' || item.status === 'no_answer'
                        ? 'Cuộc gọi nhỡ'
                        : item.status === 'rejected'
                          ? 'Đã từ chối'
                          : item.status === 'cancelled'
                            ? 'Đã hủy'
                            : 'Thất bại'
                    return (
                      <div key={item.id} className={styles.notifyCard}>
                        <button type="button" className={styles.notifyMainBtn} onClick={() => handleOpenConversation(item.conversationId)}>
                          <span className={styles.listEntryIdentity}>
                            <span className={styles.listEntryAvatar}>{item.callType === 'video' ? 'V' : 'P'}</span>
                            <span className={styles.listEntryMeta}>
                              <strong className={styles.listEntryTitle}>{title}</strong>
                              <span className={styles.listEntrySubtitle}>
                                {outgoing ? 'Gọi đi' : 'Gọi đến'} · {item.mode === 'group' ? 'Nhóm' : '1-1'} · {statusLabel}
                              </span>
                              <small className={styles.listEntrySubtitle}>
                                {new Date(item.createdAt || item.startedAt).toLocaleString('vi-VN')} · {formatCallDuration(item.durationSec || 0)}
                              </small>
                            </span>
                          </span>
                        </button>
                        <div className={styles.notifyActions}>
                          <button type="button" onClick={() => handleOpenConversation(item.conversationId)}>Mở chat</button>
                          <button type="button" onClick={() => {
                            handleOpenConversation(item.conversationId)
                            window.setTimeout(() => void handleStartCall('voice'), 0)
                          }}>Gọi lại</button>
                          <button type="button" onClick={() => {
                            handleOpenConversation(item.conversationId)
                            window.setTimeout(() => void handleStartCall('video'), 0)
                          }}>Video</button>
                        </div>
                      </div>
                    )
                  })}
                  {filteredCallHistory.length === 0 ? <p>Chưa có lịch sử cuộc gọi phù hợp.</p> : null}
                </div>
                <button type="button" className={styles.overlayCloseBtn} onClick={() => setShowCallHistoryDrawer(false)} title="Đóng" aria-label="Đóng">
                  Đóng
                </button>
              </div>
            </div>
          ) : null}

          {showNotificationsDrawer ? (
            <div className={styles.overlayBackdrop}>
              <div className={`${styles.overlayCard} ${styles.notificationsCenter}`}>
                <div className={styles.notificationsHeader}>
                  <h3>Thông báo <span>{notifications.length}</span></h3>
                  <div className={styles.notificationsHeaderActions}>
                    <button
                      type="button"
                      disabled={!notifications.some((item) => !item.is_read)}
                      onClick={() => {
                        setNotifications((current) => current.map((item) => ({ ...item, is_read: 1 })))
                        if (token) api.readAllNotifications(token).catch(() => undefined)
                      }}
                    >
                      Đánh dấu đã đọc
                    </button>
                    <button type="button" className={styles.notificationsCloseBtn} onClick={() => setShowNotificationsDrawer(false)} title="Đóng" aria-label="Đóng">
                      ×
                    </button>
                  </div>
                </div>
                <div className={`${styles.overlayList} ${styles.notificationsList}`}>
                  {notifications.map((item) => {
                    const meta = parseNotificationMeta(item)
                    const conversationId = meta?.conversationId
                    const canAccept = item.type === 'friend-request' && !item.is_read && Boolean(meta?.requesterId || meta?.friendshipId)
                    const isUnread = !item.is_read
                    const senderName = item.title?.replace(/^new message:?/i, '').trim() || item.title || 'ZChat'
                    const preview = item.body || 'Thông báo hệ thống'
                    return (
                      <div key={item.id} className={cn(styles.notifyCard, isUnread && styles.notifyCardUnread)}>
                        <button type="button" className={styles.notifyMainBtn} onClick={() => handleOpenNotificationConversation(conversationId, item.id)}>
                          <span className={styles.notifyAvatar}>{getAvatarInitial(senderName)}</span>
                          <span className={styles.notifyContent}>
                            <span className={styles.notifyTopLine}>
                              <strong>{senderName}</strong>
                              <small>{formatRelativeTime(item.created_at)}</small>
                            </span>
                            <span className={styles.notifyPreview}>{preview}</span>
                          </span>
                          {isUnread ? <span className={styles.notifyUnreadDot} aria-label="Chưa đọc" /> : null}
                          <span className={styles.notifyArrow} aria-hidden="true">→</span>
                        </button>
                        {canAccept ? (
                          <div className={styles.notifyActions}>
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
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                  {notifications.length === 0 ? <p>Hiện chưa có thông báo quan trọng.</p> : null}
                </div>
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
                        <span className={styles.listEntryIdentity}>
                          <span className={styles.listEntryAvatar}>{getAvatarInitial(getConversationDisplayName(conv, user?.id))}</span>
                          <span className={styles.listEntryMeta}>
                            <strong className={styles.listEntryTitle}>{getConversationDisplayName(conv, user?.id)}</strong>
                            <small className={styles.listEntrySubtitle}>ID {conv.id}</small>
                          </span>
                        </span>
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
                  {filteredCreateGroupInviteCandidates.map((friend) => {
                    const checked = groupMemberIds.includes(friend.id)
                    return (
                      <button key={friend.id} type="button" onClick={() => toggleGroupMember(friend.id)} title={`Chọn ${friend.fullName}`} aria-label={`Chọn ${friend.fullName}`}>
                        <span className={styles.listEntryIdentity}>
                          <span className={styles.listEntryAvatar}>{getAvatarInitial(friend.fullName)}</span>
                          <span className={styles.listEntryMeta}>
                            <strong className={styles.listEntryTitle}>{checked ? '✓ ' : ''}{friend.fullName}</strong>
                            <span className={styles.listEntrySubtitle}>{friend.username ? `@${friend.username}` : friend.email || friend.phone || `ID ${friend.id}`}</span>
                          </span>
                        </span>
                      </button>
                    )
                  })}
                  {acceptedFriends.length === 0 ? <p>Bạn chưa có bạn bè để tạo nhóm.</p> : null}
                  {acceptedFriends.length > 0 && filteredCreateGroupInviteCandidates.length === 0 ? <p>Không tìm thấy bạn bè phù hợp.</p> : null}
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

          {jitsiCallUrl ? (
            <section className={styles.jitsiCallWindow} aria-label="Cuộc gọi video đang diễn ra">
              <header className={styles.jitsiCallHeader}>
                <div>
                  <strong>Cuộc gọi video</strong>
                  <span>{callStatus || 'Đang kết nối'}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const socket = getSocket()
                    const conversationId = activeCall?.conversationId || selectedConversationId
                    if (socket && conversationId) socket.emit('call:leave', { conversationId, useJitsi: true })
                    setJitsiCallUrl(null)
                    setCallStatus(null)
                    setCallState('idle')
                  }}
                  title="Kết thúc cuộc gọi"
                  aria-label="Kết thúc cuộc gọi"
                >
                  <PhoneOff size={18} />
                </button>
              </header>
              <iframe
                className={styles.jitsiCallFrame}
                src={jitsiCallUrl}
                title="Cuộc gọi video"
                allow="camera; microphone; fullscreen; display-capture; autoplay"
              />
            </section>
          ) : null}

          {activeCall && callAnswered && !callMinimized ? (
            <ActiveCallWindow
              name={activeCall.withName}
              avatarUrl={activeCall.avatarUrl}
              callType={activeCall.type}
              mode={activeCall.mode}
              state={callState === 'idle' ? 'connected' : callState}
              duration={formattedCallTime}
              participants={callParticipantProfiles}
              localStream={localStreamState}
              remoteStreams={remoteStreams}
              mutedMic={mutedMic}
              mutedCam={mutedCam}
              cameraAvailable={cameraAvailable}
              onToggleMic={handleToggleMic}
              onToggleCamera={handleToggleCamera}
              onAddMembers={activeCall.mode === 'group' ? handleAddMembers : undefined}
              onMinimize={() => setCallMinimized(true)}
              onEnd={handleEndCall}
            />
          ) : null}

          {false && activeCall ? (
            <div className={styles.callOverlay}>
              <div className={styles.callBackdropGlow} />
              <div className={styles.callTopBar}>
                <div>
                  <small>Call in progress</small>
                  <h3>{activeCall!.withName}</h3>
                  <p className={styles.callParticipantCount}>
                    {callParticipantProfiles.length} người đang tham gia
                  </p>
                </div>
                <div className={styles.callBadge}>{callAnswered ? formattedCallTime : 'Đổ chuông...'}</div>
              </div>
              {callParticipantProfiles.length > 0 ? (
                <div className={styles.callParticipantList}>
                  {callParticipantProfiles.map((member) => (
                    <div key={member.userId} className={styles.callParticipantItem}>
                      {member.avatarUrl ? (
                        <img src={member.avatarUrl} alt={member.name} />
                      ) : (
                        <span>{(member.name[0] || 'U').toUpperCase()}</span>
                      )}
                      <strong>{member.name}</strong>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className={styles.callMainVideo}>
                {remoteStreams.length > 0 ? (
                  <div className={styles.remoteGrid}>
                    {remoteStreams.map((item) => (
                      <div key={item.userId} className={styles.remoteVideoCard}>
                        <video
                          autoPlay
                          playsInline
                          ref={(node) => {
                            if (!node) return
                            node.srcObject = item.stream
                          }}
                        />
                        <span className={styles.remoteVideoLabel}>
                          {callParticipantProfiles.find((member) => member.userId === item.userId)?.name || `Người dùng #${item.userId}`}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={styles.callAvatarBig}>{(activeCall!.withName[0] || 'U').toUpperCase()}</div>
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

          {actionMenu && activeActionMessage ? (
            <div ref={actionMenuRef} className={styles.actionMenu} style={{ left: actionMenu.x, top: actionMenu.y }}>
              <div className={styles.actionMenuHeader}>
                <span className={styles.listEntryAvatar}>{getAvatarInitial(getSenderName(activeActionMessage.senderId, activeActionMessage))}</span>
                <div className={styles.actionMenuMeta}>
                  <strong>{getSenderName(activeActionMessage.senderId, activeActionMessage)}</strong>
                  <small>{formatVietnamTime(activeActionMessage.createdAt)}</small>
                </div>
              </div>
              {(() => {
                const isActionMsgRecalled = !!(activeActionMessage.isDeleted || (activeActionMessage.meta as Record<string, unknown>)?.recalled)
                return (
                  <>
                    {!isActionMsgRecalled ? (
                      <>
                        <button type="button" onClick={() => { handleReaction(activeActionMessage, 'like'); setActionMenu(null) }} title="Thích" aria-label="Thích">Thích</button>
                        <button type="button" onClick={() => { handleReaction(activeActionMessage, 'love'); setActionMenu(null) }} title="Yêu thích" aria-label="Yêu thích">Yêu thích</button>
                        <button type="button" onClick={() => { handleReaction(activeActionMessage, 'care'); setActionMenu(null) }} title="Quan tâm" aria-label="Quan tâm">Quan tâm</button>
                        <button type="button" onClick={() => { setForwardingMessageId(activeActionMessage.id); setActionMenu(null) }}>Chuyển tiếp</button>
                        <button type="button" onClick={() => { void handleTogglePinMessage(activeActionMessage); setActionMenu(null) }}>
                          {pinnedMessageIds.has(activeActionMessage.id) ? 'Bỏ ghim' : 'Ghim'}
                        </button>
                      </>
                    ) : null}
                    {activeActionMessage.text && !translatedMessages[activeActionMessage.id] && !isActionMsgRecalled ? (
                      <button
                        type="button"
                        onClick={() => { handleTranslateMessage(activeActionMessage.id, activeActionMessage.text!); setActionMenu(null) }}
                        disabled={translatingIds[activeActionMessage.id]}
                      >
                        <Languages size={14} style={{ display: 'inline', marginRight: 4, marginBottom: -2 }} />
                        {translatingIds[activeActionMessage.id] ? 'Đang dịch...' : 'Dịch (AI)'}
                      </button>
                    ) : null}
                    {activeActionMessage.senderId === user?.id ? (
                      <button type="button" onClick={() => { handleRecall(activeActionMessage); setActionMenu(null) }}>Thu hồi</button>
                    ) : null}
                    {activeActionMessage.senderId === user?.id ? (
                      <button type="button" onClick={() => { handleDeleteMessage(activeActionMessage); setActionMenu(null) }}>Xóa</button>
                    ) : null}
                  </>
                )
              })()}
            </div>
          ) : null}

          {reactionPicker && activeReactionMessage ? (
            <div
              ref={reactionPickerRef}
              className={`${styles.reactionPicker} ${reactionPicker.placement === 'above' ? styles.reactionPickerAbove : styles.reactionPickerBelow}`}
              role="toolbar"
              aria-label="Chọn cảm xúc"
              onKeyDown={(event) => {
                if (!reactionPickerRef.current) return
                const buttons = Array.from(reactionPickerRef.current.querySelectorAll('button')) as HTMLButtonElement[]
                if (buttons.length === 0) return
                const currentIndex = buttons.findIndex((btn) => btn === document.activeElement)
                if (event.key === 'Escape') {
                  event.preventDefault()
                  setReactionPicker(null)
                  return
                }
                if (event.key === 'ArrowRight') {
                  event.preventDefault()
                  const nextIndex = (currentIndex + 1) % buttons.length
                  buttons[nextIndex]?.focus()
                }
                if (event.key === 'ArrowLeft') {
                  event.preventDefault()
                  const nextIndex = currentIndex <= 0 ? buttons.length - 1 : currentIndex - 1
                  buttons[nextIndex]?.focus()
                }
              }}
            >
              {MESSAGE_REACTION_ICONS.map((reaction) => (
                <button
                  key={reaction.type}
                  type="button"
                  className={activeReactionMessage.viewerReaction === reaction.type ? styles.reactionPickerActive : ''}
                  title={reaction.label}
                  aria-label={reaction.label}
                  disabled={busyActionId === activeReactionMessage.id}
                  onClick={() => {
                    void handleReaction(activeReactionMessage, reaction.type)
                    setReactionPicker(null)
                  }}
                >
                  <span className={styles.reactionPickerGlyph}>{reaction.emoji}</span>
                </button>
              ))}
            </div>
          ) : null}
        </section>

        {mediaLightbox ? (
          <div className={styles.mediaLightbox} role="dialog" aria-modal="true" aria-label="Xem ảnh" onClick={() => setMediaLightbox(null)}>
            <button type="button" className={styles.mediaLightboxClose} onClick={() => setMediaLightbox(null)} aria-label="Đóng">
              <X size={20} />
            </button>
            <img src={mediaLightbox.url} alt={mediaLightbox.alt} onClick={(event) => event.stopPropagation()} />
          </div>
        ) : null}

        {showSettingsDrawer ? <button type="button" className={styles.settingsBackdrop} aria-label="Đóng cài đặt hội thoại" onClick={() => setShowSettingsDrawer(false)} /> : null}
        <aside className={`${styles.detailsPanel}${showSettingsDrawer ? ` ${styles.detailsPanelOpen}` : ''}${!showDetailsPanelDesktop ? ` ${styles.detailsPanelHidden}` : ''}`}>
          <div className={styles.detailsBody}>
          <ConversationDetailsPanel
            selectedConversation={selectedConversation}
            selectedGroup={selectedGroup}
            rightPanelSection={rightPanelSection}
            setRightPanelSection={setRightPanelSection}
            myGroupRole={myGroupRole}
            groupLeader={groupLeader}
            groupDeputy={groupDeputy}
            canManageRoles={canManageRoles}
            canRemoveMembers={canRemoveMembers}
            canAddMembers={canAddMembers}
            canDissolveSelectedGroup={canDissolveSelectedGroup}
            canLeaderLeaveGroup={canLeaderLeaveGroup}
            groupSearchKeyword={groupSearchKeyword}
            setGroupSearchKeyword={setGroupSearchKeyword}
            filteredGroupInviteCandidates={filteredGroupInviteCandidates}
            groupActionBusyId={groupActionBusyId}
            userId={user?.id}
            handleClearChatForMe={handleClearChatForMe}
            handleTransferLeader={handleTransferLeader}
            handleSetDeputyRole={handleSetDeputyRole}
            handleRemoveMemberFromGroup={handleRemoveMemberFromGroup}
            handleAddMemberToGroup={handleAddMemberToGroup}
            handleLeaveGroup={handleLeaveGroup}
            handleDissolveGroup={handleDissolveGroup}
            handleToggleConversationPin={handleToggleConversationPin}
            handleToggleConversationMute={handleToggleConversationMute}
            handleUpdateConversationPreferences={handleUpdateConversationPreferences}
            largeText={selectedConversationUiPrefs.largeText}
            roundBubbles={selectedConversationUiPrefs.roundBubbles}
            onLargeTextChange={handleSetLargeText}
            onRoundBubblesChange={handleSetRoundBubbles}
            handleUpdateNickname={handleUpdateNickname}
            handleUpdateGroupProfile={handleUpdateGroupProfile}
            handleBlockPeer={handleBlockPeer}
            handleUnblockPeer={handleUnblockPeer}
            handleOpenHideConversation={handleOpenHideConversation}
            handleOpenLockConversation={handleOpenLockConversation}
            handleOpenAutoDeleteSettings={() => setAutoDeleteDialogOpen(true)}
            handleOpenReportConversation={handleOpenReportConversation}
            isDirectPeerBlocked={isDirectPeerBlocked}
            pinnedMessages={pinnedMessages}
            sharedContent={sharedContent}
            loadingSharedContent={loadingSharedContent}
            onClose={() => {
              setShowSettingsDrawer(false)
              setShowDetailsPanelDesktop(false)
            }}
          />
          </div>
        </aside>
        {incomingCall ? (
          <IncomingCallModal
            name={incomingCallName}
            avatarUrl={incomingCallAvatar}
            callType={incomingCall.callType}
            mode={incomingConversation?.type === 'group' ? 'group' : 'private'}
            callerName={incomingConversation?.type === 'group' ? incomingCaller?.fullName : undefined}
            countdownSeconds={incomingSecondsLeft}
            onAccept={() => handleAcceptIncomingCall()}
            onAcceptAudioOnly={() => handleAcceptIncomingCall(undefined, true)}
            onDecline={handleDeclineIncomingCall}
          />
        ) : null}
        {/* OutgoingCallModal, ActiveCallWindow and MinimizedCallPill are rendered in AppLayout to persist across navigation. */}
        <AppDialog
          open={callSettingsOpen}
          onOpenChange={setCallSettingsOpen}
          title="Cài đặt cuộc gọi"
          description="Tùy chỉnh âm thanh, thông báo và quyền tham gia cuộc gọi trên thiết bị này."
        >
          <CallSettingsPanel settings={callSettings} onChange={setCallSettings} />
        </AppDialog>
        {pendingLockedConversationId ? (
          <div className={styles.lockGateOverlay} role="dialog" aria-modal="true" aria-labelledby="unlock-conversation-title">
            <form
              className={styles.lockGateCard}
              onSubmit={(event) => {
                event.preventDefault()
                void handleSubmitPendingUnlock()
              }}
            >
              <h3 id="unlock-conversation-title">Mở khóa hội thoại</h3>
              <p>
                Hội thoại này đang bị khóa trên thiết bị của bạn. Mở khóa để tiếp tục xem nội dung và nhận tin nhắn.
              </p>
              <label className={styles.lockGateField}>
                <span>Mật khẩu khóa</span>
                <input
                  type="password"
                  value={pendingUnlockPassword}
                  onChange={(event) => {
                    setPendingUnlockPassword(event.target.value)
                    setPendingUnlockError(null)
                  }}
                  autoFocus
                  placeholder="Nhập mật khẩu"
                />
              </label>
              {pendingUnlockError ? <small className={styles.lockGateError}>{pendingUnlockError}</small> : null}
              <div className={styles.lockGateActions}>
                <button
                  type="button"
                  onClick={() => {
                    setPendingLockedConversationId(null)
                    setPendingUnlockPassword('')
                    setPendingUnlockError(null)
                  }}
                >
                  Đóng
                </button>
                <button type="submit">
                  Mở khóa
                </button>
              </div>
            </form>
          </div>
        ) : null}
        <ConfirmDialog
          open={Boolean(confirmModal)}
          onOpenChange={(open) => {
            if (!open) setConfirmModal(null)
          }}
          title={confirmModal?.title || ''}
          description={confirmModal?.description || ''}
          confirmLabel={confirmModal?.confirmLabel || 'Xác nhận'}
          destructive={confirmModal?.destructive ?? true}
          icon={confirmModal?.icon || 'warning'}
          onConfirm={async () => {
            await confirmModal?.onConfirm()
          }}
        />
        <InputDialog
          open={Boolean(nicknameDialog)}
          onOpenChange={(open) => {
            if (!open) setNicknameDialog(null)
          }}
          title="Đổi biệt danh"
          description="Biệt danh chỉ hiển thị trong hội thoại này."
          label="Biệt danh"
          placeholder="Nhập biệt danh..."
          hint="Để trống để xóa biệt danh"
          initialValue={nicknameDialog?.currentValue || ''}
          maxLength={30}
          identity={nicknameDialog ? { name: nicknameDialog.name, avatarUrl: nicknameDialog.avatarUrl } : undefined}
          submitLabel="Lưu"
          onSubmit={handleSubmitNickname}
        />
        <InputDialog
          open={groupNameDialogOpen}
          onOpenChange={setGroupNameDialogOpen}
          title="Đổi tên nhóm"
          description="Tên nhóm giúp mọi người nhận ra cuộc trò chuyện nhanh hơn."
          label="Tên nhóm"
          placeholder="Nhập tên nhóm..."
          initialValue={selectedGroup?.name || ''}
          maxLength={50}
          required
          identity={selectedGroup ? { name: selectedGroup.name || 'Nhóm chat', avatarUrl: selectedGroup.avatarUrl } : undefined}
          submitLabel="Lưu"
          validate={(value) => (!value.trim() ? 'Tên nhóm không được để trống.' : null)}
          onSubmit={(nextName) => handleUpdateGroupProfile({ name: nextName })}
        />
        <InputDialog
          open={hideDialogOpen}
          onOpenChange={setHideDialogOpen}
          title={hideDialogMode === 'unhide' ? 'Bỏ ẩn hội thoại' : 'Ẩn hội thoại'}
          description={hideDialogMode === 'unhide' ? 'Nhập mã ẩn để đưa hội thoại trở lại danh sách.' : 'Nhập mã riêng để ẩn hội thoại khỏi danh sách. Bạn sẽ cần mã này để mở lại.'}
          label={hideDialogMode === 'unhide' ? 'Mã xác nhận' : 'Mã ẩn'}
          placeholder="Nhập mã ẩn..."
          hint={hideDialogMode === 'unhide' ? 'Mã phải trùng với mã đã dùng khi ẩn hội thoại.' : 'Mã này dùng để xác thực khi mở lại hội thoại ẩn.'}
          inputType="password"
          maxLength={32}
          required
          submitLabel={hideDialogMode === 'unhide' ? 'Bỏ ẩn' : 'Ẩn'}
          validate={(value) => (!value.trim() ? (hideDialogMode === 'unhide' ? 'Nhập mã để bỏ ẩn hội thoại.' : 'Mã ẩn không được để trống.') : null)}
          onSubmit={handleSubmitHideConversation}
        />
        <InputDialog
          open={lockDialogOpen}
          onOpenChange={setLockDialogOpen}
          title="Khóa hội thoại"
          description="Bạn cần xác thực để mở lại hội thoại này."
          label="Mã PIN"
          placeholder="Nhập mã PIN..."
          hint="Mã PIN tạm thời sẽ được dùng làm mật khẩu khóa hội thoại."
          inputType="password"
          maxLength={12}
          required
          submitLabel="Khóa"
          validate={(value) => (!value.trim() ? 'Vui lòng nhập mã PIN.' : null)}
          onSubmit={handleSubmitLockConversation}
        />
        <UploadImageDialog
          open={groupAvatarDialogOpen}
          onOpenChange={setGroupAvatarDialogOpen}
          title="Cập nhật ảnh nhóm"
          description="Chọn ảnh đại diện mới cho nhóm. Ảnh cần nhỏ hơn 5MB."
          onSubmit={handleSubmitGroupAvatar}
        />
        <ReportDialog
          open={Boolean(reportDialog)}
          onOpenChange={(open) => {
            if (!open) setReportDialog(null)
          }}
          title={reportDialog?.title || 'Báo cáo'}
          onSubmit={handleSubmitReport}
        />
        <NotificationMuteDialog
          open={muteDialogOpen}
          onOpenChange={setMuteDialogOpen}
          onSubmit={handleApplyConversationMute}
        />
        <AutoDeleteMessageDialog
          open={autoDeleteDialogOpen}
          onOpenChange={setAutoDeleteDialogOpen}
          value={selectedConversation?.autoDeleteAfterSeconds ?? null}
          onSubmit={handleSubmitAutoDelete}
        />
      </div>
    </div>
  )
}

