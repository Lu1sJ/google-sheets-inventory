// Client-side authentication constants
export const AUTH_ENDPOINTS = {
  ME: "/api/auth/me",
  LOGOUT: "/api/auth/logout", 
  LOGOUT_ALL: "/api/auth/logout-all",
  GOOGLE_SIGNIN: "/api/auth/google",
  GOOGLE_CALLBACK: "/api/auth/google/callback",
} as const;

export const PROFILE_ENDPOINTS = {
  UPDATE: "/api/profile",
  DELETE: "/api/profile",
} as const;

export const ADMIN_ENDPOINTS = {
  USERS: "/api/admin/users",
  UPDATE_ROLE: (userId: string) => `/api/admin/users/${userId}/role`,
} as const;

export const AUTH_ERROR_MESSAGES = {
  FAILED_TO_GET_USER: "Failed to get current user",
  FAILED_TO_LOGOUT: "Failed to logout",
  SESSION_EXPIRED: "Your session has expired. Please sign in again.",
  NETWORK_ERROR: "Network error. Please check your connection.",
} as const;

export const CACHE_SETTINGS = {
  NO_CACHE: { "Cache-Control": "no-cache" },
  INCLUDE_CREDENTIALS: "include" as RequestCredentials,
} as const;