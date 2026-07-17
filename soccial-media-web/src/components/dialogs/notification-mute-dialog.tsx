import { BellOff, Loader2 } from 'lucide-react'
import { useState } from 'react'

import { AppDialog, DialogButton } from './app-dialog'
import styles from './dialogs.module.css'

export type MuteOptionValue = number | null

const OPTIONS: Array<{ label: string; value: MuteOptionValue }> = [
  { label: '15 phút', value: 15 * 60 },
  { label: '1 giờ', value: 60 * 60 },
  { label: '8 giờ', value: 8 * 60 * 60 },
  { label: '24 giờ', value: 24 * 60 * 60 },
  { label: 'Cho đến khi bật lại', value: null },
]

export function NotificationMuteDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (value: MuteOptionValue) => void | Promise<void>
}) {
  const [selected, setSelected] = useState<MuteOptionValue>(OPTIONS[0].value)
  const [loading, setLoading] = useState(false)

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
      onOpenChange={(value) => !loading && onOpenChange(value)}
      title="Tắt thông báo"
      description="Chọn khoảng thời gian bạn muốn tạm dừng thông báo của hội thoại này."
      variant="sheet"
      icon={<span className={styles.lockIcon}><BellOff size={22} /></span>}
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
              <small>{option.value ? 'Thông báo sẽ tự bật lại sau thời gian này.' : 'Thông báo sẽ tắt cho đến khi bạn bật lại thủ công.'}</small>
            </span>
          </label>
        ))}
      </div>
    </AppDialog>
  )
}

