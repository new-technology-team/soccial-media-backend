import { lazy, Suspense } from 'react'
import { Navigate, Outlet, Route } from 'react-router-dom'

import AdminLayout from '@/components/layouts/AdminLayout'

const AdminDashboardPage = lazy(() => import('@/pages/(app)/admin/dashboard/page'))
const AdminAuditLogsPage = lazy(() => import('@/pages/(app)/admin/audit-logs/page'))
const AdminModeratorsPage = lazy(() => import('@/pages/(app)/admin/moderators/page'))
const AdminPostsPage = lazy(() => import('@/pages/(app)/admin/posts/page'))
const AdminReportsPage = lazy(() => import('@/pages/(app)/admin/reports/page'))
const AdminSettingsPage = lazy(() => import('@/pages/(app)/admin/settings/page'))
const AdminStatisticsPage = lazy(() => import('@/pages/(app)/admin/statistics/page'))
const AdminUsersPage = lazy(() => import('@/pages/(app)/admin/users/page'))

function AdminLayoutRoute() {
  return (
    <AdminLayout>
      <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
        <Outlet />
      </Suspense>
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
      <Route path="moderators" element={<AdminModeratorsPage />} />
      <Route path="reports" element={<AdminReportsPage />} />
      <Route path="statistics" element={<AdminStatisticsPage />} />
      <Route path="audit-logs" element={<AdminAuditLogsPage />} />
      <Route path="settings" element={<AdminSettingsPage />} />
    </Route>
  )
}

