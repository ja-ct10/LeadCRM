vi.mock('@/shared/hooks/use-cached-page', () => ({ useCachedPage: () => ({ data: undefined, isInitialLoad: false, refetch: vi.fn() }) }));
vi.mock('@/shared/hooks/use-permissions', () => ({ useHasPermission: () => true }));
vi.mock('@/features/tenant/notifications/hooks/use-record-notifications', () => ({ UnreadRecordDot: () => null }));
vi.mock('@/shared/hooks/use-crm-record-access', () => ({ useCrmRecordAccess: () => ({ canMutate: () => true, canReassign: true, policy: { userId: 'actor', tenantId: 'tenant', assignmentRestricted: false, clientAdmin: true } }) }));
import React, { useState } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DataGrid } from '../data-grid';
import type { SortState } from '../types';
import { LeadsDataGrid } from '@/features/tenant/crm/leads/ui/leads-data-grid';
import { LEADS_COLUMN_REGISTRY } from '@/shared/constants/column-registries';
import { compareSortValues, normalizeLeadColumns, tableSortLabels } from '@leadcrm/shared';
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  window.matchMedia = vi.fn().mockImplementation(() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const records = [
  { id: 'z', tenantId: 'tenant', firstName: 'Zulu', lastName: 'Test Zulu', email: 'z@test.example', phone: '300', companyName: 'Z', status: 'Warm', createdAt: '2026-03-01', source: 'Z' },
  { id: 'a', tenantId: 'tenant', firstName: 'Alpha', lastName: 'Test Alpha', email: 'a@test.example', phone: '100', companyName: 'A', status: 'Cold', createdAt: '2026-01-01', source: 'A' },
];
const columns = LEADS_COLUMN_REGISTRY.map(c => ({ id: c.id, visible: c.defaultVisible || ['firstName', 'lastName', 'createdAt', 'source'].includes(c.id), order: c.defaultOrder }));
function LeadHarness({ separate = false }: { separate?: boolean }) {
  const [sort, setSort] = useState<SortState | null>(null);
  const rows = sort ? [...records].sort((a, b) => compareSortValues(a[sort.field as keyof typeof a], b[sort.field as keyof typeof b], sort.direction)) : records;
  const layout = columns.map(column => column.id === 'name' ? { ...column, visible: !separate } : column);
  return <LeadsDataGrid leads={rows as any} totalRecords={2} effectiveColumns={layout} sort={sort} onSortChange={setSort}
    onRowClick={() => {}} selectedIds={new Set()} onSelectionChange={() => {}} getOwnerName={() => ''} getOwnerInitials={() => ''} />;
}

it.each([[true, true, 84], [true, false, 44], [false, true, 40], [false, false, 0]] as const)('offsets pinned cells after selection=%s and row actions=%s', (selectable, actions, offset) => {
  render(<DataGrid columns={[{ id: 'firstName', header: 'Name', accessor: row => row.firstName, pinned: 'left' }]}
    data={records} getRowId={row => row.id} selectable={selectable} rowActions={actions ? () => [] : undefined} />);
  expect(screen.getByRole('columnheader', { name: 'Name' }).style.left).toBe(`${offset}px`);
  const row = screen.getAllByRole('row')[1];
  expect(row.querySelectorAll('td')[Number(selectable) + Number(actions)].style.left).toBe(`${offset}px`);
});

it('does not sort when the Name resize handle is clicked or released', () => {
  const sort = vi.fn();
  render(<LeadsDataGrid leads={records} totalRecords={records.length} effectiveColumns={columns}
    selectedIds={new Set()} onSelectionChange={vi.fn()} onRowClick={vi.fn()} getOwnerName={() => '—'} getOwnerInitials={() => '?'} onSortChange={sort} />);
  const handle = screen.getByRole('columnheader', { name: 'Name' }).querySelector('.cursor-col-resize');
  expect(handle).toBeTruthy();
  fireEvent.click(handle!);
  expect(sort).not.toHaveBeenCalled();
});
it.each(['First Name', 'Last Name', 'Email', 'Phone', 'Company Name', 'Status', 'Created', 'Lead Source'])('sorts %s from its own hamburger', label => {
  render(<LeadHarness separate={['First Name', 'Last Name'].includes(label)} />);
  const open = () => fireEvent.click(screen.getByRole('button', { name: `Column options for ${label}` }));
  const labels = tableSortLabels(label === 'Created' ? 'date' : label === 'Phone' ? 'phone' : 'text');
  const firstName = () => screen.getAllByRole('row').slice(1).find(row => row.textContent?.includes('Test'))!.textContent;
  expect(firstName()).toContain('Zulu');
  open(); fireEvent.click(screen.getByRole('menuitemradio', { name: labels.asc })); expect(firstName()).toContain('Alpha');
  open(); fireEvent.click(screen.getByRole('menuitemradio', { name: labels.desc })); expect(firstName()).toContain('Zulu');
  if (label !== 'Created') { open(); fireEvent.click(screen.getByRole('menuitem', { name: 'Restore default sorting' })); expect(firstName()).toContain('Zulu'); }
});
it('sorts Name from its pinned header menu and restores defaults without header-click sorting', () => {
  const onSortChange = vi.fn();
  const props = { leads: records as any, totalRecords: 2, effectiveColumns: columns, onSortChange,
    onRowClick: () => {}, selectedIds: new Set<string>(), onSelectionChange: () => {}, getOwnerName: () => '', getOwnerInitials: () => '' };
  const view = render(<LeadsDataGrid {...props} sort={null} />);
  const open = () => fireEvent.click(screen.getByRole('button', { name: 'Column options for Name' }));
  fireEvent.click(screen.getByRole('columnheader', { name: 'Name' })); expect(onSortChange).not.toHaveBeenCalled();
  open(); fireEvent.click(screen.getByRole('menuitemradio', { name: 'Sort A–Z' }));
  expect(onSortChange).toHaveBeenLastCalledWith({ field: 'name', direction: 'asc' });
  view.rerender(<LeadsDataGrid {...props} sort={{ field: 'name', direction: 'asc' }} />);
  open(); expect(screen.getByRole('menuitemradio', { name: 'Sort A–Z' }).getAttribute('aria-checked')).toBe('true');
  fireEvent.click(screen.getByRole('menuitemradio', { name: 'Sort Z–A' }));
  expect(onSortChange).toHaveBeenLastCalledWith({ field: 'name', direction: 'desc' });
  view.rerender(<LeadsDataGrid {...props} sort={{ field: 'name', direction: 'desc' }} />);
  open(); fireEvent.click(screen.getByRole('menuitem', { name: 'Restore default sorting' }));
  expect(onSortChange).toHaveBeenLastCalledWith(null);
});
it('sets aria-sort only on the active visible header', () => {
  render(<LeadsDataGrid leads={records} totalRecords={2} effectiveColumns={columns} sort={{ field: 'companyName', direction: 'asc' }} selectedIds={new Set()} onSelectionChange={vi.fn()} onRowClick={vi.fn()} getOwnerName={() => ''} getOwnerInitials={() => ''} />);
  expect(screen.getByRole('columnheader', { name: 'Company Name' }).getAttribute('aria-sort')).toBe('ascending');
  expect(screen.getByRole('columnheader', { name: 'Name' }).hasAttribute('aria-sort')).toBe(false);
});
it('never reorders an externally sorted server page', () => {
  render(<DataGrid columns={[{ id: 'firstName', header: 'Name', accessor: row => row.firstName, sortable: true }]}
    data={records} getRowId={row => row.id} sortingMode="external" sort={{ field: 'firstName', direction: 'asc' }} />);
  expect(screen.getAllByRole('row')[1].textContent).toContain('Zulu');
});
it.each([320, 1440])('keeps separate email/phone toggles and removes the retired column at %s px', width => {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
  const migrated = normalizeLeadColumns([{ id: 'emailAndPhone', visible: true, order: 1 }, ...columns]);
  const props = { leads: records as any, totalRecords: 2, onRowClick: () => {}, selectedIds: new Set<string>(), onSelectionChange: () => {}, getOwnerName: () => '', getOwnerInitials: () => '' };
  const view = render(<LeadsDataGrid {...props} effectiveColumns={migrated} />);
  expect(screen.queryByText('Email & Phone')).toBeNull();
  expect(screen.getByRole('columnheader', { name: 'Email' })).toBeTruthy();
  expect(screen.getByRole('columnheader', { name: 'Phone' })).toBeTruthy();
  view.rerender(<LeadsDataGrid {...props} effectiveColumns={migrated.map(col => col.id === 'email' ? { ...col, visible: false } : col)} />);
  expect(screen.queryByRole('columnheader', { name: 'Email' })).toBeNull();
  expect(screen.getByRole('columnheader', { name: 'Phone' })).toBeTruthy();
});
