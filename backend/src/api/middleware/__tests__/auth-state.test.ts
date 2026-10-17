import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('../../../core/auth/auth-user', async importOriginal => ({
  ...await importOriginal<typeof import('../../../core/auth/auth-user')>(), readAuthUser: vi.fn(),
}));
vi.mock('../../../core/auth/session.service', () => ({ validateSession: vi.fn() }));
vi.mock('../../../config/app.config', () => ({ appConfig: { jwtSecret: 'test-only-secret' } }));
import jwt from 'jsonwebtoken';
import { authMiddleware } from '../auth.middleware';
import { readAuthUser } from '../../../core/auth/auth-user';
import { validateSession } from '../../../core/auth/session.service';
import { appConfig } from '../../../config/app.config';
import { buildAuthUserResponse } from '../../../core/auth/auth-user';
import { workspaceReadyMiddleware } from '../tenant.middleware';

const claims = { userId: 'user-1', tenantId: 'tenant-1', role: 'Client Admin' };
it('rejects an existing session after its current database role is retired', async () => {
  vi.mocked(readAuthUser).mockResolvedValue({ role: 'Guest', email: 'staff@camxian.com', status: 'ACTIVE' } as never);
  const next = vi.fn();
  await authMiddleware(request() as never, {} as never, next);
  expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'ROLE_RETIRED' }));
});
const request = () => ({
  cookies: { leadcrm_token: jwt.sign(claims, appConfig.jwtSecret) }, headers: {},
});
afterEach(() => vi.useRealTimers());
const expiringUser = () => ({
  id: 'user-1', tenantId: 'tenant-1', firstName: 'Staff', lastName: 'User', role: 'Sales',
  email: 'staff@camxian.com', status: 'ACTIVE', tenant: { status: 'ACTIVE' },
  mustChangePassword: false, passwordHash: 'hash', passwordChangedAt: new Date('2030-01-01'),
  onboardingCompletedAt: new Date('2029-12-01'),
});

it.each(['cookie', 'bearer'])('restricts the same %s session on its next protected request at exactly 90 days', async transport => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2030-03-31T23:59:59.999Z'));
  const source = expiringUser();
  vi.mocked(readAuthUser).mockImplementation(async () => buildAuthUserResponse(source));
  const req = { ...request(), baseUrl: '/api/v1/crm', path: '/leads' };
  if (transport === 'bearer') Object.assign(req, { headers: { authorization: `Bearer ${req.cookies.leadcrm_token}` }, cookies: {} });
  const next = vi.fn();
  await authMiddleware(req as never, {} as never, next);
  expect(next).toHaveBeenLastCalledWith();
  vi.setSystemTime(new Date('2030-04-01T00:00:00.000Z'));
  await authMiddleware(req as never, {} as never, next);
  expect(next).toHaveBeenLastCalledWith(expect.objectContaining({ statusCode: 403, code: 'PASSWORD_CHANGE_REQUIRED' }));
  expect(source.mustChangePassword).toBe(false);
});
it.each(['/me', '/change-password', '/logout', '/activity'])('permits expired-password recovery at %s', async path => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2030-04-01'));
  vi.mocked(readAuthUser).mockResolvedValue(buildAuthUserResponse(expiringUser()));
  const next = vi.fn();
  await authMiddleware({ ...request(), baseUrl: '/api/v1/auth', path } as never, {} as never, next);
  expect(next).toHaveBeenCalledWith();
});
it('workspace readiness uses the same effective expiration flag', () => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2030-04-01'));
  const next = vi.fn();
  workspaceReadyMiddleware({ authUser: buildAuthUserResponse(expiringUser()) } as never, {} as never, next);
  expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403, code: 'PASSWORD_CHANGE_REQUIRED' }));
});
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('LEADCRM_PRODUCTION_AUTH_ENABLED', 'false');
  vi.mocked(validateSession).mockResolvedValue(claims);
  vi.mocked(readAuthUser).mockResolvedValue({
    id: 'user-1', tenantId: 'tenant-1', role: 'Sales', status: 'ACTIVE',
    email: 'owner@camxian.com', tenantStatus: 'ACTIVE', onboardingCompletedAt: '2026-01-01',
  } as never);
});
it('uses the current database role instead of a stale Client Admin JWT role', async () => {
  const req = request();
  const next = vi.fn();
  await authMiddleware(req as never, {} as never, next);
  expect(req).toHaveProperty('user.role', 'Sales');
  expect(req).toHaveProperty('authUser.id', 'user-1');
  expect(next).toHaveBeenCalledWith();
});
it('does not disguise database failures as unauthenticated sessions', async () => {
  const error = new Error('database unavailable');
  vi.mocked(readAuthUser).mockRejectedValue(error);
  const next = vi.fn();
  await authMiddleware(request() as never, {} as never, next);
  expect(next).toHaveBeenCalledWith(error);
});
it('rejects a session whose tenant differs from its signed identity', async () => {
  vi.mocked(validateSession).mockResolvedValue({ ...claims, tenantId: 'another-tenant' });
  const next = vi.fn();
  await authMiddleware(request() as never, {} as never, next);
  expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  expect(readAuthUser).not.toHaveBeenCalled();
});
it('rejects forged tokens before session lookup', async () => {
  const next = vi.fn();
  await authMiddleware({ cookies: { leadcrm_token: 'forged' }, headers: {} } as never, {} as never, next);
  expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  expect(validateSession).not.toHaveBeenCalled();
});

it.each(['/api/v1/crm', '/api/v1/administration', '/api/v1/preferences', '/api/v1/billing'])('blocks temporary-password sessions at %s', async baseUrl => {
  vi.mocked(readAuthUser).mockResolvedValue({ id: 'user-1', tenantId: 'tenant-1', role: 'Client Admin', status: 'ACTIVE', tenantStatus: 'ACTIVE', email: 'employee@camxian.com', mustChangePassword: true } as never);
  const next = vi.fn();
  await authMiddleware({ ...request(), baseUrl, path: '/anything' } as never, {} as never, next);
  expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'PASSWORD_CHANGE_REQUIRED' }));
});
it.each(['/me', '/change-password', '/activity'])('permits only required recovery actions: %s', async path => {
  vi.mocked(readAuthUser).mockResolvedValue({ id: 'user-1', tenantId: 'tenant-1', role: 'Client Admin', status: 'ACTIVE', tenantStatus: 'ACTIVE', email: 'employee@camxian.com', mustChangePassword: true } as never);
  const next = vi.fn();
  await authMiddleware({ ...request(), baseUrl: '/api/v1/auth', path } as never, {} as never, next);
  expect(next).toHaveBeenCalledWith();
});
it('does not allow the onboarding endpoint to bypass a temporary password', async () => {
  vi.mocked(readAuthUser).mockResolvedValue({ id: 'user-1', tenantId: 'tenant-1', role: 'Client Admin', status: 'ACTIVE', tenantStatus: 'ACTIVE', email: 'employee@camxian.com', mustChangePassword: true } as never);
  const next = vi.fn();
  await authMiddleware({ ...request(), baseUrl: '/api/v1/auth', path: '/onboarding/complete' } as never, {} as never, next);
  expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'PASSWORD_CHANGE_REQUIRED' }));
});
it('blocks CRM access until persisted onboarding is complete', async () => {
  vi.mocked(readAuthUser).mockResolvedValue({ role: 'Client Admin', status: 'ACTIVE', tenantStatus: 'ACTIVE', email: 'employee@camxian.com', mustChangePassword: false, onboardingCompletedAt: null } as never);
  const next = vi.fn();
  await authMiddleware({ ...request(), baseUrl: '/api/v1/crm', path: '/leads' } as never, {} as never, next);
  expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'ONBOARDING_REQUIRED' }));
});
it('rejects an external employee account even with an existing signed session', async () => {
  vi.mocked(readAuthUser).mockResolvedValue({ role: 'Client Admin', status: 'ACTIVE', tenantStatus: 'ACTIVE', email: 'employee@example.com' } as never);
  const next = vi.fn();
  await authMiddleware(request() as never, {} as never, next);
  expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'EMPLOYEE_ACCOUNT_REQUIRED' }));
});

it.each(['tironjulieann10@gmail.com', 'reymarkjpanes@gmail.com'])('allows %s through a normally validated development session', async email => {
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('LEADCRM_TEST_AUTH_ENABLED', 'true');
  vi.stubEnv('LEADCRM_TEST_EMAIL_ALLOWLIST', 'tironjulieann10@gmail.com,reymarkjpanes@gmail.com');
  vi.mocked(readAuthUser).mockResolvedValue({ id: 'user-1', tenantId: 'tenant-1', role: 'Sales', status: 'ACTIVE', tenantStatus: 'ACTIVE', email, onboardingCompletedAt: '2026-01-01' } as never);
  const next = vi.fn();
  const req = request();

  await authMiddleware(req as never, {} as never, next);

  expect(validateSession).toHaveBeenCalledOnce();
  expect(req).toHaveProperty('user.email', email);
  expect(next).toHaveBeenCalledWith();
});


it('returns Authentication required for a genuinely signed-out request', async () => {
  const next = vi.fn();
  await authMiddleware({ cookies: {}, headers: {} } as never, {} as never, next);
  expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401, message: 'Authentication required' }));
  expect(validateSession).not.toHaveBeenCalled();
});

it.each(['SUSPENDED', 'CANCELLED', 'DELETED', 'REJECTED', 'unknown', null, undefined])('blocks an existing session in an unavailable workspace (%s)', async tenantStatus => {
  vi.mocked(readAuthUser).mockResolvedValue({
    id: 'user-1', tenantId: 'tenant-1', role: 'Sales', status: 'ACTIVE', tenantStatus,
    email: 'owner@camxian.com', onboardingCompletedAt: '2026-01-01',
  } as never);
  const next = vi.fn();
  const req = request();
  await authMiddleware(req as never, {} as never, next);
  expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403, message: 'Workspace access is unavailable.' }));
  expect(req).not.toHaveProperty('user');
});

it.each(['ACTIVE', 'SANDBOX'])('allows eligible sessions in %s workspaces', async tenantStatus => {
  vi.mocked(readAuthUser).mockResolvedValue({ id: 'user-1', tenantId: 'tenant-1', role: 'Sales', status: 'ACTIVE', tenantStatus,
    email: 'owner@camxian.com', onboardingCompletedAt: '2026-01-01' } as never);
  const next = vi.fn();
  await authMiddleware(request() as never, {} as never, next);
  expect(next).toHaveBeenCalledWith();
});
