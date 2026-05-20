import { MoreHorizontal, Smile } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Dispatch, MouseEvent, MutableRefObject, ReactNode, SetStateAction, UIEvent } from 'react'

import { MESSAGE_REACTIONS } from '@/services/messages/constants'
import { formatVietnamTime, getMessageReactionItems, getMessageReactionMeta } from '@/services/messages/formatters'
import type { ChatMessage, Conversation } from '@/types'
import { cn } from '@/utils'
import styles from '../page.module.css'

type VirtualSlice = {
  startIndex: number
  items: ChatMessage[]
}

type MessageThreadProps = {
  userId?: number
  selectedConversation: Conversation | null
  virtualSlice: VirtualSlice
  messagesWrapRef: MutableRefObject<HTMLDivElement | null>
  loadingOlderMessages: boolean
  typingUserIds: Set<number>
  busyActionId: string | null
  pinnedMessageIds: Set<string>
  reactionPickerMessageId: string | null
  setReactionPickerMessageId: Dispatch<SetStateAction<string | null>>
  openMessageActions: (event: MouseEvent<HTMLElement>, messageId: string) => void
  handleReaction: (message: ChatMessage, reaction: string) => void | Promise<void>
  renderMessagePreview: (message: ChatMessage) => ReactNode
  getMessageReadLabel: (message: ChatMessage) => string | null
  onLoadOlderMessages: () => Promise<void>
  onScroll?: (event: UIEvent<HTMLDivElement>) => void
}

export function MessageThread({
  userId,
  selectedConversation,
  virtualSlice,
  messagesWrapRef,
  loadingOlderMessages,
  typingUserIds,
  busyActionId,
  pinnedMessageIds,
  reactionPickerMessageId,
  setReactionPickerMessageId,
  openMessageActions,
  handleReaction,
  renderMessagePreview,
  getMessageReadLabel,
  onLoadOlderMessages,
  onScroll,
}: MessageThreadProps) {
  return (
    <div
      className={cn(styles.messagesWrap, virtualSlice.items.length === 0 && styles.messagesWrapEmpty)}
      ref={messagesWrapRef}
      onScroll={(event) => {
        const element = event.currentTarget
        if (element.scrollTop <= 24) {
          onLoadOlderMessages().catch(() => undefined)
        }
        onScroll?.(event)
      }}
    >
      {loadingOlderMessages ? <p className={styles.historyLoading}>Dang tai tin nhan cu hon...</p> : null}
      {virtualSlice.startIndex > 0 ? (
        <p className={styles.virtualHint}>Dang hien thi cac tin nhan moi nhat. Cuon len de tai them lich su.</p>
      ) : null}

      {virtualSlice.items.map((msg) => {
        const mine = msg.senderId === userId
        const reactionItems = getMessageReactionItems(msg)
        const sender = selectedConversation?.members.find((member) => member.userId === msg.senderId) || null
        const senderName = sender?.fullName || msg.senderName || `Nguoi dung #${msg.senderId}`
        const readLabel = mine ? getMessageReadLabel(msg) : null

        return (
          <div key={msg.id} className={cn(styles.messageRow, mine && styles.messageRowMine)}>
            <div className={styles.messageAvatar}>
              {sender?.avatarUrl ? <img src={sender.avatarUrl} alt={senderName} className={styles.messageAvatarImage} loading="lazy" /> : (senderName[0] || 'U').toUpperCase()}
            </div>

            <div className={styles.messageBlock}>
              <div className={styles.senderRow}>
                {mine ? (
                  <span className={styles.senderSelf}>{senderName}</span>
                ) : (
                  <Link to={`/profile/${msg.senderId}`} className={styles.senderLink}>
                    {senderName}
                  </Link>
                )}
              </div>

              <div
                className={cn(
                  styles.bubble,
                  mine && styles.bubbleMine
                )}
                onContextMenu={(event) => {
                  event.preventDefault()
                  openMessageActions(event, msg.id)
                }}
              >
                <button
                  type="button"
                  className={styles.messageActionTrigger}
                  title="Mo menu thao tac"
                  aria-label="Mo menu thao tac"
                  onClick={(event) => {
                    event.stopPropagation()
                    openMessageActions(event, msg.id)
                  }}
                >
                  <MoreHorizontal size={14} />
                </button>

                {renderMessagePreview(msg)}
                {pinnedMessageIds.has(msg.id) ? <small className={styles.forwardTag}>Da ghim</small> : null}

                {reactionItems.length > 0 ? (
                  <div className={styles.reactionsPill}>
                    {reactionItems.slice(0, 4).map((reaction, index) => {
                      const reactor = selectedConversation?.members.find((member) => member.userId === reaction.userId) || null
                      const reactorName = reactor?.fullName || `Nguoi dung #${reaction.userId}`
                      const meta = getMessageReactionMeta(reaction.meta)
                      return (
                        <span key={`${reaction.userId}-${index}`} className={styles.reactionChip} title={`${reactorName} da tha ${meta.label}`}>
                          {reactor?.avatarUrl ? (
                            <img src={reactor.avatarUrl} alt={reactorName} className={styles.reactionAvatar} loading="lazy" />
                          ) : (
                            <span className={styles.reactionAvatar}>{(reactorName[0] || 'U').toUpperCase()}</span>
                          )}
                          <span className={styles.reactionEmoji}>{meta.emoji}</span>
                        </span>
                      )
                    })}
                    {reactionItems.length > 4 ? <span className={styles.reactionMore}>+{reactionItems.length - 4}</span> : null}
                  </div>
                ) : null}
              </div>

              <div className={cn(styles.messageFooter, mine && styles.messageFooterMine)}>
                <button
                  type="button"
                  className={cn(styles.reactionTrigger, msg.viewerReaction && styles.reactionTriggerActive)}
                  title="Tha cam xuc"
                  aria-label="Tha cam xuc"
                  onClick={() => setReactionPickerMessageId((current) => (current === msg.id ? null : msg.id))}
                >
                  {msg.viewerReaction ? getMessageReactionMeta(msg.viewerReaction).emoji : <Smile size={14} />}
                </button>
                <span className={styles.messageTime}>{formatVietnamTime(msg.createdAt)}</span>
                {readLabel ? <span className={styles.readLabel}>{readLabel}</span> : null}
              </div>

              {reactionPickerMessageId === msg.id ? (
                <div className={styles.reactionPicker}>
                  {MESSAGE_REACTIONS.map((reaction) => (
                    <button
                      key={reaction.type}
                      type="button"
                      className={cn(msg.viewerReaction === reaction.type && styles.reactionPickerActive)}
                      title={reaction.label}
                      aria-label={reaction.label}
                      disabled={busyActionId === msg.id}
                      onClick={() => {
                        void handleReaction(msg, reaction.type)
                        setReactionPickerMessageId(null)
                      }}
                    >
                      {reaction.emoji}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        )
      })}

      {typingUserIds.size > 0 ? (
        <div className={styles.messageRow}>
          <div className={styles.messageAvatar}>...</div>
          <div className={cn(styles.bubble, styles.typingNotice)}>
            {Array.from(typingUserIds)
              .map((memberId) => selectedConversation?.members.find((member) => member.userId === memberId)?.fullName || `Nguoi dung #${memberId}`)
              .join(', ')}{' '}
            dang soan tin nhan...
          </div>
        </div>
      ) : null}

      {virtualSlice.items.length === 0 ? <p className={styles.empty}>Chua co tin nhan trong cuoc tro chuyen nay.</p> : null}
    </div>
  )
}
