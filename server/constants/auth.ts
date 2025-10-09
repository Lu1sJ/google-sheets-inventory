// Authentication-related constants
export const SESSION_DURATION_DAYS = 30;
export const SESSION_DURATION_MS = SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000;

export const GOOGLE_OAUTH_SCOPES = "email profile openid https://www.googleapis.com/auth/spreadsheets";

export const USER_ROLES = {
  USER: "user",
  ADMIN: "admin",
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

export const ERROR_MESSAGES = {
  NOT_AUTHENTICATED: "Not authenticated",
  SESSION_EXPIRED: "Session expired",
  INTERNAL_SERVER_ERROR: "Internal server error",
  GOOGLE_OAUTH_NOT_CONFIGURED: "Google OAuth not configured",
  INVALID_ROLE: "Invalid role",
  CANNOT_CHANGE_OWN_ROLE: "Cannot change your own role",
  CANNOT_REMOVE_LAST_ADMIN: "Cannot remove the last admin user",
  USER_NOT_FOUND: "User not found",
  NAME_REQUIRED: "Name is required",
} as const;

export const SESSION_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 1 day