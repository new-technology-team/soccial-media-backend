import styles from './profile-tabs.module.css'

export type ProfileTab = 'posts' | 'about' | 'friends' | 'photos' | 'videos'

const tabs: Array<{ id: ProfileTab; label: string }> = [
  { id: 'posts', label: 'Bài viết' },
  { id: 'about', label: 'Giới thiệu' },
  { id: 'friends', label: 'Bạn bè' },
  { id: 'photos', label: 'Ảnh' },
  { id: 'videos', label: 'Video' },
]

export default function ProfileTabs({
  activeTab,
  onChange,
}: {
  activeTab: ProfileTab
  onChange: (tab: ProfileTab) => void
}) {
  return (
    <nav className={styles.tabs} aria-label="Điều hướng hồ sơ">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  )
}
