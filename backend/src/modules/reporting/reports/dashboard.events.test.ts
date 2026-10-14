import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), revision: vi.fn() }));
vi.mock('../../../api/middleware/auth.middleware', () => ({ authMiddleware: mocks.auth }));
vi.mock('../../../config/database.config', () => ({ default: { dashboardRevision: { findUnique: mocks.revision } } }));
vi.mock('./dashboard.service', () => ({ dashboardAccess: vi.fn() }));
vi.mock('../../../core/permissions/permission.service', () => ({ assertPermissions: vi.fn() }));
import { authorizationEvents } from './dashboard.events';
import { AppError } from '../../../shared/errors/app-error';

beforeEach(() => { vi.resetAllMocks(); vi.useFakeTimers(); mocks.revision.mockResolvedValue(null); });
afterEach(() => vi.useRealTimers());
it.each([
  [403, 'PASSWORD_CHANGE_REQUIRED', { code: 'PASSWORD_CHANGE_REQUIRED' }],
  [401, undefined, {}],
  [403, 'ROLE_RETIRED', {}],
] as const)('closes an existing authorization stream with the appropriate access-loss reason (%s, %s)', async (status, code, data) => {
  mocks.auth.mockImplementationOnce((_req, _res, next) => next())
    .mockImplementation((_req, _res, next) => next(new AppError('Access changed', status, code)));
  const res = Object.assign(new EventEmitter(), { setHeader: vi.fn(), flushHeaders: vi.fn(), write: vi.fn(), end: vi.fn() });
  res.end.mockImplementation(() => res.emit('close'));
  const req = { user: { userId: 'user', tenantId: 'tenant' }, baseUrl: '/api/v1/auth', path: '/events' };
  const next = vi.fn();
  await authorizationEvents(req as never, res as never, next);
  await vi.advanceTimersByTimeAsync(0);
  expect(res.end).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(3000);
  expect(res.write).toHaveBeenCalledWith(`event: authorization-access-changed\ndata: ${JSON.stringify(data)}\n\n`);
  expect(res.end).toHaveBeenCalledOnce();
  expect(next).not.toHaveBeenCalled();
});
