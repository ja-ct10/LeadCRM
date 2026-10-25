import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ session: null as any, findUnique: vi.fn(), updateMany: vi.fn() }));
vi.mock('../../../config/database.config', () => ({ default: { session: { findUnique: state.findUnique, updateMany: state.updateMany } } }));
import { validateSession, revokeSession } from '../session.service';
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2030-01-01T12:00:00Z'));
  state.session = { id: 'session-current', userId: 'u', tenantId: 't', lastActiveAt: new Date(), expiresAt: new Date(Date.now() + 86400000), revokedAt: null };
  state.findUnique.mockImplementation(async () => ({ ...state.session }));
  state.updateMany.mockImplementation(async ({ data }) => { Object.assign(state.session, data); return { count: 1 }; });
});
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });
it('records real activity before 30 minutes and preserves absolute expiry', async () => {
  const expiry = state.session.expiresAt;
  vi.advanceTimersByTime(29 * 60000);
  await validateSession('secret', new Date());
  vi.advanceTimersByTime(29 * 60000);
  await expect(validateSession('secret')).resolves.toMatchObject({ userId: 'u', expiresAt: expiry });
});
it('does not renew activity for passive validation and revokes at exactly 30 minutes', async () => {
  vi.advanceTimersByTime(29 * 60000); await validateSession('secret'); expect(state.updateMany).not.toHaveBeenCalled();
  vi.advanceTimersByTime(60000);
  await expect(validateSession('secret', new Date())).rejects.toMatchObject({ statusCode: 401, code: 'SESSION_IDLE_EXPIRED' });
  await expect(validateSession('secret')).rejects.toMatchObject({ code: 'SESSION_IDLE_EXPIRED' });
});
it('rejects absolute expiration even with activity', async () => {
  state.session.expiresAt = new Date();
  await expect(validateSession('secret', new Date())).rejects.toMatchObject({ statusCode: 401 });
  expect(state.updateMany).not.toHaveBeenCalled();
});
it('manual logout remains revoked', async () => {
  await revokeSession('secret'); await expect(validateSession('secret')).rejects.toMatchObject({ statusCode: 401 });
});

it('rechecks validation when logout wins a concurrent activity update', async () => {
  vi.advanceTimersByTime(60000);
  state.updateMany.mockImplementationOnce(async () => { state.session.revokedAt = new Date(); return { count: 0 }; });
  await expect(validateSession('secret', new Date(), true)).rejects.toMatchObject({ statusCode: 401 });
  expect(state.findUnique).toHaveBeenCalledTimes(2);
});

it('does not renew or revoke a replacement session from a stale tab', async () => {
  await expect(validateSession('secret', new Date(), true, 'session-old')).rejects.toMatchObject({ statusCode: 409, code: 'SESSION_CHANGED' });
  await expect(revokeSession('secret', 'session-old')).rejects.toMatchObject({ statusCode: 409, code: 'SESSION_CHANGED' });
  expect(state.updateMany).not.toHaveBeenCalled();
});

it('clamps future activity to server time and never moves activity backwards', async () => {
  await validateSession('secret', new Date(Date.now() + 86400000), true);
  expect(state.updateMany).not.toHaveBeenCalled();
  vi.advanceTimersByTime(60000);
  await validateSession('secret', new Date(Date.now() + 86400000), true);
  expect(+state.session.lastActiveAt).toBe(Date.now());
  state.updateMany.mockClear();
  await validateSession('secret', new Date(Date.now() - 1000), true);
  expect(state.updateMany).not.toHaveBeenCalled();
});
