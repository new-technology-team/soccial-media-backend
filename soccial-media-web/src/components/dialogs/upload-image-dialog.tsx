import { ImagePlus, Loader2 } from 'lucide-react'
import { DragEvent, FormEvent, useEffect, useRef, useState } from 'react'

import { AppDialog, DialogButton } from './app-dialog'
import styles from './dialogs.module.css'

const MAX_IMAGE_SIZE = 5 * 1024 * 1024

const readImage = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Không thể đọc tệp ảnh.'))
    reader.readAsDataURL(file)
  })

export function UploadImageDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel = 'Cập nhật',
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  submitLabel?: string
  onSubmit: (payload: { file: File; dataUrl: string }) => void | Promise<void>
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setFile(null)
    setPreview(null)
    setError(null)
    setDragging(false)
    setLoading(false)
  }, [open])

  const acceptFile = async (nextFile: File | null) => {
    if (!nextFile) return
    if (!nextFile.type.startsWith('image/')) {
      setError('Vui lòng chọn tệp hình ảnh.')
      return
    }
    if (nextFile.size > MAX_IMAGE_SIZE) {
      setError('Ảnh không được vượt quá 5MB.')
      return
    }

    setError(null)
    setFile(nextFile)
    setPreview(await readImage(nextFile))
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    void acceptFile(event.dataTransfer.files?.[0] || null)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!file || !preview) {
      setError('Vui lòng chọn ảnh trước khi cập nhật.')
      return
    }

    try {
      setLoading(true)
      await onSubmit({ file, dataUrl: preview })
      onOpenChange(false)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Không thể cập nhật ảnh.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppDialog
      open={open}
      onOpenChange={(value) => !loading && onOpenChange(value)}
      title={title}
      description={description}
      footer={
        <>
          <DialogButton type="button" variant="secondary" disabled={loading} onClick={() => onOpenChange(false)}>
            Hủy
          </DialogButton>
          <DialogButton type="submit" form="upload-image-dialog-form" disabled={loading}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            {submitLabel}
          </DialogButton>
        </>
      }
    >
      <form id="upload-image-dialog-form" onSubmit={handleSubmit} className={styles.field}>
        <input
          ref={inputRef}
          className={styles.hiddenFile}
          type="file"
          accept="image/*"
          onChange={(event) => void acceptFile(event.target.files?.[0] || null)}
        />
        <div
          className={`${styles.dropZone} ${dragging ? styles.dropZoneActive : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          role="button"
          tabIndex={0}
        >
          {preview ? <img src={preview} alt="Ảnh xem trước" className={styles.preview} /> : <ImagePlus size={34} />}
          <span className={styles.hint}>Kéo thả ảnh vào đây hoặc nhấn để chọn ảnh.</span>
        </div>
        {error ? <span className={styles.error}>{error}</span> : null}
      </form>
    </AppDialog>
  )
}

