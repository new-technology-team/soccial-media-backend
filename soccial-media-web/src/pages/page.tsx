import { Link } from 'react-router-dom'
import { ArrowRight, Compass, Lock, MessageSquareText, Shield, Sparkles, Users, Waves } from 'lucide-react'
import styles from './page.module.css'

const features = [
  {
    icon: MessageSquareText,
    title: 'Tin nhắn tức thì',
    description: 'Trò chuyện 1-1 và nhóm, đồng bộ realtime giữa web và mobile.',
  },
  {
    icon: Users,
    title: 'Nhóm cộng đồng',
    description: 'Xây dựng nhóm riêng theo sở thích với quyền quản trị linh hoạt.',
  },
  {
    icon: Compass,
    title: 'Khám phá thông minh',
    description: 'Theo dõi xu hướng theo thời gian thực và khám phá nội dung phù hợp.',
  },
  {
    icon: Shield,
    title: 'An toàn',
    description: 'Xác thực và kiểm duyệt đa lớp giúp không gian luôn lành mạnh.',
  },
]

export default function Home() {
  return (
    <div className={styles.page}>
      <section className={styles.heroSection}>
        <div className={styles.container}>
          <div className={styles.heroPanel}>
            <div className={styles.heroLeft}>
              <span className={styles.badge}>
                <Sparkles size={16} />
                ZChat - mạng xã hội thế hệ mới cho cộng đồng Việt
              </span>

              <h1 className={styles.heroTitle}>
                Kết nối tự nhiên,
                <br />
                <span className={styles.gradientText}>trò chuyện mượt mà</span>
                <br />
                mỗi ngày.
              </h1>

              <p className={styles.heroDescription}>
                Từ trò chuyện nhanh, xây nhóm riêng đến khám phá xu hướng, mọi thứ được thiết kế trực quan,
                an toàn và tạo cảm giác thân quen như các ứng dụng nhắn tin hiện đại.
              </p>

              <div className={styles.heroActions}>
                <Link to="/auth/signup" className={styles.primaryBtn}>
                  Tạo tài khoản miễn phí
                  <ArrowRight size={16} />
                </Link>
                <Link to="/auth/login" className={styles.secondaryBtn}>
                  Đăng nhập ngay
                </Link>
              </div>

              <div className={styles.metricsRow}>
                <div>
                  <p>120K+</p>
                  <span>Người dùng hoạt động</span>
                </div>
                <div>
                  <p>1.2M</p>
                  <span>Tin nhắn mỗi ngày</span>
                </div>
                <div>
                  <p>99.9%</p>
                  <span>Thời gian ổn định</span>
                </div>
              </div>
            </div>

            <div className={styles.heroRight}>
              <div className={styles.glassCardMain}>
                <div className={styles.glassHead}>
                  <Waves size={18} />
                  <span>Bảng tin cộng đồng</span>
                </div>
                <h3>Tăng tương tác, giảm nhiễu.</h3>
                <p>Gợi ý nội dung theo mối quan tâm thật của bạn, rõ ràng và dễ theo dõi.</p>
              </div>

              <div className={styles.miniCards}>
                <div className={styles.miniCardBlue}>
                  <MessageSquareText size={20} />
                  <p>Chat realtime</p>
                </div>
                <div className={styles.miniCardOrange}>
                  <Users size={20} />
                  <p>Nhóm riêng</p>
                </div>
                <div className={styles.miniCardLight}>
                  <Lock size={20} />
                  <p>Bảo mật cao</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.featuresSection}>
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Những điểm mạnh nổi bật</h2>
            <p className={styles.sectionSubtitle}>
              Một nền tảng duy nhất cho giao tiếp, khám phá và phát triển cộng đồng.
            </p>
          </div>

          <div className={styles.featureGrid}>
            {features.map((feature) => (
              <article className={styles.featureCard} key={feature.title}>
                <feature.icon size={24} className={styles.featureIcon} />
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.ctaSection}>
        <div className={styles.container}>
          <div className={styles.ctaPanel}>
            <h2>Sẵn sàng tham gia cộng đồng?</h2>
            <p>Tạo tài khoản trong vài giây và bắt đầu kết nối với những người phù hợp nhất.</p>
            <Link to="/auth/signup" className={styles.primaryBtn}>
              Bắt đầu ngay
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
