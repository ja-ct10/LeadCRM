import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useTasks } from '../use-tasks';

const mocks = vi.hoisted(() => ({
  auth: { user: { id: 'agent' }, tenant: { id: 'tenant' } },
  canRead: true,
  data: { queryTasks: vi.fn(), queryTaskSummary: vi.fn(), refreshTasks: vi.fn(), tasksRevision: 0, taskScopeRevision: 0 },
}));
vi.mock('@/store/AuthContext', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/store/DataContext', () => ({ useData: () => mocks.data }));
vi.mock('@/shared/hooks/use-permissions', () => ({ useHasPermission: () => mocks.canRead }));
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks(); mocks.canRead = true; mocks.auth.tenant = { id: 'tenant' }; mocks.data.tasksRevision = 0; mocks.data.taskScopeRevision = 0;
  mocks.data.queryTasks.mockResolvedValue({ data: [{ id: 'task', title: 'Follow up' }], meta: { total: 1 } });
  mocks.data.queryTaskSummary.mockResolvedValue({ total: 1 });
});

it('keeps the same query visible during background refresh and a read failure', async () => {
  const { result, rerender } = renderHook(() => useTasks({}, true));
  await waitFor(() => expect(result.current.tasks).toHaveLength(1));
  let reject!: (error: Error) => void;
  mocks.data.queryTasks.mockImplementation(() => new Promise((_resolve, rejectRequest) => { reject = rejectRequest; }));
  mocks.data.tasksRevision++;
  rerender();
  expect(result.current.tasks[0].id).toBe('task');
  expect(result.current.loading).toBe(false);
  expect(result.current.refreshing).toBe(true);
  await act(async () => reject(new Error('Temporarily unavailable')));
  expect(result.current.tasks[0].id).toBe('task');
  expect(result.current.error).toBe('Temporarily unavailable');
  expect(result.current.refreshing).toBe(false);
});

it('ends manual feedback when its read settles and keeps later revisions silent', async () => {
  const hook = renderHook(() => useTasks());
  await waitFor(() => expect(hook.result.current.tasks).toHaveLength(1));
  let resolve!: (value: unknown) => void;
  mocks.data.queryTasks.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  act(() => hook.result.current.refresh());
  mocks.data.tasksRevision++; hook.rerender();
  expect(hook.result.current.isManualRefreshing).toBe(true);
  await act(async () => resolve({ data: [{ id: 'task' }], meta: { total: 1 } }));
  expect(hook.result.current.isManualRefreshing).toBe(false);
  mocks.data.queryTasks.mockReturnValueOnce(new Promise(() => {}));
  mocks.data.tasksRevision++; hook.rerender();
  expect(hook.result.current.refreshing).toBe(true);
  expect(hook.result.current.isManualRefreshing).toBe(false);
});

it('clears prior rows when the query, identity, or permissions change', async () => {
  const { result, rerender } = renderHook(({ search }) => useTasks({ search }, true), { initialProps: { search: '' } });
  await waitFor(() => expect(result.current.tasks).toHaveLength(1));
  mocks.data.queryTasks.mockImplementation(() => new Promise(() => {}));
  rerender({ search: 'different' });
  expect(result.current.tasks).toEqual([]); expect(result.current.loading).toBe(true);
  mocks.auth.tenant = { id: 'other' }; rerender({ search: '' });
  expect(result.current.tasks).toEqual([]);
  mocks.canRead = false; rerender({ search: '' });
  expect(result.current.tasks).toEqual([]); expect(result.current.canRead).toBe(false);
});

it('does not repeat reads when the auth context replaces the same tenant object', async () => {
  const hook = renderHook(() => useTasks());
  await waitFor(() => expect(hook.result.current.tasks).toHaveLength(1));
  const reads = mocks.data.queryTasks.mock.calls.length;
  mocks.auth.tenant = { id: 'tenant' }; hook.rerender();
  expect(mocks.data.queryTasks).toHaveBeenCalledTimes(reads);
});

it('discards previously visible rows when the API revokes access', async () => {
  const { result, rerender } = renderHook(() => useTasks({}, true));
  await waitFor(() => expect(result.current.tasks).toHaveLength(1));
  mocks.data.queryTasks.mockRejectedValue(Object.assign(new Error('Access denied'), { status: 403 }));
  mocks.data.tasksRevision++; rerender();
  await waitFor(() => expect(result.current.error).toBe('Access denied'));
  expect(result.current.tasks).toEqual([]);
});

it('evicts rows and ignores late requests when the authorized Group scope changes', async () => {
  const { result, rerender } = renderHook(() => useTasks({}, true));
  await waitFor(() => expect(result.current.tasks).toHaveLength(1));
  let oldResolve!: (page: unknown) => void;
  mocks.data.queryTasks.mockImplementationOnce(() => new Promise(resolve => { oldResolve = resolve; }));
  mocks.data.tasksRevision++; rerender();
  mocks.data.queryTasks.mockResolvedValue({ data: [], meta: { total: 0 } });
  mocks.data.taskScopeRevision++; rerender();
  expect(result.current.tasks).toEqual([]);
  await waitFor(() => expect(result.current.meta?.total).toBe(0));
  await act(async () => oldResolve({ data: [{ id: 'revoked-task' }], meta: { total: 1 } }));
  expect(result.current.tasks).toEqual([]);
});
