import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AuthTokens } from '../types';

const TOKEN_KEY = 'auth_tokens';

let tokenCache: AuthTokens | null = null;
let initPromise: Promise<void> | null = null;

async function init(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(TOKEN_KEY);
    if (raw) {
      tokenCache = JSON.parse(raw) as AuthTokens;
    }
  } catch {
    tokenCache = null;
  }
}

export const authStore = {
  getTokens: (): AuthTokens | null => tokenCache,

  setTokens: async (tokens: AuthTokens): Promise<void> => {
    tokenCache = tokens;
    try {
      await AsyncStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
    } catch {
      // ignore storage errors
    }
  },

  clear: async (): Promise<void> => {
    tokenCache = null;
    try {
      await AsyncStorage.removeItem(TOKEN_KEY);
    } catch {
      // ignore storage errors
    }
  },

  hydrate: (): Promise<void> => {
    if (!initPromise) {
      initPromise = init();
    }
    return initPromise;
  },
};
