import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('../../config/mail.config', () => ({ mailConfig: { gmail: {
  clientId: 'disposable-client', clientSecret: 'disposable-secret', redirectUri: 'https://api.lead-crm.tech/api/v1/integrations/gmail/callback',
} } }));
import { createHash } from 'node:crypto';
import { exchangeCodeForTokens, getAuthorizationUrl, getMailboxProfile, getUserInfo, refreshAccessToken } from './gmail.oauth';
const provider = vi.fn();
beforeEach(() => { provider.mockReset(); vi.stubGlobal('fetch', provider); vi.stubEnv('ENCRYPTION_KEY', 'a'.repeat(64)); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it('requests the minimum Inbox scopes with offline consent, an exact login hint and S256 PKCE', () => {
  const params = new URL(getAuthorizationUrl('opaque-state', 'test-verifier', 'staff@gmail.com')).searchParams;
  expect(params.get('scope')?.split(' ')).toEqual(['https://www.googleapis.com/auth/gmail.modify', 'https://www.googleapis.com/auth/userinfo.email']);
  expect(params.get('login_hint')).toBe('staff@gmail.com');
  expect(params.get('state')).toBe('opaque-state');
  expect(params.get('access_type')).toBe('offline');
  expect(params.get('code_challenge_method')).toBe('S256');
  expect(params.get('code_challenge')).toBe(createHash('sha256').update('test-verifier').digest('base64url'));
});
it('sends the original verifier in the authorization-code exchange', async () => {
  provider.mockResolvedValue(Response.json({ access_token: 'access', refresh_token: 'refresh', expires_in: 3600, scope: 'https://www.googleapis.com/auth/gmail.modify' }));
  await exchangeCodeForTokens('code', 'original-verifier');
  expect(provider.mock.calls[0][1].body.get('code_verifier')).toBe('original-verifier');
});
it.each([false, undefined])('rejects identity without a verified Google email: %s', async verified_email => {
  provider.mockResolvedValue(Response.json({ email: 'staff@gmail.com', verified_email }));
  await expect(getUserInfo('access')).rejects.toHaveProperty('code', 'GMAIL_IDENTITY_UNVERIFIED');
});
it('verifies the actual mailbox and only requests its identity field', async () => {
  provider.mockResolvedValue(Response.json({ emailAddress: ' STAFF@WORKSPACE.EXAMPLE ' }));
  expect(await getMailboxProfile('access')).toEqual({ emailAddress: 'staff@workspace.example' });
  expect(provider.mock.calls[0][0]).toBe('https://gmail.googleapis.com/gmail/v1/users/me/profile?fields=emailAddress');
});
it('explains a Google account without available Gmail service', async () => {
  provider.mockResolvedValue(Response.json({ error: 'not available' }, { status: 403 }));
  await expect(getMailboxProfile('access')).rejects.toHaveProperty('code', 'GMAIL_MAILBOX_UNAVAILABLE');
});
it('distinguishes revoked authorization from a temporary refresh failure', async () => {
  provider.mockResolvedValueOnce(Response.json({ error: 'invalid_grant' }, { status: 400 }));
  await expect(refreshAccessToken('refresh')).rejects.toHaveProperty('code', 'GMAIL_RECONNECT_REQUIRED');
  provider.mockResolvedValueOnce(Response.json({ error: 'temporarily_unavailable' }, { status: 503 }));
  await expect(refreshAccessToken('refresh')).rejects.toHaveProperty('code', 'GMAIL_REFRESH_UNAVAILABLE');
});
