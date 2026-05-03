import { Navigate, Route, Routes } from 'react-router-dom'

import HomePage from '@/pages/page'
import { renderAppRoutes } from '@/routes/app-routes'
import { renderAuthRoutes } from '@/routes/auth-routes'

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      {renderAuthRoutes()}
      {renderAppRoutes()}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
