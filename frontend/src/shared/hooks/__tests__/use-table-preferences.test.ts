import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useTablePreferences } from '../use-table-preferences';

const mocks = vi.hoisted(() => ({
  api: { getTablePreferences: vi.fn(), saveSort: vi.fn() },
  auth: { user: { id: 'user' }, tenant: { id: 'tenant' } }, toast: vi.fn(),
}));
vi.mock('@/store/AuthContext', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/shared/services/table-preferences.api', () => ({ tablePreferencesApi: mocks.api }));
vi.mock('sonner', () => ({ toast: { error: mocks.toast } }));
beforeEach(() => {
  vi.resetAllMocks(); mocks.auth.user = { id: 'user' }; mocks.auth.tenant = { id: 'tenant' };
  mocks.api.getTablePreferences.mockResolvedValue({ data: { pageSize: 25, viewMode: 'wrap', sort: null } });
  mocks.api.saveSort.mockResolvedValue(undefined);
});
afterEach(cleanup);
async function loaded() { const hook = renderHook(() => useTablePreferences('leads')); await waitFor(() => expect(hook.result.current.isLoading).toBe(false)); return hook; }
it('persists default restoration as null while indicating the actual server default', async () => {
  const { result } = await loaded();
  act(() => result.current.setSort({ field: 'email', direction: 'asc' }));
  await waitFor(() => expect(mocks.api.saveSort).toHaveBeenCalledWith('leads', { field: 'email', direction: 'asc' }));
  act(() => result.current.setSort(null));
  await waitFor(() => expect(mocks.api.saveSort).toHaveBeenLastCalledWith('leads', null));
  expect(result.current.sort).toEqual({ field: 'lastSalesActivityAt', direction: 'desc' });
});
it('rolls back a failed sort and allows retry through the same menu action', async () => {
  const { result } = await loaded();
  mocks.api.saveSort.mockRejectedValueOnce(new Error('Offline'));
  act(() => result.current.setSort({ field: 'email', direction: 'asc' }));
  await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
  expect(result.current.sort).toEqual({ field: 'lastSalesActivityAt', direction: 'desc' });
  act(() => result.current.setSort({ field: 'email', direction: 'asc' }));
  await waitFor(() => expect(mocks.api.saveSort).toHaveBeenCalledTimes(2));
  expect(result.current.sort).toEqual({ field: 'email', direction: 'asc' });
});
it('serializes writes and drops queued work from a former tenant', async () => {
  let resolve!: () => void;
  mocks.api.saveSort.mockReturnValueOnce(new Promise<void>(done => { resolve = done; }));
  const { result, rerender } = await loaded();
  act(() => { result.current.setSort({ field: 'email', direction: 'asc' }); result.current.setSort({ field: 'phone', direction: 'desc' }); });
  await waitFor(() => expect(mocks.api.saveSort).toHaveBeenCalledTimes(1));
  mocks.auth.tenant = { id: 'other' }; rerender();
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  await act(async () => resolve());
  expect(mocks.api.saveSort).toHaveBeenCalledTimes(1);
  expect(result.current.sort).toEqual({ field: 'lastSalesActivityAt', direction: 'desc' });
});

it.each(['leads', 'contacts'])('preserves an explicit saved %s sort', async module => {
  mocks.api.getTablePreferences.mockResolvedValue({ data: { sort: { field: 'createdAt', direction: 'asc' } } });
  const { result } = renderHook(() => useTablePreferences(module));
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.sort).toEqual({ field: 'createdAt', direction: 'asc' });
});
