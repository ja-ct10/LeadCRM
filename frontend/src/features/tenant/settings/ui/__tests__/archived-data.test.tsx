import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ArchivedData } from '../archived-data';
import { clearPageCache } from '@/shared/cache/page-cache';

const state = vi.hoisted(() => ({ canEdit: true, success: vi.fn(), error: vi.fn() }));
vi.mock('@/store/AuthContext', () => ({ useAuth: () => ({ tenant: { id: 'tenant-a' }, user: { id: 'user-a', role: 'Client Admin', activeEnvironment: 'PRODUCTION' } }) }));
vi.mock('@/store/DataContext', () => ({ useData: () => ({ deals: [], pipelines: [], workflows: [], campaigns: [], templates: [], users: [], roles: [], restoreRecord: vi.fn() }) }));
vi.mock('@/shared/hooks/use-permissions', () => ({ useHasPermission: (permission: string) => !permission.endsWith('.edit') || state.canEdit }));
vi.mock('sonner', () => ({ toast: { success: state.success, error: state.error } }));

let restored: Set<string>;
let failRestore = false;
const request = vi.fn(async (url: string, options: RequestInit) => {
  const path = new URL(url, 'http://localhost');
  const module = path.pathname.split('/')[4];
  if (options.method === 'PATCH') {
    if (failRestore) return new Response(JSON.stringify({ error: 'Permission denied' }), { status: 403 });
    restored.add(module);
    return new Response(JSON.stringify({ success: true }));
  }
  let rows: object[] = [];
  if (!restored.has(module)) {
    if (module === 'leads') rows = [{ id: path.searchParams.get('page') === '2' ? 'second-lead-id' : 'lead-id', firstName: path.searchParams.get('page') === '2' ? 'Second' : 'Saved', lastName: 'Lead', email: 'lead@example.com' }];
    if (module === 'contacts') rows = [{ id: 'contact-id', firstName: 'Saved', lastName: 'Contact', email: 'contact@example.com' }];
    if (module === 'accounts') rows = [{ id: 'account-id', name: 'Saved Account', city: 'Taguig City' }];
  }
  return new Response(JSON.stringify({ success: true, data: rows, meta: { total: rows.length, page: 1, limit: 100, hasMore: module === 'leads' && path.searchParams.get('page') === '1' && rows.length > 0 } }));
});
beforeEach(() => {
  clearPageCache(); restored = new Set(); failRestore = false; state.canEdit = true;
  vi.clearAllMocks(); vi.stubGlobal('fetch', request);
});
afterEach(() => { cleanup(); clearPageCache(); vi.unstubAllGlobals(); });

it('loads all pages of Lead, Contact and Account archives from the backend on every mount', async () => {
  const view = render(<ArchivedData />);
  await screen.findByText('Saved Lead');
  expect(screen.getByText('Second Lead')).toBeTruthy();
  expect(screen.getByText('Saved Contact')).toBeTruthy();
  expect(screen.getByText('Saved Account')).toBeTruthy();
  expect(screen.getByText('Taguig City')).toBeTruthy();
  expect(request.mock.calls.every(([url]) => url.includes('archived=true'))).toBe(true);
  const count = request.mock.calls.length;
  view.unmount(); render(<ArchivedData />);
  await waitFor(() => expect(request.mock.calls.length).toBeGreaterThan(count));
});
it.each([['Lead', 'leads'], ['Contact', 'contacts'], ['Account', 'accounts']])('restores a %s through its exact backend route and removes it', async (label, module) => {
  render(<ArchivedData />);
  const name = await screen.findByText(`Saved ${label}`);
  fireEvent.click(within(name.parentElement!.parentElement!).getByRole('button', { name: 'Restore' }));
  await waitFor(() => expect(screen.queryByText(`Saved ${label}`)).toBeNull());
  expect(request.mock.calls.some(([url, options]) => url === `/api/proxy/crm/${module}/${label.toLowerCase()}-id/restore` && options.method === 'PATCH')).toBe(true);
  expect(state.success).toHaveBeenCalledWith(`${label} restored`);
});
it('keeps the archive visible and reports failure when restore is rejected', async () => {
  failRestore = true; render(<ArchivedData />);
  const name = await screen.findByText('Saved Contact');
  fireEvent.click(within(name.parentElement!.parentElement!).getByRole('button', { name: 'Restore' }));
  await waitFor(() => expect(state.error).toHaveBeenCalledWith('Permission denied'));
  expect(screen.getByText('Saved Contact')).toBeTruthy();
  expect(state.success).not.toHaveBeenCalled();
});
it('disables restore for a viewer without edit permission', async () => {
  state.canEdit = false; render(<ArchivedData />);
  await screen.findByText('Saved Lead');
  for (const button of screen.getAllByRole('button', { name: 'Restore' })) expect((button as HTMLButtonElement).disabled).toBe(true);
});
