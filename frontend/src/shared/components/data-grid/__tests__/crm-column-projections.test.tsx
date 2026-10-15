import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ACCOUNTS_TABLE_COLUMNS, CONTACTS_TABLE_COLUMNS, DEALS_TABLE_COLUMNS, CAMPAIGNS_TABLE_COLUMNS, WORKFLOWS_TABLE_COLUMNS, USERS_TABLE_COLUMNS, type ColumnDefinition } from '@leadcrm/shared';
import { MODULE_COLUMN_REGISTRIES } from '@/shared/constants/column-registries';
import { COLUMN_REGISTRIES } from '../../../../../../backend/src/modules/preferences/column-registry';
import { AccountsDataGrid } from '@/features/tenant/crm/accounts/ui/accounts-data-grid';
import { ContactsDataGrid } from '@/features/tenant/crm/contacts/ui/contacts-data-grid';
import { DealsDataGrid } from '@/features/tenant/crm/deals/ui/deals-data-grid';
import type { Account } from '@/features/tenant/crm/accounts/types/account.types';
import type { Contact, Deal } from '@/store/types';

vi.mock('@/shared/hooks/use-field-layout', () => ({ useConfiguredCrmColumns: (_module: string, columns: unknown[]) => columns }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/shared/hooks/use-crm-record-access', () => ({ useCrmRecordAccess: () => ({ canMutate: () => true }) }));
vi.mock('@/store/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user' }, userCan: () => true }) }));
const all = (registry: ColumnDefinition[]) => registry.map(column => ({ id: column.id, visible: true, order: column.defaultOrder }));
const controls = { onRowClick: vi.fn(), selectedIds: new Set<string>(), onSelectionChange: vi.fn() };
afterEach(cleanup);
beforeEach(() => { vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} }); });

it('uses the same module choices in the client fallback and server defaults', () => {
  for (const [module, columns] of Object.entries({ accounts: ACCOUNTS_TABLE_COLUMNS, contacts: CONTACTS_TABLE_COLUMNS, deals: DEALS_TABLE_COLUMNS, campaigns: CAMPAIGNS_TABLE_COLUMNS, workflows: WORKFLOWS_TABLE_COLUMNS, users: USERS_TABLE_COLUMNS })) {
    expect(MODULE_COLUMN_REGISTRIES[module]).toBe(columns);
    expect(COLUMN_REGISTRIES[module].columns).toBe(columns);
    expect(columns.map(column => column.defaultOrder)).toEqual(columns.map((_, index) => index));
    expect(new Set(columns.map(column => column.id)).size).toBe(columns.length);
  }
});

it('renders supported Account columns without retired ownership', () => {
  const account: Account = { id: 'account', tenantId: 'tenant', name: 'Acme', industry: 'Services', size: 'Small', address: '42 Main Street, Manila, Philippines', website: 'example.test', tags: ['Partner'], createdAt: '2026-10-01T00:00:00Z' };
  render(<AccountsDataGrid accounts={[account]} totalRecords={1} effectiveColumns={all(ACCOUNTS_TABLE_COLUMNS)} {...controls} />);
  for (const column of ACCOUNTS_TABLE_COLUMNS) expect(screen.getByRole('columnheader', { name: new RegExp(column.label) })).toBeTruthy();
  const cells = screen.getAllByRole('row')[1].querySelectorAll('td');
  expect([...cells].slice(2).every(cell => cell.textContent?.trim() && cell.textContent.trim() !== '—')).toBe(true);
  expect(screen.queryByRole('columnheader', { name: 'Assigned Agent' })).toBeNull();
  expect(screen.getAllByText('42 Main Street, Manila, Philippines').length).toBeGreaterThan(0);
  for (const label of ['Active Products', 'Internal Notes', 'City', 'Province', 'Country']) expect(screen.queryByRole('columnheader', { name: label })).toBeNull();
});

it('keeps Contact company text separate from the linked Account and navigates by its ID', () => {
  const contact: Contact = { id: 'contact', tenantId: 'tenant', firstName: 'Mary Ann', lastName: 'De la Cruz', email: 'mary@example.test', phone: '09123456789', companyName: 'Stored Company', source: 'Referral', status: 'Warm', accountId: 'account-id', account: { id: 'account-id', name: 'Linked Account' }, assignedUser: { id: 'user', firstName: 'Sam', lastName: 'Agent' }, createdAt: '2026-10-01T00:00:00Z' };
  render(<ContactsDataGrid contacts={[contact]} totalRecords={1} effectiveColumns={all(CONTACTS_TABLE_COLUMNS)} getAccountName={row => row.account?.name || 'Wrong fallback'} getAssignedUserName={() => 'Incorrect fallback'} {...controls} />);
  for (const column of CONTACTS_TABLE_COLUMNS) expect(screen.getByRole('columnheader', { name: new RegExp(column.label) })).toBeTruthy();
  expect(screen.getByText('Stored Company').closest('a')).toBeNull();
  expect(screen.getByRole('link', { name: 'Linked Account' }).getAttribute('href')).toBe('/crm/accounts/account-id');
  expect(screen.getByText('Mary Ann')).toBeTruthy();
  expect(screen.getByText('De la Cruz')).toBeTruthy();
});

it('does not invent an Account relation from a Deal company display alias', () => {
  const deal = { id: 'deal', tenantId: 'tenant', title: 'Expansion', value: 500, order: 0, companyName: 'Unlinked Company', contactPerson: '', pipelineId: 'pipeline', stageId: 'stage', priority: 'Medium', createdAt: '2026-10-01T00:00:00Z' } as Deal;
  render(<DealsDataGrid deals={[deal]} totalRecords={1} effectiveColumns={all(DEALS_TABLE_COLUMNS)} stageNameMap={{ stage: 'Qualification' }} getAccountName={() => 'Wrong fallback'} getAssignedUserName={() => 'Unassigned'} {...controls} />);
  expect(screen.queryByRole('link')).toBeNull();
  expect(screen.getByRole('columnheader', { name: /Account/ })).toBeTruthy();
});
