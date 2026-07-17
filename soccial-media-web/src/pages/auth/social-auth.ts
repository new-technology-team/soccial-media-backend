import { API_BASE } from '@/config/api'

type SocialProvider = 'google'

const providerLabels: Record<SocialProvider, string> = {
  google: 'Google',
}

export const startSocialAuth = (provider: SocialProvider) => {
  const errorRedirect = encodeURIComponent(`/auth/login?socialProvider=${provider}`)
  const targetUrl = `${API_BASE}/auth/${provider}?redirectOnError=${errorRedirect}`

  sessionStorage.setItem('zchat-social-provider', provider)
  sessionStorage.removeItem('zchat-social-retry')
  window.location.assign(targetUrl)
}

export const getSocialAuthUnavailableMessage = (provider: SocialProvider) =>
  `Chưa cấu hình đăng nhập ${providerLabels[provider]}. Hãy thêm OAuth Client ID/Secret ở backend.`
