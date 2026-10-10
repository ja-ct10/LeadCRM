import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ cache: vi.fn() }));
vi.mock('@/store/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user', role: 'Staff' }, tenant: { id: 'tenant' } }) }));
vi.mock('./use-cached-page', () => ({ useCachedPage: mocks.cache }));
import { clearPageCache } from '@/shared/cache/page-cache';
import { useRecordRelationships } from './use-record-relationships';
afterEach(() => { cleanup(); clearPageCache(); });
it('retains related Deals while loading more but discards them after an authorization clear', () => {
  const relationships = { deals: [{ id: 'private-deal' }], hasMoreDeals: true };
  mocks.cache.mockReturnValue({ data: relationships });
  const hook = renderHook(() => useRecordRelationships('contacts', 'contact', false));
  expect(hook.result.current.data).toEqual(relationships);
  mocks.cache.mockReturnValue({ data: undefined, isInitialLoad: true });
  hook.rerender(); expect(hook.result.current.data).toEqual(relationships);
  clearPageCache(); hook.rerender(); expect(hook.result.current.data).toBeUndefined();
});
