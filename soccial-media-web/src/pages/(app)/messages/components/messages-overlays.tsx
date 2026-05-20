import { Check, CornerUpRight, Pin, RotateCcw, Trash2 } from 'lucide-react'

import { formatVietnamTime, getAvatarInitial, getConversationDisplayName } from '@/services/messages/formatters'
import { parseNotificationMeta, type MessageNotificationItem } from '@/services/messages/notification-meta'
import type { ChatMessage, Conversation, FriendConnection } from '@/types'
import { cn } from '@/utils'
import styles from '../page.module.css'

type MessagesOverlaysProps = {
  userId?: number
  conversations: Conversation[]
  selectedConversationId: string | null
  actionMenu: { messageId: string; x: number; y: number } | null
  activeActionMessage: ChatMessage | null
  pinnedMessageIds: Set<string>
  forwardingMessageId: string | null
  showNewMessageModal: boolean
  newMessageKeyword: string
  searchUsersResult: Array<{ id: number; name: string }>
  showNotificationsDrawer: boolean
  notifications: MessageNotificationItem[]
  showCreateGroupModal: boolean
  groupName: string
  groupSearchKeyword: string
  filteredCreateGroupInviteCandidates: FriendConnection[]
  groupMemberIds: number[]
  busyActionId: string | null
  creatingGroup: boolean
  acceptedFriendsCount: number
  setForwardingMessageId: (messageId: string | null) => void
  setActionMenu: (value: { messageId: string; x: number; y: number } | null) => void
  setShowNewMessageModal: (value: boolean) => void
  setNewMessageKeyword: (value: string) => void
  handleCreateConversationWithUser: (userId: number) => void | Promise<void>
  setShowNotificationsDrawer: (value: boolean) => void
  handleOpenNotificationConversation: (conversationId: string | null | undefined) => void
  handleAcceptFromNotification: (item: MessageNotificationItem) => void | Promise<void>
  setShowCreateGroupModal: (value: boolean) => void
  handleCreateGroupConversation: () => void | Promise<void>
  setGroupName: (value: string) => void
  setGroupSearchKeyword: (value: string) => void
  toggleGroupMember: (userId: number) => void
  handleTogglePinMessage: (message: ChatMessage) => void | Promise<void>
  handleRecall: (message: ChatMessage) => void | Promise<void>
  handleDeleteMessage: (message: ChatMessage) => void | Promise<void>
  handleForward: (targetConversationId: string) => void | Promise<void>
}

function ListIdentity({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <span className={styles.listEntryIdentity}>
      <span className={styles.listEntryAvatar}>{getAvatarInitial(title)}</span>
      <span className={styles.listEntryMeta}>
        <strong className={styles.listEntryTitle}>{title}</strong>
        <small className={styles.listEntrySubtitle}>{subtitle}</small>
      </span>
    </span>
  )
}

export function MessagesOverlays({
  userId,
  conversations,
  selectedConversationId,
  actionMenu,
  activeActionMessage,
  pinnedMessageIds,
  forwardingMessageId,
  showNewMessageModal,
  newMessageKeyword,
  searchUsersResult,
  showNotificationsDrawer,
  notifications,
  showCreateGroupModal,
  groupName,
  groupSearchKeyword,
  filteredCreateGroupInviteCandidates,
  groupMemberIds,
  busyActionId,
  creatingGroup,
  acceptedFriendsCount,
  setForwardingMessageId,
  setActionMenu,
  setShowNewMessageModal,
  setNewMessageKeyword,
  handleCreateConversationWithUser,
  setShowNotificationsDrawer,
  handleOpenNotificationConversation,
  handleAcceptFromNotification,
  setShowCreateGroupModal,
  handleCreateGroupConversation,
  setGroupName,
  setGroupSearchKeyword,
  toggleGroupMember,
  handleTogglePinMessage,
  handleRecall,
  handleDeleteMessage,
  handleForward,
}: MessagesOverlaysProps) {
  return (
    <>
      {actionMenu && activeActionMessage ? (
        <div
          className={styles.actionMenu}
          style={{ left: actionMenu.x, top: actionMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className={styles.actionMenuHeader}>
            <span className={styles.listEntryAvatar}>
              {getAvatarInitial(activeActionMessage.senderName || `Nguoi dung #${activeActionMessage.senderId}`)}
            </span>
            <div className={styles.actionMenuMeta}>
              <strong>{String(activeActionMessage.senderName || `Nguoi dung #${activeActionMessage.senderId}`)}</strong>
              <small>{formatVietnamTime(activeActionMessage.createdAt)}</small>
            </div>
          </div>
          <button type="button" onClick={() => { setForwardingMessageId(activeActionMessage.id); setActionMenu(null) }}>
            <CornerUpRight size={15} />
            Chuyen tiep
          </button>
          <button type="button" onClick={() => { void handleTogglePinMessage(activeActionMessage); setActionMenu(null) }}>
            <Pin size={15} />
            {pinnedMessageIds.has(activeActionMessage.id) ? 'Bo ghim' : 'Ghim'}
          </button>
          {activeActionMessage.senderId === userId ? (
            <button type="button" onClick={() => { void handleRecall(activeActionMessage); setActionMenu(null) }}>
              <RotateCcw size={15} />
              Thu hoi
            </button>
          ) : null}
          {activeActionMessage.senderId === userId ? (
            <button className={styles.actionMenuDanger} type="button" onClick={() => { void handleDeleteMessage(activeActionMessage); setActionMenu(null) }}>
              <Trash2 size={15} />
              Xoa
            </button>
          ) : null}
        </div>
      ) : null}

      {showNewMessageModal ? (
        <div className={styles.overlayBackdrop}>
          <div className={styles.overlayCard}>
            <h3>Tin nhan moi</h3>
            <input value={newMessageKeyword} onChange={(event) => setNewMessageKeyword(event.target.value)} placeholder="Nhap ten ban be hoac email dang ky" />
            <div className={styles.overlayList}>
              {searchUsersResult.map((item) => (
                <button key={item.id} type="button" onClick={() => void handleCreateConversationWithUser(item.id)}>
                  <ListIdentity title={item.name} subtitle={`ID ${item.id}`} />
                </button>
              ))}
              {searchUsersResult.length === 0 ? <p>Khong co ket qua phu hop.</p> : null}
            </div>
            <button type="button" className={styles.overlayCloseBtn} onClick={() => setShowNewMessageModal(false)}>Dong</button>
          </div>
        </div>
      ) : null}

      {showNotificationsDrawer ? (
        <div className={styles.overlayBackdrop}>
          <div className={styles.overlayCard}>
            <h3>Thong bao nang cao</h3>
            <div className={styles.overlayList}>
              {notifications.map((item) => {
                const meta = parseNotificationMeta(item)
                const conversationId = meta?.conversationId
                const canAccept = item.type === 'friend-request' && !item.is_read && Boolean(meta?.requesterId || meta?.friendshipId)
                return (
                  <div key={item.id} className={styles.notifyCard}>
                    <button type="button" className={styles.notifyMainBtn} onClick={() => handleOpenNotificationConversation(conversationId)}>
                      <ListIdentity title={item.title} subtitle={`${item.body || 'Thong bao he thong'} - ${new Date(item.created_at).toLocaleString('vi-VN')}`} />
                    </button>
                    <div className={styles.notifyActions}>
                      {conversationId ? <button type="button" onClick={() => handleOpenNotificationConversation(conversationId)}>Mo doan chat</button> : null}
                      {canAccept ? (
                        <button type="button" className={styles.notifyAcceptBtn} disabled={busyActionId === `notif-${item.id}`} onClick={() => void handleAcceptFromNotification(item)}>
                          {busyActionId === `notif-${item.id}` ? 'Dang dong y...' : 'Dong y'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                )
              })}
              {notifications.length === 0 ? <p>Hien chua co thong bao quan trong.</p> : null}
            </div>
            <button type="button" className={styles.overlayCloseBtn} onClick={() => setShowNotificationsDrawer(false)}>Dong</button>
          </div>
        </div>
      ) : null}

      {forwardingMessageId ? (
        <div className={styles.overlayBackdrop}>
          <div className={styles.forwardDialog}>
            <h3>Chuyen tiep tin nhan</h3>
            <p>Chon cuoc tro chuyen de chuyen tiep:</p>
            <div className={styles.forwardList}>
              {conversations.filter((conv) => conv.id !== selectedConversationId).map((conv) => {
                const name = getConversationDisplayName(conv, userId)
                return (
                  <button key={conv.id} type="button" onClick={() => void handleForward(conv.id)}>
                    <ListIdentity title={name} subtitle={`ID ${conv.id}`} />
                  </button>
                )
              })}
            </div>
            <button type="button" className={styles.forwardCancel} onClick={() => setForwardingMessageId(null)}>Huy</button>
          </div>
        </div>
      ) : null}

      {showCreateGroupModal ? (
        <div className={styles.overlayBackdrop}>
          <div className={styles.overlayCard}>
            <h3>Tao nhom chat</h3>
            <input value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="Nhap ten nhom" />
            <input value={groupSearchKeyword} onChange={(event) => setGroupSearchKeyword(event.target.value)} placeholder="Tim ban be de them vao nhom" />
            <div className={styles.overlayList}>
              {filteredCreateGroupInviteCandidates.map((friend) => {
                const checked = groupMemberIds.includes(friend.id)
                return (
                  <button key={friend.id} type="button" onClick={() => toggleGroupMember(friend.id)}>
                    <ListIdentity title={friend.fullName} subtitle={friend.email || friend.phone || `ID ${friend.id}`} />
                    <span className={cn(styles.selectPill, checked && styles.selectPillActive)}>
                      {checked ? <Check size={13} /> : 'Chon'}
                    </span>
                  </button>
                )
              })}
              {acceptedFriendsCount === 0 ? <p>Ban chua co ban be de tao nhom.</p> : null}
              {acceptedFriendsCount > 0 && filteredCreateGroupInviteCandidates.length === 0 ? <p>Khong tim thay ban be phu hop.</p> : null}
            </div>
            <div className={styles.overlayActions}>
              <button type="button" className={styles.primaryOverlayBtn} disabled={!groupName.trim() || groupMemberIds.length === 0 || creatingGroup} onClick={() => void handleCreateGroupConversation()}>
                {creatingGroup ? 'Dang tao nhom...' : 'Tao nhom'}
              </button>
              <button type="button" className={styles.overlayCloseBtn} onClick={() => setShowCreateGroupModal(false)}>Dong</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
