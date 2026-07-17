import { Loader2 } from 'lucide-react'
import { FormEvent, useEffect, useState } from 'react'

import { AppDialog, DialogButton } from './app-dialog'
import styles from './dialogs.module.css'

const REPORT_REASONS = [
  'Spam hoặc quảng cáo',
  'Quấy rối hoặc bắt nạt',
  'Ngôn từ thù ghét',
  'Bạo lực hoặc nguy hiểm',
  'Nội dung nhạy cảm',
  'Thông tin sai lệch',
  'Lừa đảo',
]

export function ReportDialog({
  open,
  onOpenChange,
  title = 'Báo cáo',
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  onSubmit: (payload: { reason: string; details?: string }) => void | Promise<void>
}) {
  const [reason, setReason] = useState(REPORT_REASONS[0])
  const [details, setDetails] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setReason(REPORT_REASONS[0])
    setDetails('')
    setError(null)
    setLoading(false)
  }, [open])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()

    try {
      setLoading(true)
      await onSubmit({ reason, details: details.trim() || undefined })
      onOpenChange(false)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Không thể gửi báo cáo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppDialog
      open={open}
      onOpenChange={(value) => !loading && onOpenChange(value)}
      title={title}
      description="Báo cáo sẽ được gửi đến đội ngũ kiểm duyệt để xem xét."
      footer={
        <>
          <DialogButton type="button" variant="secondary" disabled={loading} onClick={() => onOpenChange(false)}>
            Hủy
          </DialogButton>
          <DialogButton type="submit" form="report-dialog-form" disabled={loading}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            Gửi báo cáo
          </DialogButton>
        </>
      }
    >
      <form id="report-dialog-form" onSubmit={handleSubmit} className={styles.field}>
        <div className={styles.radioList}>
          {REPORT_REASONS.map((item) => (
            <label key={item} className={styles.radioRow}>
              <input type="radio" name="reason" checked={reason === item} onChange={() => setReason(item)} />
              <span>{item}</span>
            </label>
          ))}
        </div>
        <textarea
          className={styles.textarea}
          value={details}
          onChange={(event) => {
            setDetails(event.target.value)
            setError(null)
          }}
          placeholder="Ghi chú thêm cho kiểm duyệt viên (không bắt buộc)..."
        />
        {error ? <span className={styles.error}>{error}</span> : null}
      </form>
    </AppDialog>
  )
}
