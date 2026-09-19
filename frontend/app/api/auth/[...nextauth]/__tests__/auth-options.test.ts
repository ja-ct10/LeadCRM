// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const { setCookie } = vi.hoisted(() => ({ setCookie: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: async () => ({ set: setCookie }) }));
import { authOptions } from '../auth-options';

const signIn = authOptions.callbacks!.signIn!;
beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

it('exchanges only the Google ID token and establishes the LeadCRM cookie', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
    success: true, data: { token: 'server-session', user: { id: 'leadcrm-user' } },
  })));
  vi.stubGlobal('fetch', fetchMock);
  const user = { id: 'google-user' };
  expect(await signIn({
    user, account: { provider: 'google', id_token: 'google-proof', access_token: 'unused' },
  } as never)).toBe(true);
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ idToken: 'google-proof' });
  expect(user.id).toBe('leadcrm-user');
  expect(setCookie).toHaveBeenCalledWith('leadcrm_token', 'server-session',
    expect.objectContaining({ path: '/', httpOnly: true, sameSite: 'lax' }));
});

it.each([
  ['EMAIL_VERIFICATION_REQUIRED', 'VerificationRequired'],
  ['ACCOUNT_LINK_REQUIRED', 'OAuthAccountNotLinked'],
  ['ACCOUNT_INACTIVE', 'AccountInactive'],
])('preserves a useful recovery error for %s', async (code, error) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
    success: false, error: { code },
  }), { status: 403 })));
  expect(await signIn({
    user: {}, account: { provider: 'google', id_token: 'proof' },
  } as never)).toBe(`/login?error=${error}`);
  expect(setCookie).not.toHaveBeenCalled();
});

it('does not trust a Google callback without an ID token', async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  expect(await signIn({ user: {}, account: { provider: 'google' } } as never)).toBe(false);
  expect(fetchMock).not.toHaveBeenCalled();
});

it('discards backend tokens and onboarding flags from the NextAuth JWT', async () => {
  const token = await authOptions.callbacks!.jwt!({
    token: {
      sub: 'user-1', name: 'Test', email: 'test@example.com',
      accessToken: 'old-secret', role: 'Client Admin', requiresProfileCompletion: true,
    },
  } as never);
  expect(token).toEqual({
    sub: 'user-1', name: 'Test', email: 'test@example.com', picture: undefined,
  });
  expect(await authOptions.callbacks!.redirect!({
    url: 'https://evil.example', baseUrl: 'https://app.example.com',
  })).toBe('https://app.example.com');
});
