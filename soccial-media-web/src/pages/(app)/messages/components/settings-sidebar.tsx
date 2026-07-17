import {
  Bell,
  BellOff,
  Blocks,
  Brush,
  CalendarClock,
  Check,
  ChevronDown,
  Crown,
  FileText,
  Flag,
  FolderOpen,
  Image,
  Link2,
  LogOut,
  MessageSquareMore,
  PaintBucket,
  Pin,
  PinOff,
  ShieldCheck,
  ShieldX,
  Trash2,
  Type,
  UserMinus,
  UserPen,
  UserPlus,
  UsersRound,
  Wallpaper,
  X,
} from 'lucide-react'
import { useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react'

import { getAvatarInitial, getGroupRoleLabel } from '@/services/messages/formatters'
import type { ChatMessage, Conversation, FriendConnection } from '@/types'
import { cn } from '@/utils'
import styles from '../page.module.css'

type SharedContent = { photosVideos: ChatMessage[]; files: ChatMessage[]; links: ChatMessage[] }
type GroupLeader = { fullName: string; userId: number } | null

export type SettingsSidebarProps = {
  conversation: Conversation
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
  handleOpenHideConversation: (mode?: 'hide' | 'unhide') => void
  handleOpenLockConversation: () => void
  handleOpenAutoDeleteSettings: () => void
  handleOpenReportConversation: () => void
  isDirectPeerBlocked: boolean
  pinnedMessages: ChatMessage[]
  sharedContent: SharedContent
  loadingSharedContent: boolean
  onClose?: () => void
}

type AccordionSectionProps = {
  icon: ReactNode
  title: string
  meta?: ReactNode
  defaultOpen?: boolean
  children: ReactNode
}

export function AccordionSection({ icon, title, meta, defaultOpen = false, children }: AccordionSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section className={cn(styles.settingsAccordion, open && styles.settingsAccordionOpen)}>
      <button type="button" className={styles.settingsAccordionTrigger} onClick={() => setOpen((value) => !value)}>
        <span className={styles.settingsAccordionTitle}>
          {icon}
          <b>{title}</b>
        </span>
        <span className={styles.settingsAccordionMeta}>
          {meta}
          <ChevronDown size={16} />
        </span>
      </button>
      {open ? <div className={styles.settingsAccordionBody}>{children}</div> : null}
    </section>
  )
}

type QuickActionButtonProps = {
  icon: ReactNode
  label: string
  active?: boolean
  disabled?: boolean
  onClick?: () => void
}

export function QuickActionButton({ icon, label, active, disabled, onClick }: QuickActionButtonProps) {
  return (
    <button type="button" className={cn(styles.quickAction, active && styles.quickActionActive)} disabled={disabled} onClick={onClick} title={label}>
      <span>{icon}</span>
      <small>{label}</small>
    </button>
  )
}

export function ToggleSwitch({
  checked,
  label,
  description,
  onChange,
  disabled,
}: {
  checked: boolean
  label: string
  description?: string
  onChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <label className={cn(styles.settingsToggleRow, disabled && styles.settingsToggleDisabled)}>
      <span>
        <b>{label}</b>
        {description ? <small>{description}</small> : null}
      </span>
      {checked ? (
        <button type="button" role="switch" aria-checked="true" disabled={disabled} className={cn(styles.toggleSwitch, styles.toggleSwitchChecked)} onClick={() => onChange(!checked)}>
          <span />
        </button>
      ) : (
        <button type="button" role="switch" aria-checked="false" disabled={disabled} className={cn(styles.toggleSwitch)} onClick={() => onChange(!checked)}>
          <span />
        </button>
      )}
    </label>
  )
}

export function MediaGrid({ items, loading }: { items: ChatMessage[]; loading: boolean }) {
  if (loading) {
    return <div className={styles.mediaGrid}>{Array.from({ length: 6 }).map((_, index) => <i key={index} className={styles.settingsSkeleton} />)}</div>
  }

  if (!items.length) return <EmptySetting label="Chưa có ảnh hoặc video được chia sẻ." />

  return (
    <div className={styles.mediaGrid}>
      {items.slice(0, 8).map((item) => (
        <a key={item.id} href={item.mediaUrl || undefined} target="_blank" rel="noreferrer" className={styles.mediaTile}>
          {item.mediaUrl && item.type === 'video' ? <video src={item.mediaUrl} muted /> : item.mediaUrl ? <img src={item.mediaUrl} alt={item.fileName || item.text || 'Shared media'} /> : <Image size={18} />}
        </a>
      ))}
    </div>
  )
}

export function FileList({ items, loading }: { items: ChatMessage[]; loading: boolean }) {
  if (loading) return <SkeletonRows />
  if (!items.length) return <EmptySetting label="Chưa có tệp được chia sẻ." />

  return (
    <div className={styles.settingsList}>
      {items.slice(0, 5).map((item) => (
        <a key={item.id} href={item.mediaUrl || undefined} target="_blank" rel="noreferrer" className={styles.settingsListRow}>
          <FileText size={16} />
          <span>
            <b>{item.fileName || 'Tệp đính kèm'}</b>
            <small>{formatFileMeta(item)}</small>
          </span>
        </a>
      ))}
    </div>
  )
}

export function LinkList({ items, loading }: { items: ChatMessage[]; loading: boolean }) {
  if (loading) return <SkeletonRows />
  if (!items.length) return <EmptySetting label="Chưa có liên kết được chia sẻ." />

  return (
    <div className={styles.settingsList}>
      {items.slice(0, 5).map((item) => {
        const href = item.links?.[0] || item.text || ''
        return (
          <a key={item.id} href={href || undefined} target="_blank" rel="noreferrer" className={styles.settingsListRow}>
            <Link2 size={16} />
            <span>
              <b>{getDomain(href)}</b>
              <small>{item.text || href}</small>
            </span>
          </a>
        )
      })}
    </div>
  )
}

export function DangerActionButton({
  icon,
  label,
  description,
  disabled,
  onClick,
}: {
  icon: ReactNode
  label: string
  description?: string
  disabled?: boolean
  onClick?: () => void
}) {
  return (
    <button type="button" className={styles.dangerAction} disabled={disabled} onClick={onClick}>
      {icon}
      <span>
        <b>{label}</b>
        {description ? <small>{description}</small> : null}
      </span>
    </button>
  )
}

export function MemberList({
  conversation,
  userId,
  canManageRoles,
  canRemoveMembers,
  groupActionBusyId,
  onNickname,
  onTransferLeader,
  onDeputy,
  onRemove,
  limit,
}: {
  conversation: Conversation
  userId?: number
  canManageRoles: boolean
  canRemoveMembers: boolean
  groupActionBusyId: string | null
  onNickname: (memberId: number) => void
  onTransferLeader: (memberId: number) => void
  onDeputy: (memberId: number | null) => void
  onRemove: (memberId: number) => void
  limit?: number
}) {
  return (
    <div className={styles.memberList}>
      {conversation.members.slice(0, limit).map((member) => {
        const isSelf = Number(member.userId) === Number(userId)
        const isLeader = member.role === 'leader'
        const isDeputy = member.role === 'deputy'

        return (
          <article key={member.userId} className={styles.memberRow}>
            <Avatar name={member.fullName} avatarUrl={member.avatarUrl} online={member.online} compact />
            <span className={styles.memberName}>
              <b>{member.nickname || member.fullName}{isSelf ? ' (Bạn)' : ''}</b>
              <small>{member.username ? `@${member.username} · ` : ''}{getGroupRoleLabel(member.role)} - {member.online ? 'Đang hoạt động' : 'Ngoại tuyến'}</small>
            </span>
            <div className={styles.memberActions}>
              <button type="button" onClick={() => onNickname(member.userId)} title="Sửa biệt danh"><UserPen size={14} /></button>
              {canManageRoles && !isSelf && !isLeader ? (
                <button type="button" disabled={groupActionBusyId === `role-${member.userId}`} onClick={() => onTransferLeader(member.userId)} title="Chuyển quyền trưởng nhóm"><Crown size={14} /></button>
              ) : null}
              {canManageRoles && !isSelf && !isLeader ? (
                <button type="button" disabled={groupActionBusyId === `deputy-${isDeputy ? 'none' : member.userId}`} onClick={() => onDeputy(isDeputy ? null : member.userId)} title={isDeputy ? 'Gỡ phó nhóm' : 'Gán phó nhóm'}><ShieldCheck size={14} /></button>
              ) : null}
              {canRemoveMembers && !isSelf && !isLeader ? (
                <button type="button" disabled={groupActionBusyId === `remove-${member.userId}`} className={styles.memberDanger} onClick={() => onRemove(member.userId)} title="Xóa thành viên"><UserMinus size={14} /></button>
              ) : null}
            </div>
          </article>
        )
      })}
    </div>
  )
}

function SharedMediaSection({ content, loading }: { content: SharedContent; loading: boolean }) {
  const tabs = [
    { key: 'photosVideos', label: 'Ảnh/Video', icon: <Image size={14} /> },
    { key: 'files', label: 'Tệp', icon: <FolderOpen size={14} /> },
    { key: 'links', label: 'Liên kết', icon: <Link2 size={14} /> },
  ] as const
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]['key']>('photosVideos')

  return (
    <>
      <div className={styles.mediaTabs}>
        {tabs.map((tab) => (
          <button type="button" key={tab.key} className={cn(activeTab === tab.key && styles.mediaTabActive)} onClick={() => setActiveTab(tab.key)}>
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab === 'photosVideos' ? <MediaGrid items={content.photosVideos} loading={loading} /> : null}
      {activeTab === 'files' ? <FileList items={content.files} loading={loading} /> : null}
      {activeTab === 'links' ? <LinkList items={content.links} loading={loading} /> : null}
      <button type="button" className={styles.viewAllButton}>Xem tất cả</button>
    </>
  )
}

export function SettingsSidebar({
  conversation,
  myGroupRole,
  groupLeader,
  groupDeputy,
  canManageRoles,
  canRemoveMembers,
  canAddMembers,
  canDissolveSelectedGroup,
  canLeaderLeaveGroup,
  groupSearchKeyword,
  setGroupSearchKeyword,
  filteredGroupInviteCandidates,
  groupActionBusyId,
  userId,
  handleClearChatForMe,
  handleTransferLeader,
  handleSetDeputyRole,
  handleRemoveMemberFromGroup,
  handleAddMemberToGroup,
  handleLeaveGroup,
  handleDissolveGroup,
  handleToggleConversationPin,
  handleToggleConversationMute,
  handleUpdateConversationPreferences,
  largeText,
  roundBubbles,
  onLargeTextChange,
  onRoundBubblesChange,
  handleUpdateNickname,
  handleUpdateGroupProfile,
  handleBlockPeer,
  handleUnblockPeer,
  handleOpenHideConversation,
  handleOpenLockConversation,
  handleOpenAutoDeleteSettings,
  handleOpenReportConversation,
  isDirectPeerBlocked,
  pinnedMessages,
  sharedContent,
  loadingSharedContent,
  onClose,
}: SettingsSidebarProps) {
  const isGroup = conversation.type === 'group'
  const peer = conversation.members.find((member) => Number(member.userId) !== Number(userId))
  const title = isGroup ? conversation.name || 'Nhóm chat' : peer?.nickname || peer?.fullName || conversation.name || 'Cuộc trò chuyện'
  const onlineMembers = conversation.members.filter((member) => member.online)
  const [showAllMembers, setShowAllMembers] = useState(false)
  const [editingGroupName, setEditingGroupName] = useState(false)
  const [groupNameDraft, setGroupNameDraft] = useState('')
  const [savingGroupName, setSavingGroupName] = useState(false)
  const [boardPanel, setBoardPanel] = useState<'pinned' | null>(null)
  const backgroundInputRef = useRef<HTMLInputElement | null>(null)
  const autoDeleteLabel = useMemo(() => {
    const current = conversation.autoDeleteAfterSeconds ?? null
    if (!current) return 'Tắt'
    if (current === 3600) return '1 giờ'
    if (current === 86400) return '1 ngày'
    if (current === 604800) return '7 ngày'
    if (current === 2592000) return '30 ngày'
    return `${current} giây`
  }, [conversation.autoDeleteAfterSeconds])
  const isHiddenForMe = Boolean(conversation.isHidden)
  const isLockedForMe = Boolean(conversation.isLocked)

  const updatePreferences = (payload: Parameters<typeof handleUpdateConversationPreferences>[0]) => {
    return void handleUpdateConversationPreferences(payload)
  }

  const handleBackgroundFilePicked = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null
    event.target.value = ''
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const nextValue = typeof reader.result === 'string' ? reader.result : null
      updatePreferences({ backgroundUrl: nextValue })
    }
    reader.readAsDataURL(file)
  }

  const handleBackgroundColorChange = (event: ChangeEvent<HTMLInputElement>) => {
    updatePreferences({ themeColor: event.target.value })
  }

  const autoDeleteOptions = [
    { label: 'Tắt', value: null },
    { label: '1 giờ', value: 3600 },
    { label: '1 ngày', value: 86400 },
    { label: '7 ngày', value: 604800 },
    { label: '30 ngày', value: 2592000 },
  ] as const

  const description = useMemo(() => {
    if (!isGroup) return formatActivity(peer)
    const memberLabel = `${conversation.members.length} thành viên`
    const onlineLabel = onlineMembers.length ? ` - ${onlineMembers.length} online` : ''
    return `${memberLabel}${onlineLabel}`
  }, [conversation.members.length, isGroup, onlineMembers.length, peer])

  return (
    <div className={styles.settingsSidebar}>
      <input ref={backgroundInputRef} type="file" accept="image/*" className={styles.hiddenFileInput} onChange={handleBackgroundFilePicked} aria-label="Chọn hình nền" title="Chọn hình nền" />
      <header className={styles.settingsHeader}>
        <button type="button" className={styles.settingsClose} onClick={onClose} aria-label="Đóng cài đặt">
          <X size={17} />
        </button>
        <div className={styles.settingsHeroAvatars}>
          {isGroup ? (
            conversation.members.slice(0, 3).map((member, index) => (
              <Avatar key={member.userId} name={member.fullName} avatarUrl={index === 0 ? conversation.avatarUrl || member.avatarUrl : member.avatarUrl} online={member.online} stacked />
            ))
          ) : (
            <Avatar name={title} avatarUrl={peer?.avatarUrl || conversation.avatarUrl} online={peer?.online} />
          )}
        </div>
        <div className={styles.settingsTitleRow}>
          {isGroup && editingGroupName ? (
            <>
              <input
                className={styles.groupNameInput}
                value={groupNameDraft}
                onChange={(e) => setGroupNameDraft(e.target.value)}
                maxLength={80}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && groupNameDraft.trim()) {
                    void (async () => {
                      setSavingGroupName(true)
                      try { await handleUpdateGroupProfile({ name: groupNameDraft.trim(), avatarUrl: conversation.avatarUrl || null }); setEditingGroupName(false) }
                      finally { setSavingGroupName(false) }
                    })()
                  }
                  if (e.key === 'Escape') setEditingGroupName(false)
                }}
              />
              <button
                type="button"
                title="Lưu"
                disabled={!groupNameDraft.trim() || savingGroupName}
                onClick={() => {
                  if (!groupNameDraft.trim()) return
                  void (async () => {
                    setSavingGroupName(true)
                    try { await handleUpdateGroupProfile({ name: groupNameDraft.trim(), avatarUrl: conversation.avatarUrl || null }); setEditingGroupName(false) }
                    finally { setSavingGroupName(false) }
                  })()
                }}
              >
                <Check size={14} />
              </button>
              <button type="button" title="Hủy" onClick={() => setEditingGroupName(false)}>
                <X size={14} />
              </button>
            </>
          ) : (
            <>
              <h3>{title}</h3>
              <button
                type="button"
                title="Chỉnh sửa"
                onClick={() => {
                  if (isGroup) {
                    setGroupNameDraft(conversation.name || '')
                    setEditingGroupName(true)
                  } else if (peer) {
                    void handleUpdateNickname(peer.userId)
                  }
                }}
              >
                <UserPen size={15} />
              </button>
            </>
          )}
        </div>
        <p>{description}</p>
        {isGroup ? (
          <div className={styles.groupMeta}>
            <span>{getGroupRoleLabel(myGroupRole)}</span>
            <span>Tạo bởi {groupLeader?.fullName || `ID ${conversation.createdBy || '?'}`}</span>
            {conversation.createdAt ? <span>Tạo ngày {new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short' }).format(new Date(conversation.createdAt))}</span> : null}
          </div>
        ) : null}
      </header>

      <div className={styles.quickActionsRow}>
        <QuickActionButton icon={conversation.isMuted ? <Bell size={18} /> : <BellOff size={18} />} label={conversation.isMuted ? 'Bật TB' : 'Tắt TB'} active={Boolean(conversation.isMuted)} onClick={() => void handleToggleConversationMute()} />
        <QuickActionButton icon={conversation.isPinned ? <PinOff size={18} /> : <Pin size={18} />} label={conversation.isPinned ? 'Bỏ ghim' : 'Ghim'} active={Boolean(conversation.isPinned)} onClick={() => void handleToggleConversationPin()} />
        {isGroup ? <QuickActionButton icon={<UserPlus size={18} />} label="Thêm" disabled={!canAddMembers} onClick={() => document.getElementById(`invite-${conversation.id}`)?.focus()} /> : null}
        {isGroup ? <QuickActionButton icon={<UsersRound size={18} />} label="Quản lý" onClick={() => document.getElementById(`members-${conversation.id}`)?.scrollIntoView({ block: 'nearest' })} /> : null}
        {isGroup ? <QuickActionButton icon={<Image size={18} />} label="Ảnh nhóm" disabled={true} onClick={() => undefined} /> : null}
        <QuickActionButton icon={<Wallpaper size={18} />} label="Nền" onClick={() => backgroundInputRef.current?.click()} />
        {!isGroup ? (
          <QuickActionButton
            icon={isDirectPeerBlocked ? <ShieldCheck size={18} /> : <ShieldX size={18} />}
            label={isDirectPeerBlocked ? 'Bỏ chặn' : 'Chặn'}
            active={isDirectPeerBlocked}
            onClick={() => void (isDirectPeerBlocked ? handleUnblockPeer() : handleBlockPeer())}
          />
        ) : null}
      </div>

      <div className={styles.settingsSections}>
        <AccordionSection icon={<UsersRound size={17} />} title={isGroup ? 'Thành viên' : 'Kết nối chung'} meta={isGroup ? `${conversation.members.length}` : undefined} defaultOpen>
          {isGroup ? (
            <>
              <div className={styles.settingsStats}>
                <span><UsersRound size={14} /> {conversation.members.length} thành viên</span>
                <span><Bell size={14} /> {onlineMembers.length} đang online</span>
              </div>
              <div id={`members-${conversation.id}`}>
                <MemberList
                  conversation={conversation}
                  userId={userId}
                  canManageRoles={canManageRoles}
                  canRemoveMembers={canRemoveMembers}
                  groupActionBusyId={groupActionBusyId}
                  onNickname={(memberId) => void handleUpdateNickname(memberId)}
                  onTransferLeader={(memberId) => void handleTransferLeader(memberId)}
                  onDeputy={(memberId) => void handleSetDeputyRole(memberId)}
                  onRemove={(memberId) => void handleRemoveMemberFromGroup(memberId)}
                  limit={showAllMembers ? undefined : 4}
                />
              </div>
              {conversation.members.length > 4 ? (
                <button type="button" className={styles.viewAllButton} onClick={() => setShowAllMembers((value) => !value)}>
                  {showAllMembers ? 'Thu gọn thành viên' : `Xem tất cả ${conversation.members.length} thành viên`}
                </button>
              ) : null}
              {canAddMembers ? (
                <div className={styles.inviteBox}>
                  <label htmlFor={`invite-${conversation.id}`}>Thêm thành viên</label>
                  <input id={`invite-${conversation.id}`} value={groupSearchKeyword} onChange={(event) => setGroupSearchKeyword(event.target.value)} placeholder="Tìm bạn bè theo tên, email hoặc ID" />
                  {filteredGroupInviteCandidates.slice(0, 4).map((friend) => (
                    <button key={friend.id} type="button" disabled={groupActionBusyId === `add-${friend.id}`} onClick={() => void handleAddMemberToGroup(friend.id)}>
                      <Avatar name={friend.fullName} avatarUrl={friend.avatarUrl} compact />
                      <span>{friend.fullName}{friend.username ? <small className={styles.inviteUsername}> @{friend.username}</small> : null}</span>
                      <UserPlus size={14} />
                    </button>
                  ))}
                  {!filteredGroupInviteCandidates.length ? <EmptySetting label="Không còn bạn bè phù hợp để thêm." /> : null}
                </div>
              ) : null}
            </>
          ) : (
            <div className={styles.mockRows}>
              <InfoRow icon={<UsersRound size={16} />} label="Nhóm chung" value="Chưa có dữ liệu" />
              <InfoRow icon={<UserPlus size={16} />} label="Bạn chung" value="Sẽ hiện khi API hỗ trợ" />
            </div>
          )}
        </AccordionSection>

        {isGroup ? (
          <AccordionSection icon={<Blocks size={17} />} title="Bảng tin nhóm">
            <ActionRows rows={[
              { icon: <Pin size={16} />, label: `Tin nhắn đã ghim (${pinnedMessages.length})`, onClick: () => setBoardPanel((value) => value === 'pinned' ? null : 'pinned') },
            ]} />
            {boardPanel ? (
              <GroupBoardPanel
                pinnedMessages={pinnedMessages}
              />
            ) : null}
          </AccordionSection>
        ) : null}

        <AccordionSection icon={<Image size={17} />} title="Media, tệp và liên kết" defaultOpen>
          <SharedMediaSection content={sharedContent} loading={loadingSharedContent} />
        </AccordionSection>

        <AccordionSection icon={<UserPen size={17} />} title="Biệt danh">
          {isGroup ? (
            <div className={styles.nicknameList}>
              {conversation.members.map((member) => (
                <button type="button" key={member.userId} onClick={() => void handleUpdateNickname(member.userId)}>
                  <Avatar name={member.fullName} avatarUrl={member.avatarUrl} compact />
                  <span>
                    <b>{member.nickname || member.fullName}</b>
                    <small>{member.nickname ? `Tên gốc: ${member.realName || member.fullName}` : 'Chưa đặt biệt danh'}</small>
                  </span>
                  <UserPen size={14} />
                </button>
              ))}
            </div>
          ) : peer ? (
            <div className={styles.nicknamePreview}>
              <Avatar name={peer.fullName} avatarUrl={peer.avatarUrl} compact />
              <span>
                <b>{peer.nickname || peer.fullName}</b>
                <small>{peer.nickname ? 'Đang hiện biệt danh trong chat' : 'Đang hiện tên thật'}</small>
              </span>
              <button type="button" onClick={() => void handleUpdateNickname(peer.userId)}>Sửa</button>
            </div>
          ) : <EmptySetting label="Không tìm thấy thành viên cần sửa biệt danh." />}
        </AccordionSection>

        <AccordionSection icon={<PaintBucket size={17} />} title="Tùy biến đoạn chat">
          <ActionRows rows={[
            { icon: <Wallpaper size={16} />, label: 'Chọn hình nền', onClick: () => backgroundInputRef.current?.click() },
          ]} />
          <div className={styles.settingsStats}>
            {conversation.backgroundUrl ? <span><Wallpaper size={14} /> Đã chọn nền</span> : null}
            {conversation.themeColor ? <span><Brush size={14} /> Màu chủ đề đang dùng</span> : null}
          </div>
          <div className={styles.settingsInlineControls}>
            <label className={styles.settingsInlineControl}>
              <span><Brush size={14} /> Màu chủ đề</span>
              <input type="color" value={conversation.themeColor || '#0b5fff'} onChange={handleBackgroundColorChange} aria-label="Chọn màu chủ đề" title="Chọn màu chủ đề" />
            </label>
          </div>
          <ToggleSwitch checked={largeText} label="Cỡ chữ lớn" description="Xem trước trên thiết bị này" onChange={onLargeTextChange} />
          <ToggleSwitch checked={roundBubbles} label="Bóng tin bo góc" description="Tùy biến kiểu bóng chat" onChange={onRoundBubblesChange} />
          {largeText ? <p className={styles.settingsPreviewText}><Type size={14} /> Kích thước chữ xem trước đã tăng.</p> : null}
        </AccordionSection>

        <AccordionSection icon={<ShieldCheck size={17} />} title="Bảo mật và riêng tư">
          <ToggleSwitch
            checked={Boolean(conversation.autoDeleteAfterSeconds)}
            label="Tự động xóa tin nhắn"
            description={conversation.autoDeleteAfterSeconds ? `Đang bật: ${autoDeleteLabel}` : 'Bật để chọn thời gian xóa'}
            onChange={() => handleOpenAutoDeleteSettings()}
          />
          {conversation.autoDeleteAfterSeconds ? (
            <div className={styles.quickActionsRow}>
              {autoDeleteOptions.slice(1).map((option) => (
                <QuickActionButton
                  key={option.label}
                  icon={<CalendarClock size={16} />}
                  label={option.label}
                  active={(conversation.autoDeleteAfterSeconds ?? null) === option.value}
                  onClick={() => handleOpenAutoDeleteSettings()}
                />
              ))}
            </div>
          ) : null}
          <ToggleSwitch
            checked={isHiddenForMe}
            label="Ẩn hội thoại"
            description="Cần mật khẩu ẩn để mở lại"
            onChange={(checked) => {
              if (checked) {
                handleOpenHideConversation('hide')
                return
              }
              handleOpenHideConversation('unhide')
            }}
          />
          <ToggleSwitch
            checked={isLockedForMe}
            label="Khóa hội thoại"
            description="Cần mật khẩu khóa để mở lại"
            onChange={(checked) => {
              if (checked) {
                handleOpenLockConversation()
                return
              }
              updatePreferences({ locked: false })
            }}
          />
          <DangerActionButton icon={<Trash2 size={17} />} label="Xóa lịch sử chat phía bạn" description="Không ảnh hưởng người khác" onClick={() => void handleClearChatForMe()} />
          {isGroup ? (
            <>
              <DangerActionButton icon={<LogOut size={17} />} label={groupActionBusyId === 'leave-group' ? 'Đang rời nhóm...' : 'Rời nhóm'} disabled={groupActionBusyId === 'leave-group' || (myGroupRole === 'leader' && !canLeaderLeaveGroup)} onClick={() => void handleLeaveGroup()} />
              {canDissolveSelectedGroup ? <DangerActionButton icon={<Trash2 size={17} />} label={groupActionBusyId === 'dissolve-group' ? 'Đang giải tán...' : 'Giải tán nhóm'} onClick={() => void handleDissolveGroup()} disabled={groupActionBusyId === 'dissolve-group'} /> : null}
            </>
          ) : (
            <>
              <DangerActionButton icon={<Flag size={17} />} label="Báo cáo hội thoại" description="Gửi báo cáo đến quản trị viên để xem xét" onClick={handleOpenReportConversation} />
              <DangerActionButton
                icon={isDirectPeerBlocked ? <ShieldCheck size={17} /> : <ShieldX size={17} />}
                label={isDirectPeerBlocked ? 'Bỏ chặn người dùng' : 'Chặn người dùng'}
                description={isDirectPeerBlocked ? 'Mở lại luồng nhắn tin trực tiếp' : 'Ngừng nhận tin nhắn trực tiếp từ người này'}
                onClick={() => void (isDirectPeerBlocked ? handleUnblockPeer() : handleBlockPeer())}
              />
            </>
          )}
        </AccordionSection>
      </div>
    </div>
  )
}

function Avatar({ name, avatarUrl, online, compact, stacked }: { name: string; avatarUrl?: string | null; online?: boolean; compact?: boolean; stacked?: boolean }) {
  return (
    <span className={cn(styles.settingsAvatar, compact && styles.settingsAvatarCompact, stacked && styles.settingsAvatarStacked)}>
      {avatarUrl ? <img src={avatarUrl} alt={name} /> : getAvatarInitial(name)}
      {online ? <i /> : null}
    </span>
  )
}

function InfoRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className={styles.infoRow}>
      {icon}
      <span>
        <b>{label}</b>
        <small>{value}</small>
      </span>
    </div>
  )
}

function ActionRows({ rows }: { rows: Array<{ icon: ReactNode; label: string; onClick?: () => void }> }) {
  return (
    <div className={styles.actionRows}>
      {rows.map((row) => (
        <button type="button" key={row.label} onClick={row.onClick}>
          {row.icon}
          <span>{row.label}</span>
          <MessageSquareMore size={14} />
        </button>
      ))}
    </div>
  )
}

function GroupBoardPanel({
  pinnedMessages,
}: {
  pinnedMessages: ChatMessage[]
}) {
  return (
    <div className={styles.groupBoardPanel}>
      {pinnedMessages.length ? pinnedMessages.map((item) => (
        <article key={item.id} className={styles.boardItem}>
          <span>
            <b>{item.senderName}</b>
            <small>{item.text || item.fileName || item.type}</small>
          </span>
        </article>
      )) : <EmptySetting label="Chưa có tin nhắn đã ghim trong dữ liệu đang tải." />}
    </div>
  )
}

function EmptySetting({ label }: { label: string }) {
  return <p className={styles.settingsEmpty}>{label}</p>
}

function SkeletonRows() {
  return (
    <div className={styles.settingsSkeletonRows}>
      {Array.from({ length: 3 }).map((_, index) => <i key={index} className={styles.settingsSkeleton} />)}
    </div>
  )
}

function formatActivity(member?: Conversation['members'][number]) {
  if (!member) return 'Đoạn chat cá nhân'
  if (member.online) return 'Đang hoạt động'
  if (!member.lastActiveAt) return 'Ngoại tuyến'
  const lastActiveAt = new Date(member.lastActiveAt).getTime()
  if (Number.isNaN(lastActiveAt)) return 'Ngoại tuyến'
  const diffMinutes = Math.max(1, Math.round((Date.now() - lastActiveAt) / 60000))
  if (diffMinutes < 60) return `Hoạt động ${diffMinutes} phút trước`
  return `Hoạt động ${Math.round(diffMinutes / 60)} giờ trước`
}

function formatFileMeta(item: ChatMessage) {
  const size = item.fileSize ? item.fileSize > 1024 * 1024 ? `${(item.fileSize / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(item.fileSize / 1024))} KB` : 'Không rõ dung lượng'
  return `${size} - ${new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short' }).format(new Date(item.createdAt))}`
}

function getDomain(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, '')
  } catch {
    return value || 'Liên kết'
  }
}
