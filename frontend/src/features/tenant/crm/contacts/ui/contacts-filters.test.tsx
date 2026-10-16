import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ModuleTabs } from '@/shared/components/crm/module-tabs';
import ContactsPage from './contacts-page';

const mocks = vi.hoisted(() => ({
  role: 'Sales', params: {} as Record<string, string>,
  persist: vi.fn(), updateParams: vi.fn(), query: vi.fn(),
  users: [{ id: 'agent', firstName: 'Sam', lastName: 'Agent', role: 'Sales', status: 'active', assignableAgent: true }],
  deals: [{ id: 'deal', contactIds: ['one'] }],
  contacts: [
    { id: 'one', firstName: 'One', contactPerson: 'One', assignedUserId: 'agent', lifecycleStage: 'LEAD', lastUpdated: '2026-10-01', status: 'Warm' },
    { id: 'two', firstName: 'Two', contactPerson: 'Two', assignedUserId: 'other', lifecycleStage: 'LEAD', status: 'Warm' },
  ],
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/store/AuthContext', () => ({ useAuth: () => ({ user: { id: 'agent', role: mocks.role }, tenant: { id: 'tenant' } }) }));
vi.mock('@/store/DataContext', () => ({ useData: () => ({ organizations: [], users: mocks.users, deals: mocks.deals }) }));
vi.mock('@/shared/hooks/use-permissions', () => ({ useHasPermission: () => true }));
vi.mock('@/shared/hooks/use-crm-record-access', () => ({ useCrmRecordAccess: () => ({ canMutate: () => true }) }));
vi.mock('@/shared/hooks/use-cached-page', () => ({ useCachedPage: ({ params }: any) => {
  mocks.query(params);
  const filters = params.filters ?? [];
  const filtered = mocks.contacts.filter(contact => filters.every((filter: any) => {
    if (filter.field === 'scope' && filter.value === 'my') return contact.assignedUserId === 'agent';
    if (filter.field === 'assignedUserId') return filter.value.includes(contact.assignedUserId);
    if (filter.field === 'system') return filter.value.includes('touched') ? Boolean(contact.lastUpdated) : !contact.lastUpdated;
    if (filter.field === 'related') return mocks.deals.some(deal => deal.contactIds.includes(contact.id));
    return true;
  }));
  return { data: params.recordId ? mocks.contacts[0] : { data: filtered, meta: { total: filtered.length, facets: { touched: 1, untouched: 1, has_deals: 1 } } }, refetch: vi.fn() };
} }));
vi.mock('@/shared/hooks/use-column-preferences', () => ({ useColumnPreferences: () => ({ effectiveColumns: [], saveColumns: vi.fn(), resetColumns: vi.fn() }) }));
vi.mock('@/shared/hooks/use-table-preferences', () => ({ useTablePreferences: () => ({ pageSize: 25, viewMode: 'wrap', sort: null, persistFilters: mocks.persist }) }));
vi.mock('@/shared/hooks/use-filter-url-sync', () => ({ useFilterUrlSync: () => ({ getParam: (key: string) => mocks.params[key] ?? '', getArrayParam: (key: string) => key === 'types' ? ['Prospect'] : [], updateParams: mocks.updateParams }) }));
vi.mock('@/shared/components/crm', () => ({
  ContactPanel: () => null, StatusBadge: () => null,
  ModuleWorkspace: ({ filterGroups, onFilterToggle, savedTabs, activeTab, onTabChange, children }: any) => <div>
    <ModuleTabs tabs={savedTabs} activeTab={activeTab} onTabChange={onTabChange} ariaLabel="Contacts views" />
    {filterGroups.map((group: any) => <section key={group.id}>{group.items.map((item: any) => <button key={item.id} onClick={() => onFilterToggle(group.id, item.id)}>{item.label}</button>)}</section>)}{children}</div>,
}));
vi.mock('./contacts-data-grid', () => ({ ContactsDataGrid: ({ contacts }: any) => <div data-testid="contacts">{contacts.map((c: any) => c.id).join(',')}</div> }));
vi.mock('./contact-form', () => ({ ContactFormSheet: () => null }));
vi.mock('@/shared/components/manage-columns-drawer', () => ({ ManageColumnsDrawer: () => null }));
beforeEach(() => { vi.clearAllMocks(); mocks.role = 'Sales'; mocks.params = {}; });
afterEach(cleanup);

it('omits My Contacts for Client Admin while preserving All and Active Contacts', () => {
  mocks.role = 'Client Admin';
  render(<ContactsPage />);
  expect(screen.queryByRole('button', { name: 'My Contacts', hidden: true })).toBeNull();
  expect(screen.getByRole('button', { name: 'All Contacts', pressed: true })).toBeTruthy();
  expect(screen.getByTestId('contacts').textContent).toBe('one,two');
  fireEvent.click(screen.getByRole('button', { name: 'Active Contacts' }));
  expect(screen.getByRole('button', { name: 'Active Contacts', pressed: true })).toBeTruthy();
  expect(mocks.query).toHaveBeenLastCalledWith(expect.objectContaining({ filters: [{ field: 'scope', operator: 'equals', value: 'active' }] }));
});

it.each(['Sales', 'Account Manager'])('preserves personal and shared Contact scopes for %s', role => {
  mocks.role = role;
  render(<ContactsPage />);
  fireEvent.click(screen.getByRole('button', { name: 'My Contacts' }));
  expect(screen.getByRole('button', { name: 'My Contacts', pressed: true })).toBeTruthy();
  expect(screen.getByTestId('contacts').textContent).toBe('one');
  expect(mocks.query).toHaveBeenLastCalledWith(expect.objectContaining({ filters: [{ field: 'scope', operator: 'equals', value: 'my' }] }));
  fireEvent.click(screen.getByRole('button', { name: 'All Contacts' }));
  expect(screen.getByTestId('contacts').textContent).toBe('one,two');
  expect(mocks.query).toHaveBeenLastCalledWith(expect.objectContaining({ filters: [] }));
  fireEvent.click(screen.getByRole('button', { name: 'Active Contacts' }));
  expect(mocks.query).toHaveBeenLastCalledWith(expect.objectContaining({ filters: [{ field: 'scope', operator: 'equals', value: 'active' }] }));
});

it.each(['', 'one'])('normalizes Client Admin tab=my before querying, including highlight=%s', highlight => {
  mocks.role = 'Client Admin'; mocks.params = { tab: 'my', search: 'retained', ...(highlight ? { highlight } : {}) };
  render(<ContactsPage />);
  expect(screen.queryByRole('button', { name: 'My Contacts', hidden: true })).toBeNull();
  expect(screen.getByRole('button', { name: 'All Contacts', pressed: true })).toBeTruthy();
  expect(mocks.query.mock.calls.every(([query]) => !(query.filters ?? []).some((filter: { field: string; value: unknown }) => filter.field === 'scope' && filter.value === 'my'))).toBe(true);
  expect(mocks.updateParams).toHaveBeenCalledWith(highlight ? { tab: null } : expect.objectContaining({ tab: null, search: 'retained' }));
});

it('clears a mounted personal Contact selection when the role changes to Client Admin', () => {
  const view = render(<ContactsPage />);
  fireEvent.click(screen.getByRole('button', { name: 'My Contacts' }));
  mocks.role = 'Client Admin'; mocks.query.mockClear();
  view.rerender(<ContactsPage />);
  expect(screen.queryByRole('button', { name: 'My Contacts', hidden: true })).toBeNull();
  expect(screen.getByRole('button', { name: 'All Contacts', pressed: true })).toBeTruthy();
  expect(screen.getByTestId('contacts').textContent).toBe('one,two');
  expect(mocks.query.mock.calls.every(([query]) => query.filters.length === 0)).toBe(true);
  mocks.role = 'Sales';
  view.rerender(<ContactsPage />);
  expect(screen.getByRole('button', { name: 'All Contacts', pressed: true })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'My Contacts', pressed: false })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'My Contacts' }));
  expect(screen.getByTestId('contacts').textContent).toBe('one');
});

it('falls back to All when a personal Contact URL is opened on a mounted Client Admin page', () => {
  mocks.role = 'Client Admin';
  const view = render(<ContactsPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Active Contacts' }));
  mocks.params = { tab: 'my' }; mocks.query.mockClear();
  view.rerender(<ContactsPage />);
  expect(screen.getByRole('button', { name: 'All Contacts', pressed: true })).toBeTruthy();
  expect(mocks.query.mock.calls.every(([query]) => query.filters.length === 0)).toBe(true);
  expect(mocks.updateParams).toHaveBeenLastCalledWith(expect.objectContaining({ tab: null }));
});

it('removes obsolete types and saved criteria while preserving agent, update and deal filters', () => {
  render(<ContactsPage />);
  expect(screen.queryByText(/Type:|Active Customer|Prospect|Evaluator/)).toBeNull();
  expect(screen.getByTestId('contacts').textContent).toBe('one,two');
  expect(mocks.updateParams).toHaveBeenCalledWith(expect.objectContaining({ types: null }));
  expect(mocks.persist).toHaveBeenCalledWith([]);
  expect(mocks.query).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 25, filters: [] }));
  for (const label of ['Assigned Agent: Sam Agent', 'Updated Records', 'Contacts with Deals']) {
    fireEvent.click(screen.getByRole('button', { name: label }));
    expect(screen.getByTestId('contacts').textContent).toBe('one');
    fireEvent.click(screen.getByRole('button', { name: label }));
    expect(screen.getByTestId('contacts').textContent).toBe('one,two');
  }
  expect(mocks.persist.mock.calls.every(([conditions]) => conditions.every((c: { field: string }) => c.field !== 'customerType'))).toBe(true);
});
