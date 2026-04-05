type Tokens = {
  accessToken: string;
  refreshToken: string;
};

let tokenCache: Tokens | null = null;

export const authStore = {
  getTokens: () => tokenCache,
  setTokens: (tokens: Tokens) => {
    tokenCache = tokens;
  },
  clear: () => {
    tokenCache = null;
  }
};
