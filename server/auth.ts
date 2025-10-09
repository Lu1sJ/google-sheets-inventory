import { storage } from "./storage";
import type { User, InsertUser } from "@shared/schema";
import { SESSION_DURATION_MS } from "./constants/auth";
import { validateGoogleOAuthConfig } from "./utils/validation";

export interface SafeUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
  googleId?: string;
  role: string;
  createdAt: Date;
  lastSignIn?: Date;
  isVerified: boolean;
}

export class GoogleAuthError extends Error {
  code: string;
  
  constructor(message: string, code: string) {
    super(message);
    this.name = 'GoogleAuthError';
    this.code = code;
  }
}

export interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  picture?: string;
  verified_email: boolean;
}

export interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

export class AuthService {
  static toSafeUser(user: User): SafeUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture || undefined,
      googleId: user.googleId || undefined,
      role: user.role,
      createdAt: user.createdAt,
      lastSignIn: user.lastSignIn || undefined,
      isVerified: user.isVerified,
    };
  }

  static async createSessionForUser(userId: string): Promise<string> {
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
    
    const session = await storage.createSession({
      userId,
      expiresAt,
    });
    
    return session.id;
  }

  static async validateSession(sessionId: string): Promise<(User & { sessionId: string }) | null> {
    if (!sessionId) return null;
    
    const sessionWithUser = await storage.getSessionWithUser(sessionId);
    if (!sessionWithUser) return null;
    
    return {
      ...sessionWithUser.user,
      sessionId: sessionWithUser.id,
    };
  }

  static async createOrUpdateUserFromGoogle(googleUser: GoogleUserInfo, tokens?: GoogleTokenResponse): Promise<User> {
    // No domain restriction - allow any verified email address
    const existingUser = await this.findExistingUser(googleUser);
    
    if (existingUser) {
      return await this.updateExistingUser(existingUser, googleUser, tokens);
    }
    
    return await this.createNewUser(googleUser, tokens);
  }

  private static validateEmailDomain(email: string): void {
    // Domain validation removed - any verified email address is now allowed
    // This method is kept for backward compatibility but no longer enforces restrictions
  }

  private static async findExistingUser(googleUser: GoogleUserInfo): Promise<User | undefined> {
    // First try to find by Google ID
    let user = await storage.getUserByGoogleId(googleUser.id);
    if (user) return user;
    
    // Then try to find by email
    return await storage.getUserByEmail(googleUser.email);
  }

  private static async updateExistingUser(user: User, googleUser: GoogleUserInfo, tokens?: GoogleTokenResponse): Promise<User> {
    const tokenUpdates = tokens ? {
      googleAccessToken: tokens.access_token,
      googleRefreshToken: tokens.refresh_token,
      googleTokenExpiresAt: new Date(Date.now() + (tokens.expires_in * 1000)),
    } : {};

    const updates = {
      lastSignIn: new Date(),
      name: googleUser.name,
      picture: googleUser.picture,
      isVerified: googleUser.verified_email,
      // Link Google account if not already linked
      ...(user.googleId ? {} : { googleId: googleUser.id }),
      ...tokenUpdates,
    };

    const updatedUser = await storage.updateUser(user.id, updates);
    if (!updatedUser) {
      throw new Error("Failed to update user");
    }
    
    return updatedUser;
  }

  private static async createNewUser(googleUser: GoogleUserInfo, tokens?: GoogleTokenResponse): Promise<User> {
    const tokenFields = tokens ? {
      googleAccessToken: tokens.access_token,
      googleRefreshToken: tokens.refresh_token,
      googleTokenExpiresAt: new Date(Date.now() + (tokens.expires_in * 1000)),
    } : {};

    const newUser: InsertUser = {
      email: googleUser.email,
      name: googleUser.name,
      picture: googleUser.picture,
      googleId: googleUser.id,
      lastSignIn: new Date(),
      isVerified: googleUser.verified_email,
      ...tokenFields,
    };
    
    return await storage.createUser(newUser);
  }
}

export class GoogleOAuthService {
  static async exchangeCodeForTokens(code: string, requestHost?: string): Promise<GoogleTokenResponse> {
    const { clientId, redirectUri } = validateGoogleOAuthConfig(requestHost);
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    
    if (!clientSecret) {
      throw new Error("Google OAuth client secret not configured");
    }

    console.log("=== Token Exchange Debug ===");
    console.log("clientId:", clientId.substring(0, 20) + "...");
    console.log("redirectUri:", redirectUri);
    console.log("code:", code.substring(0, 20) + "...");

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Token exchange failed:", response.status, errorText);
      throw new Error(`Failed to exchange code for tokens: ${errorText}`);
    }
    
    const tokens = await response.json();
    console.log("Token exchange successful");
    return tokens;
  }

  static async getUserInfo(accessToken: string): Promise<GoogleUserInfo> {
    const response = await fetch(`https://www.googleapis.com/oauth2/v2/userinfo?access_token=${accessToken}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get user info from Google: ${errorText}`);
    }
    
    return await response.json();
  }

  static async refreshAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
    const { clientId } = validateGoogleOAuthConfig();
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    
    if (!clientSecret) {
      throw new Error("Google OAuth client secret not configured");
    }

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to refresh access token: ${errorText}`);
    }
    
    return await response.json();
  }

  static async ensureValidAccessToken(user: User): Promise<string> {
    if (!user.googleAccessToken) {
      throw new GoogleAuthError("No Google access token available", "GOOGLE_REAUTH_REQUIRED");
    }

    // If token expires within the next 5 minutes, refresh it
    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
    
    if (user.googleTokenExpiresAt && user.googleTokenExpiresAt <= fiveMinutesFromNow) {
      if (!user.googleRefreshToken) {
        throw new GoogleAuthError("Access token expired and no refresh token available", "GOOGLE_REAUTH_REQUIRED");
      }

      try {
        const tokens = await this.refreshAccessToken(user.googleRefreshToken);
        
        // Update user with new tokens
        await storage.updateUser(user.id, {
          googleAccessToken: tokens.access_token,
          googleRefreshToken: tokens.refresh_token || user.googleRefreshToken, // Keep old refresh token if new one not provided
          googleTokenExpiresAt: new Date(Date.now() + (tokens.expires_in * 1000)),
        });

        return tokens.access_token;
      } catch (error) {
        console.error("Token refresh failed:", error);
        throw new GoogleAuthError("Failed to refresh access token. Please sign in again.", "GOOGLE_REAUTH_REQUIRED");
      }
    }

    return user.googleAccessToken;
  }
}

// Legacy exports for backward compatibility
export const createSessionForUser = AuthService.createSessionForUser;
export const validateSession = AuthService.validateSession;
export const createOrUpdateUserFromGoogle = AuthService.createOrUpdateUserFromGoogle;
export const exchangeGoogleCodeForTokens = GoogleOAuthService.exchangeCodeForTokens;
export const getGoogleUserInfo = GoogleOAuthService.getUserInfo;
