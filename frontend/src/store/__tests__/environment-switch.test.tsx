import React from 'react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
const mocks = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_USE_MOCK_AUTH = 'false';
  process.env.NEXT_PUBLIC_USE_MOCK_DATA = 'false';
  return { me: vi.fn(), changeEnvironment: vi.fn(), permissions: vi.fn() };
});
vi.mock('@/shared/services/auth.api', () => ({ authApi: mocks }));
vi.mock('@/shared/services/roles.api', () => ({ rolesApi: { getUserPermissions: mocks.permissions } }));
vi.mock('@/store/mockData', () => ({ MOCK_USERS: [], MOCK_TENANTS: [] }));
import { AuthProvider, useAuth, buildTenantFromApiUser } from '../AuthContext';
import { clearPageCache, getPageCache, setPageCache, createPageCacheGuard } from '@/shared/cache/page-cache';
import { environmentSnapshot, endEnvironmentSwitch, setTransportEnvironment } from '@/lib/api/environment-transport';
let auth: ReturnType<typeof useAuth>;
function Probe() { auth = useAuth(); return <span>{auth.user?.activeEnvironment}</span>; }
const user = { id: 'alice', tenantId: 'tenant', role: 'Sales Agent', email: 'alice@camxian.com', firstName: 'Alice', lastName: 'Test', status: 'ACTIVE', activeEnvironment: 'SANDBOX', avatarUrl: null, timeZone: null };
beforeEach(() => {
  vi.resetAllMocks(); clearPageCache(); setTransportEnvironment(null); endEnvironmentSwitch();
  mocks.me.mockResolvedValue({ data: { user } });
  mocks.permissions.mockResolvedValue({ data: { contacts: { canView: true, canDelete: false } } });
});
afterEach(cleanup);
async function show() {
  render(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(() => expect(auth.user?.id).toBe('alice'));
  await waitFor(() => expect(auth.user?.role === 'System Admin' || auth.permissions.contacts?.canView).toBe(true));
}
it('commits one update, invalidates old data and preserves the loaded permissions', async () => {
  await show();
  const permissions = auth.permissions;
  setPageCache('leads', 'tenant', {}, ['sandbox']);
  const guard = createPageCacheGuard('leads');
  let resolve!: (value: unknown) => void;
  mocks.changeEnvironment.mockReturnValue(new Promise(r => { resolve = r; }));
  let pending!: Promise<void>;
  await act(async () => { pending = auth.switchEnvironment('PRODUCTION'); });
  expect(auth.user?.activeEnvironment).toBe('SANDBOX');
  expect(auth.isSwitchingEnvironment).toBe(true);
  await act(async () => { await auth.switchEnvironment('PRODUCTION'); });
  expect(mocks.changeEnvironment).toHaveBeenCalledOnce();
  await act(async () => { resolve({ data: { environment: 'PRODUCTION' } }); await pending; });
  expect(auth.user?.activeEnvironment).toBe('PRODUCTION');
  expect(environmentSnapshot().environment).toBe('PRODUCTION');
  expect(getPageCache('leads', 'tenant', {})).toBeNull();
  expect(guard()).toBe(false);
  expect(auth.permissions).toBe(permissions);
  expect(mocks.permissions).toHaveBeenCalledOnce();
  expect(mocks.me).toHaveBeenCalledOnce();
});
it('keeps the existing data and preference when the update fails', async () => {
  await show();
  setPageCache('leads', 'tenant', {}, ['sandbox']);
  mocks.changeEnvironment.mockRejectedValue(Object.assign(new Error('Rejected'), { status: 403 }));
  await act(async () => { await expect(auth.switchEnvironment('PRODUCTION')).rejects.toThrow('Rejected'); });
  expect(auth.user?.activeEnvironment).toBe('SANDBOX');
  expect(getPageCache('leads', 'tenant', {})?.data).toEqual(['sandbox']);
  expect(auth.isSwitchingEnvironment).toBe(false);
  expect(environmentSnapshot().switching).toBe(false);
});
it('restores the persisted Live preference and ignores selecting the active environment', async () => {
  mocks.me.mockResolvedValue({ data: { user: { ...user, activeEnvironment: 'PRODUCTION' } } });
  await show();
  await act(async () => { await auth.switchEnvironment('PRODUCTION'); });
  expect(auth.user?.activeEnvironment).toBe('PRODUCTION');
  expect(mocks.changeEnvironment).not.toHaveBeenCalled();
});
it('excludes System Admin from switching', async () => {
  mocks.me.mockResolvedValue({ data: { user: { ...user, role: 'System Admin', activeEnvironment: null } } });
  await show();
  await act(async () => { await auth.switchEnvironment('PRODUCTION'); });
  expect(auth.tenant).toBeNull();
  expect(mocks.changeEnvironment).not.toHaveBeenCalled();
});
it('keeps account status separate from the selected dataset for Client Admin', async () => {
  const admin = { ...user, role: 'Client Admin', tenantStatus: 'SANDBOX' };
  mocks.me.mockResolvedValue({ data: { user: admin } });
  mocks.changeEnvironment.mockImplementation(environment => Promise.resolve({ data: { environment } }));
  await show();
  expect(buildTenantFromApiUser(admin)).not.toHaveProperty('environment');
  for (const environment of ['PRODUCTION', 'SANDBOX'] as const) {
    await act(async () => { await auth.switchEnvironment(environment); });
    expect(auth.user?.activeEnvironment).toBe(environment);
    expect(auth.userCan('workflows', 'canCreate')).toBe(true);
    expect(auth.tenant).not.toHaveProperty('environment');
  }
});
