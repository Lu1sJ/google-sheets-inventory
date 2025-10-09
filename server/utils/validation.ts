import { USER_ROLES, type UserRole } from "../constants/auth";
import validator from "validator";

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

// Security: Sanitize user input to prevent XSS attacks
export function sanitizeInput(value: string): string {
  return validator.escape(value.trim());
}

export function validateRequiredString(value: unknown, fieldName: string): string {
  if (!value || typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(`${fieldName} is required`);
  }
  // Security: Sanitize input to prevent XSS
  return sanitizeInput(value);
}

export function validateUserRole(role: unknown): UserRole {
  if (!role || typeof role !== "string" || !Object.values(USER_ROLES).includes(role as UserRole)) {
    throw new ValidationError("Invalid role");
  }
  return role as UserRole;
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validateGoogleOAuthConfig(requestHost?: string): { clientId: string; redirectUri: string } {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new ValidationError("Google OAuth not configured");
  }

  let redirectUri: string;
  if (requestHost) {
    redirectUri = `https://${requestHost}//api/auth/google/callback`;
  } else {
    if (process.env.GOOGLE_REDIRECT_URI) {
      redirectUri = process.env.GOOGLE_REDIRECT_URI;
    } else if (process.env.DEPLOYMENT_URL) {
      const deploymentHost = process.env.DEPLOYMENT_URL.replace(/^https?:\/\//, '');
      redirectUri = `https://${deploymentHost}//api/auth/google/callback`;
    } else if (process.env.DOMAINS) {
      redirectUri = `https://${process.env.DOMAINS.split(',')[0]}//api/auth/google/callback`;
    } else {
      redirectUri = `https://localhost:5000//api/auth/google/callback`;
    }
  }

  // Security: Only log OAuth config in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[validateGoogleOAuthConfig] redirectUri:', redirectUri);
  }

  return { clientId, redirectUri };
}