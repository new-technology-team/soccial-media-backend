import { Bell, BellOff, CirclePlus, FileText, Film, Image, Info, LockKeyhole, MessageCircle, Mic, Phone, Pin, Search, Send, SmilePlus, UserPlus, Users } from 'lucide-react'

import { formatVietnamTime, getConversationDisplayName } from '@/services/messages/formatters'
import type { Conversation, NotificationItem } from '@/types'
import { cn } from '@/utils'
import styles from '../page.module.css'

type MessagesSidebarProps = {
  initials: string
  userId?: number
  conversations: Conversation[]
  selectedConversationId: string | null
  notifications: NotificationItem[]
  searchTerm: string
  setSearchTerm: (value: string) => void
  isLoadingConversations?: boolean
  activeRailTab: 'messages' | 'newMessage' | 'createGroup' | 'notifications' | 'calls'
  onOpenConversation: (conversationId: string) => void
  onShowMessages: () => void
  onShowNotifications: () => void
  onShowCalls: () => void
  onShowNewMessage: () => void
  onShowCreateGroup: () => void
}

export function MessagesSidebar({
  initials,
  userId,
  conversations,
  selectedConversationId,
  notifications,
  searchTerm,
  setSearchTerm,
  isLoadingConversations = false,
  activeRailTab,
  onOpenConversation,
  onShowMessages,
  onShowNotifications,
  onShowCalls,
  onShowNewMessage,
  onShowCreateGroup,
}: MessagesSidebarProps) {
  const visibleConversations = conversations

  return (
    <>
      <aside className={styles.rail}>
        <div className={styles.railLogo}>
          <MessageCircle size={23} />
        </div>
        <nav className={styles.railNav}>
          <button type="button" className={cn(styles.railBtn, activeRailTab === 'messages' && styles.railBtnActive)} onClick={onShowMessages} title="Tin nhắn" aria-label="Tin nhắn">
            <Send size={16} />
          </button>
          <button type="button" className={cn(styles.railBtn, activeRailTab === 'newMessage' && styles.railBtnActive)} onClick={onShowNewMessage} title="Tạo hội thoại mới" aria-label="Tạo hội thoại mới">
            <UserPlus size={16} />
          </button>
          <button type="button" className={cn(styles.railBtn, activeRailTab === 'createGroup' && styles.railBtnActive)} onClick={onShowCreateGroup} title="Tạo nhóm" aria-label="Tạo nhóm">
            <CirclePlus size={16} />
          </button>
          <button type="button" className={cn(styles.railBtn, activeRailTab === 'notifications' && styles.railBtnActive)} onClick={onShowNotifications} title="Thông báo" aria-label="Thông báo">
            <Bell size={16} />
          </button>
          <button type="button" className={cn(styles.railBtn, activeRailTab === 'calls' && styles.railBtnActive)} onClick={onShowCalls} title="Cuộc gọi" aria-label="Cuộc gọi">
            <Phone size={16} />
          </button>
          <button type="button" className={cn(styles.railBtn, styles.railBottomBtn)} title="Thông tin" aria-label="Thông tin">
            <Info size={16} />
          </button>
        </nav>
        <div className={styles.railAvatar}>{initials}</div>
      </aside>

      <section className={styles.listPanel}>
        <div className={styles.listHeader}>
          <div className={styles.listHeaderTop}>
            <h1>Tất cả cuộc trò chuyện</h1>
            <button type="button" className={styles.headerNotifyBtn} onClick={onShowNotifications} title="Thông báo" aria-label="Thông báo">
              <Bell size={14} />
              {notifications.some((item) => !item.is_read) ? <i /> : null}
            </button>
          </div>
          <div className={styles.searchWrap}>
            <Search size={14} />
            <input placeholder="Tìm cuộc trò chuyện" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
          </div>
        </div>

        <div className={styles.convList}>
          {isLoadingConversations ? (
            <>
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className={styles.convSkeleton} aria-hidden="true" />
              ))}
            </>
          ) : null}

          {visibleConversations.map((conv) => {
            const isActive = conv.id === selectedConversationId
            const name = getConversationDisplayName(conv, userId)
            const fallback = (name[0] || 'C').toUpperCase()
            const lastMessage = conv.lastMessage || null
            const sender = lastMessage ? conv.members.find((member) => member.userId === lastMessage.senderId) || null : null
            const senderName = lastMessage ? (lastMessage.senderId === userId ? 'Bạn' : lastMessage.senderName || sender?.fullName || `Người dùng #${lastMessage.senderId}`) : ''
            const previewText = !lastMessage
              ? 'Chưa có tin nhắn'
              : lastMessage.isDeleted || (lastMessage.meta && (lastMessage.meta as Record<string, unknown>).recalled)
                ? 'Tin nhắn đã được thu hồi'
                : lastMessage.type === 'sticker'
                  ? String((lastMessage.meta && (lastMessage.meta as Record<string, unknown>).sticker) || lastMessage.text || 'Sticker').startsWith('icon:')
                    ? 'Sticker'
                    : String((lastMessage.meta && (lastMessage.meta as Record<string, unknown>).sticker) || lastMessage.text || 'Sticker')
                  : lastMessage.type === 'image'
                    ? 'Đã gửi một hình ảnh'
                    : lastMessage.type === 'video'
                      ? 'Đã gửi một video'
                      : lastMessage.type === 'audio'
                        ? 'Đã gửi một tin nhắn âm thanh'
                        : lastMessage.mediaUrl
                          ? lastMessage.fileName || 'Đã gửi tệp đính kèm'
                          : lastMessage.text || ''
            const previewLine = lastMessage ? `${senderName}: ${previewText}` : previewText
            const previewIcon = lastMessage?.type === 'image'
              ? <Image size={13} />
              : lastMessage?.type === 'video'
                ? <Film size={13} />
                : lastMessage?.type === 'audio'
                  ? <Mic size={13} />
                  : lastMessage?.type === 'sticker' || lastMessage?.viewerReaction
                    ? <SmilePlus size={13} />
                    : lastMessage?.mediaUrl
                      ? <FileText size={13} />
                      : null
            const directPeer = conv.type === 'direct' ? conv.members.find((member) => member.userId !== userId) || null : null
            const peerUsername = conv.type === 'direct' ? directPeer?.username || null : null
            const avatarUrl = conv.avatarUrl || (conv.type === 'direct' ? directPeer?.avatarUrl || sender?.avatarUrl || null : null)
            const isOnline = Boolean(directPeer?.online)
            const statusLabel = conv.type === 'group'
              ? `${conv.members.length} thành viên${conv.onlineCount ? ` · ${conv.onlineCount} online` : ''}`
              : isOnline
                ? 'Đang hoạt động'
                : directPeer?.lastActiveAt
                  ? `Hoạt động ${new Date(directPeer.lastActiveAt).toLocaleString('vi-VN')}`
                  : 'Offline'

            return (
              <button
                key={conv.id}
                type="button"
                onClick={() => onOpenConversation(conv.id)}
                className={cn(styles.convItem, isActive && styles.convItemActive, conv.unreadCount > 0 && styles.convItemUnread)}
              >
                <div className={styles.convAvatar}>
                  {avatarUrl ? <img src={avatarUrl} alt={name} className={styles.convAvatarImage} loading="lazy" onError={(event) => { event.currentTarget.style.display = 'none' }} /> : fallback}
                  <span className={cn(styles.presenceDot, isOnline ? styles.presenceDotOnline : styles.presenceDotOffline)} />
                </div>
                <div className={styles.convText}>
                  <div className={styles.convLineTop}>
                    <strong>{name} {conv.isPinned ? <Pin size={11} /> : null} {conv.isMuted ? <BellOff size={11} /> : null} {conv.isHidden ? <LockKeyhole size={11} /> : null} {conv.isLocked ? <LockKeyhole size={11} /> : null}</strong>
                    <span>{lastMessage ? formatVietnamTime(lastMessage.createdAt) : 'Chat'}</span>
                  </div>
                  {peerUsername ? <p className={styles.convUsername}>@{peerUsername}</p> : null}
                  <div className={styles.convStatusLine}>
                    {conv.type === 'group' ? <Users size={12} /> : <span className={cn(styles.statusSpark, isOnline ? styles.statusSparkOnline : styles.statusSparkOffline)} />}
                    <small>{statusLabel}</small>
                  </div>
                  <p className={styles.convPreviewLine}>{previewIcon}{previewLine}</p>
                  {conv.unreadCount > 0 ? (
                    <div className={styles.convFooter}>
                      <span className={styles.convUnreadBadge}>{conv.unreadCount} chưa đọc</span>
                    </div>
                  ) : null}
                </div>
              </button>
            )
          })}
        </div>
      </section>
    </>
  )
}
