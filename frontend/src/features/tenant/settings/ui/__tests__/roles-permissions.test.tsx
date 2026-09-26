import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PERMISSION_MODULES } from '@leadcrm/shared';
import { DataProvider } from '@/store/DataContext';
import { RolesPermissions } from '../roles-permissions';
const mocks = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), environment: 'SANDBOX' }));
vi.mock('@/store/AuthContext', () => ({ useAuth: () => ({
  tenant: { id: 'tenant-a' }, user: { id: 'admin', role: 'Client Admin', status: 'ACTIVE', onboardingCompletedAt: '2026-01-01', activeEnvironment: mocks.environment }, userCan: () => true,
}) }));
vi.mock('@/lib/config', () => ({ USE_MOCK_DATA: false }));
vi.mock('sonner', () => ({ toast: mocks }));
const savedRoles: object[] = [];
let failure = '';
let pending: Promise<void> | undefined;
let holdCrm = false;
const fetcher = vi.fn(async (url: string, options?: RequestInit) => {
  const path = url.split('?')[0];
  if (holdCrm && path.endsWith('/crm/accounts')) return new Promise<never>(() => {});
  if (path.endsWith('/administration/permissions')) return { ok: true, json: async () => ({ data: PERMISSION_MODULES }) };
  if (path.endsWith('/administration/roles')) {
    if (options?.method === 'POST') {
      if (pending) await pending;
      if (failure) return { ok: false, status: 409, json: async () => ({ error: failure }) };
      const body = JSON.parse(String(options.body));
      const data = { ...body, id: 'database-role', tenantId: 'tenant-a', isSystemRole: false, isArchived: false, userCount: 0, createdAt: '2026-01-01', updatedAt: '2026-01-01', permissions: body.permissions.map((row: object) => ({ ...row, id: 'database-permission', roleId: 'database-role' })) };
      savedRoles.push(data);
      return { ok: true, json: async () => ({ success: true, data }) };
    }
    return { ok: true, json: async () => ({ data: savedRoles }) };
  }
  return { ok: true, json: async () => ({ data: [], meta: { total: 0, totalPages: 0 } }) };
});
beforeEach(() => { localStorage.clear(); savedRoles.length = 0; failure = ''; pending = undefined; holdCrm = false; mocks.environment = 'SANDBOX'; fetcher.mockClear(); vi.clearAllMocks(); vi.stubGlobal('fetch', fetcher); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const mount = () => render(<DataProvider><RolesPermissions /></DataProvider>);
async function open() { const view = mount(); fireEvent.click(await screen.findByRole('button', { name: 'Create Custom Role' })); return view; }
const posts = () => fetcher.mock.calls.filter(([url, options]) => url.endsWith('/administration/roles') && options?.method === 'POST');
it('blocks whitespace names with one inline error and no POST', async () => {
  await open(); fireEvent.change(screen.getByLabelText('Role Name *'), { target: { value: '   ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create Role' }));
  expect(screen.getAllByText('Role name is required.')).toHaveLength(1);
  expect(posts()).toHaveLength(0); expect(mocks.error).not.toHaveBeenCalled();
});
it('synchronizes group/individual switches, sends module flags through the real client, waits, and reloads the response', async () => {
  localStorage.setItem('leadcrm_roles', '[{"name":"Obsolete"}]');
  const view = await open();
  fireEvent.change(screen.getByLabelText('Role Name *'), { target: { value: ' Sales Assistant ' } });
  const contacts = screen.getByRole('switch', { name: 'Contacts & Accounts' });
  expect(contacts.getAttribute('aria-checked')).toBe('false');
  fireEvent.click(contacts);
  expect(screen.getByText('8/8')).toBeTruthy();
  fireEvent.click(screen.getByRole('switch', { name: 'View Contacts' }));
  expect(screen.getByText('7/8')).toBeTruthy(); expect(screen.getByText('Partially enabled')).toBeTruthy();
  fireEvent.click(contacts); expect(within(contacts.parentElement!.parentElement!).getByText('0/8')).toBeTruthy(); fireEvent.click(contacts);
  fireEvent.click(screen.getByRole('switch', { name: 'Deals & Pipeline' }));
  let finish!: () => void; pending = new Promise(resolve => { finish = resolve; });
  fireEvent.click(screen.getByRole('button', { name: 'Create Role' }));
  expect(mocks.success).not.toHaveBeenCalled(); expect(screen.getByRole('button', { name: 'Saving…' })).toBeTruthy();
  const [url, options] = posts()[0];
  expect(url).toBe('/api/proxy/administration/roles'); expect(options?.credentials).toBe('include');
  expect(JSON.parse(String(options?.body))).toEqual({ name: 'Sales Assistant', description: '', permissions: ['contacts', 'accounts', 'deals'].map(module => ({ module, canView: true, canCreate: true, canEdit: true, canDelete: true })) });
  await act(async () => finish()); await screen.findByText('Sales Assistant');
  expect(mocks.success).toHaveBeenCalledTimes(1); expect(localStorage.getItem('leadcrm_roles')).toBeNull();
  view.unmount(); mount(); await screen.findByText('Sales Assistant');
});
it('keeps values and permissions on server failure and allows a zero-permission role', async () => {
  await open(); fireEvent.change(screen.getByLabelText('Role Name *'), { target: { value: 'Sales Assistant' } });
  fireEvent.change(screen.getByLabelText(/Description/), { target: { value: 'Retain this' } });
  fireEvent.click(screen.getByRole('switch', { name: 'Contacts & Accounts' }));
  failure = 'A role with this name already exists.';
  fireEvent.click(screen.getByRole('button', { name: 'Create Role' }));
  await screen.findByText(failure); expect(screen.getByDisplayValue('Retain this')).toBeTruthy(); expect(screen.getByText('8/8')).toBeTruthy();
  expect(mocks.success).not.toHaveBeenCalled(); expect(savedRoles).toHaveLength(0);
  failure = ''; fireEvent.click(screen.getByRole('switch', { name: 'Contacts & Accounts' }));
  fireEvent.click(screen.getByRole('button', { name: 'Create Role' }));
  await waitFor(() => expect(savedRoles).toHaveLength(1));
  expect(JSON.parse(String(posts()[1][1]?.body)).permissions).toEqual([]);
});

it('keeps tenant-wide permissions when environment switches while CRM startup is still pending', async () => {
  holdCrm = true;
  const view = await open();
  fireEvent.click(screen.getByRole('switch', { name: 'Contacts & Accounts' }));
  mocks.environment = 'PRODUCTION';
  view.rerender(<DataProvider><RolesPermissions /></DataProvider>);
  expect(screen.getByText('8/8')).toBeTruthy();
  expect(screen.queryByText('0/0')).toBeNull();
});

it('displays effective Client Admin permissions as enabled and readonly without saving', async () => {
  savedRoles.push({ id: 'admin-role', name: 'Client Admin', tenantId: 'tenant-a', isSystemRole: true, isArchived: false, permissions: [] });
  mount(); const title = await screen.findByText('Client Admin');
  const card = title.closest<HTMLElement>('.group')!;
  fireEvent.click(within(card).getByRole('button'));
  fireEvent.click(screen.getByRole('button', { name: 'Edit Permissions' }));
  await screen.findByText('Edit Role');
  const switches = screen.getAllByRole('switch');
  expect(switches.length).toBeGreaterThan(7);
  for (const toggle of switches) {
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect((toggle as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-checked')).toBe('true');
  }
  const count = switches.length - 7;
  expect(screen.getByText(`${count} of ${count}`)).toBeTruthy();
  expect((screen.getByRole('button', { name: 'Save Changes' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.submit(screen.getByLabelText('Role Name *').closest('form')!);
  expect(fetcher.mock.calls.filter(([, options]) => ['PUT', 'POST'].includes(options?.method ?? ''))).toHaveLength(0);
});
