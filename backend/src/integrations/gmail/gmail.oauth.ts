import { mailConfig } from '../../config/mail.config';

/**
 * Gmail OAuth2 helpers.
 * Generates the authorization URL and exchanges the auth code for tokens.
 * Tokens must be stored securely — never in plain localStorage or logs.
 */

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/userinfo.email',
];

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

interface UserInfoResponse {
  email: string;
  name?: string;
  picture?: string;
}

/**
 * Builds the Google OAuth2 authorization URL.
 * Includes state param for CSRF protection (userId + tenantId).
 */
export function getAuthorizationUrl(state: string): string {
  const { clientId, redirectUri } = mailConfig.gmail;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GMAIL_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchanges the authorization code for access + refresh tokens.
 */
export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const { clientId, clientSecret, redirectUri } = mailConfig.gmail;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Token exchange failed: ${response.status} — ${errorBody}`);
  }

  return response.json() as Promise<TokenResponse>;
}

/**
 * Refreshes an expired access token using the refresh token.
 */
export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const { clientId, clientSecret } = mailConfig.gmail;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Token refresh failed: ${response.status} — ${errorBody}`);
  }

  return response.json() as Promise<TokenResponse>;
}

/**
 * Fetches the authenticated user's email address from Google.
 */
export async function getUserInfo(accessToken: string): Promise<UserInfoResponse> {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch user info: ${response.status}`);
  }

  return response.json() as Promise<UserInfoResponse>;
}

export { GMAIL_SCOPES };
export type { TokenResponse, UserInfoResponse };
