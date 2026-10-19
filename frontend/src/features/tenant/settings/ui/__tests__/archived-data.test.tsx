import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ArchivedData } from '../archived-data';
import { clearPageCache } from '@/shared/cache/page-cache';
import type { ArchivedRecord } from '@leadcrm/shared';
import { ARCHIVE_TYPES } from '@leadcrm/shared';
import { useProductInterests } from '@/shared/hooks/use-product-interests';

const state = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), tenantId: 'tenant-a', userId: 'user-a', canRestore: true }));
vi.mock('@/store/AuthContext', () => ({ useAuth: () => ({ tenant: { id: state.tenantId }, userCan: () => state.canRestore, user: { id: state.userId, tenantId: state.tenantId, role: 'Client Admin' } }) }));
vi.mock('sonner', () => ({ toast: { success: state.success, error: state.error } }));
vi.mock('@/store/DataContext', () => ({ useData: () => ({ refreshRoles: vi.fn(), refreshPipelines: vi.fn(), refreshDeals: vi.fn(), refreshOrganizations: vi.fn() }) }));
let rows: ArchivedRecord[];
let failIds: Set<string>;
let failFetch: boolean;
let failureStatus: number, failureMessage: string;
let activeProducts: Array<{ id: string; name: string; dealValue: number; active: boolean; createdAt: string; updatedAt: string }>;
const request = vi.fn(async (url: string, options: RequestInit) => {
  const path = new URL(url, 'http://localhost');
  if (options.method === 'PATCH') {
    const id = path.pathname.split('/').at(-2)!;
    if (failIds.has(id)) return new Response(JSON.stringify({ error: failureMessage }), { status: failureStatus });
    const product = rows.find(row => row.id === id && row.type === 'Product');
    if (product) activeProducts.push({ id, name: product.name, dealValue: 5000.25, active: true, createdAt: '', updatedAt: '' });
    rows = rows.filter(row => row.id !== id);
    return new Response(JSON.stringify({ success: true }));
  }
  if (path.pathname.endsWith('/product-interests')) return new Response(JSON.stringify({ data: activeProducts, meta: { enabled: true } }));
  if (failFetch) return new Response(JSON.stringify({ error: 'Fetch failed' }), { status: 500 });
  const filtered = rows.filter(row => (!path.searchParams.get('type') || row.type === path.searchParams.get('type')) && row.name.toLowerCase().includes((path.searchParams.get('search') || '').toLowerCase()));
  const page = Number(path.searchParams.get('page')), limit = Number(path.searchParams.get('limit'));
  return new Response(JSON.stringify({ success: true, data: filtered.slice((page - 1) * limit, page * limit), meta: { total: filtered.length, page, limit, hasMore: page * limit < filtered.length } }));
});
beforeEach(() => {
  clearPageCache(); failIds = new Set(); failFetch = false;
  failureStatus = 403; failureMessage = 'Permission denied'; activeProducts = [];
  state.tenantId = 'tenant-a'; state.userId = 'user-a'; state.canRestore = true;
  rows = (['Lead', 'Contact', 'Account'] as const).map(type => ({ id: type.toLowerCase() + '-id', type, name: 'Saved ' + type, detail: type + '@example.com', archivedAt: type === 'Lead' ? '2026-09-01T00:00:00.000Z' : null, canRestore: true }));
  vi.clearAllMocks(); vi.stubGlobal('fetch', request);
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); clearPageCache(); vi.unstubAllGlobals(); });
const confirm = () => fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: /^Restore/ }));
const writes = () => request.mock.calls.filter(([, options]) => options.method === 'PATCH');
const removeButton = () => screen.getByRole('button', { name: 'Remove selected archived records from view' });
const floatingDeleteButton = () => within(screen.getByRole('toolbar', { name: 'Selected row actions' })).getByRole('button', { name: 'Delete' });
const deleteButton = (source: 'toolbar' | 'selection') => source === 'toolbar' ? removeButton() : floatingDeleteButton();
const confirmDelete = () => fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }));
const mutations = () => request.mock.calls.filter(([, options]) => options.method !== 'GET');

it.each(ARCHIVE_TYPES)('filters %s and returns to all supported records through the shared tabs', async type => {
  rows = ARCHIVE_TYPES.map(kind => ({ type: kind, id: kind.toLowerCase(), name: `Saved ${kind}`, detail: '', archivedAt: null, canRestore: true }));
  render(<ArchivedData />); await screen.findByText('Saved Lead');
  fireEvent.click(screen.getByRole('button', { name: type }));
  await waitFor(() => expect(within(screen.getByRole('grid')).getAllByRole('button', { name: 'Restore' })).toHaveLength(1));
  expect(screen.getByRole('button', { name: type, pressed: true })).toBeTruthy();
  expect(request.mock.calls.some(([url]) => new URL(url, 'http://localhost').searchParams.get('type') === type)).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'All' }));
  await waitFor(() => expect(within(screen.getByRole('grid')).getAllByRole('button', { name: 'Restore' })).toHaveLength(ARCHIVE_TYPES.length));
});

it('uses the shared grid, actual timestamp and one scrolling filter row', async () => {
  render(<ArchivedData />);
  expect(screen.getByRole('status').querySelector('.animate-spin')).toBeTruthy();
  expect(screen.getByText('Archived Data Recovery')).toBeTruthy();
  const filters = screen.getByRole('group', { name: 'Archived record types' });
  expect(within(filters).getAllByRole('button').map(button => button.textContent)).toEqual(['All', 'Lead', 'Contact', 'Account', 'Deal', 'Product', 'User', 'Task', 'Campaign', 'Workflow']);
  expect(filters.className).toContain('overflow-x-auto');
  expect(filters.className).toContain('flex-nowrap');
  expect(filters.className).toContain('border-b');
  expect(within(filters).getByRole('button', { name: 'All', pressed: true }).querySelector('[aria-hidden]')?.className).toContain('bg-primary');
  expect(within(filters).queryByRole('button', { name: 'Role' })).toBeNull();
  const primary = screen.getByRole('toolbar', { name: 'Archived records controls' });
  expect(within(primary).getByRole('textbox', { name: 'Search archived records' })).toBeTruthy();
  expect(within(primary).getByRole('button', { name: 'Refresh' })).toBeTruthy();
  await screen.findByText('Saved Lead');
  expect(screen.getByRole('grid')).toBeTruthy();
  expect(screen.getAllByRole('checkbox')).toHaveLength(4);
  expect(screen.getByRole('columnheader', { name: 'Archived On' })).toBeTruthy();
  expect(screen.getAllByRole('button', { name: 'Restore' })[0].textContent).toBe('');
});

it('places the red shared icon button immediately before Refresh and enables it only for selected rows', async () => {
  render(<ArchivedData />);
  expect(removeButton()).toHaveProperty('disabled', true);
  await screen.findByText('Saved Lead');
  const button = removeButton(), refresh = screen.getByRole('button', { name: 'Refresh' });
  expect(button.nextElementSibling).toBe(refresh);
  expect(button.getAttribute('title')).toBe('Remove from list');
  expect(button.querySelector('svg')?.classList.contains('text-destructive')).toBe(true);
  for (const control of [button, refresh]) {
    expect(control.className).toContain('min-w-11');
    expect(control.className).toContain('min-h-11');
    expect(control.className).toContain('p-1.5');
    expect(control.className).toContain('rounded-lg');
  }
  fireEvent.click(button);
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(screen.queryByRole('toolbar', { name: 'Selected row actions' })).toBeNull();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select record Lead-lead-id' }));
  expect(button).toHaveProperty('disabled', false);
  const selectionBar = screen.getByRole('toolbar', { name: 'Selected row actions' });
  const restore = within(selectionBar).getByRole('button', { name: 'Restore' });
  expect(restore.nextElementSibling).toBe(floatingDeleteButton());
  expect(floatingDeleteButton()).toHaveProperty('disabled', false);
  expect(floatingDeleteButton().className).toContain('bg-rose-600');
  expect(floatingDeleteButton().className).toContain('rounded-lg');
  fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
  expect(button).toHaveProperty('disabled', true);
  expect(screen.queryByRole('toolbar', { name: 'Selected row actions' })).toBeNull();
});

it.each(['toolbar', 'selection'] as const)('uses standard singular Delete confirmation, cancels unchanged, and removes only the selected UI row (%s)', async source => {
  const original = structuredClone(rows);
  render(<ArchivedData />); await screen.findByText('Saved Lead');
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select record Lead-lead-id' }));
  fireEvent.click(deleteButton(source));
  let dialog = screen.getByRole('alertdialog');
  expect(within(dialog).getByRole('heading', { name: 'Delete archived record?' })).toBeTruthy();
  expect(within(dialog).getByText('Are you sure you want to delete this archived record?')).toBeTruthy();
  expect(dialog.textContent).not.toContain('cannot be undone');
  expect(within(dialog).getByRole('button', { name: 'Delete' }).className).toContain('bg-red-600');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  expect(screen.getByText('Saved Lead')).toBeTruthy();
  expect(screen.getByRole('checkbox', { name: 'Select record Lead-lead-id' })).toHaveProperty('checked', true);
  expect(screen.getByText('1 selected')).toBeTruthy();
  fireEvent.click(deleteButton(source));
  dialog = screen.getByRole('alertdialog');
  const readsBefore = request.mock.calls.length;
  confirmDelete();
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  expect(screen.queryByText('Saved Lead')).toBeNull();
  expect(screen.getByText('Saved Contact')).toBeTruthy();
  expect(screen.getByText('Saved Account')).toBeTruthy();
  expect(screen.queryByRole('toolbar', { name: 'Selected row actions' })).toBeNull();
  expect(screen.getAllByRole('checkbox').every(checkbox => !(checkbox as HTMLInputElement).checked)).toBe(true);
  expect(removeButton()).toHaveProperty('disabled', true);
  expect(screen.getByRole('columnheader', { name: 'Archived On' })).toBeTruthy();
  expect(rows).toEqual(original);
  expect(request.mock.calls).toHaveLength(readsBefore);
  expect(mutations()).toHaveLength(0);
  expect(state.success).not.toHaveBeenCalled();
});

it.each(['toolbar', 'selection'] as const)('removes multiple selected records using plural wording and keeps matching IDs of other types (%s)', async source => {
  rows = rows.map(record => ({ ...record, id: 'same-id' }));
  const original = structuredClone(rows);
  render(<ArchivedData />); await screen.findByText('Saved Lead');
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select record Lead-same-id' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select record Account-same-id' }));
  fireEvent.click(deleteButton(source));
  expect(screen.getByText('Are you sure you want to delete the selected archived records?')).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Delete archived records?' })).toBeTruthy();
  confirmDelete();
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  expect(screen.queryByText('Saved Lead')).toBeNull();
  expect(screen.queryByText('Saved Account')).toBeNull();
  expect(screen.getByText('Saved Contact')).toBeTruthy();
  expect(rows).toEqual(original);
  expect(mutations()).toHaveLength(0);
});

it.each(['All', ...ARCHIVE_TYPES] as const)('temporarily removes selected records from the %s tab', async type => {
  rows = ARCHIVE_TYPES.map(kind => ({ type: kind, id: kind.toLowerCase(), name: `Saved ${kind}`, detail: '', archivedAt: null, canRestore: true }));
  render(<ArchivedData />); await screen.findByText('Saved Lead');
  if (type !== 'All') {
    fireEvent.click(screen.getByRole('button', { name: type }));
    await waitFor(() => expect(within(screen.getByRole('grid')).getAllByRole('button', { name: 'Restore' })).toHaveLength(1));
  }
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select all records' }));
  fireEvent.click(removeButton()); confirmDelete();
  await screen.findByText('No archived records found.');
  expect(screen.getByRole('button', { name: type, pressed: true })).toBeTruthy();
  expect(screen.queryByRole('toolbar', { name: 'Selected row actions' })).toBeNull();
  expect(rows).toHaveLength(ARCHIVE_TYPES.length);
  expect(mutations()).toHaveLength(0);
});

it('retains hidden rows through tabs, search, toolbar refresh and background refresh', async () => {
  render(<ArchivedData />); await screen.findByText('Saved Lead');
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select record Lead-lead-id' }));
  fireEvent.click(removeButton()); confirmDelete();
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  fireEvent.click(screen.getByRole('button', { name: 'Contact' }));
  await screen.findByText('Saved Contact');
  fireEvent.click(screen.getByRole('button', { name: 'All' }));
  await screen.findByText('Saved Account');
  expect(screen.queryByText('Saved Lead')).toBeNull();
  const input = screen.getByRole('textbox', { name: 'Search archived records' });
  fireEvent.change(input, { target: { value: 'Lead' } });
  await screen.findByText('No archived records found.');
  expect(input).toHaveProperty('value', 'Lead');
  fireEvent.change(input, { target: { value: 'Saved' } });
  await screen.findByText('Saved Contact');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh' })).toHaveProperty('disabled', false));
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh' })).toHaveProperty('disabled', false));
  const readsBeforeFocus = request.mock.calls.length;
  fireEvent(window, new Event('focus'));
  await waitFor(() => expect(request.mock.calls.length).toBeGreaterThan(readsBeforeFocus));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh' })).toHaveProperty('disabled', false));
  expect(screen.queryByText('Saved Lead')).toBeNull();
  expect(screen.getByText('Saved Contact')).toBeTruthy();
  expect(input).toHaveProperty('value', 'Saved');
  expect(screen.getByRole('button', { name: 'All', pressed: true })).toBeTruthy();
  expect(request.mock.calls.every(([url]) => url.includes('sortBy=archivedAt') && url.includes('sortOrder=desc'))).toBe(true);
  expect(mutations()).toHaveLength(0);
});

it('keeps server page boundaries after partial removal and steps backward through emptied pages', async () => {
  rows = Array.from({ length: 51 }, (_, index) => ({ ...rows[0], id: String(index), name: `Lead ${index}` }));
  render(<ArchivedData />); await screen.findByText('Lead 0');
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select record Lead-0' }));
  fireEvent.click(removeButton()); confirmDelete();
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  expect(screen.getByText('Page 1 of 3')).toBeTruthy();
  expect(screen.getAllByRole('checkbox')).toHaveLength(25);
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
  await screen.findByText('Lead 25');
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select all records' }));
  fireEvent.click(removeButton()); confirmDelete();
  await screen.findByText('Lead 1');
  expect(screen.getByText('Page 1 of 3')).toBeTruthy();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Records per page' })).toHaveProperty('disabled', false));
  expect(screen.queryByText('Lead 0')).toBeNull();
  // Empty server pages remain navigable so later, unhidden rows stay reachable.
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
  await screen.findByText('No archived records found.');
  expect(screen.getByText('Page 2 of 3')).toBeTruthy();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Next page' })).toHaveProperty('disabled', false));
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
  await screen.findByText('Lead 50');
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select all records' }));
  fireEvent.click(removeButton()); confirmDelete();
  await screen.findByText('Lead 1');
  expect(screen.getByText('Page 1 of 3')).toBeTruthy();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Records per page' })).toHaveProperty('disabled', false));
  fireEvent.click(screen.getByRole('button', { name: 'Records per page' }));
  fireEvent.click(screen.getByRole('option', { name: '10' }));
  await screen.findByText('Page 1 of 6');
  await screen.findByText('Lead 1');
  expect(screen.queryByText('Lead 0')).toBeNull();
  expect(rows).toHaveLength(51);
  expect(mutations()).toHaveLength(0);
});

it.each(['tenant', 'user', 'remount'] as const)('resets exclusions and pending Delete confirmation on %s change', async change => {
  const view = render(<ArchivedData />); await screen.findByText('Saved Lead');
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select record Lead-lead-id' }));
  fireEvent.click(floatingDeleteButton()); confirmDelete();
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select record Contact-contact-id' }));
  fireEvent.click(removeButton());
  if (change === 'remount') { view.unmount(); render(<ArchivedData />); }
  else {
    if (change === 'tenant') state.tenantId = 'tenant-b';
    else state.userId = 'user-b';
    view.rerender(<ArchivedData />);
  }
  await screen.findByText('Saved Lead');
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(removeButton()).toHaveProperty('disabled', true);
  expect(mutations()).toHaveLength(0);
});

it('keeps removal separate from Restore permissions and disables removal while refreshing or restoring', async () => {
  state.canRestore = false;
  const view = render(<ArchivedData />); await screen.findByText('Saved Lead');
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select record Lead-lead-id' }));
  expect(removeButton()).toHaveProperty('disabled', false);
  expect(floatingDeleteButton()).toHaveProperty('disabled', false);
  let finish!: (response: Response) => void;
  request.mockReturnValueOnce(new Promise(done => { finish = done; }));
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
  expect(removeButton()).toHaveProperty('disabled', true);
  expect(floatingDeleteButton()).toHaveProperty('disabled', true);
  await act(async () => finish(new Response(JSON.stringify({ data: rows, meta: { total: rows.length, page: 1, limit: 25 } }))));
  expect(removeButton()).toHaveProperty('disabled', false);
  expect(floatingDeleteButton()).toHaveProperty('disabled', false);
  state.canRestore = true; view.rerender(<ArchivedData />);
  const remove = removeButton();
  const floatingDelete = floatingDeleteButton();
  request.mockReturnValueOnce(new Promise(done => { finish = done; }));
  fireEvent.click(within(screen.getByRole('grid')).getAllByRole('button', { name: 'Restore' })[0]); confirm();
  expect(remove).toHaveProperty('disabled', true);
  expect(floatingDelete).toHaveProperty('disabled', true);
  await act(async () => finish(new Response(JSON.stringify({ success: true }))));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
});

it('restores the remaining visible rows after UI removal without restoring the hidden row', async () => {
  render(<ArchivedData />); await screen.findByText('Saved Lead');
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select record Lead-lead-id' }));
  fireEvent.click(removeButton()); confirmDelete();
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select all records' }));
  fireEvent.click(screen.getByText('Restore', { selector: 'button' })); confirm();
  await screen.findByText('No archived records found.');
  expect(writes()).toHaveLength(2);
  expect(writes().every(([url]) => !url.includes('/leads/'))).toBe(true);
  expect(rows.map(record => record.name)).toEqual(['Saved Lead']);
});

it.each([
  ['Lead', 'crm/leads'], ['Contact', 'crm/contacts'], ['Account', 'crm/accounts'], ['Deal', 'crm/deals'], ['Product', 'administration/archived-data/Product'], ['User', 'administration/users'], ['Task', 'administration/archived-data/Task'], ['Campaign', 'administration/archived-data/Campaign'], ['Workflow', 'administration/archived-data/Workflow'],
])('confirms %s restoration using its configured endpoint', async (label, route) => {
  rows = [{ ...rows[0], id: label.toLowerCase() + '-id', type: label as ArchivedRecord['type'], name: 'Saved ' + label }];
  render(<ArchivedData />); await screen.findByText('Saved ' + label);
  fireEvent.click(within(screen.getByRole('grid')).getByRole('button', { name: 'Restore' }));
  expect(writes()).toHaveLength(0);
  expect(screen.getByText('This record will be restored to its original module.')).toBeTruthy();
  confirm();
  await waitFor(() => expect(screen.queryByText('Saved ' + label)).toBeNull());
  expect(writes()[0][0]).toBe('/api/proxy/' + route + '/' + label.toLowerCase() + '-id/restore');
  expect(state.success).toHaveBeenCalledWith(label + ' restored');
});

it('cancel and Escape do not restore; dialog traps focus and restores it', async () => {
  render(<ArchivedData />); await screen.findByText('Saved Lead');
  const button = screen.getAllByRole('button', { name: 'Restore' })[0];
  button.focus(); fireEvent.click(button);
  const dialog = screen.getByRole('alertdialog');
  expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Cancel' }));
  within(dialog).getByRole('button', { name: 'Close confirmation' }).focus();
  fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
  expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Restore' }));
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(document.activeElement).toBe(button);
  expect(writes()).toHaveLength(0);
});

it('selects, deselects and restores all visible records only after bulk confirmation', async () => {
  render(<ArchivedData />); await screen.findByText('Saved Lead');
  const all = screen.getByRole('checkbox', { name: 'Select all records' }) as HTMLInputElement;
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select record Lead-lead-id' }));
  expect(all.indeterminate).toBe(true);
  fireEvent.click(all); expect(screen.getByText('3 selected')).toBeTruthy();
  fireEvent.click(all); expect(screen.queryByRole('group', { name: 'Bulk restore' })).toBeNull();
  fireEvent.click(all); fireEvent.click(screen.getByText('Restore', { selector: 'button' }));
  expect(writes()).toHaveLength(0);
  expect(screen.getByText('This will restore 3 archived records to their original modules.')).toBeTruthy();
  confirm();
  await screen.findByText('No archived records found.');
  expect(writes()).toHaveLength(3);
  expect(state.success).toHaveBeenCalledWith('3 records restored');
});

it('keeps failed records and reports partial bulk results accurately', async () => {
  failIds.add('contact-id');
  render(<ArchivedData />); await screen.findByText('Saved Lead');
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select all records' }));
  fireEvent.click(screen.getByText('Restore', { selector: 'button' })); confirm();
  await waitFor(() => expect(state.error).toHaveBeenCalledWith('1 record could not be restored. Permission denied'));
  expect(state.success).toHaveBeenCalledWith('2 records restored');
  expect(screen.getByText('Saved Contact')).toBeTruthy();
  expect(screen.getByText('1 selected')).toBeTruthy();
  expect(screen.queryByText('Saved Lead')).toBeNull();
});

it('retains a rejected individual restore and disables forbidden actions', async () => {
  failIds.add('lead-id'); rows[1].canRestore = false;
  render(<ArchivedData />); await screen.findByText('Saved Lead');
  expect((screen.getAllByRole('button', { name: 'Restore' })[1] as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getAllByRole('button', { name: 'Restore' })[0]); confirm();
  await waitFor(() => expect(state.error).toHaveBeenCalledWith('Permission denied'));
  expect(screen.getByText('Saved Lead')).toBeTruthy();
  expect(state.success).not.toHaveBeenCalled();
  expect(screen.getByRole('alertdialog').textContent).toContain('Permission denied');
});

it('clears selection on filter/page changes, uses backend pagination and omits absent timestamps', async () => {
  rows = Array.from({ length: 26 }, (_, index) => ({ ...rows[0], id: String(index), name: 'Lead ' + index, archivedAt: null }));
  render(<ArchivedData />); await screen.findByText('Lead 0');
  expect(screen.queryByRole('columnheader', { name: 'Archived On' })).toBeNull();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select all records' }));
  expect(screen.getByText('25 selected')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
  await screen.findByText('Lead 25');
  expect(screen.queryByRole('group', { name: 'Bulk restore' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Contact' }));
  await screen.findByText('No archived records found.');
  expect(request.mock.calls.some(([url]) => url.includes('type=Contact') && url.includes('page=1'))).toBe(true);
});

it('shows a fetch error with retry and recovers', async () => {
  failFetch = true; render(<ArchivedData />);
  await screen.findByRole('alert');
  expect(screen.queryByText('No archived records found.')).toBeNull();
  failFetch = false; fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await screen.findByText('Saved Lead');
});

it('retains archived rows, pagination and checkbox selection during a failed refresh', async () => {
  render(<ArchivedData />); await screen.findByText('Saved Lead');
  const checkbox = screen.getByRole('checkbox', { name: 'Select record Lead-lead-id' }) as HTMLInputElement;
  fireEvent.click(checkbox);
  let finish!: (response: Response) => void;
  request.mockReturnValueOnce(new Promise(done => { finish = done; }));
  fireEvent.click(screen.getByRole('button', { name: /^Refresh$/ }));
  expect(within(screen.getByRole('region', { name: 'Archived data grid' })).getByRole('status', { name: 'Refreshing data...' })).toBeTruthy();
  expect(screen.getByText('Saved Lead')).toBeTruthy();
  expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeTruthy();
  expect(checkbox.checked).toBe(true);
  await act(async () => finish(new Response(JSON.stringify({ error: 'Refresh failed' }), { status: 500 })));
  await screen.findByRole('alert');
  expect(screen.queryByRole('status', { name: 'Refreshing data...' })).toBeNull();
  expect(checkbox.checked).toBe(true);
  expect(screen.getByText('Saved Lead')).toBeTruthy();
  expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeTruthy();
});

it('searches server records beyond the visible page and resets pagination', async () => {
  rows = Array.from({ length: 26 }, (_, i) => ({ ...rows[0], id: String(i), name: i === 25 ? 'Needle campaign' : `Lead ${i}`, type: i === 25 ? 'Campaign' : 'Lead' }));
  render(<ArchivedData />); await screen.findByText('Lead 0');
  expect(screen.queryByText('Needle campaign')).toBeNull();
  fireEvent.change(screen.getByRole('textbox', { name: 'Search archived records' }), { target: { value: 'Needle' } });
  expect(screen.getByText('Loading archived records...').parentElement?.querySelector('.animate-spin')).toBeTruthy();
  expect(screen.getByRole('group', { name: 'Archived record types' })).toBeTruthy();
  await screen.findByText('Needle campaign');
  expect(request.mock.calls.some(([url]) => url.includes('search=Needle') && url.includes('page=1'))).toBe(true);
  expect(screen.queryByText('Lead 0')).toBeNull();
});

const savedProduct = (id = 'product-id'): ArchivedRecord => ({ type: 'Product', id, name: `CCTV Surveillance System ${id}`, detail: '₱5,000.25', archivedAt: '2026-10-14T10:00:00.000Z', canRestore: true });

it('requests type=Product and renders Product details, timestamp and the existing restore action', async () => {
  rows.push(savedProduct());
  render(<ArchivedData />); await screen.findByText('Saved Lead');
  fireEvent.click(screen.getByRole('button', { name: /^Product$/ }));
  await screen.findByText(savedProduct().name);
  await waitFor(() => expect(screen.queryByText('Saved Lead')).toBeNull());
  const grid = screen.getByRole('grid');
  expect(within(grid).getByText('Product', { exact: true })).toBeTruthy();
  expect(within(grid).getByText('₱5,000.25')).toBeTruthy();
  expect(within(grid).getByText(new Date(savedProduct().archivedAt!).toLocaleString())).toBeTruthy();
  expect(within(grid).getByRole('button', { name: 'Restore' })).toBeTruthy();
  expect(request.mock.calls.some(([url]) => new URL(url, 'http://localhost').searchParams.get('type') === 'Product')).toBe(true);
});

function ActiveCatalog() {
  const { products } = useProductInterests();
  return <div data-testid="active-catalog">Catalog: {products.map(product => product.name).join(', ')}</div>;
}

it('refreshes an already-mounted active Product catalog through product-interests-changed', async () => {
  rows = [savedProduct()];
  render(<><ArchivedData /><ActiveCatalog /></>);
  await screen.findByText(savedProduct().name);
  expect(screen.getByTestId('active-catalog').textContent).toBe('Catalog: ');
  fireEvent.click(within(screen.getByRole('grid')).getByRole('button', { name: 'Restore' })); confirm();
  await waitFor(() => expect(screen.getByTestId('active-catalog').textContent).toContain(savedProduct().name));
  await screen.findByText('No archived records found.');
  expect(writes()[0][0]).toBe('/api/proxy/administration/archived-data/Product/product-id/restore');
  expect(request.mock.calls.filter(([url]) => url.endsWith('/product-interests')).length).toBeGreaterThanOrEqual(2);
});

it.each([false, true])('restores a Product batch and emits one catalog refresh (mixed types: %s)', async mixed => {
  rows = [savedProduct('one'), savedProduct('two'), ...(mixed ? [rows[0]] : [])];
  const changed = vi.fn(); window.addEventListener('product-interests-changed', changed);
  try {
    render(<ArchivedData />); await screen.findByText(savedProduct('one').name);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all records' }));
    fireEvent.click(screen.getByText('Restore', { selector: 'button' })); confirm();
    await screen.findByText('No archived records found.');
    expect(writes()).toHaveLength(mixed ? 3 : 2);
    expect(changed).toHaveBeenCalledOnce();
    expect(activeProducts).toHaveLength(2);
  } finally { window.removeEventListener('product-interests-changed', changed); }
});

it('retains conflicted Products and reports partial mixed bulk restore accurately', async () => {
  rows = [savedProduct('conflict'), savedProduct('success'), rows[0]];
  failIds.add('conflict'); failureStatus = 409; failureMessage = 'An active product with this name already exists.';
  render(<ArchivedData />); await screen.findByText(savedProduct('conflict').name);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select all records' }));
  fireEvent.click(screen.getByText('Restore', { selector: 'button' })); confirm();
  await waitFor(() => expect(state.error).toHaveBeenCalledWith('1 record could not be restored. An active product with this name already exists.'));
  expect(state.success).toHaveBeenCalledWith('2 records restored');
  expect(screen.getByText(savedProduct('conflict').name)).toBeTruthy();
  expect(screen.getByText('1 selected')).toBeTruthy();
  expect(screen.queryByText(savedProduct('success').name)).toBeNull();
});

it('does not refresh Products after a failed restore or disabled restore permission', async () => {
  rows = [savedProduct()]; failIds.add('product-id');
  const changed = vi.fn(); window.addEventListener('product-interests-changed', changed);
  try {
    const view = render(<ArchivedData />); await screen.findByText(savedProduct().name);
    fireEvent.click(within(screen.getByRole('grid')).getByRole('button', { name: 'Restore' })); confirm();
    await waitFor(() => expect(state.error).toHaveBeenCalledWith('Permission denied'));
    expect(changed).not.toHaveBeenCalled();
    state.canRestore = false; view.rerender(<ArchivedData />);
    expect((within(screen.getByRole('grid')).getByRole('button', { name: 'Restore' }) as HTMLButtonElement).disabled).toBe(true);
  } finally { window.removeEventListener('product-interests-changed', changed); }
});

it('does not publish a Product refresh into a different workspace after an in-flight restore', async () => {
  rows = [savedProduct()];
  const changed = vi.fn(); window.addEventListener('product-interests-changed', changed);
  try {
    const view = render(<ArchivedData />); await screen.findByText(savedProduct().name);
    let finish!: (response: Response) => void;
    request.mockReturnValueOnce(new Promise(done => { finish = done; }));
    fireEvent.click(within(screen.getByRole('grid')).getByRole('button', { name: 'Restore' })); confirm();
    await waitFor(() => expect(writes()).toHaveLength(1));
    state.tenantId = 'tenant-b'; view.rerender(<ArchivedData />);
    await act(async () => finish(new Response(JSON.stringify({ success: true }))));
    await waitFor(() => expect(state.success).toHaveBeenCalledWith('Product restored'));
    expect(changed).not.toHaveBeenCalled();
  } finally { window.removeEventListener('product-interests-changed', changed); }
});
