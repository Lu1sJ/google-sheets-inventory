import { GOOGLE_OAUTH_SCOPES } from "../constants/auth";
import { validateGoogleOAuthConfig } from "./validation";

export function buildGoogleOAuthUrl(requestHost?: string): string {
  const { clientId, redirectUri } = validateGoogleOAuthConfig(requestHost);
  
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_OAUTH_SCOPES,
    access_type: "offline",
    prompt: "select_account",
  });
  
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function buildErrorRedirectUrl(error: string): string {
  return `/?error=${encodeURIComponent(error)}`;
}

export function isOAuthError(query: any): boolean {
  return Boolean(query.error);
}

export function hasAuthorizationCode(query: any): boolean {
  return Boolean(query.code);
}