import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), revision: vi.fn(), stages: vi.fn(), unsubscribe: vi.fn() }));
vi.mock('../../../api/middleware/auth.middleware', () => ({ authMiddleware: mocks.auth }));
vi.mock('../../../config/database.config', () => ({ default: { dashboardRevision: { findUnique: mocks.revision }, stage: { findMany: mocks.stages } } }));
vi.mock('../../crm/record-change-events', () => ({ subscribeRecordChanges: () => mocks.unsubscribe }));
vi.mock('./dashboard.service', () => ({ dashboardAccess: vi.fn() }));
vi.mock('../../../core/permissions/permission.service', () => ({ assertPermissions: vi.fn() }));
import { authorizationEvents, dashboardEvents, pipelineEvents, recordEvents } from './dashboard.events';
import { AppError } from '../../../shared/errors/app-error';

beforeEach(() => { vi.resetAllMocks(); vi.useFakeTimers(); mocks.revision.mockResolvedValue(null); mocks.stages.mockResolvedValue([]); });
afterEach(() => vi.useRealTimers());
it.each([
  [403, 'PASSWORD_CHANGE_REQUIRED', { code: 'PASSWORD_CHANGE_REQUIRED' }],
  [401, 'SESSION_IDLE_EXPIRED', { code: 'SESSION_IDLE_EXPIRED' }],
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

it.each([authorizationEvents, dashboardEvents, pipelineEvents, recordEvents])('does not write or run queued work after a disconnect during a revision read (%s)', async handler => {
  mocks.auth.mockImplementation((_req, _res, next) => next());
  let resolve!: (value: null) => void;
  mocks.revision.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  const res = Object.assign(new EventEmitter(), { setHeader: vi.fn(), flushHeaders: vi.fn(), write: vi.fn(), end: vi.fn() });
  await handler({ user: { tenantId: 'tenant', userId: 'user' }, authUser: { role: 'Agent', mustChangePassword: false } } as never, res as never, vi.fn());
  await vi.advanceTimersByTimeAsync(3000); // Queue a tick behind the outstanding read.
  expect(mocks.revision).toHaveBeenCalledOnce();
  res.emit('close'); res.write.mockClear();
  resolve(null); await vi.advanceTimersByTimeAsync(60000);
  expect(res.write).not.toHaveBeenCalled(); expect(res.end).not.toHaveBeenCalled();
  expect(mocks.revision).toHaveBeenCalledOnce();
  if (handler === recordEvents) expect(mocks.unsubscribe).toHaveBeenCalledOnce();
});
it('stops work immediately on intentional expiry even before close is emitted', async () => {
  mocks.auth.mockImplementation((_req, _res, next) => next());
  const res = Object.assign(new EventEmitter(), { setHeader: vi.fn(), flushHeaders: vi.fn(), write: vi.fn(), end: vi.fn() });
  await authorizationEvents({ user: { tenantId: 'tenant', userId: 'user' } } as never, res as never, vi.fn());
  await vi.advanceTimersByTimeAsync(45000);
  expect(res.end).toHaveBeenCalledOnce();
  const calls = mocks.revision.mock.calls.length; res.write.mockClear();
  await vi.advanceTimersByTimeAsync(60000);
  expect(mocks.revision).toHaveBeenCalledTimes(calls); expect(res.write).not.toHaveBeenCalled();
});
