import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ account: { findUnique: vi.fn(), updateMany: vi.fn(), update: vi.fn() }, oauthStates: { deleteMany: vi.fn() }, refresh: vi.fn() }));
vi.mock('../../config/database.config', () => ({ default: { emailAccount: state.account, mailboxOAuthState: state.oauthStates } }));
vi.mock('../../core/auth/auth-user', () => ({ readAuthUser: vi.fn().mockResolvedValue({ email: 'staff@camxian.com' }) }));
vi.mock('./gmail.oauth', () => ({ refreshAccessToken: state.refresh, getUserInfo: vi.fn() }));
import { encryptToken, decryptToken } from '../../core/encryption/crypto.service';
import { AppError } from '../../shared/errors/app-error';
import { disconnectAccount, getConnectionStatus, getValidAccessToken } from './gmail.service';
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('ENCRYPTION_KEY', 'b'.repeat(64)); state.account.updateMany.mockResolvedValue({ count: 1 }); });
afterEach(() => vi.unstubAllEnvs());
const account = (expiresAt: Date) => ({ id: 'account', email: 'staff@camxian.com', isActive: true,
  accessToken: encryptToken('access'), refreshToken: encryptToken('refresh'), tokenExpiresAt: expiresAt });

it.each([null, { isActive: false, syncError: null }])('preserves the empty connection-status contract without a reconnect reason', async stored => {
  state.account.findUnique.mockResolvedValue(stored);
  expect(await getConnectionStatus('tenant', 'staff')).toEqual({ isConnected: false, email: null, connectedAt: null, lastSyncAt: null });
});

it('uses a valid encrypted access token without refreshing or requesting consent', async () => {
  state.account.findUnique.mockResolvedValue(account(new Date(Date.now() + 3600000)));
  expect(await getValidAccessToken('tenant', 'staff')).toBe('access');
  expect(state.refresh).not.toHaveBeenCalled();
});
it('refreshes and encrypts the replacement access token without discarding an omitted refresh token', async () => {
  state.account.findUnique.mockResolvedValue(account(new Date(0)));
  state.refresh.mockResolvedValue({ access_token: 'new-access', expires_in: 3600 });
  expect(await getValidAccessToken('tenant', 'staff')).toBe('new-access');
  const write = state.account.updateMany.mock.calls[0][0];
  expect(decryptToken(write.data.accessToken)).toBe('new-access');
  expect(write.data.accessToken).not.toContain('new-access');
  expect(write.data).not.toHaveProperty('refreshToken');
});
it('retires revoked credentials while preserving mailbox history', async () => {
  state.account.findUnique.mockResolvedValue(account(new Date(0)));
  state.refresh.mockRejectedValue(new AppError('Reconnect your registered email.', 409, 'GMAIL_RECONNECT_REQUIRED'));
  await expect(getValidAccessToken('tenant', 'staff')).rejects.toHaveProperty('code', 'GMAIL_RECONNECT_REQUIRED');
  expect(state.account.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ isActive: false, accessToken: '', refreshToken: null }) }));
  state.account.findUnique.mockResolvedValue({ isActive: false, syncError: 'Reconnect your registered email.' });
  expect(await getConnectionStatus('tenant', 'staff')).toMatchObject({ isConnected: false, syncError: 'Reconnect your registered email.' });
});
it('does not erase credentials on a transient provider failure or restore a disconnected account', async () => {
  state.account.findUnique.mockResolvedValue(account(new Date(0)));
  state.refresh.mockRejectedValueOnce(new AppError('Try again later.', 502, 'GMAIL_REFRESH_UNAVAILABLE'));
  await expect(getValidAccessToken('tenant', 'staff')).rejects.toHaveProperty('code', 'GMAIL_REFRESH_UNAVAILABLE');
  expect(state.account.updateMany).not.toHaveBeenCalled();
  state.refresh.mockResolvedValue({ access_token: 'new-access', expires_in: 3600 });
  state.account.updateMany.mockResolvedValue({ count: 0 });
  await expect(getValidAccessToken('tenant', 'staff')).rejects.toHaveProperty('statusCode', 409);
});
it('disconnects credentials and pending OAuth requests without deleting history', async () => {
  await disconnectAccount('tenant', 'staff');
  expect(state.oauthStates.deleteMany).toHaveBeenCalledWith({ where: { tenantId: 'tenant', userId: 'staff' } });
  expect(state.account.update).toHaveBeenCalledWith({
    where: { tenantId_userId_provider: { tenantId: 'tenant', userId: 'staff', provider: 'gmail' } },
    data: { isActive: false, accessToken: '', refreshToken: null, syncLeaseId: null, syncLeaseUntil: null, syncError: null, mailboxVersion: { increment: 1 } },
  });
});
