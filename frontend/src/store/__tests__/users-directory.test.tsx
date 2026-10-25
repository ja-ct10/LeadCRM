import React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { EMPTY_PERMISSION_FLAGS, hasModulePermission, type ResolvedPermissions } from '@leadcrm/shared';
import { DataProvider, useData } from '../DataContext';
import { clearPageCache, getPageCacheSize, setPageCache } from '@/shared/cache/page-cache';
import { toast } from 'sonner';

const state = vi.hoisted(() => ({
  id: 'actor', tenant: 'tenant', role: 'Sales Associate', ready: true, loading: false,
  permissionsLoaded: true, permissionsError: null as string | null, usersView: false, usersEdit: false,
}));
vi.mock('../AuthContext', () => ({ useAuth: () => {
  const permissions: ResolvedPermissions = { users: { ...EMPTY_PERMISSION_FLAGS, canView: state.usersView, canEdit: state.usersEdit } };
  return {
    user: state.id ? { id: state.id, tenantId: state.tenant, role: state.role, status: 'ACTIVE',
      mustChangePassword: !state.ready, onboardingCompletedAt: '2026-01-01' } : null,
    tenant: state.tenant ? { id: state.tenant } : null,
    permissions, isPermissionsLoaded: state.permissionsLoaded, permissionsError: state.permissionsError,
    userCan: (module: string, action: Parameters<typeof hasModulePermission>[2]) =>
      state.role === 'Client Admin' || hasModulePermission(permissions, module, action),
    isLoading: state.loading, authError: null,
  };
} }));
vi.mock('@/lib/config', () => ({ USE_MOCK_DATA: false }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const person = (id = 'staff') => ({ id, tenantId: state.tenant, firstName: id, lastName: 'User', role: 'Sales', status: 'ACTIVE' });
const response = (data: unknown, status = 200, hasMore = false) => new Response(JSON.stringify({
  success: status === 200, ...(status === 200 ? { data, meta: { hasMore } } : { error: 'Access denied' }),
}), { status, headers: { 'Content-Type': 'application/json' } });
let intercept: ((url: URL, init?: RequestInit) => Promise<Response> | undefined) | undefined;
const fetcher = vi.fn(async (path: string, init?: RequestInit) => {
  const url = new URL(path, 'http://localhost');
  const held = intercept?.(url, init); if (held) return held;
  if (url.pathname.endsWith('/administration/users')) return response([person()]);
  if (url.pathname.endsWith('/crm/pipelines')) return response([{ id: 'pipeline', name: 'Sales', stages: [] }]);
  return response([]);
});
const directoryCalls = () => fetcher.mock.calls.filter(([path]) => new URL(path, 'http://localhost').pathname.endsWith('/administration/users'));
const changed = () => window.dispatchEvent(new Event('leadcrm:users-changed'));
const flush = () => act(async () => { await Promise.resolve(); });
function Probe() {
  const { users, pipelines } = useData();
  return <><output data-testid="users">{users.map(user => user.id).join(',')}</output>
    <output data-testid="pipelines">{pipelines.map(pipeline => pipeline.id).join(',')}</output></>;
}
const view = (strict = false) => strict ? <React.StrictMode><DataProvider><Probe /></DataProvider></React.StrictMode> : <DataProvider><Probe /></DataProvider>;

beforeEach(() => {
  Object.assign(state, { id: 'actor', tenant: 'tenant', role: 'Sales Associate', ready: true, loading: false,
    permissionsLoaded: true, permissionsError: null, usersView: false, usersEdit: false });
  intercept = undefined; clearPageCache(); localStorage.clear(); fetcher.mockClear(); vi.clearAllMocks();
  vi.stubGlobal('fetch', fetcher);
  vi.stubGlobal('EventSource', class extends EventTarget { close() {} });
});
afterEach(() => { cleanup(); clearPageCache(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it.each(['Sales Associate', 'Sales Manager', 'Custom Viewer'])('loads the authorized workspace without a directory request for %s', async role => {
  state.role = role;
  setPageCache('users', 'tenant', {}, [person('cached')]);
  render(view());
  await waitFor(() => expect(screen.getByTestId('pipelines').textContent).toBe('pipeline'));
  act(() => { changed(); changed(); changed(); }); await flush();
  expect(directoryCalls()).toHaveLength(0);
  expect(screen.getByTestId('users').textContent).toBe('');
  expect(getPageCacheSize()).toBe(0);
  expect(toast.error).not.toHaveBeenCalled();
});

it.each(['Client Admin', 'Custom Administrator'])('waits for effective permissions before loading the directory for %s', async role => {
  state.role = role; state.usersView = true; state.permissionsLoaded = false;
  const rendered = render(view()); await flush();
  act(() => { changed(); changed(); }); await flush();
  expect(directoryCalls()).toHaveLength(0);
  state.permissionsLoaded = true; rendered.rerender(view());
  await waitFor(() => expect(screen.getByTestId('users').textContent).toBe('staff'));
  expect(directoryCalls()).toHaveLength(1);
});

it.each(['authentication', 'workspace', 'permission error', 'missing tenant'])('skips directory reads during %s unavailability', async unavailable => {
  state.usersView = true;
  if (unavailable === 'authentication') state.loading = true;
  if (unavailable === 'workspace') state.ready = false;
  if (unavailable === 'permission error') state.permissionsError = 'Unable to load permissions';
  if (unavailable === 'missing tenant') state.tenant = '';
  render(view()); act(changed); await flush();
  expect(directoryCalls()).toHaveLength(0);
});

it('deduplicates initial reads in Strict Mode and concurrent user-change events, then refreshes legitimate changes', async () => {
  state.usersView = true;
  let finish!: (value: Response) => void;
  intercept = url => url.pathname.endsWith('/administration/users') ? new Promise(resolve => { finish = resolve; }) : undefined;
  render(view(true));
  await waitFor(() => expect(directoryCalls()).toHaveLength(1));
  act(() => { changed(); changed(); changed(); }); await flush();
  expect(directoryCalls()).toHaveLength(1);
  await act(async () => { finish(response([person()])); });
  await waitFor(() => expect(screen.getByTestId('users').textContent).toBe('staff'));
  intercept = undefined; act(changed);
  await waitFor(() => expect(directoryCalls()).toHaveLength(2));
});

it('loads a new grant without login, clears revocation and discards an old in-flight response', async () => {
  const rendered = render(view()); await flush();
  let finish!: (value: Response) => void;
  intercept = url => url.pathname.endsWith('/administration/users') ? new Promise(resolve => { finish = resolve; }) : undefined;
  state.usersView = true; rendered.rerender(view());
  await waitFor(() => expect(directoryCalls()).toHaveLength(1));
  const signal = directoryCalls()[0][1]?.signal;
  state.usersView = false; rendered.rerender(view());
  expect(screen.getByTestId('users').textContent).toBe('');
  await flush(); expect(signal?.aborted).toBe(true);
  await act(async () => { finish(response([person('obsolete')])); changed(); });
  expect(screen.getByTestId('users').textContent).toBe('');
  expect(directoryCalls()).toHaveLength(1);
  expect(getPageCacheSize()).toBe(0);
  state.usersView = true; intercept = undefined; rendered.rerender(view());
  await waitFor(() => expect(screen.getByTestId('users').textContent).toBe('staff'));
  expect(directoryCalls()).toHaveLength(2);
});

it.each(['logout', 'account', 'tenant', 'workspace', 'permissions loading'])('clears loaded directory data on %s changes', async change => {
  state.usersView = true;
  const rendered = render(view());
  await waitFor(() => expect(screen.getByTestId('users').textContent).toBe('staff'));
  let finish!: (value: Response) => void;
  intercept = url => url.pathname.endsWith('/administration/users') ? new Promise(resolve => { finish = resolve; }) : undefined;
  act(changed); await waitFor(() => expect(directoryCalls()).toHaveLength(2));
  const signal = directoryCalls()[1][1]?.signal;
  if (change === 'logout') state.id = '';
  if (change === 'account') { state.id = 'new-user'; state.permissionsLoaded = false; }
  if (change === 'tenant') { state.tenant = 'new-tenant'; state.permissionsLoaded = false; }
  if (change === 'workspace') state.ready = false;
  if (change === 'permissions loading') state.permissionsLoaded = false;
  rendered.rerender(view());
  expect(screen.getByTestId('users').textContent).toBe('');
  await flush(); expect(signal?.aborted).toBe(true);
  await act(async () => { finish(response([person('old-session')])); changed(); });
  expect(screen.getByTestId('users').textContent).toBe('');
  expect(directoryCalls()).toHaveLength(2);
  expect(getPageCacheSize()).toBe(0);
});

it('clears data after an authoritative denial and does not retry events or unchanged permission objects', async () => {
  state.usersView = true;
  const rendered = render(view());
  await waitFor(() => expect(screen.getByTestId('users').textContent).toBe('staff'));
  intercept = url => url.pathname.endsWith('/administration/users') ? Promise.resolve(response([], 403)) : undefined;
  act(changed);
  await waitFor(() => expect(screen.getByTestId('users').textContent).toBe(''));
  act(() => { changed(); changed(); }); rendered.rerender(view()); await flush();
  expect(directoryCalls()).toHaveLength(2);
  expect(toast.error).not.toHaveBeenCalled();
  // Only a changed effective authorization snapshot permits another automatic attempt.
  state.usersEdit = true; intercept = undefined; rendered.rerender(view());
  await waitFor(() => expect(screen.getByTestId('users').textContent).toBe('staff'));
  expect(directoryCalls()).toHaveLength(3);
});

it('reports a transport failure without discarding existing directory or workspace data', async () => {
  state.usersView = true;
  render(view());
  await waitFor(() => expect(screen.getByTestId('users').textContent).toBe('staff'));
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  intercept = url => url.pathname.endsWith('/administration/users') ? Promise.resolve(response([], 503)) : undefined;
  act(changed);
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Failed to load users. Please refresh the page.'));
  expect(error).toHaveBeenCalled();
  expect(screen.getByTestId('users').textContent).toBe('staff');
  expect(screen.getByTestId('pipelines').textContent).toBe('pipeline');
});
