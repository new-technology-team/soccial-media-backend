import { Navigate, Outlet, Route } from 'react-router-dom'

import AdminLayout from '@/layouts/AdminLayout'
import AdminDashboardPage from '@/pages/(app)/admin/dashboard/page'
import AdminPostsPage from '@/pages/(app)/admin/posts/page'
import AdminUsersPage from '@/pages/(app)/admin/users/page'

function AdminLayoutRoute() {
  return (
    <AdminLayout>
      <Outlet />
    </AdminLayout>
  )
}

export function renderAdminRoutes() {
  return (
    <Route path="/admin" element={<AdminLayoutRoute />}>
      <Route index element={<Navigate to="dashboard" replace />} />
      <Route path="dashboard" element={<AdminDashboardPage />} />
      <Route path="posts" element={<AdminPostsPage />} />
      <Route path="users" element={<AdminUsersPage />} />
    </Route>
  )
}
