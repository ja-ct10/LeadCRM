import { beforeEach, expect, it, vi } from 'vitest';
const verifyIdToken = vi.hoisted(() => vi.fn());
vi.mock('google-auth-library', () => ({
  OAuth2Client: class { verifyIdToken = verifyIdToken; },
}));
vi.mock('../../../config/database.config', async () => ({
  default: (await import('./auth-test-db')).db,
}));
vi.mock('../session.service', () => ({ createSession: vi.fn() }));
vi.mock('../jwt.service', () => ({ signToken: vi.fn().mockReturnValue('jwt') }));
import { db, user, resetDb } from './auth-test-db';
import { verifyGoogleIdentity } from '../google-identity.service';
import { findOrCreateUserByOAuth } from '../oauth.service';
import { createSession } from '../session.service';

const identity = {
  provider: 'google' as const, providerAccountId: 'stable-subject',
  email: 'alice@gmail.com', firstName: 'Alice', lastName: 'Owner', authoritativeEmail: true,
};
beforeEach(() => {
  resetDb();
  vi.stubEnv('GOOGLE_CLIENT_ID', 'configured-client-id');
});
it('verifies signature/audience through the Google verifier and uses only verified claims', async () => {
  verifyIdToken.mockResolvedValue({ getPayload: () => ({
    sub: 'verified-sub', email: 'ALICE@GMAIL.COM', email_verified: true, given_name: 'Alice',
  }) });
  expect(await verifyGoogleIdentity('signed-token')).toMatchObject({
    providerAccountId: 'verified-sub', email: 'alice@gmail.com', authoritativeEmail: true,
  });
  expect(verifyIdToken).toHaveBeenCalledWith({ idToken: 'signed-token', audience: 'configured-client-id' });
});
it('rejects invalid/expired/wrong-audience tokens without falling back to decoded claims', async () => {
  verifyIdToken.mockRejectedValue(new Error('invalid signature'));
  await expect(verifyGoogleIdentity('forged-token')).rejects.toMatchObject({ statusCode: 401 });
});
it('rejects an unverified Google email', async () => {
  verifyIdToken.mockResolvedValue({ getPayload: () => ({
    sub: 'sub', email: 'alice@gmail.com', email_verified: false,
  }) });
  await expect(verifyGoogleIdentity('token')).rejects.toMatchObject({ statusCode: 401 });
});
it('rejects OAuth provisioning without creating users, workspaces or sessions', async () => {
  await expect(findOrCreateUserByOAuth(identity)).rejects.toHaveProperty('code', 'SELF_SERVICE_DISABLED');
  expect(db.user.create).not.toHaveBeenCalled();
  expect(db.tenant.create).not.toHaveBeenCalled();
  expect(createSession).not.toHaveBeenCalled();
});
it.each(['ambiguous', 'pending', 'third-party-email'])('rejects unsafe linking: %s', async mode => {
  if (mode === 'ambiguous') db.user.findMany.mockResolvedValue([user, { ...user, id: 'other' }]);
  if (mode === 'pending') user.status = 'PENDING';
  const profile = { ...identity, authoritativeEmail: mode !== 'third-party-email' };
  await expect(findOrCreateUserByOAuth(profile)).rejects.toThrow();
  expect(db.oAuthAccount.create).not.toHaveBeenCalled();
  expect(createSession).not.toHaveBeenCalled();
});

it('supports the existing backend Google client ID variable without skipping audience verification', async () => {
  vi.stubEnv('GOOGLE_CLIENT_ID', '');
  vi.stubEnv('GOOGLE_OAUTH_CLIENT_ID', 'legacy-client-id');
  verifyIdToken.mockResolvedValue({ getPayload: () => ({
    sub: 'verified-sub', email: 'alice@gmail.com', email_verified: true,
  }) });
  await verifyGoogleIdentity('signed-token');
  expect(verifyIdToken).toHaveBeenCalledWith({
    idToken: 'signed-token', audience: 'legacy-client-id',
  });
});
