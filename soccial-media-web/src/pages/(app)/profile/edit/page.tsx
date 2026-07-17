'use client'

import { ChangeEvent, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Camera, CheckCircle2, Eye, Lock, ShieldCheck, UserRound, X } from 'lucide-react'
import type { User } from '@/types'

import { api, resolveApiAssetUrl } from '@/api/client'
import { useAuthStore } from '@/contexts/auth-store'
import { useChatStore } from '@/contexts/chat-store'
import { toast } from '@/hooks/use-toast'
import styles from './page.module.css'

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(new Error('Không thể đọc ảnh đại diện'))
    reader.readAsDataURL(file)
  })

const cropAvatarToBase64 = (dataUrl: string, zoom: number, cropX: number, cropY: number) =>
  new Promise<string>((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const size = 512
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      if (!context) {
        reject(new Error('Không thể xử lý ảnh'))
        return
      }
      canvas.width = size
      canvas.height = size
      context.fillStyle = '#f8fafc'
      context.fillRect(0, 0, size, size)

      const scale = Math.max(size / image.width, size / image.height) * zoom
      const drawWidth = image.width * scale
      const drawHeight = image.height * scale
      const maxX = Math.max(0, (drawWidth - size) / 2)
      const maxY = Math.max(0, (drawHeight - size) / 2)
      const dx = (size - drawWidth) / 2 + (cropX / 100) * maxX
      const dy = (size - drawHeight) / 2 + (cropY / 100) * maxY
      context.drawImage(image, dx, dy, drawWidth, drawHeight)
      resolve(canvas.toDataURL('image/jpeg', 0.92).split(',')[1] || '')
    }
    image.onerror = () => reject(new Error('Ảnh không hợp lệ'))
    image.src = dataUrl
  })

export default function EditProfilePage() {
  const navigate = useNavigate()
  const token = useAuthStore((state) => state.accessToken)
  const me = useAuthStore((state) => state.user)
  const setAuth = useAuthStore((state) => state.setAuth)
  const refreshToken = useAuthStore((state) => state.refreshToken)
  const [fullName, setFullName] = useState(me?.fullName || '')
  const [username, setUsername] = useState(me?.username || '')
  const [bio, setBio] = useState('Nhà sáng tạo nội dung số, tập trung vào trải nghiệm tối giản và rõ ràng.')
  const [profilePublic, setProfilePublic] = useState(true)
  const [showActivity, setShowActivity] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(me?.avatarUrl || '')
  const [avatarDraft, setAvatarDraft] = useState('')
  const [avatarFileName, setAvatarFileName] = useState('avatar.jpg')
  const [avatarZoom, setAvatarZoom] = useState(1)
  const [avatarCropX, setAvatarCropX] = useState(0)
  const [avatarCropY, setAvatarCropY] = useState(0)
  const [avatarModalOpen, setAvatarModalOpen] = useState(false)
  const [busySave, setBusySave] = useState(false)
  const [busyUpload, setBusyUpload] = useState(false)
  const [savingPrivacyKey, setSavingPrivacyKey] = useState<'profile' | 'activity' | null>(null)
  const [coverDraft, setCoverDraft] = useState('')
  const [message, setMessage] = useState('')
  const avatarInputRef = useRef<HTMLInputElement | null>(null)
  const coverInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!token) return
    api.getSettings(token)
      .then((response) => {
        setProfilePublic(Boolean(response.settings.privacyProfilePhoto))
        setShowActivity(Boolean(response.settings.privacyLastSeen))
      })
      .catch(() => undefined)
  }, [token])

  const handleSelectAvatar = () => avatarInputRef.current?.click()
  const handleSelectCover = () => coverInputRef.current?.click()
  const handleCoverChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !token) return
    try {
      const dataUrl = await fileToDataUrl(file)
      setCoverDraft(dataUrl)
      setBusyUpload(true)
      const coverDataUrl = await cropAvatarToBase64(dataUrl, 1, 0, 0)
      const response = await fetch('/api/auth/cover-upload-base64', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fileName: 'cover.jpg', contentType: 'image/jpeg', base64Data: coverDataUrl }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.message || 'Upload cover thất bại')
      const uploadedCoverUrl = result.fileUrl || ''
      setCoverDraft('')
      setMessage('Đã tải ảnh bìa. Nhấn "Lưu thay đổi" để cập nhật.')
      if (refreshToken) {
        const currentUser = useAuthStore.getState().user
        setAuth({
          accessToken: token,
          refreshToken,
          user: { ...(currentUser || {}), coverUrl: uploadedCoverUrl } as User,
        })
      }
    } catch (err: any) {
      setMessage(err.message || 'Upload cover thất bại')
    } finally {
      setBusyUpload(false)
      event.target.value = ''
    }
  }

  const prepareAvatar = async (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast({ title: 'File không hợp lệ', description: 'Vui lòng chọn một ảnh đại diện.', variant: 'destructive' })
      return
    }
    const dataUrl = await fileToDataUrl(file)
    setAvatarDraft(dataUrl)
    setAvatarFileName(file.name || 'avatar.jpg')
    setAvatarZoom(1)
    setAvatarCropX(0)
    setAvatarCropY(0)
    setAvatarModalOpen(true)
    setMessage('')
  }

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    await prepareAvatar(event.target.files?.[0])
    event.target.value = ''
  }

  const uploadAvatarDraft = async () => {
    if (!avatarDraft || !token) return
    setBusyUpload(true)
    try {
      const base64Data = await cropAvatarToBase64(avatarDraft, avatarZoom, avatarCropX, avatarCropY)
      const response = await fetch('/api/auth/avatar-upload-base64', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fileName: avatarFileName,
          contentType: 'image/jpeg',
          base64Data,
        }),
      })
      const uploaded = await response.json().catch(() => ({}))

      if (!response.ok || (!uploaded.mediaUrl && !uploaded.fileUrl && !uploaded.avatarUrl)) {
        throw new Error(uploaded.message || 'Upload avatar thất bại')
      }

      const nextAvatarUrl = uploaded.mediaUrl || uploaded.fileUrl || uploaded.avatarUrl
      const resolvedAvatarUrl = resolveApiAssetUrl(String(nextAvatarUrl)) ?? String(nextAvatarUrl)
      setAvatarUrl(resolvedAvatarUrl)
      setAvatarDraft('')
      setAvatarModalOpen(false)
      if (uploaded.user && refreshToken) {
        setAuth({
          accessToken: token,
          refreshToken,
          user: {
            ...uploaded.user,
            avatarUrl: resolvedAvatarUrl,
          },
        })
      }
      if (me?.id) {
        useChatStore.getState().updateUserAvatar(Number(me.id), resolvedAvatarUrl)
      }
      setMessage('Đã tải ảnh đại diện mới.')
      toast({ title: 'Đã cập nhật ảnh đại diện', description: 'Avatar đã đồng bộ tới navbar, chat và bình luận.' })
    } catch (error) {
      console.error(error)
      setMessage(error instanceof Error ? error.message : 'Không thể tải ảnh đại diện.')
      toast({ title: 'Không thể tải ảnh đại diện', description: error instanceof Error ? error.message : 'Vui lòng thử lại.', variant: 'destructive' })
    } finally {
      setBusyUpload(false)
    }
  }

  const handlePrivacyChange = async (key: 'profile' | 'activity', value: boolean) => {
    if (!token) return
    const previousProfilePublic = profilePublic
    const previousShowActivity = showActivity
    const nextProfilePublic = key === 'profile' ? value : profilePublic
    const nextShowActivity = key === 'activity' ? value : showActivity

    setProfilePublic(nextProfilePublic)
    setShowActivity(nextShowActivity)
    setSavingPrivacyKey(key)
    try {
      await api.saveSettings(token, {
        privacyProfilePhoto: nextProfilePublic,
        privacyLastSeen: nextShowActivity,
      })
      toast({ title: 'Đã lưu quyền riêng tư', description: 'Thay đổi đã được áp dụng ngay.' })
    } catch (error) {
      setProfilePublic(previousProfilePublic)
      setShowActivity(previousShowActivity)
      toast({ title: 'Không thể lưu quyền riêng tư', description: 'Đã khôi phục thiết lập trước đó.', variant: 'destructive' })
    } finally {
      setSavingPrivacyKey(null)
    }
  }

  const handleSave = async () => {
    if (!token || !me || !refreshToken) {
      setMessage('Phiên đăng nhập không hợp lệ.')
      return
    }

    setBusySave(true)
    try {
      const savedCoverUrl = me?.coverUrl || ''
      const response = await api.updateProfile(token, {
        fullName: fullName.trim() || undefined,
        username: username.trim().toLowerCase() || undefined,
        avatarUrl: avatarUrl.trim() || undefined,
        coverUrl: savedCoverUrl || undefined,
      })
      const mergedUser = { ...response.user, coverUrl: response.user?.coverUrl || savedCoverUrl }
      await api.saveSettings(token, {
        privacyProfilePhoto: profilePublic,
        privacyLastSeen: showActivity,
      })

      setAuth({
        accessToken: token,
        refreshToken,
        user: mergedUser,
      })

      setMessage('Lưu thay đổi thành công.')
      toast({ title: 'Đã lưu hồ sơ', description: 'Thông tin hồ sơ đã được cập nhật.' })
      navigate(`/profile/${mergedUser.username || mergedUser.id}`)
    } catch (error) {
      console.error(error)
      setMessage('Không thể lưu hồ sơ. Vui lòng thử lại.')
      toast({ title: 'Không thể lưu hồ sơ', description: 'Vui lòng thử lại.', variant: 'destructive' })
    } finally {
      setBusySave(false)
    }
  }

  const previewAvatar = avatarDraft || avatarUrl

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Profile settings</p>
          <h1>Chỉnh sửa hồ sơ</h1>
          <p className={styles.headerSub}>Cập nhật cách bạn xuất hiện trên ZChat.</p>
        </div>
        <div className={styles.actions}>
          <Link to={me ? `/profile/${me.username || me.id}` : '/feed'} className={styles.cancelBtn}>
            Hủy
          </Link>
          <button type="button" className={styles.saveBtn} onClick={handleSave} disabled={busySave || busyUpload}>
            {busySave ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </header>

      {message ? <p className={styles.notice}>{message}</p> : null}

      <div className={styles.layout}>
        <section className={styles.mainCol}>
          {/* Cover Image */}
          <article className={`${styles.card} ${styles.identityCard}`}>
            <h2 className="text-sm font-semibold mb-2">Ảnh bìa</h2>
            <div className={styles.coverShell}>
              {coverDraft ? (
                <img src={coverDraft} alt="cover preview" className={styles.coverImage} />
              ) : me?.coverUrl ? (
                <img src={me.coverUrl} alt="cover" className={styles.coverImage} />
              ) : (
                <div className={styles.coverPlaceholder}>
                  <Camera size={24} />
                  <span className="text-xs text-muted-foreground mt-1">Thêm ảnh bìa</span>
                </div>
              )}
              <button type="button" className={styles.coverUploadBtn} onClick={handleSelectCover} aria-label="Đổi ảnh bìa">
                <Camera size={16} />
              </button>
              <input ref={coverInputRef} type="file" accept="image/*" className={styles.hiddenInput} onChange={handleCoverChange} />
            </div>
          </article>

          <article className={`${styles.card} ${styles.identityCard}`}>
            <div className={styles.avatarShell}>
              <button type="button" className={styles.avatarButton} onClick={handleSelectAvatar} aria-label="Đổi ảnh đại diện">
                {previewAvatar ? (
                  <img src={previewAvatar} alt="avatar" className={styles.avatarImage} />
                ) : (
                  <span className={styles.avatar}>{(me?.fullName?.[0] || 'U').toUpperCase()}</span>
                )}
                <span className={styles.cameraOverlay}><Camera size={18} /></span>
              </button>
              <input ref={avatarInputRef} type="file" accept="image/*" className={styles.hiddenInput} onChange={handleAvatarChange} />
            </div>
            <div className={styles.identityCopy}>
              <h2>{fullName || me?.fullName || 'ZChat user'}</h2>
              <p>@{username || 'username'} · Ảnh đại diện hiển thị trên hồ sơ, feed, chat và bình luận.</p>
            </div>
            <button type="button" className={styles.secondaryBtn} onClick={handleSelectAvatar}>
              <Camera size={16} /> Đổi ảnh
            </button>
          </article>

          <article className={styles.card}>
            <h2>Thông tin cơ bản</h2>
            <div className={styles.formGrid}>
              <label>
                <span>Họ và tên</span>
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </label>
              <label>
                <span>Tên người dùng</span>
                <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="nguyen.van.a" />
              </label>
              <label className={styles.fullWidth}>
                <span>Tiểu sử</span>
                <textarea rows={4} value={bio} onChange={(e) => setBio(e.target.value)} />
              </label>
              <label>
                <span>Giới tính</span>
                <select defaultValue="Khác">
                  <option>Khác</option>
                  <option>Nam</option>
                  <option>Nữ</option>
                  <option>Không tiết lộ</option>
                </select>
              </label>
              <label>
                <span>Ngày sinh</span>
                <input type="date" defaultValue="1994-08-12" />
              </label>
            </div>
          </article>

          <article className={styles.card}>
            <h2>Bảo mật tài khoản</h2>
            <div className={styles.securityItem}>
              <div>
                <b>Đổi mật khẩu</b>
                <small>Cập nhật gần nhất 3 tháng trước</small>
              </div>
              <button type="button">Cập nhật mật khẩu</button>
            </div>
          </article>
        </section>

        <aside className={styles.sideCol}>
          <article className={styles.card}>
            <h3>Xem trước hồ sơ</h3>
            <div className={styles.previewCard}>
              <div className={styles.previewCover} />
              <div className={styles.previewBody}>
                {previewAvatar ? <img src={previewAvatar} alt="preview avatar" /> : <div>{(fullName?.[0] || 'U').toUpperCase()}</div>}
                <b>{fullName || 'Tên hiển thị'}</b>
                <small>@{username || 'username'}</small>
                <p>{bio}</p>
                <span><UserRound size={14} /> 0 bạn chung · 0 bài viết công khai</span>
              </div>
            </div>
          </article>

          <article className={styles.card}>
            <div className={styles.cardTitleRow}>
              <h3>Quyền riêng tư</h3>
              <ShieldCheck size={18} />
            </div>
            <div className={styles.privacyStack}>
              <div className={styles.switchRow}>
                <Eye size={17} />
                <span>
                  <b>Ảnh hồ sơ công khai</b>
                  <small>Cho phép người khác xem ảnh đại diện của bạn.</small>
                </span>
                <label className={styles.switch}><input type="checkbox" checked={profilePublic} onChange={(e) => void handlePrivacyChange('profile', e.target.checked)} /><span></span></label>
              </div>
              <div className={styles.switchRow}>
                <Lock size={17} />
                <span>
                  <b>Hiện trạng thái hoạt động</b>
                  <small>Hiển thị khi bạn online hoặc hoạt động gần đây.</small>
                </span>
                <label className={styles.switch}><input type="checkbox" checked={showActivity} onChange={(e) => void handlePrivacyChange('activity', e.target.checked)} /><span></span></label>
              </div>
              {savingPrivacyKey ? <p className={styles.privacySaving}><CheckCircle2 size={14} /> Đang lưu thay đổi...</p> : null}
            </div>
          </article>
        </aside>
      </div>

      {avatarModalOpen ? (
        <div className={styles.modalOverlay} role="presentation" onClick={() => setAvatarModalOpen(false)}>
          <section className={styles.avatarModal} role="dialog" aria-modal="true" aria-label="Cập nhật ảnh đại diện" onClick={(event) => event.stopPropagation()}>
            <header className={styles.modalHeader}>
              <h2>Cập nhật ảnh đại diện</h2>
              <button type="button" onClick={() => setAvatarModalOpen(false)} aria-label="Đóng"><X size={17} /></button>
            </header>
            <div className={styles.cropPreview}>
              {avatarDraft ? <img src={avatarDraft} alt="Avatar preview" style={{ transform: `scale(${avatarZoom})`, objectPosition: `${50 + avatarCropX / 2}% ${50 + avatarCropY / 2}%` }} /> : null}
            </div>
            <div className={styles.cropControls}>
              <label>Zoom<input type="range" min="1" max="2.4" step="0.05" value={avatarZoom} onChange={(event) => setAvatarZoom(Number(event.target.value))} /></label>
              <label>Ngang<input type="range" min="-100" max="100" value={avatarCropX} onChange={(event) => setAvatarCropX(Number(event.target.value))} /></label>
              <label>Dọc<input type="range" min="-100" max="100" value={avatarCropY} onChange={(event) => setAvatarCropY(Number(event.target.value))} /></label>
            </div>
            <div className={styles.cropActions}>
              <button type="button" className={styles.cancelBtn} onClick={() => { setAvatarDraft(''); setAvatarModalOpen(false) }}>Bỏ ảnh</button>
              <button type="button" className={styles.saveBtn} disabled={!avatarDraft || busyUpload} onClick={() => void uploadAvatarDraft()}>{busyUpload ? 'Đang upload...' : 'Lưu ảnh đại diện'}</button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}
