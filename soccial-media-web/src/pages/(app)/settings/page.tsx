'use client'

import { useState } from 'react'
import { Lock, Shield, Users } from 'lucide-react'
import styles from './page.module.css'

export default function SettingsPage() {
  const [visibility, setVisibility] = useState<'public' | 'friends'>('public')
  const [twoFactor, setTwoFactor] = useState(true)

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>Bảo mật và quyền riêng tư</h1>
        <p>Quản lý khả năng hiển thị hồ sơ, mật khẩu và các tài khoản bị chặn.</p>
      </header>

      <div className={styles.layout}>
        <aside className={styles.menu}>
          <button type="button" className={styles.menuActive}>
            <Shield size={16} /> Trung tâm bảo mật
          </button>
          <button type="button">
            <Users size={16} /> Chính sách quyền riêng tư
          </button>
          <button type="button">
            <Lock size={16} /> Nhật ký truy cập
          </button>
        </aside>

        <section className={styles.content}>
          <article className={styles.card}>
            <h2>Hiển thị hồ sơ</h2>
            <p>Kiểm soát ai có thể xem thông tin và hoạt động của bạn.</p>
            <label className={styles.radioRow}>
              <span>
                <b>Công khai</b>
                <small>Mọi người trên nền tảng đều có thể xem hồ sơ của bạn.</small>
              </span>
              <input
                type="radio"
                name="visibility"
                checked={visibility === 'public'}
                onChange={() => setVisibility('public')}
              />
            </label>
            <label className={styles.radioRow}>
              <span>
                <b>Chỉ bạn bè</b>
                <small>Chỉ người đã kết nối mới có thể xem bài viết.</small>
              </span>
              <input
                type="radio"
                name="visibility"
                checked={visibility === 'friends'}
                onChange={() => setVisibility('friends')}
              />
            </label>
          </article>

          <div className={styles.grid}>
            <article className={styles.card}>
              <h3>Mật khẩu</h3>
              <p>Đã cập nhật 3 tháng trước. Nên đổi mật khẩu định kỳ 6 tháng/lần.</p>
              <button type="button" className={styles.softBtn}>Cập nhật mật khẩu</button>
            </article>

            <article className={styles.card}>
              <div className={styles.rowBetween}>
                <h3>Xác thực 2 lớp</h3>
                <label className={styles.switch}>
                  <input
                    type="checkbox"
                    checked={twoFactor}
                    onChange={(event) => setTwoFactor(event.target.checked)}
                  />
                  <span></span>
                </label>
              </div>
              <p>Thêm một lớp bảo vệ bằng ứng dụng xác thực hoặc SMS.</p>
              <strong className={styles.status}>{twoFactor ? 'Trạng thái: Đang bảo vệ' : 'Trạng thái: Đã tắt'}</strong>
            </article>
          </div>

          <article className={styles.card}>
            <div className={styles.rowBetween}>
              <h2>Tài khoản đã chặn</h2>
              <span className={styles.count}>12 tổng</span>
            </div>
            <div className={styles.blockedList}>
              <div className={styles.blockedItem}>
                <span><b>Marcus Chen</b><small>Chặn ngày 12/01/2024</small></span>
                <button type="button" className={styles.softBtn}>Bỏ chặn</button>
              </div>
              <div className={styles.blockedItem}>
                <span><b>Elena Rodriguez</b><small>Chặn ngày 05/02/2024</small></span>
                <button type="button" className={styles.softBtn}>Bỏ chặn</button>
              </div>
              <div className={styles.blockedItem}>
                <span><b>Jordan Smith</b><small>Chặn ngày 18/03/2024</small></span>
                <button type="button" className={styles.softBtn}>Bỏ chặn</button>
              </div>
            </div>
          </article>

          <div className={styles.footerActions}>
            <button type="button" className={styles.ghostBtn}>Hủy thay đổi</button>
            <button type="button" className={styles.saveBtn}>Lưu cài đặt</button>
          </div>
        </section>
      </div>
    </div>
  )
}
