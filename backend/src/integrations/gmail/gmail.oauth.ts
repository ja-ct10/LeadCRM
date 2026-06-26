import { mailConfig } from '../../config/mail.config';

/**
 * Gmail OAuth2 helpers.
 * Generates the authorization URL and exchanges the auth code for tokens.
 * Tokens must be stored securely — never in plain localStorage or logs.
 */
export function getAuthorizationUrl(): string {
  const { clientId, redirectUri } = mailConfig.gmail;
  const scopes = ['https://www.googleapis.com/auth/gmail.send'];
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes.join(' '),
    access_type: 'offline',
    prompt: 'consent',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// TODO: implement exchangeCodeForTokens(code: string) using googleapis in Phase 2
