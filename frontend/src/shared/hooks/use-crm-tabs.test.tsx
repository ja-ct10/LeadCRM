import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import { EMPTY_PERMISSION_FLAGS, type ResolvedPermissions } from '@leadcrm/shared';
const state = vi.hoisted(() => ({ role: 'Staff', permissions: {} as ResolvedPermissions }));
vi.mock('@/store/AuthContext', () => ({ useAuth: () => ({ user: { role: state.role }, permissions: state.permissions, isPermissionsLoaded: true }) }));
import { useCrmTabs } from './use-crm-tabs';
afterEach(() => { cleanup(); state.role = 'Staff'; state.permissions = {}; });
const tabs = [{ id: 'all', label: 'All' }, { id: 'my', label: 'My' }, { id: 'active', label: 'Active' }];

it.each(['leads', 'contacts', 'accounts', 'deals'])('filters every applicable combination for %s and updates while mounted', module => {
  const available = module === 'accounts' ? tabs.slice(0, 1) : module === 'deals' ? tabs.slice(0, 2) : tabs;
  const hook = renderHook(() => useCrmTabs(module, available));
  for (let mask = 0; mask < 1 << available.length; mask++) {
    state.permissions = { [module]: { ...EMPTY_PERMISSION_FLAGS, canView: true,
      canViewAll: !!(mask & 1), canViewMy: !!(mask & 2), canViewActive: !!(mask & 4) } };
    hook.rerender();
    const expected = available.filter((_, index) => mask & 1 << index);
    expect(hook.result.current.tabs).toEqual(expected);
    expect(hook.result.current.firstId).toBe(expected[0]?.id ?? '');
  }
  state.permissions[module].canView = false; hook.rerender(); expect(hook.result.current.tabs).toEqual([]);
});
it('keeps administrative access and the existing hidden personal tab', () => {
  state.role = 'Client Admin';
  expect(renderHook(() => useCrmTabs('leads', tabs)).result.current.tabs.map(tab => tab.id)).toEqual(['all', 'active']);
});
