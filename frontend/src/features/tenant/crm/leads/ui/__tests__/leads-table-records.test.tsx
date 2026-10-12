vi.mock('@/shared/hooks/use-cached-page', () => ({ useCachedPage: () => ({ data: undefined, isInitialLoad: false, refetch: vi.fn() }) }));
vi.mock('@/shared/hooks/use-permissions', () => ({ useHasPermission: () => true }));
vi.mock('@/shared/hooks/use-crm-record-access', () => ({ useCrmRecordAccess: () => ({ canMutate: () => true, canReassign: true, policy: { userId: 'actor', tenantId: 'tenant', assignmentRestricted: false, clientAdmin: true } }) }));
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { LeadsDataGrid } from '../leads-data-grid';
import { toFrontendContact } from '@/lib/api/adapters/contact.adapter';
import type { Lead } from '@/store/types';
import { LEADS_COLUMN_REGISTRY } from '@/shared/constants/column-registries';
const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/shared/hooks/use-cached-page', () => ({ useCachedPage: () => ({ data: undefined }) }));
vi.mock('@/shared/hooks/use-permissions', () => ({ useHasPermission: () => true }));
vi.mock('@/shared/hooks/use-crm-record-access', () => ({ useCrmRecordAccess: () => ({ canMutate: () => true, canReassign: true, policy: { userId: 'actor', tenantId: 'tenant', assignmentRestricted: false, clientAdmin: true } }) }));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

it('renders all products and populated API details without relying on the user lookup page', () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  const owner = { id: 'owner', firstName: 'Alex', lastName: 'Morgan' };
  const lead = toFrontendContact({ id: 'lead', firstName: 'Jordan', lastName: 'Lee',
    productInterest: ['CCTV', 'Biometrics'], description: 'Installation request', website: 'https://example.test',
    assignedUser: owner, assignedUserId: owner.id, createdBy: owner, updatedBy: owner,
  }) as Lead;
  render(<LeadsDataGrid leads={[lead]} totalRecords={1}
    effectiveColumns={['firstName', 'productInterest', 'description', 'website', 'createdBy', 'updatedBy', 'assignedUserId'].map((id, order) => ({ id, order, visible: true }))}
    selectedIds={new Set()} onSelectionChange={vi.fn()} onRowClick={vi.fn()} getOwnerName={() => '—'} getOwnerInitials={() => '?'} />);
  expect(screen.getByText('CCTV')).toBeTruthy();
  expect(screen.getByText('Biometrics')).toBeTruthy();
  expect(screen.getByText('Installation request')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'example.test' }).getAttribute('href')).toBe('https://example.test');
  expect(screen.getAllByText('Alex Morgan')).toHaveLength(3);
});

it('removes the trailing Actions cells while retaining selection, navigation and record email in the row menu', () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  const lead = { id: 'lead', firstName: 'Jordan', lastName: 'Lee', email: 'jordan@example.test' } as Lead;
  const select = vi.fn(), navigate = vi.fn();
  const { container } = render(<LeadsDataGrid leads={[lead]} totalRecords={1}
    effectiveColumns={['firstName', 'email'].map((id, order) => ({ id, order, visible: true }))}
    selectedIds={new Set()} onSelectionChange={select} onRowClick={navigate} getOwnerName={() => '—'} getOwnerInitials={() => '?'} />);
  expect(screen.queryByRole('columnheader', { name: 'Actions' })).toBeNull();
  expect(container.querySelectorAll('col')).toHaveLength(4); // Menu, checkbox, name, email.
  expect(container.querySelector('tbody tr')?.querySelectorAll('td')).toHaveLength(4);
  expect(screen.queryByRole('button', { name: 'Email' })).toBeNull();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select record lead' }));
  expect(select).toHaveBeenCalledWith(new Set(['lead']));
  expect(navigate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Jordan'));
  expect(navigate).toHaveBeenCalledWith(lead);
  fireEvent.click(screen.getByRole('button', { name: 'Row actions' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Send Email' }));
  expect(push).toHaveBeenCalledWith('/inbox?compose=record-email&to=jordan%40example.test');
});

it('uses persisted names in separate default columns and keeps company only in its dedicated cell', () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  const lead = { id: 'lead', firstName: 'Josh', lastName: 'Tiron', leadPerson: 'Wrong Display Name',
    displayName: 'Another Wrong Name', companyName: 'Teleperformance' } as Lead;
  const navigate = vi.fn();
  render(<LeadsDataGrid leads={[lead]} totalRecords={1} effectiveColumns={[]}
    selectedIds={new Set()} onSelectionChange={vi.fn()} onRowClick={navigate} getOwnerName={() => '—'} getOwnerInitials={() => '?'} />);
  const headers = screen.getAllByRole('columnheader').map(header => header.textContent);
  expect(headers.filter(Boolean)).toEqual(['First Name', 'Last Name', 'Email', 'Phone', 'Company Name', 'Status', 'Assigned Agent']);
  const cells = screen.getAllByRole('row')[1].querySelectorAll('td');
  expect(cells[2].textContent).toBe('JTJosh');
  expect(cells[3].textContent).toBe('Tiron');
  expect(cells[6].textContent).toBe('Teleperformance');
  expect(screen.getAllByText('Teleperformance')).toHaveLength(1);
  expect(screen.queryByText('Wrong Display Name')).toBeNull();
  fireEvent.click(screen.getByText('Josh'));
  expect(navigate).toHaveBeenCalledWith(lead);
  expect(lead.lastName).toBe('Tiron');
  expect(lead.companyName).toBe('Teleperformance');
  expect(LEADS_COLUMN_REGISTRY.find(column => column.id === 'lastName')?.required).toBe(false);
});

it.each([undefined, null, ''])('renders a missing Last Name as an em dash (%s)', lastName => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  render(<LeadsDataGrid leads={[{ id: 'lead', firstName: 'Josh', lastName } as Lead]} totalRecords={1}
    effectiveColumns={[{ id: 'firstName', visible: true, order: 0 }, { id: 'lastName', visible: true, order: 1 }]}
    selectedIds={new Set()} onSelectionChange={vi.fn()} onRowClick={vi.fn()} getOwnerName={() => '—'} getOwnerInitials={() => '?'} />);
  const cells = screen.getAllByRole('row')[1].querySelectorAll('td');
  expect(cells[2].textContent).toBe('JOJosh');
  expect(cells[3].textContent).toBe('—');
});
