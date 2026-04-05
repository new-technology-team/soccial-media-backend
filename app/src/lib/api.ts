import { authStore } from "./auth";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000";

type AuthUser = {
  id: number;
  email?: string | null;
  phone?: string | null;
  fullName: string;
  avatarUrl?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  isVerified?: boolean;
  createdAt?: string;
};

type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

type RegisterResponse = {
  message: string;
  otpSent: boolean;
  otpChannel?: string;
  otpDestination?: string;
  otpReason?: string;
  otpError?: string;
  emailOrPhone: string;
  verificationCode?: string;
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  const tokens = authStore.getTokens();

  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (tokens?.accessToken) {
    headers.set("Authorization", `Bearer ${tokens.accessToken}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detailedMessage =
      data?.message ||
      data?.issues?.[0]?.message ||
      data?.issues?.[0]?.path?.join?.(".") ||
      "Request failed";
    throw new Error(detailedMessage);
  }

  return data as T;
}

export const api = {
  register: (payload: { emailOrPhone: string; fullName?: string; password: string; dateOfBirth?: string; gender?: string }) =>
    request<RegisterResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload)
    }),

  verifyRegistration: (payload: { emailOrPhone: string; code: string }) =>
    request<AuthResponse>("/api/auth/verify-registration", {
      method: "POST",
      body: JSON.stringify(payload)
    }),

  resendVerification: (emailOrPhone: string) =>
    request<{ message: string; verificationCode?: string; otpSent?: boolean; otpChannel?: string; otpDestination?: string; otpReason?: string; otpError?: string }>("/api/auth/resend-verification", {
      method: "POST",
      body: JSON.stringify({ emailOrPhone })
    }),

  login: (payload: { emailOrPhone: string; password: string }) =>
    request<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload)
    }),

  forgotPassword: (emailOrPhone: string) =>
    request<{ message: string; resetCode?: string; otpSent?: boolean; otpChannel?: string; otpDestination?: string; otpReason?: string; otpError?: string }>("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ emailOrPhone })
    }),

  resetPassword: (payload: { emailOrPhone: string; code: string; newPassword: string }) =>
    request<{ message: string }>("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(payload)
    }),

  me: () =>
    request<AuthUser>("/api/auth/me"),

  updateProfile: (payload: { fullName?: string; avatarUrl?: string; dateOfBirth?: string | null; gender?: string | null }) =>
    request<{ message: string; user: AuthUser; fullName?: string; avatarUrl?: string }>(
      "/api/auth/me",
      {
        method: "PUT",
        body: JSON.stringify(payload)
      }
    ),

  changePassword: (payload: { currentPassword: string; newPassword: string }) =>
    request<{ message: string }>("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify(payload)
    }),

  logout: () => request<{ message: string }>("/api/auth/logout", { method: "POST" })
};
