import { Outlet, Route } from 'react-router-dom'

import AuthLayout from '@/layouts/AuthLayout'
import AdminLoginPage from '@/pages/auth/admin-login/page'
import ForgotPasswordPage from '@/pages/auth/forgot-password/page'
import LoginPage from '@/pages/auth/login/page'
import SignupPage from '@/pages/auth/signup/page'
import VerifyOtpPage from '@/pages/auth/verify-otp/page'

function AuthLayoutRoute() {
  return (
    <AuthLayout>
      <Outlet />
    </AuthLayout>
  )
}

export function renderAuthRoutes() {
  return (
    <Route path="/auth" element={<AuthLayoutRoute />}>
      <Route path="login" element={<LoginPage />} />
      <Route path="admin-login" element={<AdminLoginPage />} />
      <Route path="forgot-password" element={<ForgotPasswordPage />} />
      <Route path="signup" element={<SignupPage />} />
      <Route path="verify-otp" element={<VerifyOtpPage />} />
    </Route>
  )
}
