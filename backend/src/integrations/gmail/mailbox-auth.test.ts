import { beforeEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  db: {
    mailboxOAuthState: { findUnique: vi.fn(), deleteMany: vi.fn() },
    session: { findUnique: vi.fn() },
    emailAccount: { findUnique: vi.fn(), upsert: vi.fn() },
    auditLog: { findFirst: vi.fn() },
  },
  readUser: vi.fn(), permission: vi.fn(), exchange: vi.fn(), info: vi.fn(), profile: vi.fn(),
}));
vi.mock('../../config/database.config', () => ({ default: state.db }));
vi.mock('../../core/auth/auth-user', () => ({ readAuthUser: state.readUser }));
vi.mock('../../core/auth/session.service', () => ({ hashToken: (value: string) => value }));
vi.mock('../../core/permissions/permission.service', () => ({ assertPermissions: state.permission }));
vi.mock('../../core/encryption/crypto.service', () => ({ encryptToken: (value: string) => value, decryptToken: (value: string) => value }));
vi.mock('../../core/audit/audit.service', () => ({ writeAuditLog: vi.fn() }));
vi.mock('./gmail.oauth', () => ({ getAuthorizationUrl: vi.fn(), exchangeCodeForTokens: state.exchange, getUserInfo: state.info, getMailboxProfile: state.profile }));
vi.mock('../../modules/crm/leads/lead-automation.service', () => ({ salesTransaction: (work: (tx: typeof state.db) => Promise<unknown>) => work(state.db) }));

import { finishMailboxConnection } from './mailbox-auth.service';
import { AppError } from '../../shared/errors/app-error';

const user = () => ({ id: 'u', tenantId: 't', email: 'staff@camxian.com', role: 'Sales', status: 'ACTIVE',
  tenantStatus: 'ACTIVE', mustChangePassword: false, onboardingCompletedAt: '2026-01-01' });
beforeEach(() => {
  vi.resetAllMocks();
  state.db.mailboxOAuthState.findUnique.mockResolvedValue({ userId: 'u', tenantId: 't', sessionHash: 'session', verifier: 'verifier', expiresAt: new Date(Date.now() + 60000) });
  state.db.mailboxOAuthState.deleteMany.mockResolvedValue({ count: 1 });
  state.db.session.findUnique.mockResolvedValue({ userId: 'u', tenantId: 't', revokedAt: null, expiresAt: new Date(Date.now() + 60000) });
  state.readUser.mockResolvedValue(user());
  state.db.emailAccount.findUnique.mockResolvedValue(null);
  state.exchange.mockResolvedValue({ access_token: 'access', refresh_token: 'refresh', expires_in: 3600, scope: 'https://www.googleapis.com/auth/gmail.modify' });
  state.info.mockResolvedValue({ email: 'staff@camxian.com', verified_email: true });
  state.profile.mockResolvedValue({ emailAddress: 'staff@camxian.com' });
  state.db.auditLog.findFirst.mockResolvedValue(null);
});
it('connects approved new Gmail staff without a production address allowlist', async () => {
  state.readUser.mockResolvedValue({ ...user(), email: 'new@gmail.com' });
  state.db.auditLog.findFirst.mockResolvedValue({ id: 'approved' });
  state.info.mockResolvedValue({ email: 'new@gmail.com', verified_email: true });
  state.profile.mockResolvedValue({ emailAddress: 'new@gmail.com' });
  await finishMailboxConnection('state', 'code');
  expect(state.db.emailAccount.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ email: 'new@gmail.com' }) }));
});
it.each(['unverified', 'different-google', 'different-gmail', 'partial-grant', 'no-offline-access'])('rejects %s before saving credentials', async reason => {
  if (reason === 'unverified') state.info.mockResolvedValue({ email: 'staff@camxian.com', verified_email: false });
  if (reason === 'different-google') { state.info.mockResolvedValue({ email: 'other@gmail.com', verified_email: true }); state.profile.mockResolvedValue({ emailAddress: 'other@gmail.com' }); }
  if (reason === 'different-gmail') state.profile.mockResolvedValue({ emailAddress: 'other@gmail.com' });
  if (reason === 'partial-grant') state.exchange.mockResolvedValue({ access_token: 'access', scope: 'https://www.googleapis.com/auth/gmail.readonly' });
  if (reason === 'no-offline-access') state.exchange.mockResolvedValue({ access_token: 'access', expires_in: 3600, scope: 'https://www.googleapis.com/auth/gmail.modify' });
  await expect(finishMailboxConnection('state', 'code')).rejects.toHaveProperty('statusCode', 400);
  expect(state.db.emailAccount.upsert).not.toHaveBeenCalled();
});
it('rechecks deactivation inside the credential transaction', async () => {
  state.readUser.mockResolvedValueOnce(user()).mockResolvedValueOnce(user()).mockResolvedValueOnce(user())
    .mockResolvedValue({ ...user(), status: 'INACTIVE' });
  await expect(finishMailboxConnection('state', 'code')).rejects.toHaveProperty('statusCode', 403);
  expect(state.db.emailAccount.upsert).not.toHaveBeenCalled();
});
it('preserves an existing active refresh token when Google does not return a replacement', async () => {
  state.db.emailAccount.findUnique.mockResolvedValue({ email: 'staff@camxian.com', isActive: true, refreshToken: 'existing-encrypted-refresh' });
  state.exchange.mockResolvedValue({ access_token: 'access', expires_in: 3600, scope: 'https://www.googleapis.com/auth/gmail.modify' });
  await finishMailboxConnection('state', 'code');
  expect(state.db.emailAccount.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: expect.objectContaining({ refreshToken: 'existing-encrypted-refresh' }) }));
});

it('does not restore a mailbox disconnected while Google confirms its identity', async () => {
  const active = { id: 'account', email: 'staff@camxian.com', isActive: true, refreshToken: 'encrypted-refresh' };
  state.db.emailAccount.findUnique.mockResolvedValue(active);
  state.profile.mockImplementation(async () => {
    state.db.emailAccount.findUnique.mockResolvedValue({ ...active, isActive: false, refreshToken: null });
    return { emailAddress: 'staff@camxian.com' };
  });
  await expect(finishMailboxConnection('state', 'code')).rejects.toHaveProperty('statusCode', 409);
  expect(state.db.emailAccount.upsert).not.toHaveBeenCalled();
});

it.each(['leads.view', 'contacts.view'])('completes OAuth for a staff member with only %s', async permission => {
  state.permission.mockImplementation(async (_actor, required) => {
    if (!required.includes(permission)) throw new AppError('Access denied', 403);
  });
  await finishMailboxConnection('state', 'code');
  expect(state.exchange).toHaveBeenCalledWith('code', 'verifier');
  expect(state.db.emailAccount.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ tenantId: 't', userId: 'u', email: 'staff@camxian.com' }) }));
});

it('denies a staff member with no CRM visibility before exchanging provider tokens', async () => {
  state.permission.mockRejectedValue(new AppError('Access denied', 403));
  await expect(finishMailboxConnection('state', 'code')).rejects.toMatchObject({ statusCode: 403 });
  expect(state.exchange).not.toHaveBeenCalled();
});

it.each(['SUSPENDED', 'CANCELLED', 'DELETED', 'REJECTED', null, undefined])('denies unavailable workspace %s before contacting Google', async tenantStatus => {
  state.readUser.mockResolvedValue({ ...user(), tenantStatus });
  await expect(finishMailboxConnection('state', 'code')).rejects.toMatchObject({ statusCode: 403 });
  expect(state.permission).not.toHaveBeenCalled();
  expect(state.exchange).not.toHaveBeenCalled();
  expect(state.db.emailAccount.upsert).not.toHaveBeenCalled();
});

it('propagates permission database failures without attempting a second permission', async () => {
  const failure = new Error('database unavailable');
  state.permission.mockRejectedValue(failure);
  await expect(finishMailboxConnection('state', 'code')).rejects.toBe(failure);
  expect(state.permission).toHaveBeenCalledOnce();
  expect(state.exchange).not.toHaveBeenCalled();
});

it('retains session revocation and one-time OAuth state guards', async () => {
  state.db.session.findUnique.mockResolvedValue({ userId: 'u', tenantId: 't', revokedAt: new Date(), expiresAt: new Date(Date.now() + 60000) });
  await expect(finishMailboxConnection('state', 'code')).rejects.toMatchObject({ statusCode: 401 });
  state.db.mailboxOAuthState.deleteMany.mockResolvedValue({ count: 0 });
  await expect(finishMailboxConnection('state', 'code')).rejects.toMatchObject({ statusCode: 400 });
  expect(state.exchange).not.toHaveBeenCalled();
});
