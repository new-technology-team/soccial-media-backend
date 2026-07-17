import { useEffect, useState } from 'react'
import { AlertTriangle, Lock, Save } from 'lucide-react'

import { api } from '@/api/client'
import { AdminPage, Panel, StatusBadge, adminStyles as styles } from '@/components/admin/admin-ui'
import { useAuthStore } from '@/contexts/auth-store'
import { toast } from '@/hooks/use-toast'

const groups = [
  {
    id: 'auth',
    title: 'Authentication',
    items: [
      ['otp', 'OTP bắt buộc', 'Yêu cầu xác thực OTP khi đăng ký hoặc reset mật khẩu.', true],
      ['register', 'Cho phép đăng ký mới', 'Tắt khi hệ thống đang bảo trì hoặc bị spam.', true],
      ['session', 'Session timeout ngắn', 'Giảm thời gian sống phiên đăng nhập admin.', false],
    ],
  },
  {
    id: 'moderation',
    title: 'Moderation',
    items: [
      ['auto', 'Auto moderation', 'Bật AI moderation score và toxicity indicator.', true],
      ['notify', 'Thông báo report mới', 'Gửi toast/email cho moderator khi có báo cáo ưu tiên.', true],
    ],
  },
  {
    id: 'security',
    title: 'Security',
    items: [
      ['rate', 'Rate limiting', 'Giới hạn request theo IP/device.', true],
      ['device', 'Device control', 'Theo dõi thiết bị lạ và IP bất thường.', true],
    ],
  },
  {
    id: 'system',
    title: 'System',
    items: [
      ['logging', 'Audit logging', 'Lưu mọi thao tác admin/moderator.', true],
      ['maintenance', 'Maintenance mode', 'Đóng hệ thống tạm thời để bảo trì.', false],
    ],
  },
] as const

export default function AdminSettingsPage() {
  const me = useAuthStore((state) => state.user)
  const token = useAuthStore((state) => state.accessToken)
  const defaults = Object.fromEntries(groups.flatMap((group) => group.items.map(([key, , , value]) => [key, value])))
  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    defaults,
  )
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!token || me?.role !== 'admin') return
    setLoading(true)
    api.adminSystemSettings(token)
      .then((res) => setEnabled({ ...defaults, ...(res.settings || {}) }))
      .catch((error) => {
        toast({
          title: 'Không thể tải cấu hình hệ thống',
          description: error instanceof Error ? error.message : 'Vui lòng thử lại.', variant: 'destructive',
        })
      })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, me?.role])

  if (me?.role !== 'admin') return <div className={styles.empty}>Bạn không có quyền truy cập.</div>

  const save = async () => {
    if (!token) return
    setSaving(true)
    try {
      const res = await api.updateAdminSystemSettings(token, enabled)
      setEnabled({ ...defaults, ...(res.settings || {}) })
      toast({ title: 'Đã cập nhật cấu hình hệ thống', description: 'Thiết lập đã được lưu vào backend và sẽ giữ nguyên khi chuyển trang.' })
    } catch (error) {
      toast({
        title: 'Không thể lưu cấu hình hệ thống',
        description: error instanceof Error ? error.message : 'Vui lòng thử lại.', variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminPage
      eyebrow="System configuration"
      title="Cấu hình hệ thống"
      description="Grouped settings cho authentication, moderation, security và system operations với cảnh báo rõ ràng."
      actions={<button type="button" className={styles.button} disabled={saving || loading} onClick={() => void save()}><Save size={15} /> {saving ? 'Đang lưu...' : 'Lưu thay đổi'}</button>}
    >
      {loading ? <div className={styles.empty}>Đang tải cấu hình đã lưu...</div> : null}
      {groups.map((group) => (
        <Panel key={group.id} title={group.title} description={`Thiết lập nhóm ${group.title.toLowerCase()} của ZChat.`}>
          <div id={group.id} className={styles.settingList}>
            {group.items.map(([key, label, description]) => (
              <div className={styles.settingItem} key={key}>
                <div>
                  <div className={styles.inline}>
                    <b>{label}</b>
                    {key === 'maintenance' || key === 'rate' ? <StatusBadge value="warning" label="Cần cẩn trọng" /> : null}
                  </div>
                  <p className={styles.panelText}>{description}</p>
                </div>
                <button
                  type="button"
                  className={`${styles.switch} ${enabled[key] ? styles.switchOn : ''}`}
                  aria-pressed={enabled[key]}
                  aria-label={label}
                  onClick={() => setEnabled((prev) => ({ ...prev, [key]: !prev[key] }))}
                >
                  <span />
                </button>
              </div>
            ))}
          </div>
        </Panel>
      ))}

      <section className={styles.dangerZone}>
        <div className={styles.inline}>
          <AlertTriangle size={18} />
          <strong>Danger zone</strong>
          <StatusBadge value="dangerBadge" label="High risk" />
        </div>
        <p className={styles.panelText}>Các thao tác xóa dữ liệu, bật maintenance mode hoặc thay đổi bảo mật nên yêu cầu xác nhận kép.</p>
        <button type="button" className={styles.danger} onClick={() => toast({ title: 'Maintenance mode cần xác nhận kép' })}>
          <Lock size={15} /> Mở danger action
        </button>
      </section>
    </AdminPage>
  )
}
