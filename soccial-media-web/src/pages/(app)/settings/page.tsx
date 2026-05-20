'use client'

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, Shield, Users } from 'lucide-react'
import { api } from '@/api/client'
import { useAuthStore } from '@/contexts/auth-store'
import styles from './page.module.css'

type Settings = {
  privacyLastSeen: boolean
  privacyProfilePhoto: boolean
  allowFriendRequests: boolean
  notificationMessages: boolean
  notificationCalls: boolean
}

export default function SettingsPage() {
  const navigate = useNavigate()
  const token = useAuthStore((state) => state.accessToken)
  const user = useAuthStore((state) => state.user)
  const clearAuth = useAuthStore((state) => state.clearAuth)
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [activeSection, setActiveSection] = useState<'security' | 'privacy' | 'access'>('security')
  const [settings, setSettings] = useState<Settings>({
    privacyLastSeen: false,
    privacyProfilePhoto: false,
    allowFriendRequests: true,
    notificationMessages: true,
    notificationCalls: true,
  })
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ old: '', new: '', confirm: '' })

  useEffect(() => {
    if (!token) {
      navigate('/auth/login')
      return
    }

    loadSettings()
  }, [token, navigate])

  const loadSettings = async () => {
    if (!token) return
    setLoading(true)
    try {
      const response = await api.getSettings(token)
      setSettings(response.settings)
    } catch (err) {
      console.error('Failed to load settings', err)
      setError('Không thể tĂ¡º£i cài đặt')
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    if (passwordForm.new !== passwordForm.confirm) {
      setError('MĂ¡º­t khẩu mĂ¡»›i không khĂ¡»›p')
      return
    }
    if (passwordForm.new.length < 6) {
      setError('MĂ¡º­t khẩu phĂ¡º£i có ít nhĂ¡º¥t 6 ký tĂ¡»±')
      return
    }

    setSaving(true)
    try {
      await api.changePassword(token, {
        oldPassword: passwordForm.old,
        newPassword: passwordForm.new,
      })
      setSuccess('ĐĂ£ đĂ¡»•i mĂ¡º­t khẩu thành công')
      setPasswordForm({ old: '', new: '', confirm: '' })
      setShowChangePassword(false)
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể đĂ¡»•i mĂ¡º­t khẩu')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveSettings = async () => {
    if (!token) return
    setSaving(true)
    try {
      const response = await api.saveSettings(token, settings)
      setSettings(response.settings)
      setSuccess('ĐĂ£ cĂ¡º­p nhĂ¡º­t cài đặt thành công')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể lưu cài đặt')
    } finally {
      setSaving(false)
    }
  }

  if (!token || loading) {
    return <div className={styles.page}><p>Ä ang tĂ¡º£i...</p></div>
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>BĂ¡º£o mĂ¡º­t và quyĂ¡»n riêng tư</h1>
        <p>QuĂ¡º£n lý khĂ¡º£ năng hiển thĂ¡»‹ hĂ¡»“ sơ, mĂ¡º­t khẩu và các tài khoĂ¡º£n bĂ¡»‹ chặn.</p>
      </header>

      {error && <div style={{ color: 'red', padding: '1rem', margin: '1rem 0' }}>{error}</div>}
      {success && <div style={{ color: 'green', padding: '1rem', margin: '1rem 0' }}>{success}</div>}

      <div className={styles.layout}>
        <aside className={styles.menu}>
          <button 
            type="button" 
            className={activeSection === 'security' ? styles.menuActive : ''}
            onClick={() => setActiveSection('security')}
          >
            <Shield size={16} /> Trung tâm bĂ¡º£o mĂ¡º­t
          </button>
          <button 
            type="button"
            className={activeSection === 'privacy' ? styles.menuActive : ''}
            onClick={() => setActiveSection('privacy')}
          >
            <Users size={16} /> Chính sách quyĂ¡»n riêng tư
          </button>
        </aside>

        <section className={styles.content}>
          {activeSection === 'security' && (
            <>
              <article className={styles.card}>
                <h3>MĂ¡º­t khẩu</h3>
                <p>ĐĂ£ cĂ¡º­p nhĂ¡º­t gần đây. Nên đĂ¡»•i mĂ¡º­t khẩu đĂ¡»‹nh kĂ¡»³ 6 tháng/lần.</p>
                <button 
                  type="button" 
                  className={styles.softBtn}
                  onClick={() => setShowChangePassword(!showChangePassword)}
                >
                  {showChangePassword ? 'Hủy' : 'CĂ¡º­p nhĂ¡º­t mĂ¡º­t khẩu'}
                </button>
                
                {showChangePassword && (
                  <form onSubmit={handleChangePassword} style={{ marginTop: '1rem', padding: '1rem', border: '1px solid #e0e0e0', borderRadius: '8px' }}>
                    <div style={{ marginBottom: '0.8rem' }}>
                      <label>MĂ¡º­t khẩu hiĂ¡»‡n tại</label>
                      <input
                        type="password"
                        value={passwordForm.old}
                        onChange={(e) => setPasswordForm({ ...passwordForm, old: e.target.value })}
                        required
                        style={{ width: '100%', padding: '0.5rem', marginTop: '0.4rem', borderRadius: '4px', border: '1px solid #ccc' }}
                      />
                    </div>
                    <div style={{ marginBottom: '0.8rem' }}>
                      <label>MĂ¡º­t khẩu mĂ¡»›i</label>
                      <input
                        type="password"
                        value={passwordForm.new}
                        onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })}
                        required
                        style={{ width: '100%', padding: '0.5rem', marginTop: '0.4rem', borderRadius: '4px', border: '1px solid #ccc' }}
                      />
                    </div>
                    <div style={{ marginBottom: '0.8rem' }}>
                      <label>Xác nhĂ¡º­n mĂ¡º­t khẩu mĂ¡»›i</label>
                      <input
                        type="password"
                        value={passwordForm.confirm}
                        onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                        required
                        style={{ width: '100%', padding: '0.5rem', marginTop: '0.4rem', borderRadius: '4px', border: '1px solid #ccc' }}
                      />
                    </div>
                    <button type="submit" disabled={saving} className={styles.saveBtn}>
                      {saving ? 'Ä ang lưu...' : 'Lưu mĂ¡º­t khẩu mĂ¡»›i'}
                    </button>
                  </form>
                )}
              </article>
            </>
          )}

          {activeSection === 'privacy' && (
            <>
              <article className={styles.card}>
                <h2>Cài đặt quyĂ¡»n riêng tư</h2>
                <p>KiĂ¡»ƒm soát ai có thĂ¡»ƒ xem thông tin của bạn.</p>
                
                <div style={{ marginTop: '1rem' }}>
                  <label className={styles.checkboxRow}>
                    <input
                      type="checkbox"
                      checked={settings.privacyLastSeen}
                      onChange={(e) => setSettings({ ...settings, privacyLastSeen: e.target.checked })}
                    />
                    <span>
                      <b>Ă¡º¨n trạng thái 'Online'</b>
                      <small>NgưĂ¡»i khác không thĂ¡»ƒ biĂ¡º¿t bạn đang online hay không</small>
                    </span>
                  </label>
                </div>

                <div style={{ marginTop: '1rem' }}>
                  <label className={styles.checkboxRow}>
                    <input
                      type="checkbox"
                      checked={settings.privacyProfilePhoto}
                      onChange={(e) => setSettings({ ...settings, privacyProfilePhoto: e.target.checked })}
                    />
                    <span>
                      <b>Ă¡º¨n Ă¡º£nh hĂ¡»“ sơ</b>
                      <small>ChĂ¡»‰ bạn bè mĂ¡»›i có thĂ¡»ƒ thĂ¡º¥y Ă¡º£nh hĂ¡»“ sơ của bạn</small>
                    </span>
                  </label>
                </div>

                <div style={{ marginTop: '1rem' }}>
                  <label className={styles.checkboxRow}>
                    <input
                      type="checkbox"
                      checked={settings.allowFriendRequests}
                      onChange={(e) => setSettings({ ...settings, allowFriendRequests: e.target.checked })}
                    />
                    <span>
                      <b>Cho phép lĂ¡»i mĂ¡»i kĂ¡º¿t bạn</b>
                      <small>Cho phép mĂ¡»i ngưĂ¡»i gĂ¡» i lĂ¡»i mĂ¡»i kĂ¡º¿t bạn</small>
                    </span>
                  </label>
                </div>

                <div style={{ marginTop: '1rem' }}>
                  <label className={styles.checkboxRow}>
                    <input
                      type="checkbox"
                      checked={settings.notificationMessages}
                      onChange={(e) => setSettings({ ...settings, notificationMessages: e.target.checked })}
                    />
                    <span>
                      <b>Thông báo tin nhĂ¡º¯n</b>
                      <small>NhĂ¡º­n thông báo khi có tin nhĂ¡º¯n mĂ¡»›i</small>
                    </span>
                  </label>
                </div>

                <div style={{ marginTop: '1rem' }}>
                  <label className={styles.checkboxRow}>
                    <input
                      type="checkbox"
                      checked={settings.notificationCalls}
                      onChange={(e) => setSettings({ ...settings, notificationCalls: e.target.checked })}
                    />
                    <span>
                      <b>Thông báo cuĂ¡»™c gĂ¡»i</b>
                      <small>NhĂ¡º­n thông báo khi có cuĂ¡»™c gĂ¡»i đến</small>
                    </span>
                  </label>
                </div>
              </article>
            </>
          )}

          <div className={styles.footerActions}>
            <button type="button" className={styles.ghostBtn} onClick={() => loadSettings()}>
              Hủy thay đĂ¡»•i
            </button>
            <button 
              type="button" 
              className={styles.saveBtn}
              onClick={handleSaveSettings}
              disabled={saving}
            >
              {saving ? 'Ä ang lưu...' : 'Lưu cài đặt'}
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}

