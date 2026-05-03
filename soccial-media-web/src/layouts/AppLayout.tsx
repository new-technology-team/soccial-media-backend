import styles from './app-layout.module.css'

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className={styles.page}>
      <main className={styles.main}>{children}</main>
    </div>
  )
}
