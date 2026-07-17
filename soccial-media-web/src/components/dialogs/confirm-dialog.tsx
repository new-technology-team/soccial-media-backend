import { AlertTriangle, Loader2, LockKeyhole } from 'lucide-react'
import { useState } from 'react'

import { AppDialog, DialogButton } from './app-dialog'
import styles from './dialogs.module.css'

type ConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel: string
  cancelLabel?: string
  destructive?: boolean
  icon?: 'warning' | 'lock'
  onConfirm: () => void | Promise<void>
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Hủy',
  destructive = true,
  icon = 'warning',
  onConfirm,
}: ConfirmDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = async () => {
    try {
      setLoading(true)
      setError(null)
      await onConfirm()
      onOpenChange(false)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Không thể thực hiện thao tác.')
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
      icon={
        <span className={icon === 'lock' ? styles.lockIcon : styles.warningIcon}>
          {icon === 'lock' ? <LockKeyhole size={22} /> : <AlertTriangle size={22} />}
        </span>
      }
      footer={
        <>
          <DialogButton type="button" variant="secondary" disabled={loading} onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </DialogButton>
          <DialogButton type="button" variant={destructive ? 'destructive' : 'primary'} disabled={loading} onClick={handleConfirm}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            {confirmLabel}
          </DialogButton>
        </>
      }
    >
      {error ? <span className={styles.error}>{error}</span> : <span />}
    </AppDialog>
  )
}
