'use client'

import { useLocation } from 'react-router-dom'
import { motion, type Variants } from 'framer-motion'
import LeftSidebar from '@/components/navigation/LeftSidebar'
import RightSidebar, {
  type TrendingTopic,
  type SuggestedUser,
} from '@/components/navigation/RightSidebar'
import MobileHeader from '@/components/navigation/MobileHeader'
import MobileBottomNav from '@/components/navigation/MobileBottomNav'

/* ---- Types ---- */
interface MainLayoutProps {
  children: React.ReactNode
  showRightSidebar?: boolean
  trending?: TrendingTopic[]
  suggestions?: SuggestedUser[]
  contentClassName?: string
  fullWidth?: boolean
  hideMobileNav?: boolean
}

/* ---- Page transition variants ---- */
const pageVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
}

/* ==========================================================
   MainLayout — Layout 3 cột responsive
   Mobile  (<768px) : flex col, no sidebars, bottom nav
   Tablet  (768-1023): left sidebar (collapsed) + content
   Laptop+ (>=1024)  : full 3-column grid
   ========================================================== */
export default function MainLayout({
  children,
  showRightSidebar = true,
  trending,
  suggestions,
  contentClassName = '',
  fullWidth = false,
  hideMobileNav = false,
}: MainLayoutProps) {
  const { pathname } = useLocation()

  const gridCols = showRightSidebar
    ? 'auto 1fr var(--right-sidebar-width)'
    : 'auto 1fr'

  return (
    <div className="h-dvh overflow-hidden bg-background flex flex-col">
      {/* Mobile & Tablet header — hidden on laptop+ */}
      {!hideMobileNav && <MobileHeader />}

      {/* Main content grid */}
      {/* Mobile: flex column so children fill height properly */}
      {/* Tablet + Laptop+: activates grid */}
      <div
        className="flex-1 min-h-0 flex flex-col md:grid"
        style={{ gridTemplateColumns: gridCols }}
      >
        <LeftSidebar />

        <motion.main
          key={pathname}
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className={`
            min-h-0 overflow-y-auto w-full flex-1
            ${fullWidth ? '' : 'max-w-[var(--feed-max-width)]'}
            mx-auto
            ${contentClassName}
          `}
        >
          {children}
        </motion.main>

        {showRightSidebar && (
          <RightSidebar trending={trending} suggestions={suggestions} />
        )}
      </div>

      {/* Mobile & Tablet bottom nav — hidden on laptop+ */}
      {!hideMobileNav && <MobileBottomNav />}
    </div>
  )
}
