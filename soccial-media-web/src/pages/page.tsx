import { Link } from 'react-router-dom'
import { ArrowRight, Compass, Lock, MessageSquareText, Shield, Sparkles, Users, Waves } from 'lucide-react'
import styles from './page.module.css'

const features = [
  {
    icon: MessageSquareText,
    title: 'Tin nhĂ¡º¯n tĂ¡»©c thì',
    description: 'Trò chuyĂ¡»‡n 1-1 và nhóm, đĂ¡»“ng bĂ¡»™ realtime giữa web và mobile.',
  },
  {
    icon: Users,
    title: 'Nhóm cĂ¡»™ng đĂ¡»“ng',
    description: 'Xây dĂ¡»±ng nhóm riêng theo sĂ¡» thĂch vĂ¡»›i quyền quĂ¡º£n trĂ¡»‹ linh hoạt.',
  },
  {
    icon: Compass,
    title: 'Khám phá thông minh',
    description: 'Theo dõi xu hưĂ¡»›ng theo thời gian thĂ¡»±c và khám phá nĂ¡»™i dung phù hĂ¡»£p.',
  },
  {
    icon: Shield,
    title: 'An toàn',
    description: 'Xác thĂ¡»±c và kiểm duyĂ¡»‡t đa lĂ¡»›p giúp không gian luôn lành mạnh.',
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
                ZChat - mạng xã hĂ¡»™i thế hĂ¡»‡ mĂ¡»›i cho cĂ¡»™ng đĂ¡»“ng ViĂ¡»‡t
              </span>

              <h1 className={styles.heroTitle}>
                Cùng nhau tạo nên
                <br />
                <span className={styles.gradientText}>không gian kết nối</span>
                <br />
                chĂ¡º¥t lưĂ¡»£ng.
              </h1>

              <p className={styles.heroDescription}>
                TĂ¡»Ă¡»ừ trò chuyĂ¡»‡n nhanh, xây nhóm riêng đến khám phá xu hưĂ¡»›ng, mọi thĂ¡»© đưĂ¡»£c thiết kế đĂ¡»“ng nhĂ¡º¥t, trĂ¡»±c quan và an toàn cho ngÆ°á» i dùng.
              </p>

              <div className={styles.heroActions}>
                <Link to="/auth/signup" className={styles.primaryBtn}>
                  Tạo tài khoĂ¡º£n miễn phĂ
                  <ArrowRight size={16} />
                </Link>
                <Link to="/auth/login" className={styles.secondaryBtn}>
                  Ä ăng nhĂ¡º­p ngay
                </Link>
              </div>

              <div className={styles.metricsRow}>
                <div>
                  <p>120K+</p>
                  <span>Người dùng hoạt đĂ¡»™ng</span>
                </div>
                <div>
                  <p>1.2M</p>
                  <span>Tin nhĂ¡º¯n mĂ¡»—i ngày</span>
                </div>
                <div>
                  <p>99.9%</p>
                  <span>Thời gian Ă¡»•n đĂ¡»‹nh</span>
                </div>
              </div>
            </div>

            <div className={styles.heroRight}>
              <div className={styles.glassCardMain}>
                <div className={styles.glassHead}>
                  <Waves size={18} />
                  <span>BĂ¡º£ng tin cĂ¡»™ng đĂ¡»“ng</span>
                </div>
                <h3>Tăng tương tác, giĂ¡º£m nhiễu.</h3>
                <p>ThuĂ¡º­t toán gĂ¡»£i ý nĂ¡»™i dung theo mối quan tâm thĂ¡»±c của bạn.</p>
              </div>

              <div className={styles.miniCards}>
                <div className={styles.miniCardBlue}>
                  <MessageSquareText size={20} />
                  <p>Realtime Chat</p>
                </div>
                <div className={styles.miniCardOrange}>
                  <Users size={20} />
                  <p>Nhóm riêng</p>
                </div>
                <div className={styles.miniCardLight}>
                  <Lock size={20} />
                  <p>BĂ¡º£o mĂ¡º­t cao</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.featuresSection}>
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Những điểm mạnh nĂ¡»•i bĂ¡º­t</h2>
            <p className={styles.sectionSubtitle}>
              MĂ¡»™t nền tĂ¡º£ng duy nhĂ¡º¥t cho giao tiếp, khám phá và phát triển cĂ¡»™ng đĂ¡»“ng.
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
            <h2>Sẵn sàng tham gia cĂ¡»™ng đĂ¡»“ng?</h2>
            <p>Tạo tài khoĂ¡º£n trong vài giây và bĂ¡º¯t đầu kết nối vĂ¡»›i những ngÆ°á» i phù hĂ¡»£p nhĂ¡º¥t.</p>
            <Link to="/auth/signup" className={styles.primaryBtn}>
              BĂ¡º¯t đầu ngay
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
