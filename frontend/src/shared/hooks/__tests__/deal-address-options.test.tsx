import { beforeEach, it, expect, vi } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { useDealAddressOptions } from '../use-deal-address-options';
const fixture = vi.hoisted(() => ({ accounts: true, query: undefined as any, get: vi.fn() }));
vi.mock('@/lib/config', () => ({ USE_MOCK_DATA: false }));
vi.mock('@/lib/api/client', () => ({ apiClient: { get: fixture.get } }));
vi.mock('../use-permissions', () => ({ useHasPermission: () => fixture.accounts }));
vi.mock('../use-cached-page', () => ({ useCachedPage: (query: any) => { fixture.query = query; return {}; } }));
beforeEach(() => { cleanup(); fixture.accounts = true; fixture.get.mockReset(); });
it.each(['lead', 'contact'] as const)('loads %s and company addresses from existing authorized APIs', async type => {
  fixture.get.mockImplementation(async (path: string) => ({ data: path.includes('/accounts/') ? { id: 'account', name: 'Company', address: 'Office street' } : { id: 'person', firstName: 'Customer', lastName: 'One', address: 'Personal street', accountId: 'account' } }));
  renderHook(() => useDealAddressOptions({ association: { type, id: 'person' } }));
  expect(await fixture.query.fetchFn(new AbortController().signal)).toEqual([
    { type, id: 'person', label: `${type === 'lead' ? 'Lead' : 'Contact'}: Customer One`, address: 'Personal street' },
    { type: 'account', id: 'account', label: 'Company: Company', address: 'Office street' },
  ]);
  expect(fixture.get.mock.calls.map(([path]) => path)).toEqual([`/crm/${type}s/person`, '/crm/accounts/account']);
});
it('does not request or expose Account metadata without Account view access', async () => {
  fixture.accounts = false;
  fixture.get.mockResolvedValue({ data: { firstName: 'Customer', lastName: 'One', address: 'Personal street', accountId: 'hidden-account' } });
  renderHook(() => useDealAddressOptions({ association: { type: 'lead', id: 'person' } }));
  expect(await fixture.query.fetchFn(new AbortController().signal)).toHaveLength(1);
  expect(fixture.get).toHaveBeenCalledTimes(1);
});
it('uses the server-resolved Deal choices on edit and enables visible refreshes', async () => {
  const options = [{ type: 'account', id: 'company', label: 'Company', address: 'Office' }];
  fixture.get.mockResolvedValue({ data: { addressContext: { options } } });
  renderHook(() => useDealAddressOptions({ dealId: 'deal', association: { type: 'lead', id: 'person' } }));
  expect(await fixture.query.fetchFn(new AbortController().signal)).toEqual(options);
  expect(fixture.get).toHaveBeenCalledTimes(1);
  expect(fixture.query).toMatchObject({ intervalMs: 30000, pauseWhenHidden: true, revalidateOnInvalidation: true });
});
