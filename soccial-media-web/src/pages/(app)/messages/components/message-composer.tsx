import { CirclePlus, File, Image, Paperclip, Send, Smile, Video, X } from 'lucide-react'
import type { ChangeEvent, Dispatch, RefObject, SetStateAction } from 'react'

import { EMOJI_SET, STICKER_PACKS } from '@/services/messages/constants'
import { cn } from '@/utils'
import styles from '../page.module.css'

type StickerPackName = keyof typeof STICKER_PACKS

type AttachmentDraft = {
  file: File
  type: 'image' | 'video' | 'audio' | 'file'
  previewUrl: string | null
}

type MessageComposerProps = {
  message: string
  setMessage: (value: string) => void
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
  activeStickerPack: StickerPackName
  setActiveStickerPack: Dispatch<SetStateAction<StickerPackName>>
  loadedStickerPacks: Record<StickerPackName, boolean>
  setLoadedStickerPacks: Dispatch<SetStateAction<Record<StickerPackName, boolean>>>
  onSendSticker: (sticker: string) => Promise<void> | void
  attachmentDraft: AttachmentDraft | null
  onRemoveAttachment: () => void
  fileInputRef: RefObject<HTMLInputElement | null>
  imageInputRef: RefObject<HTMLInputElement | null>
  videoInputRef: RefObject<HTMLInputElement | null>
}

const formatFileSize = (bytes: number) => `${Math.max(1, Math.round(bytes / 1024))} KB`

export function MessageComposer({
  message,
  setMessage,
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
  activeStickerPack,
  setActiveStickerPack,
  loadedStickerPacks,
  setLoadedStickerPacks,
  onSendSticker,
  attachmentDraft,
  onRemoveAttachment,
  fileInputRef,
  imageInputRef,
  videoInputRef,
}: MessageComposerProps) {
  return (
    <footer className={styles.composer}>
      <input ref={fileInputRef} type="file" className={styles.hiddenFileInput} onChange={handleFileSelected} aria-label="Dinh kem tep" title="Dinh kem tep" />
      <input ref={imageInputRef} type="file" accept="image/*" className={styles.hiddenFileInput} onChange={handleFileSelected} aria-label="Dinh kem anh" title="Dinh kem anh" />
      <input ref={videoInputRef} type="file" accept="video/*" className={styles.hiddenFileInput} onChange={handleFileSelected} aria-label="Dinh kem video" title="Dinh kem video" />

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
          <button type="button" className={styles.attachmentRemoveBtn} onClick={onRemoveAttachment} disabled={busyUploading || isSendingMessage} title="Bo tep dinh kem" aria-label="Bo tep dinh kem">
            <X size={14} />
          </button>
        </div>
      ) : null}

      <div className={styles.composerRow}>
        <button type="button" className={styles.composerIconBtn} onClick={handlePickAttachment} disabled={busyUploading} title="Chon tep dinh kem" aria-label="Chon tep dinh kem">
          <CirclePlus size={18} />
        </button>

        {composerMenuOpen ? (
          <div className={styles.composerPlusMenu}>
            <button type="button" onClick={() => handlePickAttachmentType('image')}>
              <Image size={16} />
              Gui anh
            </button>
            <button type="button" onClick={() => handlePickAttachmentType('video')}>
              <Video size={16} />
              Gui video
            </button>
            <button type="button" onClick={() => handlePickAttachmentType('file')}>
              <File size={16} />
              Gui tep
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
              Chen emoji
            </button>
          </div>
        ) : null}

        <textarea
          className={styles.composerTextarea}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder={attachmentDraft ? 'Nhap chu thich...' : 'Nhap tin nhan...'}
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
          title="Mo bang emoji"
          aria-label="Mo bang emoji"
        >
          <Smile size={16} />
        </button>
        <button type="button" className={styles.composerIconBtn} onClick={() => fileInputRef.current?.click()} disabled={busyUploading} title="Chon tep" aria-label="Chon tep">
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
          title="Mo sticker"
          aria-label="Mo sticker"
        >
          <span className={styles.composerStickerIcon}>+</span>
        </button>
        {showStickerPanel ? (
          <button type="button" className={styles.composerIconBtn} onClick={() => setShowStickerPanel(false)} title="Dong sticker" aria-label="Dong sticker">
            <X size={14} />
          </button>
        ) : null}
        <button
          type="button"
          className={styles.composerSendBtn}
          onClick={handleSend}
          disabled={(!message.trim() && !attachmentDraft) || isSendingMessage || busyUploading}
          title="Gui tin nhan"
          aria-label="Gui tin nhan"
        >
          <Send size={17} />
        </button>

        {showEmojiPanel ? (
          <div className={styles.emojiPanel}>
            {EMOJI_SET.map((emoji) => (
              <button key={emoji} type="button" onClick={() => setMessage(`${message}${emoji}`)}>
                {emoji}
              </button>
            ))}
          </div>
        ) : null}

        {showStickerPanel ? (
          <div className={styles.stickerPanel}>
            <div className={styles.stickerTabs}>
              {(Object.keys(STICKER_PACKS) as Array<StickerPackName>).map((packName) => (
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
              STICKER_PACKS[activeStickerPack].map((sticker) => (
                <button key={sticker} type="button" title="Gui sticker" aria-label="Gui sticker" onClick={() => void onSendSticker(sticker)}>
                  {sticker}
                </button>
              ))
            ) : (
              <p className={styles.stickerLoading}>Dang tai pack {activeStickerPack}...</p>
            )}
          </div>
        ) : null}
      </div>
    </footer>
  )
}
