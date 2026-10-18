import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Lead } from '@/store/types';
import LeadsPage from '../leads-page';

const mocks = vi.hoisted(() => ({
  canCreate: true,
  role: 'Sales',
  params: {} as Record<string, string | undefined>,
  arrays: {} as Record<string, string[]>,
  data: {
    leads: [] as Lead[], meta: { total: 0 }, facets: {},
    isInitialLoad: false, isRefreshing: false, error: null as string | null,
    refetch: vi.fn(),
  },
  columnsLoading: false,
  query: vi.fn(), persist: vi.fn(), updateParams: vi.fn(),
  users: [],
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/store/AuthContext', () => ({ useAuth: () => ({ user: { id: 'agent', role: mocks.role }, tenant: { id: 'tenant' } }) }));
vi.mock('@/store/DataContext', () => ({ useData: () => ({ users: mocks.users, addContact: vi.fn(), updateContact: vi.fn() }) }));
vi.mock('@/shared/hooks/use-permissions', () => ({ useHasPermission: (permission: string) => permission === 'leads.create' ? mocks.canCreate : true }));
vi.mock('@/shared/hooks/use-crm-record-access', () => ({ useCrmRecordAccess: () => ({ canMutate: () => true }) }));
vi.mock('../../hooks/use-leads-data', () => ({ useLeadsData: (query: unknown) => { mocks.query(query); return mocks.data; } }));
vi.mock('@/shared/hooks/use-column-preferences', () => ({ useColumnPreferences: () => ({ effectiveColumns: [], isLoading: mocks.columnsLoading, saveColumns: vi.fn(), resetColumns: vi.fn(), resetColumnWidths: vi.fn() }) }));
vi.mock('@/shared/hooks/use-table-preferences', () => ({ useTablePreferences: () => ({ pageSize: 25, viewMode: 'wrap', sort: { field: 'createdAt', direction: 'desc' }, persistFilters: mocks.persist }) }));
vi.mock('@/shared/hooks/use-view-type-preference', () => ({ useViewTypePreference: () => ({ viewType: 'table', setViewType: vi.fn() }) }));
vi.mock('@/shared/hooks/use-field-layout', () => ({
  useConfiguredCrmColumns: (_module: string, columns: unknown[]) => columns,
  useConfiguredColumnDefinitions: (_module: string, columns: unknown[]) => columns,
}));
vi.mock('@/shared/hooks/use-filter-url-sync', () => ({ useFilterUrlSync: () => ({ getParam: (key: string) => mocks.params[key] ?? '', getArrayParam: (key: string) => mocks.arrays[key] ?? [], updateParams: mocks.updateParams }) }));
vi.mock('../../services/local-storage-migration', () => ({ migrateLocalStorageColumns: vi.fn() }));
vi.mock('@/shared/components/crm', async () => ({
  ModuleWorkspace: (await import('@/shared/components/crm/module-workspace')).ModuleWorkspace,
  LeadPanel: () => null,
}));
vi.mock('../lead-form', () => ({ LeadFormSheet: ({ isOpen, initialData, onClose }: any) => isOpen ? <div role="dialog" aria-label={initialData ? 'Edit Lead panel' : 'Create Lead panel'}><button onClick={onClose}>Close panel</button></div> : null }));
vi.mock('../convert-lead-dialog', () => ({ ConvertLeadDialog: () => null }));
vi.mock('@/shared/components/crm/merge-records-dialog', () => ({ MergeRecordsDialog: () => null }));
vi.mock('@/shared/components/manage-columns-drawer', () => ({ ManageColumnsDrawer: () => null }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.canCreate = true; mocks.role = 'Sales'; mocks.params = {}; mocks.arrays = {}; mocks.columnsLoading = false;
  Object.assign(mocks.data, { leads: [], meta: { total: 0 }, isInitialLoad: false, isRefreshing: false, error: null });
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} })));
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('omits My Leads for Client Admin while preserving All and Active Leads', () => {
  mocks.role = 'Client Admin';
  render(<LeadsPage />);
  expect(screen.queryByRole('button', { name: 'My Leads', hidden: true })).toBeNull();
  expect(screen.getByRole('button', { name: 'All Leads', pressed: true })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Active Leads' }));
  expect(screen.getByRole('button', { name: 'Active Leads', pressed: true })).toBeTruthy();
  expect(mocks.query).toHaveBeenLastCalledWith(expect.objectContaining({ filter: [{ field: 'scope', operator: 'equals', value: 'active' }] }));
});

it.each(['Sales', 'Client Admin'])('removes Work Queue and normalizes an old tab URL for %s', role => {
  mocks.role = role; mocks.params = { tab: 'work_queue', search: 'retained' };
  const view = render(<LeadsPage />);
  expect(screen.queryByRole('button', { name: /Work queue/i, hidden: true })).toBeNull();
  expect(screen.getByRole('button', { name: 'All Leads', pressed: true })).toBeTruthy();
  expect(mocks.query.mock.calls.every(([query]) => query.filter === undefined)).toBe(true);
  expect(mocks.updateParams).toHaveBeenCalledWith(expect.objectContaining({ tab: null, search: 'retained' }));
  mocks.params = {}; view.rerender(<LeadsPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Active Leads' }));
  expect(mocks.query).toHaveBeenLastCalledWith(expect.objectContaining({ filter: [{ field: 'scope', operator: 'equals', value: 'active' }] }));
  mocks.params = { tab: 'work_queue', highlight: 'selected-lead' }; view.rerender(<LeadsPage />);
  expect(screen.getByRole('button', { name: 'All Leads', pressed: true })).toBeTruthy();
  expect(mocks.updateParams).toHaveBeenLastCalledWith({ tab: null });
});

it.each(['Sales', 'Account Manager'])('preserves personal and shared Lead scopes for %s', role => {
  mocks.role = role;
  render(<LeadsPage />);
  fireEvent.click(screen.getByRole('button', { name: 'My Leads' }));
  expect(screen.getByRole('button', { name: 'My Leads', pressed: true })).toBeTruthy();
  expect(mocks.query).toHaveBeenLastCalledWith(expect.objectContaining({ filter: [{ field: 'scope', operator: 'equals', value: 'my' }] }));
  fireEvent.click(screen.getByRole('button', { name: 'All Leads' }));
  expect(mocks.query).toHaveBeenLastCalledWith(expect.objectContaining({ filter: undefined }));
  fireEvent.click(screen.getByRole('button', { name: 'Active Leads' }));
  expect(mocks.query).toHaveBeenLastCalledWith(expect.objectContaining({ filter: [{ field: 'scope', operator: 'equals', value: 'active' }] }));
});

it.each(['', 'selected-lead'])('normalizes Client Admin tab=my before querying, including highlight=%s', highlight => {
  mocks.role = 'Client Admin'; mocks.params = { tab: 'my', search: 'retained', ...(highlight ? { highlight } : {}) };
  render(<LeadsPage />);
  expect(screen.queryByRole('button', { name: 'My Leads', hidden: true })).toBeNull();
  expect(screen.getByRole('button', { name: 'All Leads', pressed: true })).toBeTruthy();
  expect(mocks.query.mock.calls.every(([query]) => !(query.filter ?? []).some((filter: { field: string; value: unknown }) => filter.field === 'scope' && filter.value === 'my'))).toBe(true);
  expect(mocks.updateParams).toHaveBeenCalledWith(highlight ? { tab: null } : expect.objectContaining({ tab: null, search: 'retained' }));
});

it('clears a mounted personal Lead selection when the role changes to Client Admin', () => {
  const view = render(<LeadsPage />);
  fireEvent.click(screen.getByRole('button', { name: 'My Leads' }));
  mocks.role = 'Client Admin'; mocks.query.mockClear();
  view.rerender(<LeadsPage />);
  expect(screen.queryByRole('button', { name: 'My Leads', hidden: true })).toBeNull();
  expect(screen.getByRole('button', { name: 'All Leads', pressed: true })).toBeTruthy();
  expect(mocks.query.mock.calls.every(([query]) => query.filter === undefined)).toBe(true);
  mocks.role = 'Sales';
  view.rerender(<LeadsPage />);
  expect(screen.getByRole('button', { name: 'All Leads', pressed: true })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'My Leads', pressed: false })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'My Leads' }));
  expect(mocks.query).toHaveBeenLastCalledWith(expect.objectContaining({ filter: [{ field: 'scope', operator: 'equals', value: 'my' }] }));
});

it('falls back to All when a personal Lead URL is opened on a mounted Client Admin page', () => {
  mocks.role = 'Client Admin';
  const view = render(<LeadsPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Active Leads' }));
  mocks.params = { tab: 'my' }; mocks.query.mockClear();
  view.rerender(<LeadsPage />);
  expect(screen.getByRole('button', { name: 'All Leads', pressed: true })).toBeTruthy();
  expect(mocks.query.mock.calls.every(([query]) => query.filter === undefined)).toBe(true);
  expect(mocks.updateParams).toHaveBeenLastCalledWith(expect.objectContaining({ tab: null }));
});

function expectNoTable() {
  expect(screen.queryByRole('grid')).toBeNull();
  expect(screen.queryByRole('columnheader')).toBeNull();
  expect(document.querySelector('[role="region"] .overflow-auto')).toBeNull();
  expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull();
}

it('reuses the card with the Lead icon and opens the same create panel as the header', () => {
  render(<LeadsPage />);
  const card = screen.getByRole('heading', { name: 'No leads yet' }).closest('.border-dashed')!;
  expect(card.querySelector('.lucide-target')).toBeTruthy();
  expect(screen.getByText('Add your first lead to start tracking potential customers.')).toBeTruthy();
  expect(card.querySelector('.lucide-plus')).toBeTruthy();
  expectNoTable();
  expect(screen.getByPlaceholderText('Search leads...')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'My Leads' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Filter Leads' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Add Lead' }));
  expect(screen.getByRole('dialog', { name: 'Create Lead panel' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Close panel' }));
  fireEvent.click(screen.getByRole('button', { name: 'Create Lead' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Create New' }));
  expect(screen.getByRole('dialog', { name: 'Create Lead panel' })).toBeTruthy();
});

it('hides both creation entry points without Create permission', () => {
  mocks.canCreate = false;
  render(<LeadsPage />);
  expect(screen.getByRole('heading', { name: 'No leads yet' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Add Lead' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Create Lead' })).toBeNull();
});

it.each([
  { params: { search: 'missing' }, arrays: {} },
  { params: { tab: 'my' }, arrays: {} },
  { params: { tab: 'active' }, arrays: {} },
  { params: { highlight: 'missing-lead' }, arrays: {} },
  { params: { createdOperator: 'gte', createdFrom: '2026-10-01' }, arrays: {} },
  ...['statuses', 'sources', 'owners', 'related', 'system'].map(key => ({ params: {}, arrays: { [key]: [key === 'sources' ? 'Website' : 'missing'] } })),
])('shows matching-results copy for applied criteria: %j', ({ params, arrays }) => {
  mocks.params = params; mocks.arrays = arrays;
  render(<LeadsPage />);
  expect(screen.getByRole('heading', { name: 'No matching records' })).toBeTruthy();
  expect(screen.getByText('Try a different search term or clear your filters.')).toBeTruthy();
  expect(screen.queryByText('No leads yet')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Add Lead' })).toBeNull();
  expectNoTable();
});

it('responds to search and tabs while retaining the header Create action', async () => {
  render(<LeadsPage />);
  fireEvent.change(screen.getByPlaceholderText('Search leads...'), { target: { value: 'missing' } });
  await screen.findByRole('heading', { name: 'No matching records' });
  await waitFor(() => expect(mocks.query).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'missing' })));
  fireEvent.change(screen.getByPlaceholderText('Search leads...'), { target: { value: '' } });
  await screen.findByRole('heading', { name: 'No leads yet' });
  fireEvent.click(screen.getByRole('button', { name: 'My Leads' }));
  expect(screen.getByRole('heading', { name: 'No matching records' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Create Lead' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Create New' }));
  expect(screen.getByRole('dialog', { name: 'Create Lead panel' })).toBeTruthy();
});

it('does not interpret whitespace or an incomplete created-date filter as applied criteria', () => {
  mocks.params = { search: '   ', createdOperator: 'between', createdFrom: '2026-10-01' };
  render(<LeadsPage />);
  expect(screen.getByRole('heading', { name: 'No leads yet' })).toBeTruthy();
});

it('does not claim the module is empty when the page total remains positive', () => {
  mocks.data.meta = { total: 1 };
  render(<LeadsPage />);
  expect(screen.getByRole('heading', { name: 'No matching records' })).toBeTruthy();
  expectNoTable();
});

it('preserves loading, retry, empty-card refresh and populated table transitions', () => {
  mocks.data.isInitialLoad = true;
  const { rerender } = render(<LeadsPage />);
  expect(screen.getByText('Loading leads...').closest('[role="status"]')).toBeTruthy();
  expect(screen.queryByText('No leads yet')).toBeNull();
  mocks.data.isInitialLoad = false; mocks.columnsLoading = true;
  rerender(<LeadsPage />);
  expect(screen.queryByText('No leads yet')).toBeNull();
  mocks.columnsLoading = false; mocks.data.error = 'Unable to load leads';
  rerender(<LeadsPage />);
  expect(screen.queryByText('No leads yet')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(mocks.data.refetch).toHaveBeenCalledTimes(1);
  mocks.data.error = null;
  rerender(<LeadsPage />);
  const heading = screen.getByRole('heading', { name: 'No leads yet' });
  mocks.data.isRefreshing = true;
  rerender(<LeadsPage />);
  expect(screen.getByRole('status', { name: 'Refreshing data...' })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'No leads yet' })).toBeNull();
  mocks.data.isRefreshing = false;
  rerender(<LeadsPage />);
  expect(screen.getByRole('heading', { name: 'No leads yet' })).toBe(heading);
  mocks.data.leads = [{ id: 'lead', firstName: 'Jordan', lastName: 'Lee' } as Lead];
  mocks.data.meta = { total: 1 };
  rerender(<LeadsPage />);
  expect(screen.getByRole('grid')).toBeTruthy();
  expect(screen.getByText('Jordan Lee')).toBeTruthy();
  expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeTruthy();
  mocks.data.error = 'Refresh failed';
  rerender(<LeadsPage />);
  expect(screen.getByText('Jordan Lee')).toBeTruthy();
  mocks.data.error = null; mocks.data.leads = []; mocks.data.meta = { total: 0 };
  rerender(<LeadsPage />);
  expect(screen.getByRole('heading', { name: 'No leads yet' })).toBeTruthy();
  expectNoTable();
});
