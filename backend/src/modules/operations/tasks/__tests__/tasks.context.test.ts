import { expect, it, vi } from 'vitest';
import type { TaskRecord } from '@leadcrm/shared';
vi.mock('../tasks.repository', () => ({ findTaskRecordContext: vi.fn() }));
import { withTaskContext } from '../tasks.context';

const task: TaskRecord = { id: 'task', tenantId: 'tenant', title: 'Workflow follow-up', description: '', status: 'pending', dueDate: '2030-01-01T00:00:00Z', createdAt: '2026-10-01T00:00:00Z', assignedUserId: 'owner', dealIds: ['deal'], accountIds: ['account'], accountId: 'account' };
const person = (id: string, tenantId = 'tenant') => ({ id, tenantId, firstName: id, lastName: 'Person' });
const account = { id: 'account', tenantId: 'tenant', name: 'Acme' };

it('derives the Account through Deals and clears retired direct Account response fields', () => {
  const result = withTaskContext(task, { leads: [], contacts: [], deals: [{ id: 'deal', tenantId: 'tenant', title: 'Expansion', organization: account, leadDeals: [{ lead: { ...person('lead'), contactId: null, convertedAt: null } }], contactDeals: [{ contact: person('contact') }] }] });
  expect(result.relatedRecords).toEqual([
    { kind: 'account', id: 'account', label: 'Acme', via: 'Deal: Expansion' },
    { kind: 'lead', id: 'lead', label: 'lead Person', via: 'Deal: Expansion' },
    { kind: 'contact', id: 'contact', label: 'contact Person', via: 'Deal: Expansion' },
  ]);
  expect(result.dealIds).toEqual(['deal']);
  expect(result.leadIds).toBeUndefined();
  expect(result).toMatchObject({ accountId: null, accountIds: [], account: null, accounts: [] });
});

it('keeps foreign-tenant and unrelated source records out of the response', () => {
  const result = withTaskContext(task, { leads: [], contacts: [], deals: [
    { id: 'deal', tenantId: 'tenant', title: 'Expansion', organization: { ...account, id: 'foreign', tenantId: 'foreign' }, leadDeals: [], contactDeals: [] },
    { id: 'unrelated', tenantId: 'tenant', title: 'Other', organization: null, leadDeals: [], contactDeals: [] },
  ] });
  expect(result.relatedRecords).toEqual([]);
  expect(result.accounts).toEqual([]);
  expect(result.account).toBeNull();
});

it('includes the connected Account, converted Contact, and all Deals for a Lead task', () => {
  const deal = { id: 'deal', tenantId: 'tenant', title: 'Expansion' };
  const result = withTaskContext({ ...task, dealIds: [], accountIds: [], accountId: null, leadIds: ['lead'] }, {
    leads: [{ ...person('lead'), account, convertedContact: person('contact'), leadDeals: [{ deal }] }], contacts: [], deals: [],
  });
  expect(result.relatedRecords?.map(row => row.kind)).toEqual(['contact', 'account', 'deal']);
  expect(result.contactIds).toBeUndefined();
});

it('does not turn a retired Account-only association into current CRM context', () => {
  const result = withTaskContext({ ...task, dealIds: [] }, { leads: [], contacts: [], deals: [] });
  expect(result).toMatchObject({ accountId: null, accountIds: [], account: null, accounts: [], relatedRecords: [], dealIds: [] });
});
