import { CirclePlus, File, Image, Paperclip, Send, Smile, Sparkles, Sticker, Video, X } from 'lucide-react'
import { useState, type ChangeEvent, type Dispatch, type RefObject, type SetStateAction } from 'react'

import { cn } from '@/utils'
import styles from '../page.module.css'

type AttachmentDraft = {
  file: File
  type: 'image' | 'video' | 'audio' | 'file'
  previewUrl: string | null
}

type EmojiInsert = {
  value: string
  label: string
  emoji: string
}

const QUICK_EMOJI_SET: EmojiInsert[] = [
  { value: '😀', label: 'Cười', emoji: '😀' },
  { value: '😍', label: 'Yêu thích', emoji: '😍' },
  { value: '😂', label: 'Cười lớn', emoji: '😂' },
  { value: '🥳', label: 'Ăn mừng', emoji: '🥳' },
  { value: '👍', label: 'Thích', emoji: '👍' },
  { value: '❤️', label: 'Trái tim', emoji: '❤️' },
  { value: '🔥', label: 'Nổi bật', emoji: '🔥' },
  { value: '✨', label: 'Lấp lánh', emoji: '✨' },
  { value: '🤝', label: 'Cảm ơn', emoji: '🤝' },
  { value: '💪', label: 'Mạnh mẽ', emoji: '💪' },
  { value: '🚀', label: 'Bứt phá', emoji: '🚀' },
  { value: '🌟', label: 'Ngôi sao', emoji: '🌟' },
]

const EMOJI_STICKER_PACKS = {
  'Cảm xúc': [
    { value: 'emoji:🤩', label: 'Mắt sao', emoji: '🤩' },
    { value: 'emoji:🥰', label: 'Ấm áp', emoji: '🥰' },
    { value: 'emoji:😂', label: 'Cười lớn', emoji: '😂' },
    { value: 'emoji:🥹', label: 'Cảm động', emoji: '🥹' },
  ],
  'Nổi bật': [
    { value: 'emoji:🔥', label: 'Nổi bật', emoji: '🔥' },
    { value: 'emoji:🎉', label: 'Ăn mừng', emoji: '🎉' },
    { value: 'emoji:🚀', label: 'Bứt phá', emoji: '🚀' },
    { value: 'emoji:🌈', label: 'Rực rỡ', emoji: '🌈' },
  ],
  'Hành động': [
    { value: 'emoji:👏', label: 'Vỗ tay', emoji: '👏' },
    { value: 'emoji:🙌', label: 'Tuyệt vời', emoji: '🙌' },
    { value: 'emoji:💪', label: 'Mạnh mẽ', emoji: '💪' },
    { value: 'emoji:🤝', label: 'Cảm ơn', emoji: '🤝' },
  ],
  'Tiện ích': [
    { value: 'emoji:✅', label: 'Đã xong', emoji: '✅' },
    { value: 'emoji:❓', label: 'Cần hỏi', emoji: '❓' },
    { value: 'emoji:💡', label: 'Ý tưởng', emoji: '💡' },
    { value: 'emoji:📎', label: 'Đính kèm', emoji: '📎' },
  ],
} satisfies Record<string, EmojiInsert[]>

type StickerPackName = keyof typeof EMOJI_STICKER_PACKS

type MessageComposerProps = {
  message: string
  setMessage: (value: string) => void
  onStopTyping?: () => void
  handleSend: () => void | Promise<void>
  handleFileSelected: (event: ChangeEvent<HTMLInputElement>) => void
  handlePickAttachment: () => void
  handlePickAttachmentType: (type: 'image' | 'video' | 'file') => void
  busyUploading: boolean
  isSendingMessage: boolean
  composerMenuOpen: boolean
  setComposerMenuOpen: Dispatch<SetStateAction<boolean>>
  showEmojiPanel: boolean
  setShowEmojiPanel: Dispatch<SetStateAction<boolean>>
  showStickerPanel: boolean
  setShowStickerPanel: Dispatch<SetStateAction<boolean>>
  onSendSticker: (sticker: string) => Promise<void> | void
  attachmentDraft: AttachmentDraft | null
  onRemoveAttachment: () => void
  fileInputRef: RefObject<HTMLInputElement | null>
  imageInputRef: RefObject<HTMLInputElement | null>
  videoInputRef: RefObject<HTMLInputElement | null>
  onSuggestReplies?: () => void | Promise<void>
  isSuggesting?: boolean
}

const formatFileSize = (bytes: number) => `${Math.max(1, Math.round(bytes / 1024))} KB`

export function MessageComposer({
  message,
  setMessage,
  onStopTyping,
  handleSend,
  handleFileSelected,
  handlePickAttachment,
  handlePickAttachmentType,
  busyUploading,
  isSendingMessage,
  composerMenuOpen,
  setComposerMenuOpen,
  showEmojiPanel,
  setShowEmojiPanel,
  showStickerPanel,
  setShowStickerPanel,
  onSendSticker,
  attachmentDraft,
  onRemoveAttachment,
  fileInputRef,
  imageInputRef,
  videoInputRef,
  onSuggestReplies,
  isSuggesting,
}: MessageComposerProps) {
  const [activeStickerPack, setActiveStickerPack] = useState<StickerPackName>('Cảm xúc')
  const [loadedStickerPacks, setLoadedStickerPacks] = useState<Record<string, boolean>>({ 'Cảm xúc': true })

  return (
    <footer className={styles.composer}>
      <input ref={fileInputRef} type="file" className={styles.hiddenFileInput} onChange={handleFileSelected} aria-label="Đính kèm tệp" title="Đính kèm tệp" />
      <input ref={imageInputRef} type="file" accept="image/*" className={styles.hiddenFileInput} onChange={handleFileSelected} aria-label="Đính kèm ảnh" title="Đính kèm ảnh" />
      <input ref={videoInputRef} type="file" accept="video/*" className={styles.hiddenFileInput} onChange={handleFileSelected} aria-label="Đính kèm video" title="Đính kèm video" />

      {attachmentDraft ? (
        <div className={styles.attachmentDraft}>
          <div className={styles.attachmentPreview}>
            {attachmentDraft.type === 'image' && attachmentDraft.previewUrl ? (
              <img src={attachmentDraft.previewUrl} alt={attachmentDraft.file.name} />
            ) : attachmentDraft.type === 'video' && attachmentDraft.previewUrl ? (
              <video src={attachmentDraft.previewUrl} muted />
            ) : (
              <File size={18} />
            )}
          </div>
          <div className={styles.attachmentMeta}>
            <strong>{attachmentDraft.file.name}</strong>
            <span>{attachmentDraft.file.type || 'application/octet-stream'} - {formatFileSize(attachmentDraft.file.size)}</span>
          </div>
          <button type="button" className={styles.attachmentRemoveBtn} onClick={onRemoveAttachment} disabled={busyUploading || isSendingMessage} title="Bỏ tệp đính kèm" aria-label="Bỏ tệp đính kèm">
            <X size={14} />
          </button>
        </div>
      ) : null}

      <div className={styles.composerRow}>
        <button type="button" className={styles.composerIconBtn} onClick={handlePickAttachment} disabled={busyUploading} title="Chọn tệp đính kèm" aria-label="Chọn tệp đính kèm">
          <CirclePlus size={18} />
        </button>

        {onSuggestReplies ? (
          <button type="button" className={styles.composerIconBtn} onClick={onSuggestReplies} disabled={isSuggesting} title="Gợi ý trả lời AI" aria-label="Gợi ý trả lời AI">
            <Sparkles size={18} />
          </button>
        ) : null}

        {composerMenuOpen ? (
          <div className={styles.composerPlusMenu}>
            <button type="button" onClick={() => handlePickAttachmentType('image')}>
              <Image size={16} />
              Gửi ảnh
            </button>
            <button type="button" onClick={() => handlePickAttachmentType('video')}>
              <Video size={16} />
              Gửi video
            </button>
            <button type="button" onClick={() => handlePickAttachmentType('file')}>
              <File size={16} />
              Gửi tệp
            </button>
            <button
              type="button"
              onClick={() => {
                setShowEmojiPanel(true)
                setShowStickerPanel(false)
                setComposerMenuOpen(false)
              }}
            >
              <Smile size={16} />
              Chèn emoji
            </button>
          </div>
        ) : null}

        <textarea
          className={styles.composerTextarea}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onBlur={() => onStopTyping?.()}
          placeholder={attachmentDraft ? 'Nhập chú thích...' : 'Nhập tin nhắn...'}
          rows={1}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              void handleSend()
            }
          }}
        />

        <button
          type="button"
          className={styles.composerIconBtn}
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
        <button type="button" className={styles.composerIconBtn} onClick={() => fileInputRef.current?.click()} disabled={busyUploading} title="Chọn tệp" aria-label="Chọn tệp">
          <Paperclip size={16} />
        </button>
        <button
          type="button"
          className={styles.composerIconBtn}
          onClick={() => {
            setShowEmojiPanel(false)
            setShowStickerPanel((prev) => !prev)
            setComposerMenuOpen(false)
          }}
          disabled={busyUploading}
          title="Mở sticker"
          aria-label="Mở sticker"
        >
          <Sticker size={16} />
        </button>
        {showStickerPanel ? (
          <button type="button" className={styles.composerIconBtn} onClick={() => setShowStickerPanel(false)} title="Đóng sticker" aria-label="Đóng sticker">
            <X size={14} />
          </button>
        ) : null}
        <button
          type="button"
          className={styles.composerSendBtn}
          onClick={handleSend}
          disabled={(!message.trim() && !attachmentDraft) || isSendingMessage || busyUploading}
          title="Gửi tin nhắn"
          aria-label="Gửi tin nhắn"
        >
          <Send size={17} />
        </button>

        {showEmojiPanel ? (
          <div className={styles.emojiPanel}>
            {QUICK_EMOJI_SET.map((item) => (
              <button key={item.value} type="button" title={item.label} aria-label={item.label} onClick={() => setMessage(`${message}${item.value}`)}>
                <span className={styles.emojiGlyph}>{item.emoji}</span>
              </button>
            ))}
          </div>
        ) : null}

        {showStickerPanel ? (
          <div className={styles.stickerPanel}>
            <div className={styles.stickerTabs}>
              {(Object.keys(EMOJI_STICKER_PACKS) as Array<StickerPackName>).map((packName) => (
                <button
                  key={packName}
                  type="button"
                  className={cn(packName === activeStickerPack && styles.stickerTabActive)}
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
            {loadedStickerPacks[activeStickerPack] ? (
              EMOJI_STICKER_PACKS[activeStickerPack].map((sticker) => (
                <button key={sticker.value} type="button" title={sticker.label} aria-label={sticker.label} onClick={() => void onSendSticker(sticker.value)}>
                  <span className={styles.stickerGlyph}>{sticker.emoji}</span>
                </button>
              ))
            ) : (
              <p className={styles.stickerLoading}>Đang tải bộ {activeStickerPack}...</p>
            )}
          </div>
        ) : null}
      </div>
    </footer>
  )
}
