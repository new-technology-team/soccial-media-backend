import { Outlet, Route } from 'react-router-dom'

import AppLayout from '@/layouts/AppLayout'
import AIChatPage from '@/pages/(app)/ai-chat/page'
import ExplorePage from '@/pages/(app)/explore/page'
import FeedPage from '@/pages/(app)/feed/page'
import FriendsPage from '@/pages/(app)/friends/page'
import GroupsPage from '@/pages/(app)/groups/page'
import MediaPage from '@/pages/(app)/media/page'
import MessagesPage from '@/pages/(app)/messages/page'
import ModeratorDashboardPage from '@/pages/(app)/moderator/dashboard/page'
import ModeratorPostsPage from '@/pages/(app)/moderator/posts/page'
import ModeratorReportsPage from '@/pages/(app)/moderator/reports/page'
import ModeratorUsersPage from '@/pages/(app)/moderator/users/page'
import NotificationsPage from '@/pages/(app)/notifications/page'
import PostDetailPage from '@/pages/(app)/posts/[id]/page'
import ProfilePage from '@/pages/(app)/profile/[id]/page'
import EditProfilePage from '@/pages/(app)/profile/edit/page'
import ReportPage from '@/pages/(app)/report/page'
import SettingsPage from '@/pages/(app)/settings/page'
import SystemAlertsPage from '@/pages/(app)/system-alerts/page'
import { renderAdminRoutes } from '@/routes/admin-routes'

function AppLayoutRoute() {
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  )
}

export function renderAppRoutes() {
  return (
    <Route element={<AppLayoutRoute />}>
      <Route path="/feed" element={<FeedPage />} />
      <Route path="/explore" element={<ExplorePage />} />
      <Route path="/messages" element={<MessagesPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/media" element={<MediaPage />} />
      <Route path="/notifications" element={<NotificationsPage />} />
      <Route path="/friends" element={<FriendsPage />} />
      <Route path="/groups" element={<GroupsPage />} />
      <Route path="/ai-chat" element={<AIChatPage />} />
      <Route path="/report" element={<ReportPage />} />
      <Route path="/system-alerts" element={<SystemAlertsPage />} />
      <Route path="/posts/:id" element={<PostDetailPage />} />
      <Route path="/profile/:id" element={<ProfilePage />} />
      <Route path="/profile/edit" element={<EditProfilePage />} />

      {renderAdminRoutes()}

      <Route path="/moderator/dashboard" element={<ModeratorDashboardPage />} />
      <Route path="/moderator/posts" element={<ModeratorPostsPage />} />
      <Route path="/moderator/users" element={<ModeratorUsersPage />} />
      <Route path="/moderator/reports" element={<ModeratorReportsPage />} />
    </Route>
  )
}
