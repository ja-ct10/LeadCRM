import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
const mocks = vi.hoisted(() => ({ permission: true, cache: vi.fn(), getAll: vi.fn(), get: vi.fn() }));
vi.mock('@/lib/config', () => ({ USE_MOCK_DATA: false }));
vi.mock('@/store/DataContext', () => ({ useData: () => ({ activities: [], users: [] }) }));
vi.mock('@/store/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user', tenantId: 'tenant', } }) }));
vi.mock('./use-permissions', () => ({ useHasPermission: () => mocks.permission }));
vi.mock('./use-cached-page', () => ({ useCachedPage: mocks.cache }));
vi.mock('@/lib/api/client', () => ({ apiClient: { get: mocks.get } }));
vi.mock('@/features/tenant/crm/activities/services/activities.service', () => ({ activitiesService: { getAll: mocks.getAll } }));
import { useRecordActivities } from './use-record-activities';
import { clearPageCache } from '@/shared/cache/page-cache';
beforeEach(() => { vi.resetAllMocks(); mocks.permission = true; mocks.cache.mockReturnValue({ data: [], refetch: vi.fn() }); });
afterEach(cleanup);
it.each([['leads', 'leadId'], ['accounts', 'accountId'], ['deals', 'dealId'], ['contacts', 'contactId']] as const)('reads only activities linked to the selected %s record', async (module, key) => {
  mocks.getAll.mockResolvedValue({ data: [{ id: 'event' }] });
  renderHook(() => useRecordActivities(module, 'selected-record'));
  const signal = new AbortController().signal;
  await mocks.cache.mock.calls[0][0].fetchFn(signal);
  expect(mocks.getAll).toHaveBeenCalledExactlyOnceWith({ [key]: 'selected-record', cursor: undefined, limit: 20 }, expect.any(AbortSignal));
});
it('reuses contact relationship history without another activity request', () => {
  const history = [{ id: 'event', title: 'Note', type: 'note', createdAt: '2026-09-21' }];
  const { result } = renderHook(() => useRecordActivities('contacts', 'contact', true, history));
  expect(mocks.cache.mock.calls[0][0].disabled).toBe(true);
  expect(result.current.activities).toBe(history);
  expect(mocks.getAll).not.toHaveBeenCalled();
  expect(mocks.get).not.toHaveBeenCalled();
});
it('withholds cached history and disables reads when permission is absent', () => {
  mocks.permission = false;
  mocks.cache.mockReturnValue({ data: [{ id: 'cached' }] });
  const { result } = renderHook(() => useRecordActivities('deals', 'deal'));
  expect(mocks.cache.mock.calls[0][0].disabled).toBe(true);
  expect(result.current.activities).toEqual([]);
});

it('discards retained pagination history when the authorization cache is cleared', () => {
  mocks.cache.mockReturnValue({ data: { data: [{ id: 'private', type: 'note', title: 'Private note', createdAt: '2026-09-21' }] } });
  const hook = renderHook(() => useRecordActivities('contacts', 'contact'));
  expect(hook.result.current.activities).toHaveLength(1);
  mocks.cache.mockReturnValue({ data: undefined, isInitialLoad: true });
  clearPageCache(); hook.rerender();
  expect(hook.result.current.activities).toEqual([]);
});

it('fetches the older server cursor when loading more instead of revealing a local slice', async () => {
  mocks.getAll.mockResolvedValueOnce({ data: [{ id: 'newer' }], total: 2, nextCursor: 'older-cursor' });
  const { result } = renderHook(() => useRecordActivities('contacts', 'contact'));
  await mocks.cache.mock.calls[0][0].fetchFn(new AbortController().signal);
  const { act } = await import('@testing-library/react');
  act(() => result.current.loadMore());
  mocks.getAll.mockResolvedValueOnce({ data: [{ id: 'newer' }], total: 2, nextCursor: 'older-cursor' }).mockResolvedValueOnce({ data: [{ id: 'older' }], total: 2, nextCursor: null });
  // No tenant in this isolated hook stub, so prior pages are deliberately uncached.
  const page = await mocks.cache.mock.calls.at(-1)![0].fetchFn(new AbortController().signal);
  expect(mocks.getAll.mock.calls.some(([params]) => params.cursor === 'older-cursor')).toBe(true);
  expect(page.data.map((row: { id: string }) => row.id)).toEqual(['newer','older']);
});
