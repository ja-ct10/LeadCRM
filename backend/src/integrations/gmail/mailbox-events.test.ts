import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ mailbox: vi.fn(), session: vi.fn() }));
vi.mock('./mailbox-store', () => ({ authorizedMailbox: mocks.mailbox }));
vi.mock('../../core/auth/session.service', () => ({ validateSession: mocks.session }));
import { mailboxEvents } from './mailbox-events';

const responses: EventEmitter[] = [];
const response = () => {
  const res = Object.assign(new EventEmitter(), { setHeader: vi.fn(), flushHeaders: vi.fn(), write: vi.fn(), end: vi.fn(), writableEnded: false });
  res.end.mockImplementation(() => { res.writableEnded = true; res.emit('finish'); }); responses.push(res); return res;
};
const request = { user: { tenantId: 'tenant', userId: 'user' }, cookies: { leadcrm_token: 'synthetic-token' } };
beforeEach(() => {
  vi.useFakeTimers(); vi.resetAllMocks();
  mocks.mailbox.mockResolvedValue({ account: { id: 'mailbox', mailboxVersion: 1 }, scope: { hash: 'scope' } });
  mocks.session.mockResolvedValue({ tenantId: 'tenant', userId: 'user' });
});
afterEach(() => { responses.splice(0).forEach(res => res.emit('close')); vi.useRealTimers(); });
it('does not write an access-loss event after disconnect during session validation', async () => {
  let reject!: (error: Error) => void;
  mocks.session.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }));
  const res = response(); await mailboxEvents(request as never, res as never, vi.fn());
  await vi.advanceTimersByTimeAsync(5000); res.emit('close'); res.write.mockClear();
  reject(new Error('Revoked')); await vi.advanceTimersByTimeAsync(60000);
  expect(res.write).not.toHaveBeenCalled(); expect(res.end).not.toHaveBeenCalled();
  expect(mocks.mailbox).toHaveBeenCalledOnce();
});
it('stops an observer awaiting mailbox scope when its last client disconnects', async () => {
  let finish!: (value: unknown) => void;
  const res = response(); await mailboxEvents(request as never, res as never, vi.fn());
  mocks.mailbox.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await vi.advanceTimersByTimeAsync(5000); res.emit('close'); res.write.mockClear();
  finish({ account: { id: 'mailbox', mailboxVersion: 2 }, scope: { hash: 'changed' } });
  await vi.advanceTimersByTimeAsync(60000);
  expect(res.write).not.toHaveBeenCalled(); expect(res.end).not.toHaveBeenCalled();
});
it('shares a timer while revalidating each session, and stops after intentional expiry', async () => {
  const first = response(), second = response();
  await mailboxEvents(request as never, first as never, vi.fn());
  await mailboxEvents({ ...request, cookies: { leadcrm_token: 'second-token' } } as never, second as never, vi.fn());
  await vi.advanceTimersByTimeAsync(5000);
  expect(mocks.session).toHaveBeenCalledTimes(2);
  expect(first.write).toHaveBeenLastCalledWith(': heartbeat\n\n');
  expect(second.write).toHaveBeenLastCalledWith(': heartbeat\n\n');
  await vi.advanceTimersByTimeAsync(40000);
  expect(first.end).toHaveBeenCalledOnce(); expect(second.end).toHaveBeenCalledOnce();
  const calls = mocks.session.mock.calls.length;
  await vi.advanceTimersByTimeAsync(60000); expect(mocks.session).toHaveBeenCalledTimes(calls);
});
