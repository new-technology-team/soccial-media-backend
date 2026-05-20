import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types'

type AuthState = {
  accessToken: string | null
  refreshToken: string | null
  user: User | null
  setAuth: (payload: { accessToken: string; refreshToken: string; user: User }) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setAuth: (payload) => {
        // Sync to authStorage so api.ts request() can read the token
        authStorage.setTokens(payload.accessToken, payload.refreshToken);
        set({
          accessToken: payload.accessToken,
          refreshToken: payload.refreshToken,
          user: payload.user,
        });
      },
      clearAuth: () => {
        authStorage.clear();
        set({ accessToken: null, refreshToken: null, user: null });
      },
    }),
    {
      name: 'abc-auth-storage',
    }
  )
)

