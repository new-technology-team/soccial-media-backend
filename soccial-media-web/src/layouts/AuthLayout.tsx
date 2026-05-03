'use client'

import { Shield, Gauge, MessageSquare } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import styles from './auth-layout.module.css'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { pathname } = useLocation()
  const isSignup = pathname.includes('/auth/signup')

  return (
    <div className={styles.page}>
      <main className={styles.shell}>
        <section className={`${styles.left} ${isSignup ? styles.signupLeft : styles.loginLeft}`}>
          {isSignup ? (
            <>
              <div>
                <div className={styles.iconBadge}>
                  <MessageSquare size={34} />
                </div>
                <h1 className={styles.brandTitle}>ZChat</h1>
                <p className={styles.brandCopy}>
                  Kết nối mọi lúc, mọi nơi với nền tảng nhắn tin bảo mật và mượt mà nhất.
                </p>
              </div>
              <div className={styles.leftCards}>
                <div className={styles.leftCard}>
                  <Shield size={20} />
                  <h3 className="font-bold">Bảo mật</h3>
                  <p>Mã hóa đầu cuối cho cuộc trò chuyện.</p>
                </div>
                <div className={styles.leftCard}>
                  <Gauge size={20} />
                  <h3 className="font-bold">Tốc độ</h3>
                  <p>Gửi tin nhắn tức thì, phản hồi liền mạch.</p>
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <h1 className={styles.brandTitle} style={{ color: '#0052ce' }}>ZChat</h1>
                <p className={styles.brandCopy}>
                  Kết nối với cộng đồng của bạn trong một không gian rõ ràng và tập trung.
                </p>
              </div>
              <div>
                <h2 className={styles.heading}>
                  Trải nghiệm
                  <br />
                  giao diện mượt mà.
                </h2>
                <p className={styles.loginOnline}>+2.4k người dùng đang trực tuyến</p>
              </div>
              <div className={styles.loginBlob} />
            </>
          )}
        </section>

        <section className={styles.right}>
          <div className={styles.rightInner}>{children}</div>
        </section>
      </main>

      <footer className={styles.footer}>
        <span>Quyền riêng tư</span>
        <span>Điều khoản</span>
        <span>Trợ giúp</span>
      </footer>
    </div>
  )
}
