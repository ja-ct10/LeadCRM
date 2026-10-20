import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { LeadsDataGrid } from '../leads-data-grid';
vi.mock('@/features/tenant/notifications/hooks/use-record-notifications', () => ({ UnreadRecordDot: () => null }));
import { toFrontendContact } from '@/lib/api/adapters/contact.adapter';
import type { Lead } from '@/store/types';
import { LEADS_COLUMN_REGISTRY } from '@/shared/constants/column-registries';
import type { ColumnConfigItem } from '@leadcrm/shared';

const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/shared/hooks/use-cached-page', () => ({ useCachedPage: () => ({ data: undefined, isInitialLoad: false, refetch: vi.fn() }) }));
vi.mock('@/shared/hooks/use-permissions', () => ({ useHasPermission: () => true }));
vi.mock('@/shared/hooks/use-crm-record-access', () => ({ useCrmRecordAccess: () => ({ canMutate: () => true, canReassign: true, policy: { userId: 'actor', tenantId: 'tenant', assignmentRestricted: false, clientAdmin: true } }) }));

beforeEach(() => vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

function columns(visibleIds: string[]): ColumnConfigItem[] {
  const ids = [...visibleIds, ...LEADS_COLUMN_REGISTRY.map(column => column.id).filter(id => !visibleIds.includes(id))];
  return ids.map((id, order) => ({ id, order, visible: visibleIds.includes(id) }));
}
function renderLead(lead: Lead, effectiveColumns: ColumnConfigItem[] = [], extras: Partial<React.ComponentProps<typeof LeadsDataGrid>> = {}) {
  return render(<LeadsDataGrid leads={[lead]} totalRecords={1} effectiveColumns={effectiveColumns}
    selectedIds={new Set()} onSelectionChange={vi.fn()} onRowClick={vi.fn()} getOwnerName={() => '—'} getOwnerInitials={() => '?'} {...extras} />);
}

it('renders every product and included owner/audit projection without a lookup page', () => {
  const owner = { id: 'owner', firstName: 'Alex', lastName: 'Morgan' };
  const lead = toFrontendContact({ id: 'lead', firstName: 'Jordan', lastName: 'Lee',
    productInterest: ['CCTV', 'Biometrics'], assignedUser: owner, assignedUserId: owner.id, createdBy: owner, updatedBy: owner,
  }) as Lead;
  renderLead(lead, columns(['name', 'productInterest', 'createdBy', 'updatedBy', 'assignedUserId']));
  expect(screen.getByText('CCTV')).toBeTruthy();
  expect(screen.getByText('Biometrics')).toBeTruthy();
  expect(screen.getAllByText('Alex Morgan')).toHaveLength(3);
});

it('keeps selection, canonical-name navigation, and record email in the row menu', () => {
  const lead = { id: 'lead', firstName: 'Jordan', lastName: 'Lee', email: 'jordan@example.test' } as Lead;
  const select = vi.fn(), navigate = vi.fn();
  const { container } = renderLead(lead, columns(['name', 'email']), { onSelectionChange: select, onRowClick: navigate });
  expect(screen.queryByRole('columnheader', { name: 'Actions' })).toBeNull();
  expect(container.querySelectorAll('col')).toHaveLength(4); // Menu, checkbox, Name, email.
  expect(container.querySelector('tbody tr')?.querySelectorAll('td')).toHaveLength(4);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select record lead' }));
  expect(select).toHaveBeenCalledWith(new Set(['lead']));
  expect(navigate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Jordan Lee'));
  expect(navigate).toHaveBeenCalledWith(lead);
  fireEvent.click(screen.getByRole('button', { name: 'Row actions' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Send Email' }));
  expect(push).toHaveBeenCalledWith('/inbox?compose=record-email&to=jordan%40example.test');
});

it('displays persisted full Name first in fresh layouts and company only in its own cell', () => {
  const lead = { id: 'lead', firstName: 'Josh', lastName: 'Tiron', leadPerson: 'Wrong Display Name',
    displayName: 'Another Wrong Name', companyName: 'Teleperformance' } as Lead;
  const navigate = vi.fn();
  renderLead(lead, [], { onRowClick: navigate });
  const headers = screen.getAllByRole('columnheader').map(header => header.textContent).filter(Boolean);
  expect(headers).toEqual(['Name', 'Email', 'Phone', 'Company Name', 'Status', 'Assigned Agent', 'Lead Source']);
  const cells = screen.getAllByRole('row')[1].querySelectorAll('td');
  expect(cells[2].textContent).toBe('JTJosh Tiron');
  expect(screen.getAllByText('Teleperformance')).toHaveLength(1);
  expect(screen.queryByText('Wrong Display Name')).toBeNull();
  fireEvent.click(screen.getByText('Josh Tiron'));
  expect(navigate).toHaveBeenCalledWith(lead);
  expect(lead).toMatchObject({ firstName: 'Josh', lastName: 'Tiron', companyName: 'Teleperformance' });
  expect(LEADS_COLUMN_REGISTRY.find(column => column.id === 'firstName')?.required).toBe(false);
  expect(LEADS_COLUMN_REGISTRY.find(column => column.id === 'lastName')?.required).toBe(false);
});

it('preserves explicitly hidden Name and the separate-name choices', () => {
  const preferences = columns(['email', 'lastName', 'firstName']).map(column => column.id === 'name' ? { ...column, visible: false, width: 320 } : column);
  renderLead({ id: 'lead', firstName: '  Mary Jane  ', lastName: '  de la Cruz  ' } as Lead, preferences);
  const headers = screen.getAllByRole('columnheader').map(header => header.textContent).filter(Boolean);
  expect(headers).toEqual(['Email', 'Last Name', 'First Name']);
  expect(screen.queryByText('Mary Jane de la Cruz')).toBeNull();
  expect(screen.getByText('Mary Jane')).toBeTruthy();
  expect(screen.getByText('de la Cruz')).toBeTruthy();
  expect(screen.queryByRole('columnheader', { name: /^Name\b/ })).toBeNull();
});

it.each([
  { firstName: ' Josh ', lastName: undefined, expected: 'Josh' },
  { firstName: '', lastName: ' Tiron ', expected: 'Tiron' },
  { firstName: null, lastName: null, expected: '—' },
  { firstName: '   ', lastName: '', expected: '—' },
])('renders partial and missing legacy names safely ($expected)', ({ firstName, lastName, expected }) => {
  renderLead({ id: 'lead', firstName, lastName, leadPerson: 'Wrong Alias', companyName: 'Wrong Fallback' } as Lead, columns(['name']));
  expect(screen.getAllByRole('row')[1].querySelectorAll('td')[2].textContent).toContain(expected);
  expect(screen.queryByText('Wrong Alias')).toBeNull();
  expect(screen.queryByText('Wrong Fallback')).toBeNull();
});

it('links phone and Account by their canonical values without navigating the Lead', () => {
  const navigate = vi.fn();
  const lead = toFrontendContact({ id: 'lead', firstName: 'Josh', lastName: 'Tiron', phone: '+639123456789',
    accountId: 'account-123', account: { id: 'account-123', name: 'Canonical Account' }, companyName: 'Unrelated company',
  }) as Lead;
  renderLead(lead, columns(['name', 'phone', 'accountId']), { onRowClick: navigate });
  const phone = screen.getByRole('link', { name: '+639123456789' });
  expect(phone.getAttribute('href')).toBe('tel:+639123456789');
  fireEvent.click(phone);
  expect(navigate).not.toHaveBeenCalled();
  const account = screen.getByRole('link', { name: 'Canonical Account' });
  expect(account.getAttribute('href')).toContain('account-123');
  expect(screen.queryByText('Unrelated company')).toBeNull();
});
