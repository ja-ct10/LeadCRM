import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PERMISSION_MODULES, EMPTY_PERMISSION_FLAGS } from '@leadcrm/shared';
import { DataProvider } from '@/store/DataContext';
import { RolesPermissions } from '../roles-permissions';
const mocks = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), denied: [] as string[] }));
vi.mock('@/store/AuthContext', () => ({ useAuth: () => ({
  tenant: { id: 'tenant-a' }, user: { id: 'admin', role: 'Client Admin', status: 'ACTIVE', onboardingCompletedAt: '2026-01-01' }, userCan: (module: string, action: string) => !mocks.denied.includes(`${module}.${action}`),
}) }));
vi.mock('@/lib/config', () => ({ USE_MOCK_DATA: false }));
vi.mock('sonner', () => ({ toast: mocks }));
const savedRoles: object[] = [];
let failure = '';
let pending: Promise<void> | undefined;
let holdCrm = false;
let rolesPending: Promise<void> | undefined;
const fetcher = vi.fn(async (url: string, options?: RequestInit) => {
  const path = url.split('?')[0];
  if (path.endsWith('/archive') && options?.method === 'PATCH') {
    if (pending) await pending;
    if (failure) return { ok: false, status: 409, json: async () => ({ error: failure }) };
    return { ok: true, json: async () => ({ success: true }) };
  }
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
    if (rolesPending) await rolesPending;
    return { ok: true, json: async () => ({ data: savedRoles }) };
  }
  return { ok: true, json: async () => ({ data: [], meta: { total: 0, totalPages: 0 } }) };
});
beforeEach(() => { localStorage.clear(); mocks.denied = []; savedRoles.length = 0; failure = ''; pending = undefined; rolesPending = undefined; holdCrm = false; fetcher.mockClear(); vi.clearAllMocks(); vi.stubGlobal('fetch', fetcher); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const mount = () => render(<DataProvider><RolesPermissions /></DataProvider>);
async function open() { const view = mount(); const button = await screen.findByRole('button', { name: 'Create Custom Role' }); await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false)); fireEvent.click(button); return view; }
const posts = () => fetcher.mock.calls.filter(([url, options]) => url.endsWith('/administration/roles') && options?.method === 'POST');
const deletes = () => fetcher.mock.calls.filter(([url, options]) => url.endsWith('/archive') && options?.method === 'PATCH');
const customRole = (userCount = 0) => ({ id: 'staff-role', name: 'Staff', tenantId: 'tenant-a', isSystemRole: false, isArchived: false, userCount, permissions: [] });
async function openDelete(userCount = 0) {
  savedRoles.push(customRole(userCount)); mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Actions for Staff' }));
  expect(screen.queryByRole('menuitem', { name: 'Archive Role' })).toBeNull();
  fireEvent.click(screen.getByRole('menuitem', { name: 'Delete Role' }));
  return screen.getByRole('alertdialog');
}

it('links RBAC guidance to the existing Roles & Permissions Help Center category in the same tab', () => {
  mount();
  const link = screen.getByRole('link', { name: 'Learn more about RBAC' });
  expect(link.getAttribute('href')).toBe('/help/category/roles');
  expect(link.hasAttribute('target')).toBe(false);
  expect(link.className).toContain('hover:underline');
  expect(link.className).toContain('focus-visible:ring-2');
  link.focus(); expect(document.activeElement).toBe(link);
  expect(screen.queryByRole('button', { name: 'Learn more about RBAC' })).toBeNull();
});

it.each([1, 5])('uses the server count to block deletion of a role assigned to %s users without a PATCH', async count => {
  const dialog = await openDelete(count);
  expect(within(dialog).getByText('Role cannot be deleted')).toBeTruthy();
  expect(within(dialog).getByText(`This role is currently assigned to ${count} user(s). Reassign them to another role before deleting this role.`)).toBeTruthy();
  expect(within(dialog).getByText('Users must have another role assigned before this role can be deleted.')).toBeTruthy();
  expect(within(dialog).queryByRole('button', { name: 'Delete Role' })).toBeNull();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
  expect(deletes()).toHaveLength(0);
  expect(screen.getByText('Staff')).toBeTruthy();
});

it('confirms an unassigned role with its name and keeps it active on Cancel', async () => {
  const dialog = await openDelete();
  expect(within(dialog).getByText('Delete role?')).toBeTruthy();
  expect(within(dialog).getByText('Delete "Staff"? The role will be removed from active use.')).toBeTruthy();
  expect(within(dialog).getByText('This role will no longer be available for assignment after deletion.')).toBeTruthy();
  expect(within(dialog).getByRole('button', { name: 'Delete Role' }).className).toContain('bg-red-600');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  expect(deletes()).toHaveLength(0); expect(screen.getByText('Staff')).toBeTruthy();
});

it('submits deletion exactly once while pending, closes on success and removes the role', async () => {
  const dialog = await openDelete();
  let finish!: () => void; pending = new Promise(resolve => { finish = resolve; });
  const button = within(dialog).getByRole('button', { name: 'Delete Role' });
  fireEvent.click(button); fireEvent.click(button);
  expect(button).toHaveProperty('disabled', true); expect(deletes()).toHaveLength(1);
  expect(mocks.success).not.toHaveBeenCalled();
  await act(async () => finish());
  await waitFor(() => expect(screen.queryByText('Staff')).toBeNull());
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(mocks.success).toHaveBeenCalledExactlyOnceWith('Role deleted');
});

it('retains the role and displays a backend conflict when assignment counts become stale', async () => {
  const dialog = await openDelete();
  failure = 'Role has 1 assigned user(s). Reassign users to another role before deleting.';
  fireEvent.click(within(dialog).getByRole('button', { name: 'Delete Role' }));
  expect((await screen.findByRole('alert')).textContent).toBe(failure);
  expect(screen.getByText('Staff')).toBeTruthy(); expect(mocks.success).not.toHaveBeenCalled();
});
it.each(['canCreate', 'canEdit'])('closes an open editor when %s is revoked without sending a mutation', async action => {
  savedRoles.push({ id: 'staff-role', name: 'Staff', tenantId: 'tenant-a', isSystemRole: false, isArchived: false, permissions: [] });
  const view = mount();
  await screen.findByText('Staff');
  if (action === 'canCreate') fireEvent.click(screen.getByRole('button', { name: 'Create Custom Role' }));
  else {
    fireEvent.click(screen.getByRole('button', { name: 'Actions for Staff' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit Permissions' }));
  }
  const oldForm = screen.getByLabelText('Role Name *').closest('form')!;
  mocks.denied = [`roles.${action}`];
  view.rerender(<DataProvider><RolesPermissions /></DataProvider>);
  expect(screen.queryByLabelText('Role Name *')).toBeNull();
  fireEvent.submit(oldForm);
  expect(fetcher.mock.calls.filter(([, options]) => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(options?.method ?? ''))).toHaveLength(0);
});
it('dismisses a deletion confirmation when Archive is revoked and denies the section without View', async () => {
  savedRoles.push({ id: 'staff-role', name: 'Staff', tenantId: 'tenant-a', isSystemRole: false, isArchived: false, permissions: [] });
  const view = mount(); await screen.findByText('Staff');
  fireEvent.click(screen.getByRole('button', { name: 'Actions for Staff' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Delete Role' }));
  expect(screen.getByText('Delete role?')).toBeTruthy();
  mocks.denied = ['roles.canArchive']; view.rerender(<DataProvider><RolesPermissions /></DataProvider>);
  expect(screen.queryByText('Delete role?')).toBeNull();
  mocks.denied = ['roles.canView']; view.rerender(<DataProvider><RolesPermissions /></DataProvider>);
  expect(screen.getByRole('alert').textContent).toContain('permission');
  expect(screen.queryByText('Staff')).toBeNull();
});
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
  const contacts = screen.getByRole('switch', { name: 'Contacts' });
  expect(contacts.getAttribute('aria-checked')).toBe('false');
  fireEvent.click(contacts);
  expect(screen.getByText('5/5')).toBeTruthy();
  fireEvent.click(screen.getByRole('switch', { name: 'Edit Contacts' }));
  expect(screen.getByText('4/5')).toBeTruthy(); expect(screen.getByText('Partially enabled')).toBeTruthy();
  fireEvent.click(contacts); expect(within(contacts.parentElement!.parentElement!).getByText('0/5')).toBeTruthy(); fireEvent.click(contacts);
  fireEvent.click(screen.getByRole('switch', { name: 'Deals' }));
  let finish!: () => void; pending = new Promise(resolve => { finish = resolve; });
  fireEvent.click(screen.getByRole('button', { name: 'Create Role' }));
  expect(mocks.success).not.toHaveBeenCalled(); expect(screen.getByRole('button', { name: 'Saving…' })).toBeTruthy();
  const [url, options] = posts()[0];
  expect(url).toBe('/api/proxy/administration/roles'); expect(options?.credentials).toBe('include');
  expect(JSON.parse(String(options?.body))).toEqual({ name: 'Sales Assistant', description: '', permissions: ['contacts', 'deals'].map(module => ({ ...EMPTY_PERMISSION_FLAGS, module, ...Object.fromEntries(PERMISSION_MODULES.find(row => row.key === module)!.actions.map(action => [action, true])) })) });
  await act(async () => finish()); await screen.findByText('Sales Assistant');
  expect(mocks.success).toHaveBeenCalledTimes(1); expect(localStorage.getItem('leadcrm_roles')).toBeNull();
  view.unmount(); mount(); await screen.findByText('Sales Assistant');
});
it('keeps values and permissions on server failure and allows a zero-permission role', async () => {
  await open(); fireEvent.change(screen.getByLabelText('Role Name *'), { target: { value: 'Sales Assistant' } });
  fireEvent.change(screen.getByLabelText(/Description/), { target: { value: 'Retain this' } });
  fireEvent.click(screen.getByRole('switch', { name: 'Contacts' }));
  failure = 'A role with this name already exists.';
  fireEvent.click(screen.getByRole('button', { name: 'Create Role' }));
  await screen.findByText(failure); expect(screen.getByDisplayValue('Retain this')).toBeTruthy(); expect(screen.getByText('5/5')).toBeTruthy();
  expect(mocks.success).not.toHaveBeenCalled(); expect(savedRoles).toHaveLength(0);
  failure = ''; fireEvent.click(screen.getByRole('switch', { name: 'Contacts' }));
  fireEvent.click(screen.getByRole('button', { name: 'Create Role' }));
  await waitFor(() => expect(savedRoles).toHaveLength(1));
  expect(JSON.parse(String(posts()[1][1]?.body)).permissions).toEqual([]);
});


it('keeps protected actions visible and disabled without navigation or requests', async () => {
  savedRoles.push({ id: 'admin-role', name: 'Client Admin', tenantId: 'tenant-a', isSystemRole: true, isArchived: false, permissions: [] });
  mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Actions for Client Admin' }));
  const callsBefore = fetcher.mock.calls.length;
  for (const name of ['Edit Permissions', 'Delete Role']) {
    const action = screen.getByRole('menuitem', { name });
    expect(action.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(action);
    fireEvent.keyDown(action, { key: 'Enter' });
    fireEvent.keyDown(action, { key: ' ' });
  }
  expect(screen.queryByText('Edit Role')).toBeNull();
  expect(screen.queryByText('Delete role?')).toBeNull();
  expect(fetcher.mock.calls.length).toBe(callsBefore);
  expect(screen.getByRole('menuitem', { name: 'Duplicate Role' }).getAttribute('aria-disabled')).toBe('false');
  expect(screen.queryByText('perms')).toBeNull();
  expect(screen.getByText('permissions')).toBeTruthy();
});

it('toggles a role menu with a full pointer sequence, dismisses it, and opens only one role at a time', async () => {
  savedRoles.push(...['First', 'Second'].map(name => ({ id: name, name, tenantId: 'tenant-a', isSystemRole: false, isArchived: false, permissions: [] })));
  mount();
  const first = await screen.findByRole('button', { name: 'Actions for First' });
  const second = screen.getByRole('button', { name: 'Actions for Second' });
  const click = (element: HTMLElement) => { fireEvent.mouseDown(element); fireEvent.mouseUp(element); fireEvent.click(element); };
  click(first); expect(screen.getAllByRole('menu')).toHaveLength(1);
  click(first); expect(screen.queryByRole('menu')).toBeNull();
  click(first); click(second);
  expect(screen.getAllByRole('menu')).toHaveLength(1);
  expect(screen.getByRole('menu', { name: 'Actions for Second' })).toBeTruthy();
  expect(first.getAttribute('aria-expanded')).toBe('false');
  fireEvent.keyDown(document, { key: 'Escape' }); expect(screen.queryByRole('menu')).toBeNull();
  expect(document.activeElement).toBe(second);
  click(first); fireEvent.mouseDown(document.body); expect(screen.queryByRole('menu')).toBeNull();
  click(first); fireEvent.click(screen.getByRole('menuitem', { name: 'Edit Permissions' }));
  expect(screen.getByText('Edit Role')).toBeTruthy();
  expect(screen.queryByRole('menu')).toBeNull();
});

it('shows card-shaped skeletons while loading, then roles or the empty state', async () => {
  let finish!: () => void; rolesPending = new Promise(resolve => { finish = resolve; });
  mount();
  const skeleton = await screen.findByRole('status', { name: 'Loading roles and permissions' });
  expect(skeleton.querySelectorAll('[aria-hidden="true"]')).toHaveLength(3);
  expect(skeleton.querySelectorAll('button')).toHaveLength(0);
  expect(screen.queryByText('Loading roles and permissions…')).toBeNull();
  await act(async () => finish()); await screen.findByText('No roles yet.');
  expect(screen.queryByRole('status', { name: 'Loading roles and permissions' })).toBeNull();
});
