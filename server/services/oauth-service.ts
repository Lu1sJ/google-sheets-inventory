import type { Request } from "express";
import { GoogleOAuthService, AuthService, GoogleAuthError } from "../auth";
import { buildErrorRedirectUrl, isOAuthError, hasAuthorizationCode } from "../utils/oauth-helpers";

export class OAuthCallbackService {
  static async handleGoogleCallback(req: Request): Promise<string> {
    const { query } = req;
    
    this.validateCallbackParameters(query);
    
    const code = query.code as string;
    const xForwardedHost = req.get('x-forwarded-host');
    const host = req.get('host');
    const referer = req.get('referer');
    
    // Use x-forwarded-host if available, otherwise use host header
    // Don't use referer from accounts.google.com - that's Google's domain, not ours!
    let requestHost = xForwardedHost || host;
    if (referer && !xForwardedHost && !referer.includes('accounts.google.com')) {
      requestHost = referer.replace(/^https?:\/\//, '').split('/')[0];
    }
    
    console.log("=== OAuth Callback Debug ===");
    console.log("referer header:", referer);
    console.log("host header:", host);
    console.log("x-forwarded-host header:", xForwardedHost);
    console.log("Using requestHost:", requestHost);
    console.log("Request protocol:", req.protocol);
    console.log("Full URL:", `${req.protocol}://${requestHost}${req.path}`);
    
    try {
      const tokens = await GoogleOAuthService.exchangeCodeForTokens(code, requestHost);
      console.log("Getting user info from Google...");
      const googleUser = await GoogleOAuthService.getUserInfo(tokens.access_token);
      console.log("Creating/updating user:", googleUser.email);
      const user = await AuthService.createOrUpdateUserFromGoogle(googleUser, tokens);
      console.log("Creating session for user:", user.id);
      const sessionId = await AuthService.createSessionForUser(user.id);
      
      // SECURITY: Regenerate session ID to prevent session fixation attacks
      // This ensures that any pre-authentication session ID is invalidated
      return new Promise<string>((resolve, reject) => {
        req.session.regenerate((err) => {
          if (err) {
            console.error("Session regeneration error:", err);
            reject(err);
            return;
          }
          
          req.session.sessionId = sessionId;
          // Security: Don't log session IDs in production
          if (process.env.NODE_ENV === 'development') {
            console.log("Session created and regenerated");
          }
          resolve("/dashboard");
        });
      });
    } catch (error) {
      console.error("OAuth callback error details:", error);
      throw error;
    }
  }

  private static validateCallbackParameters(query: any): void {
    if (isOAuthError(query)) {
      throw new Error(`oauth_error:${query.error}`);
    }
    
    if (!hasAuthorizationCode(query)) {
      throw new Error("oauth_error:no_code");
    }
  }

  static buildErrorRedirect(error: Error): string {
    // Handle GoogleAuthError with specific codes
    if (error instanceof GoogleAuthError) {
      if (error.code === 'DOMAIN_NOT_ALLOWED') {
        return buildErrorRedirectUrl("domain_not_allowed");
      }
    }
    
    const message = error.message;
    
    if (message.startsWith("oauth_error:")) {
      const errorType = message.split(":")[1];
      return buildErrorRedirectUrl(errorType);
    }
    
    return buildErrorRedirectUrl("oauth_failed");
  }
}