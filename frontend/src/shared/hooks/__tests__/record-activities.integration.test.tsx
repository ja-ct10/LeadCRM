import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { clearPageCache } from '@/shared/cache/page-cache';
import { useRecordActivities, type ActivityModule, type TimelineActivity } from '../use-record-activities';

const mocks = vi.hoisted(() => ({
  auth: { tenant: { id: 'tenant-a' }, user: { id: 'user-a', role: 'Sales', tenantId: 'tenant-a' }, isLoading: false, authError: null as string | null },
  permission: true, mockMode: false, getAll: vi.fn(), status: vi.fn(),
}));
vi.mock('@/store/AuthContext', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/store/DataContext', () => ({ useData: () => ({ activities: [], users: [] }) }));
vi.mock('@/lib/config', () => ({ get USE_MOCK_DATA() { return mocks.mockMode; } }));
vi.mock('../use-permissions', () => ({ useHasPermission: () => mocks.permission }));
vi.mock('@/features/tenant/crm/activities/services/activities.service', () => ({ activitiesService: { getAll: mocks.getAll } }));
vi.mock('@/features/tenant/inbox/services/gmail.service', () => ({ getGmailStatus: mocks.status }));

const streams: FakeSource[] = [];
class FakeSource extends EventTarget {
  close = vi.fn();
  constructor() { super(); streams.push(this); }
}
const note: TimelineActivity = { id: 'note', type: 'note', title: 'Saved note', createdAt: '2026-10-01T00:00:00Z' };
const email = (direction: 'Sent' | 'Received'): TimelineActivity => ({ id: direction, type: 'email', title: direction + ' email', createdAt: '2026-10-02T00:00:00Z' });
const response = (data: TimelineActivity[]) => ({ data, total: data.length, nextCursor: null });
const changed = () => act(() => streams.at(-1)!.dispatchEvent(new Event('mailbox-change')));
function deferred<T>() { let resolve!: (value: T) => void, reject!: (error: Error) => void; const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject }; }

beforeEach(() => {
  clearPageCache(); streams.length = 0; vi.clearAllMocks();
  mocks.auth = { tenant: { id: 'tenant-a' }, user: { id: 'user-a', role: 'Sales', tenantId: 'tenant-a' }, isLoading: false, authError: null };
  mocks.permission = true; mocks.mockMode = false;
  vi.stubGlobal('EventSource', FakeSource);
  mocks.getAll.mockResolvedValue(response([note]));
  mocks.status.mockResolvedValue({ isConnected: true });
});
afterEach(() => { cleanup(); clearPageCache(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it.each(['leads', 'contacts', 'deals'] as const)('updates mounted %s rows and totals on sent/received mailbox events without remounting', async module => {
  let server = [note];
  mocks.getAll.mockImplementation(async ({ type }: { type?: string }) => response(server.filter(row => !type || row.type === type)));
  const all = renderHook(() => useRecordActivities(module, 'record'));
  const emails = renderHook(() => useRecordActivities(module, 'record', true, undefined, { type: 'email' }));
  await waitFor(() => expect(all.result.current.total).toBe(1));
  await waitFor(() => expect(emails.result.current.total).toBe(0));
  expect(streams).toHaveLength(1);
  for (const direction of ['Sent', 'Received'] as const) {
    server = [...server, email(direction)]; changed();
    await waitFor(() => expect(all.result.current.total).toBe(server.length));
    await waitFor(() => expect(emails.result.current.activities.map(row => row.id)).toContain(direction));
    expect(emails.result.current.total).toBe(server.length - 1);
  }
  changed(); changed(); changed();
  await waitFor(() => expect(all.result.current.isRefreshing).toBe(false));
  expect(new Set(all.result.current.activities.map(row => row.id)).size).toBe(3);
  expect(emails.result.current.activities).toHaveLength(2);
});

it('shares reads and transport, then removes the last listener on unmount', async () => {
  const first = renderHook(() => useRecordActivities('leads', 'record'));
  const second = renderHook(() => useRecordActivities('leads', 'record'));
  await waitFor(() => expect(second.result.current.total).toBe(1));
  expect(mocks.getAll).toHaveBeenCalledOnce(); expect(mocks.status).toHaveBeenCalledOnce(); expect(streams).toHaveLength(1);
  first.unmount(); expect(streams[0].close).not.toHaveBeenCalled();
  mocks.getAll.mockResolvedValue(response([note, email('Sent')])); changed();
  await waitFor(() => expect(second.result.current.total).toBe(2));
  second.unmount(); expect(streams[0].close).toHaveBeenCalledOnce();
  const calls = mocks.getAll.mock.calls.length; changed();
  await new Promise(resolve => setTimeout(resolve, 10)); expect(mocks.getAll).toHaveBeenCalledTimes(calls);
});

it('refreshes mailbox errors through the same cache without hiding permitted notes', async () => {
  const hook = renderHook(() => useRecordActivities('leads', 'record'));
  await waitFor(() => expect(hook.result.current.total).toBe(1));
  mocks.status.mockResolvedValue({ isConnected: false, syncError: 'Mailbox ownership does not match, or temporary test access expired.' });
  changed();
  await waitFor(() => expect(hook.result.current.error).toContain('Mailbox ownership'));
  expect(hook.result.current.activities).toEqual([note]);
  mocks.status.mockResolvedValue({ isConnected: true, syncError: 'Email updates paused after repeated failures.' });
  await act(async () => { await hook.result.current.refetch(); });
  await waitFor(() => expect(hook.result.current.error).toContain('paused'));
  mocks.status.mockResolvedValue({ isConnected: true, syncError: null });
  changed();
  await waitFor(() => expect(hook.result.current.error).toBeFalsy());
});

it('does not open or retry an event stream for a disconnected mailbox and resumes after an explicit refresh', async () => {
  mocks.status.mockResolvedValue({ isConnected: false });
  const hook = renderHook(() => useRecordActivities('contacts', 'record'));
  await waitFor(() => expect(hook.result.current.error).toBe('Connect your work Gmail account first.'));
  expect(streams).toHaveLength(0);
  mocks.status.mockResolvedValue({ isConnected: true });
  await act(async () => { await hook.result.current.refetch(); });
  await waitFor(() => expect(streams).toHaveLength(1));
  mocks.status.mockResolvedValue({ isConnected: false });
  act(() => streams[0].dispatchEvent(new Event('error')));
  await waitFor(() => expect(streams[0].close).toHaveBeenCalledOnce());
  await waitFor(() => expect(hook.result.current.error).toBe('Connect your work Gmail account first.'));
  expect(hook.result.current.activities).toEqual([note]);
});

it('does not query Gmail status for Notes readers or expose the previous identity status', async () => {
  const noteReader = renderHook(() => useRecordActivities('leads', 'record', true, undefined, { type: 'note' }));
  await waitFor(() => expect(noteReader.result.current.total).toBe(1));
  expect(mocks.status).not.toHaveBeenCalled(); noteReader.unmount();
  mocks.status.mockResolvedValue({ isConnected: false });
  const hook = renderHook(() => useRecordActivities('leads', 'record'));
  await waitFor(() => expect(hook.result.current.error).toBe('Connect your work Gmail account first.'));
  const pending = deferred<{ isConnected: boolean }>(); mocks.status.mockReturnValue(pending.promise);
  mocks.auth.user = { ...mocks.auth.user, id: 'user-b' }; hook.rerender();
  expect(hook.result.current.error).toBeFalsy();
  await act(async () => pending.resolve({ isConnected: true }));
  await waitFor(() => expect(hook.result.current.error).toBeFalsy());
});

it('clears access-revoked rows, total and pagination immediately while hidden and rejects old responses', async () => {
  const pending = deferred<ReturnType<typeof response>>(), fresh = deferred<ReturnType<typeof response>>();
  const hook = renderHook(() => useRecordActivities('contacts', 'record', true, undefined, { type: 'email' }));
  await waitFor(() => expect(hook.result.current.total).toBe(1));
  mocks.getAll.mockReturnValueOnce(pending.promise).mockReturnValue(fresh.promise); changed();
  await waitFor(() => expect(mocks.getAll).toHaveBeenCalledTimes(2));
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  act(() => streams[0].dispatchEvent(new Event('mailbox-access-changed')));
  expect(hook.result.current.activities).toEqual([]); expect(hook.result.current.total).toBeUndefined(); expect(hook.result.current.hasMore).toBe(false);
  await act(async () => pending.resolve(response([email('Sent')])));
  expect(hook.result.current.activities).toEqual([]);
  await act(async () => fresh.resolve(response([])));
  await waitFor(() => expect(hook.result.current.total).toBe(0));
  expect(mocks.getAll.mock.lastCall?.[0]).toMatchObject({ contactId: 'record', type: 'email', cursor: undefined });
});

it.each(['user', 'tenant', 'role'] as const)('replaces subscriptions and never reuses stale data after a %s change', async change => {
  const old = deferred<ReturnType<typeof response>>(), fresh = deferred<ReturnType<typeof response>>();
  const hook = renderHook(() => useRecordActivities('deals', 'record'));
  await waitFor(() => expect(hook.result.current.total).toBe(1));
  mocks.getAll.mockReturnValueOnce(old.promise).mockReturnValue(fresh.promise); changed();
  await waitFor(() => expect(mocks.getAll).toHaveBeenCalledTimes(2));
  if (change === 'user') mocks.auth.user = { ...mocks.auth.user, id: 'user-b' };
  if (change === 'tenant') mocks.auth = { ...mocks.auth, tenant: { id: 'tenant-b' }, user: { ...mocks.auth.user, tenantId: 'tenant-b' } };
  if (change === 'role') mocks.auth.user = { ...mocks.auth.user, role: 'Reader' };
  hook.rerender(); expect(hook.result.current.activities).toEqual([]); expect(streams[0].close).toHaveBeenCalledOnce();
  act(() => streams[0].dispatchEvent(new Event('mailbox-access-changed')));
  await act(async () => old.resolve(response([email('Sent')]))); expect(hook.result.current.activities).toEqual([]);
  await act(async () => fresh.resolve(response([email('Received')])));
  await waitFor(() => expect(hook.result.current.activities.map(row => row.id)).toEqual(['Received']));
});

it('restarts a mailbox scope conflict once for all mounted shared-request readers, without a retry loop', async () => {
  const first = renderHook(() => useRecordActivities('leads', 'record'));
  const second = renderHook(() => useRecordActivities('leads', 'record'));
  await waitFor(() => expect(second.result.current.total).toBe(1));
  const conflict = Object.assign(new Error('Mailbox access changed'), { status: 409, code: 'MAILBOX_SCOPE_CHANGED' });
  const initial = deferred<ReturnType<typeof response>>(), retry = deferred<ReturnType<typeof response>>();
  mocks.getAll.mockReturnValueOnce(initial.promise).mockReturnValue(retry.promise);
  changed();
  await waitFor(() => expect(mocks.getAll).toHaveBeenCalledTimes(2));
  await act(async () => initial.reject(conflict));
  await waitFor(() => expect(mocks.getAll).toHaveBeenCalledTimes(3));
  await act(async () => retry.reject(conflict));
  await waitFor(() => expect(first.result.current.errorStatus).toBe(409));
  await waitFor(() => expect(second.result.current.errorStatus).toBe(409));
  expect(first.result.current.activities).toEqual([]); expect(second.result.current.activities).toEqual([]);
  expect(first.result.current.total).toBeUndefined(); expect(second.result.current.total).toBeUndefined();
  expect(mocks.getAll).toHaveBeenCalledTimes(3);
  await new Promise(resolve => setTimeout(resolve, 30)); expect(mocks.getAll).toHaveBeenCalledTimes(3);
  mocks.getAll.mockResolvedValue(response([email('Received')])); changed();
  await waitFor(() => expect(first.result.current.total).toBe(1));
  await waitFor(() => expect(second.result.current.activities.map(row => row.id)).toEqual(['Received']));
});

it('revalidates cached cursor pages after an event and resets pagination on access change', async () => {
  let added = false;
  mocks.getAll.mockImplementation(async ({ cursor }: { cursor?: string }) => cursor ? { data: [note], total: added ? 3 : 2, nextCursor: null } : { data: [email('Sent'), ...(added ? [email('Received')] : [])], total: added ? 3 : 2, nextCursor: 'older' });
  const hook = renderHook(() => useRecordActivities('leads', 'record'));
  await waitFor(() => expect(hook.result.current.hasMore).toBe(true));
  act(() => hook.result.current.loadMore());
  await waitFor(() => expect(hook.result.current.activities).toHaveLength(2));
  added = true; changed();
  await waitFor(() => expect(hook.result.current.activities).toHaveLength(3));
  expect(hook.result.current.total).toBe(3);
  act(() => streams[0].dispatchEvent(new Event('mailbox-access-changed')));
  await waitFor(() => expect(hook.result.current.activities).toHaveLength(2));
  expect(hook.result.current.hasMore).toBe(true);
});

it('refreshes through an open event after a missed mailbox change', async () => {
  const hook = renderHook(() => useRecordActivities('leads', 'record'));
  await waitFor(() => expect(hook.result.current.total).toBe(1));
  mocks.getAll.mockResolvedValue(response([note, email('Received')]));
  act(() => streams[0].dispatchEvent(new Event('open')));
  await waitFor(() => expect(hook.result.current.total).toBe(2));
});

it.each(['disabled', 'permission', 'mock', 'provided', 'account', 'loading', 'authError'] as const)('does not subscribe for %s readers', reason => {
  if (reason === 'permission') mocks.permission = false;
  if (reason === 'mock') mocks.mockMode = true;
  if (reason === 'loading') mocks.auth.isLoading = true;
  if (reason === 'authError') mocks.auth.authError = 'Session expired';
  renderHook(() => useRecordActivities((reason === 'account' ? 'accounts' : 'leads') as ActivityModule, 'record', reason !== 'disabled', reason === 'provided' ? [] : undefined));
  expect(streams).toHaveLength(0);
});
