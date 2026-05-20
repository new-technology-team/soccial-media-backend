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
                  Kết nối mọi lúc, mọi nơi vĂ¡»›i nền tĂ¡º£ng nhĂ¡º¯n tin bĂ¡º£o mĂ¡º­t và mưĂ¡»£t mà nhĂ¡º¥t.
                </p>
              </div>
              <div className={styles.leftCards}>
                <div className={styles.leftCard}>
                  <Shield size={20} />
                  <h3 className="font-bold">BĂ¡º£o mĂ¡º­t</h3>
                  <p>Mã hóa đầu cuối cho cuĂ¡»™c trò chuyĂ¡»‡n.</p>
                </div>
                <div className={styles.leftCard}>
                  <Gauge size={20} />
                  <h3 className="font-bold">Tốc đĂ¡»™</h3>
                  <p>GĂ¡» i tin nhĂ¡º¯n tĂ¡»©c thì, phĂ¡º£n hĂ¡»“i liền mạch.</p>
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <h1 className={styles.brandTitle} style={{ color: '#0052ce' }}>ZChat</h1>
                <p className={styles.brandCopy}>
                  Kết nối vĂ¡»›i cĂ¡»™ng đĂ¡»“ng của bạn trong mĂ¡»™t không gian rõ ràng và tĂ¡º­p trung.
                </p>
              </div>
              <div>
                <h2 className={styles.heading}>
                  TrĂ¡º£i nghiĂ¡»‡m
                  <br />
                  giao diĂ¡»‡n mưĂ¡»£t mà.
                </h2>
                <p className={styles.loginOnline}>+2.4k ngÆ°á» i dùng đang trĂ¡»±c tuyến</p>
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
        <span>Ä iều khoĂ¡º£n</span>
        <span>TrĂ¡»£ giúp</span>
      </footer>
    </div>
  )
}
