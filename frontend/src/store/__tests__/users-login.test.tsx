import React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { EMPTY_PERMISSION_FLAGS } from '@leadcrm/shared';
import { clearPageCache } from '@/shared/cache/page-cache';

const mocks = vi.hoisted(() => ({ me: vi.fn(), login: vi.fn(), logout: vi.fn(), permissions: vi.fn() }));
vi.mock('@/lib/config', () => ({ USE_MOCK_AUTH: false, USE_MOCK_DATA: false }));
vi.mock('@/shared/services/auth.api', () => ({ authApi: mocks }));
vi.mock('@/shared/services/roles.api', () => ({ rolesApi: {
  getUserPermissions: mocks.permissions, getPermissionModules: async () => ({ data: [] }),
} }));
import { AuthProvider, useAuth } from '../AuthContext';
import { DataProvider, useData } from '../DataContext';

let auth: ReturnType<typeof useAuth>;
function Probe() {
  auth = useAuth();
  const { users, pipelines } = useData();
  return <><output data-testid="users">{users.map(user => user.id).join(',')}</output>
    <output data-testid="pipelines">{pipelines.map(pipeline => pipeline.id).join(',')}</output></>;
}
beforeEach(() => {
  vi.clearAllMocks(); clearPageCache(); localStorage.clear(); sessionStorage.clear();
  mocks.me.mockRejectedValue(Object.assign(new Error('No session'), { status: 401 }));
  mocks.logout.mockResolvedValue({ success: true });
  vi.stubGlobal('EventSource', class extends EventTarget { close() {} });
});
afterEach(() => { cleanup(); clearPageCache(); vi.unstubAllGlobals(); });

it.each([
  ['Sales Associate', false], ['Client Admin', true], ['Custom Directory Viewer', true], ['Custom Staff', false],
])('initializes the workspace after %s login using resolved effective access', async (role, directoryAllowed) => {
  mocks.login.mockResolvedValue({ data: { user: {
    id: 'actor', tenantId: 'tenant', role, firstName: 'Test', lastName: 'User', email: 'test@camxian.com',
    status: 'ACTIVE', tenantStatus: 'ACTIVE', tenantName: 'Workspace', mustChangePassword: false,
    onboardingCompletedAt: '2026-01-01', avatarUrl: null,
  } } });
  let resolvePermissions!: (value: unknown) => void;
  mocks.permissions.mockReturnValue(new Promise(resolve => { resolvePermissions = resolve; }));
  const fetcher = vi.fn(async (path: string) => new Response(JSON.stringify({ success: true,
    data: path.includes('/administration/users') ? [{ id: 'staff', firstName: 'Staff', lastName: 'User', status: 'ACTIVE', role: 'Sales' }]
      : path.includes('/crm/pipelines') ? [{ id: 'pipeline', stages: [] }] : [], meta: { hasMore: false },
  }), { headers: { 'Content-Type': 'application/json' } }));
  vi.stubGlobal('fetch', fetcher);
  render(<AuthProvider><DataProvider><Probe /></DataProvider></AuthProvider>);
  await waitFor(() => expect(auth.isLoading).toBe(false));
  await act(async () => { expect(await auth.login('test@camxian.com', 'fixture-password')).toBe(true); });
  expect(auth.user?.id).toBe('actor');
  expect(auth.isPermissionsLoaded).toBe(false);
  act(() => window.dispatchEvent(new Event('leadcrm:users-changed')));
  await act(async () => { await Promise.resolve(); });
  const directoryCalls = () => fetcher.mock.calls.filter(([path]) => new URL(path, 'http://localhost').pathname.endsWith('/administration/users'));
  expect(directoryCalls()).toHaveLength(0);
  await act(async () => { resolvePermissions({ data: {
    deals: { ...EMPTY_PERMISSION_FLAGS, canView: true, canViewMy: true },
    users: { ...EMPTY_PERMISSION_FLAGS, canView: directoryAllowed },
  } }); });
  await waitFor(() => expect(auth.isPermissionsLoaded).toBe(true));
  await waitFor(() => expect(screen.getByTestId('pipelines').textContent).toBe('pipeline'));
  if (directoryAllowed) {
    await waitFor(() => expect(screen.getByTestId('users').textContent).toBe('staff'));
    expect(directoryCalls()).toHaveLength(1);
  } else {
    act(() => { window.dispatchEvent(new Event('leadcrm:users-changed')); window.dispatchEvent(new Event('leadcrm:users-changed')); });
    await act(async () => { await Promise.resolve(); });
    expect(directoryCalls()).toHaveLength(0);
    expect(screen.getByTestId('users').textContent).toBe('');
  }
});
