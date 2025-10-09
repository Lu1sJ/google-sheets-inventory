import { queryClient } from "./queryClient";
import { HttpClient, HttpError } from "../utils/http-client";
import { AUTH_ENDPOINTS, AUTH_ERROR_MESSAGES } from "../constants/auth";

export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
  googleId?: string;
  role: string;
  createdAt: string;
  lastSignIn?: string;
  isVerified: boolean;
}

export interface AuthResponse {
  user: User;
}

export class AuthService {
  static async getCurrentUser(): Promise<User | null> {
    try {
      const data = await HttpClient.get<AuthResponse>(AUTH_ENDPOINTS.ME);
      return data.user;
    } catch (error) {
      if (error instanceof HttpError && error.status === 401) {
        return null;
      }
      console.error("Error getting current user:", error);
      return null;
    }
  }

  static async logout(): Promise<void> {
    try {
      await HttpClient.post(AUTH_ENDPOINTS.LOGOUT);
      queryClient.clear();
    } catch (error) {
      console.error("Logout error:", error);
      throw new Error(AUTH_ERROR_MESSAGES.FAILED_TO_LOGOUT);
    }
  }

  static async logoutFromAllDevices(): Promise<void> {
    try {
      await HttpClient.post(AUTH_ENDPOINTS.LOGOUT_ALL);
      queryClient.clear();
    } catch (error) {
      console.error("Logout all devices error:", error);
      throw new Error(AUTH_ERROR_MESSAGES.FAILED_TO_LOGOUT);
    }
  }

  static initiateGoogleSignIn(): void {
    window.location.href = AUTH_ENDPOINTS.GOOGLE_SIGNIN;
  }
}

export class SocialAuthService {
  static async signInWithGoogle(): Promise<void> {
    AuthService.initiateGoogleSignIn();
  }

  static async signIn(provider: string, callbackURL?: string): Promise<void> {
    switch (provider) {
      case "google":
        return this.signInWithGoogle();
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }
}

// Legacy exports for backward compatibility
export const getCurrentUser = AuthService.getCurrentUser;
export const logout = AuthService.logout;
export const initiateGoogleSignIn = AuthService.initiateGoogleSignIn;

export const signIn = {
  social: async ({ provider, callbackURL }: { provider: string; callbackURL: string }) => {
    return SocialAuthService.signIn(provider, callbackURL);
  }
};

export const signOut = logout;
