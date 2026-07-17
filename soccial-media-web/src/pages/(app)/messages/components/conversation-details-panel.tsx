import type { ChatMessage, Conversation, FriendConnection } from '@/types'

import { SettingsSidebar } from './settings-sidebar'

type GroupLeader = { fullName: string; userId: number } | null

type ConversationDetailsPanelProps = {
  selectedConversation?: Conversation | null
  selectedGroup: Conversation | null
  rightPanelSection: 'overview' | 'members' | 'manage'
  setRightPanelSection: (value: 'overview' | 'members' | 'manage') => void
  myGroupRole: string | null
  groupLeader: GroupLeader
  groupDeputy: GroupLeader
  canManageRoles: boolean
  canRemoveMembers: boolean
  canAddMembers: boolean
  canDissolveSelectedGroup: boolean
  canLeaderLeaveGroup: boolean
  groupSearchKeyword: string
  setGroupSearchKeyword: (value: string) => void
  filteredGroupInviteCandidates: FriendConnection[]
  groupActionBusyId: string | null
  userId?: number
  handleClearChatForMe: () => void | Promise<void>
  handleTransferLeader: (userId: number) => void | Promise<void>
  handleSetDeputyRole: (userId: number | null) => void | Promise<void>
  handleRemoveMemberFromGroup: (userId: number) => void | Promise<void>
  handleAddMemberToGroup: (userId: number) => void | Promise<void>
  handleLeaveGroup: () => void | Promise<void>
  handleDissolveGroup: () => void | Promise<void>
  handleToggleConversationPin: () => void | Promise<void>
  handleToggleConversationMute: () => void | Promise<void>
  handleUpdateConversationPreferences: (payload: {
    backgroundUrl?: string | null
    themeColor?: string | null
    autoDeleteAfterSeconds?: number | null
    hidden?: boolean
    locked?: boolean
    hiddenPassword?: string | null
    lockedPassword?: string | null
  }) => void | Promise<void>
  largeText: boolean
  roundBubbles: boolean
  onLargeTextChange: (value: boolean) => void
  onRoundBubblesChange: (value: boolean) => void
  handleUpdateNickname: (userId: number) => void | Promise<void>
  handleUpdateGroupProfile: (payload: { name: string; avatarUrl?: string | null }) => void | Promise<void>
  handleBlockPeer: () => void | Promise<void>
  handleUnblockPeer: () => void | Promise<void>
  handleOpenHideConversation: () => void
  handleOpenLockConversation: () => void
  handleOpenAutoDeleteSettings: () => void
  handleOpenReportConversation: () => void
  isDirectPeerBlocked: boolean
  pinnedMessages: ChatMessage[]
  sharedContent: { photosVideos: ChatMessage[]; files: ChatMessage[]; links: ChatMessage[] }
  loadingSharedContent: boolean
  onClose?: () => void
}

export function ConversationDetailsPanel({
  selectedConversation,
  selectedGroup,
  rightPanelSection: _rightPanelSection,
  setRightPanelSection: _setRightPanelSection,
  ...props
}: ConversationDetailsPanelProps) {
  const conversation = selectedConversation || selectedGroup

  if (!conversation) return null

  return <SettingsSidebar conversation={conversation} {...props} />
}
