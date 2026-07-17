import { Loader2, TimerReset } from 'lucide-react'
import { useEffect, useState } from 'react'

import { AppDialog, DialogButton } from './app-dialog'
import styles from './dialogs.module.css'

const OPTIONS: Array<{ label: string; value: number | null; description: string }> = [
  { label: 'Không tự động xóa', value: null, description: 'Tin nhắn sẽ được giữ lại cho đến khi bạn xóa thủ công.' },
  { label: 'Sau 1 giờ', value: 3600, description: 'Phù hợp với các trao đổi ngắn hạn.' },
  { label: 'Sau 24 giờ', value: 86400, description: 'Tin nhắn sẽ biến mất sau một ngày.' },
  { label: 'Sau 7 ngày', value: 604800, description: 'Giữ lịch sử trong một tuần rồi tự xóa.' },
  { label: 'Sau 30 ngày', value: 2592000, description: 'Lưu nội dung trong một tháng trước khi tự xóa.' },
]

export function AutoDeleteMessageDialog({
  open,
  onOpenChange,
  value,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: number | null
  onSubmit: (value: number | null) => void | Promise<void>
}) {
  const [selected, setSelected] = useState<number | null>(value)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) setSelected(value)
  }, [open, value])

  const handleApply = async () => {
    try {
      setLoading(true)
      await onSubmit(selected)
      onOpenChange(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppDialog
      open={open}
      onOpenChange={(nextOpen) => !loading && onOpenChange(nextOpen)}
      title="Tự động xóa tin nhắn"
      description="Chọn thời hạn tự động xóa cho các tin nhắn mới trong hội thoại này."
      icon={<span className={styles.lockIcon}><TimerReset size={22} /></span>}
      footer={
        <>
          <DialogButton type="button" variant="secondary" disabled={loading} onClick={() => onOpenChange(false)}>
            Hủy
          </DialogButton>
          <DialogButton type="button" disabled={loading} onClick={handleApply}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            Áp dụng
          </DialogButton>
        </>
      }
    >
      <div className={styles.optionList}>
        {OPTIONS.map((option) => (
          <label key={option.label} className={styles.optionRow}>
            <input type="radio" checked={selected === option.value} onChange={() => setSelected(option.value)} />
            <span className={styles.optionCopy}>
              <b>{option.label}</b>
              <small>{option.description}</small>
            </span>
          </label>
        ))}
      </div>
    </AppDialog>
  )
}

