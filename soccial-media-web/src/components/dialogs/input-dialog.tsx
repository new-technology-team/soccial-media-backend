import { Loader2 } from 'lucide-react'
import { FormEvent, useEffect, useState } from 'react'

import { AppDialog, DialogButton, DialogIdentity } from './app-dialog'
import styles from './dialogs.module.css'

type InputDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  label: string
  placeholder: string
  hint?: string
  initialValue?: string
  maxLength?: number
  inputType?: 'text' | 'password'
  required?: boolean
  identity?: {
    name: string
    subtitle?: string
    avatarUrl?: string | null
  }
  submitLabel?: string
  cancelLabel?: string
  validate?: (value: string) => string | null
  onSubmit: (value: string) => void | Promise<void>
}

export function InputDialog({
  open,
  onOpenChange,
  title,
  description,
  label,
  placeholder,
  hint,
  initialValue = '',
  maxLength,
  inputType = 'text',
  required,
  identity,
  submitLabel = 'Lưu',
  cancelLabel = 'Hủy',
  validate,
  onSubmit,
}: InputDialogProps) {
  const [value, setValue] = useState(initialValue)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setValue(initialValue)
    setError(null)
    setLoading(false)
  }, [initialValue, open])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const nextValue = value.trim()
    const validationError =
      (required && !nextValue ? 'Vui lòng nhập thông tin bắt buộc.' : null) ||
      (maxLength && value.length > maxLength ? `Tối đa ${maxLength} ký tự.` : null) ||
      validate?.(value) ||
      null

    if (validationError) {
      setError(validationError)
      return
    }

    try {
      setLoading(true)
      await onSubmit(value)
      onOpenChange(false)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Không thể lưu thay đổi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppDialog
      open={open}
      onOpenChange={(nextOpen) => !loading && onOpenChange(nextOpen)}
      title={title}
      description={description}
      footer={
        <>
          <DialogButton type="button" variant="secondary" disabled={loading} onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </DialogButton>
          <DialogButton type="submit" form="app-input-dialog-form" disabled={loading}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            {submitLabel}
          </DialogButton>
        </>
      }
    >
      <form id="app-input-dialog-form" onSubmit={handleSubmit} className={styles.field}>
        {identity ? <DialogIdentity {...identity} /> : null}
        <label htmlFor="app-input-dialog-control">{label}</label>
        <input
          id="app-input-dialog-control"
          type={inputType}
          className={styles.input}
          value={value}
          maxLength={maxLength}
          autoFocus
          placeholder={placeholder}
          onChange={(event) => {
            setValue(event.target.value)
            setError(null)
          }}
        />
        {hint ? <span className={styles.hint}>{hint}</span> : null}
        {maxLength ? <span className={styles.hint}>{value.length}/{maxLength} ký tự</span> : null}
        {error ? <span className={styles.error}>{error}</span> : null}
      </form>
    </AppDialog>
  )
}

