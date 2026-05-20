import { Bell, CirclePlus, Info, Search, Send, UserPlus } from 'lucide-react'

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
  onOpenConversation: (conversationId: string) => void
  onShowNotifications: () => void
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
  onOpenConversation,
  onShowNotifications,
  onShowNewMessage,
  onShowCreateGroup,
}: MessagesSidebarProps) {
  return (
    <>
      <aside className={styles.rail}>
        <div className={styles.railLogo}>M</div>
        <nav className={styles.railNav}>
          <button type="button" className={cn(styles.railBtn, styles.railBtnActive)} title="Tin nhan" aria-label="Tin nhan">
            <Send size={16} />
          </button>
          <button type="button" className={styles.railBtn} onClick={onShowNewMessage} title="Tao hoi thoai moi" aria-label="Tao hoi thoai moi">
            <UserPlus size={16} />
          </button>
          <button type="button" className={styles.railBtn} onClick={onShowCreateGroup} title="Tao nhom" aria-label="Tao nhom">
            <CirclePlus size={16} />
          </button>
          <button type="button" className={styles.railBtn} onClick={onShowNotifications} title="Thong bao" aria-label="Thong bao">
            <Bell size={16} />
          </button>
          <button type="button" className={cn(styles.railBtn, styles.railBottomBtn)} title="Thong tin" aria-label="Thong tin">
            <Info size={16} />
          </button>
        </nav>
        <div className={styles.railAvatar}>{initials}</div>
      </aside>

      <section className={styles.listPanel}>
        <div className={styles.listHeader}>
          <div className={styles.listHeaderTop}>
            <h1>Tat ca cuoc tro chuyen</h1>
            <button
              type="button"
              className={styles.headerNotifyBtn}
              onClick={onShowNotifications}
              title="Thong bao"
              aria-label="Thong bao"
            >
              <Bell size={14} />
              {notifications.some((item) => !item.is_read) ? <i /> : null}
            </button>
          </div>
          <div className={styles.searchWrap}>
            <Search size={14} />
            <input placeholder="Tim cuoc tro chuyen" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
          </div>
        </div>

        <div className={styles.convList}>
          {conversations.map((conv) => {
            const isActive = conv.id === selectedConversationId
            const name = getConversationDisplayName(conv, userId)
            const fallback = (name[0] || 'C').toUpperCase()
            const lastMessage = conv.lastMessage || null
            const sender = lastMessage ? conv.members.find((member) => member.userId === lastMessage.senderId) || null : null
            const senderName = lastMessage ? (lastMessage.senderId === userId ? 'Ban' : lastMessage.senderName || sender?.fullName || `Nguoi dung #${lastMessage.senderId}`) : ''
            const previewText = !lastMessage
              ? 'Chua co tin nhan'
              : lastMessage.isDeleted || (lastMessage.meta && (lastMessage.meta as Record<string, unknown>).recalled)
                ? 'Tin nhan da duoc thu hoi'
                : lastMessage.type === 'sticker'
                  ? String((lastMessage.meta && (lastMessage.meta as Record<string, unknown>).sticker) || lastMessage.text || 'Sticker')
                  : lastMessage.type === 'image'
                    ? 'Da gui mot hinh anh'
                    : lastMessage.type === 'video'
                      ? 'Da gui mot video'
                      : lastMessage.type === 'audio'
                        ? 'Da gui mot tin nhan am thanh'
                        : lastMessage.mediaUrl
                          ? lastMessage.fileName || 'Da gui tep dinh kem'
                          : lastMessage.text || ''
            const previewLine = lastMessage ? `${senderName}: ${previewText}` : previewText
            const avatarUrl = conv.avatarUrl || (conv.type === 'direct' ? sender?.avatarUrl || null : null)

            return (
              <button
                key={conv.id}
                type="button"
                onClick={() => onOpenConversation(conv.id)}
                className={cn(
                  styles.convItem,
                  isActive && styles.convItemActive,
                  conv.unreadCount > 0 && styles.convItemUnread
                )}
              >
                <div className={styles.convAvatar}>
                  {avatarUrl ? <img src={avatarUrl} alt={name} className={styles.convAvatarImage} loading="lazy" /> : fallback}
                </div>
                <div className={styles.convText}>
                  <div className={styles.convLineTop}>
                    <strong>{name}</strong>
                    <span>{lastMessage ? formatVietnamTime(lastMessage.createdAt) : 'Chat'}</span>
                  </div>
                  <p>{previewLine}</p>
                  {conv.unreadCount > 0 ? (
                    <div className={styles.convFooter}>
                      <span className={styles.convUnreadBadge}>{conv.unreadCount} chua doc</span>
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
