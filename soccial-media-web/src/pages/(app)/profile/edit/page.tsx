'use client'

import { Link } from 'react-router-dom'
import { ChangeEvent, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { useAuthStore } from '@/lib/store/auth-store'
import styles from './page.module.css'

export default function EditProfilePage() {
  const navigate = useNavigate()
  const token = useAuthStore((state) => state.accessToken)
  const me = useAuthStore((state) => state.user)
  const setAuth = useAuthStore((state) => state.setAuth)
  const refreshToken = useAuthStore((state) => state.refreshToken)
  const [fullName, setFullName] = useState(me?.fullName || '')
  const [username, setUsername] = useState((me?.fullName || '').toLowerCase().replace(/\s+/g, '.'))
  const [bio, setBio] = useState('Nhà sáng tạo nội dung số, tập trung vào trải nghiệm tối giản và rõ ràng.')
  const [showActivity, setShowActivity] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(me?.avatarUrl || '')
  const [busySave, setBusySave] = useState(false)
  const [busyUpload, setBusyUpload] = useState(false)
  const [message, setMessage] = useState('')
  const avatarInputRef = useRef<HTMLInputElement | null>(null)

  const fileToBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : ''
        resolve(result.includes(',') ? result.split(',')[1] : result)
      }
      reader.onerror = () => reject(new Error('Không thể đọc ảnh đại diện'))
      reader.readAsDataURL(file)
    })

  const handleSelectAvatar = () => avatarInputRef.current?.click()

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !token) return

    setBusyUpload(true)
    try {
      const base64Data = await fileToBase64(file)
      const uploaded = await fetch('/backend/api/auth/avatar-upload-base64', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type || 'image/jpeg',
          base64Data,
        }),
      }).then((res) => res.json())

      if (!uploaded.mediaUrl) {
        throw new Error(uploaded.message || 'Upload avatar thất bại')
      }

      setAvatarUrl(uploaded.mediaUrl)
      setMessage('Đã tải ảnh đại diện mới.')
    } catch (error) {
      console.error(error)
      setMessage('Không thể tải ảnh đại diện.')
    } finally {
      setBusyUpload(false)
      event.target.value = ''
    }
  }

  const handleSave = async () => {
    if (!token || !me || !refreshToken) {
      setMessage('Phiên đăng nhập không hợp lệ.')
      return
    }

    setBusySave(true)
    try {
      const response = await api.updateProfile(token, {
        fullName: fullName.trim() || undefined,
        avatarUrl: avatarUrl.trim() || undefined,
      })

      setAuth({
        accessToken: token,
        refreshToken,
        user: response.user,
      })

      setMessage('Lưu thay đổi thành công.')
      navigate(`/profile/${response.user.id}`)
    } catch (error) {
      console.error(error)
      setMessage('Không thể lưu hồ sơ. Vui lòng thử lại.')
    } finally {
      setBusySave(false)
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>Chỉnh sửa hồ sơ</h1>
        <div className={styles.actions}>
          <Link to={me ? `/profile/${me.id}` : '/feed'} className={styles.cancelBtn}>
            Hủy
          </Link>
          <button type="button" className={styles.saveBtn} onClick={handleSave} disabled={busySave || busyUpload}>
            {busySave ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </header>

      <section className={styles.cover}>
        <input ref={avatarInputRef} type="file" accept="image/*" className={styles.hiddenInput} onChange={handleAvatarChange} />
        <button type="button" className={styles.avatarButton} onClick={handleSelectAvatar}>
          {avatarUrl ? (
            <img src={avatarUrl} alt="avatar" className={styles.avatarImage} />
          ) : (
            <div className={styles.avatar}>{(me?.fullName?.[0] || 'U').toUpperCase()}</div>
          )}
          <span>{busyUpload ? 'Đang tải ảnh...' : 'Đổi ảnh đại diện'}</span>
        </button>
      </section>

      {message ? <p className={styles.notice}>{message}</p> : null}

      <div className={styles.layout}>
        <section className={styles.mainCol}>
          <article className={styles.card}>
            <h2>Thông tin cơ bản</h2>
            <div className={styles.formGrid}>
              <label>
                <span>Họ và tên</span>
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </label>
              <label>
                <span>Tên hiển thị</span>
                <input value={username} onChange={(e) => setUsername(e.target.value)} />
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
            <div className={styles.securityItem}>
              <div>
                <b>Xác thực 2 lớp</b>
                <small>Đã bật bằng ứng dụng Authenticator</small>
              </div>
              <strong>Đang bật</strong>
            </div>
          </article>
        </section>

        <aside className={styles.sideCol}>
          <article className={styles.card}>
            <h3>Liên kết tài khoản</h3>
            <div className={styles.linkItem}><b>Google</b><button type="button">Ngắt kết nối</button></div>
            <div className={styles.linkItem}><b>Dribbble</b><button type="button">Ngắt kết nối</button></div>
            <button type="button" className={styles.addBtn}>+ Thêm tài khoản</button>
          </article>

          <article className={styles.card}>
            <h3>Quyền riêng tư hồ sơ</h3>
            <div className={styles.switchRow}>
              <span>Hồ sơ công khai</span>
              <label className={styles.switch}><input type="checkbox" defaultChecked /><span></span></label>
            </div>
            <div className={styles.switchRow}>
              <span>Hiện hoạt động</span>
              <label className={styles.switch}><input type="checkbox" checked={showActivity} onChange={(e) => setShowActivity(e.target.checked)} /><span></span></label>
            </div>
          </article>
        </aside>
      </div>
    </div>
  )
}
