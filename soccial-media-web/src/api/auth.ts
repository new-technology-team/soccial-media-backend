'use client'

import { request } from './client'
import type { User } from '@/types'

export function authApi(token: string) {
  return {
    login: (emailOrPhone: string, password: string) =>
      request<{ accessToken: string; refreshToken: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ emailOrPhone, password }),
      }),

    register: (payload: {
      fullName: string
      email?: string
      phone?: string
      password: string
      gender?: string
      dateOfBirth?: string
    }) =>
      request<{ message: string }>('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),

    verifyRegistration: (payload: { emailOrPhone: string; code: string }) =>
      request<{ message: string; accessToken?: string; refreshToken?: string; user?: User }>(
        '/auth/verify-registration',
        { method: 'POST', body: JSON.stringify(payload) }
      ),

    resendVerificationCode: (emailOrPhone: string) =>
      request<{ message: string }>('/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ emailOrPhone }),
      }),

    forgotPassword: (emailOrPhone: string) =>
      request<{ message: string }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ emailOrPhone }),
      }),

    resetPassword: (payload: { emailOrPhone: string; code: string; newPassword: string }) =>
      request<{ message: string }>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    me: () => request<{ user: User }>('/auth/me', { method: 'GET' }, token),

    updateProfile: (payload: { fullName?: string; avatarUrl?: string; dateOfBirth?: string; gender?: string }) =>
      request<{ message: string; user: User }>('/auth/me', { method: 'PUT', body: JSON.stringify(payload) }, token),

    getSettings: () =>
      request<{
        settings: {
          privacyLastSeen: boolean
          privacyProfilePhoto: boolean
          allowFriendRequests: boolean
          notificationMessages: boolean
          notificationCalls: boolean
          updatedAt: string
        }
      }>('/social/settings', { method: 'GET' }, token),

    saveSettings: (settings: {
      privacyLastSeen?: boolean
      privacyProfilePhoto?: boolean
      allowFriendRequests?: boolean
      notificationMessages?: boolean
      notificationCalls?: boolean
    }) =>
      request<{ message: string; settings: unknown }>('/social/settings', { method: 'PUT', body: JSON.stringify(settings) }, token),

    changePassword: (payload: { currentPassword: string; newPassword: string }) =>
      request<{ message: string }>('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify(payload),
      }, token),
  }
}
