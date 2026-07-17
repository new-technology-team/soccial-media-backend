'use client'

import { lazy, Suspense } from 'react'
import { Outlet, Route, Navigate } from 'react-router-dom'
import AppLayout from '@/components/layouts/AppLayout'
import MainLayout from '@/components/layouts/MainLayout'
import AIChatPage from '@/pages/(app)/ai-chat/page'
import ExplorePage from '@/pages/(app)/explore/page'
import FeedPage from '@/pages/(app)/feed/page'
import FriendsPage from '@/pages/(app)/friends/page'
import MediaPage from '@/pages/(app)/media/page'
const MessagesPage = lazy(() => import('@/pages/(app)/messages/page'))
const ModeratorDashboardPage = lazy(() => import('@/pages/(app)/moderator/dashboard/page'))
const ModeratorCommentsPage = lazy(() => import('@/pages/(app)/moderator/comments/page'))
const ModeratorPostsPage = lazy(() => import('@/pages/(app)/moderator/posts/page'))
const ModeratorMessagesPage = lazy(() => import('@/pages/(app)/moderator/messages/page'))
const ModeratorHistoryPage = lazy(() => import('@/pages/(app)/moderator/history/page'))
const ModeratorReportsPage = lazy(() => import('@/pages/(app)/moderator/reports/page'))
const ModeratorReportDetailPage = lazy(() => import('@/pages/(app)/moderator/report-detail/[id]/page'))
const ModeratorUsersPage = lazy(() => import('@/pages/(app)/moderator/users/page'))
import NotificationsPage from '@/pages/(app)/notifications/page'
import PostDetailPage from '@/pages/(app)/posts/[id]/page'
import ProfilePage from '@/pages/(app)/profile/[id]/page'
import EditProfilePage from '@/pages/(app)/profile/edit/page'
import ReportPage from '@/pages/(app)/report/page'
import SettingsPage from '@/pages/(app)/settings/page'
import SystemAlertsPage from '@/pages/(app)/system-alerts/page'
import { renderAdminRoutes } from '@/routes/admin-routes'
import { useAuthStore } from '@/contexts/auth-store'

/* ---- Auth check wrapper ---- */
function AppLayoutRoute() {
  const accessToken = useAuthStore((state) => state.accessToken)
  if (!accessToken) {
    const reason = sessionStorage.getItem('auth_cleared_reason')
    sessionStorage.removeItem('auth_cleared_reason')
    const loginPath = reason === 'session-expired' ? '/auth/login?reason=session-expired' : '/auth/login'
    return <Navigate to={loginPath} replace />
  }
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  )
}

/* ---- Main 3-column layout wrapper ---- */
function AppPageLayout() {
  return (
    <MainLayout>
      <Outlet />
    </MainLayout>
  )
}

/* ---- Profile redirect ---- */
function OwnProfileRoute() {
  const user = useAuthStore((state) => state.user)
  return <Navigate to={user ? `/profile/${user.username || user.id}` : '/auth/login?next=/profile'} replace />
}

/* ---- Routes ---- */
export function renderAppRoutes() {
  return (
    <Route element={<AppLayoutRoute />}>
      {/* Pages with 3-column MainLayout (Explore, Profile, Notifications, etc.) */}
      <Route element={<AppPageLayout />}>
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/profile" element={<OwnProfileRoute />} />
        <Route path="/profile/:id" element={<ProfilePage />} />
        <Route path="/profile/edit" element={<EditProfilePage />} />
        <Route path="/friends" element={<FriendsPage />} />
        <Route path="/media" element={<MediaPage />} />
        <Route path="/ai-chat" element={<AIChatPage />} />
        <Route path="/posts/:id" element={<PostDetailPage />} />
        <Route path="/report" element={<ReportPage />} />
        <Route path="/system-alerts" element={<SystemAlertsPage />} />
      </Route>

      {/* Feed — full width layout */}
      <Route path="/feed" element={
        <MainLayout fullWidth>
          <FeedPage />
        </MainLayout>
      } />

      {/* Messages — full width with left sidebar, no right sidebar */}
      <Route path="/messages" element={
        <MainLayout showRightSidebar={false} fullWidth hideMobileNav>
          <MessagesPage />
        </MainLayout>
      } />

      {/* Settings — no sidebars */}
      <Route path="/settings" element={<SettingsPage />} />

      {/* Admin & Moderator routes */}
      {renderAdminRoutes()}

      <Route path="/moderator/dashboard" element={<ModeratorDashboardPage />} />
      <Route path="/moderator/posts" element={<ModeratorPostsPage />} />
      <Route path="/moderator/users" element={<ModeratorUsersPage />} />
      <Route path="/moderator/comments" element={<ModeratorCommentsPage />} />
      <Route path="/moderator/messages" element={<ModeratorMessagesPage />} />
      <Route path="/moderator/history" element={<ModeratorHistoryPage />} />
      <Route path="/moderator/reports" element={<ModeratorReportsPage />} />
      <Route path="/moderator/report-detail/:id" element={<ModeratorReportDetailPage />} />
    </Route>
  )
}
