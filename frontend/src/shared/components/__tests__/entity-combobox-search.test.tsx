import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
const state = vi.hoisted(() => ({ leads: vi.fn(), contacts: vi.fn(), accounts: vi.fn(), contact: vi.fn(), lead: vi.fn(), account: vi.fn() }));
vi.mock('@/lib/config', () => ({ USE_MOCK_DATA: false }));
vi.mock('@/store/DataContext', () => ({ useData: () => ({ users: [], contacts: [{ id: 'wrong-lead-id', firstName: 'Lead', lastName: 'Only' }], organizations: [], pipelines: [] }) }));
vi.mock('@/store/AuthContext', () => ({ useAuth: () => ({ user: { id: 'actor', tenantId: 'tenant' } }) }));
vi.mock('@/features/tenant/crm/leads/services/leads.service', () => ({ leadsService: { getAll: state.leads, getById: state.lead } }));
vi.mock('@/features/tenant/crm/accounts/services/accounts.service', () => ({ accountsService: { getAll: state.accounts, getById: state.account } }));
vi.mock('@/shared/services/contacts-v2.api', () => ({ contactsV2Api: { list: state.contacts, get: state.contact } }));
import { EntityCombobox } from '../entity-combobox';
beforeEach(() => { vi.clearAllMocks(); state.leads.mockResolvedValue({ data: [] }); state.contacts.mockResolvedValue({ data: [] }); state.accounts.mockResolvedValue({ data: [] }); });
afterEach(cleanup);
it('keeps its linked required label and validation accessible while opening search', () => {
  render(<><label id="recipient-label" htmlFor="recipient-input">Recipient <span aria-hidden="true">*</span></label>
    <EntityCombobox id="recipient-input" aria-labelledby="recipient-label" aria-required="true" error="Choose a recipient." entityType="leads" value={null} onChange={vi.fn()} debounceMs={0} /></>);
  const trigger = screen.getByRole('combobox', { name: 'Recipient' });
  expect(trigger.id).toBe('recipient-input'); expect(trigger.getAttribute('aria-required')).toBe('true'); expect(trigger.getAttribute('aria-invalid')).toBe('true');
  expect(document.getElementById(trigger.getAttribute('aria-describedby')!)?.textContent).toBe('Choose a recipient.');
  fireEvent.click(trigger);
  const search = screen.getByRole('combobox', { name: 'Recipient' });
  expect(search.tagName).toBe('INPUT'); expect(search.id).toBe('recipient-input'); expect(search.getAttribute('aria-required')).toBe('true');
});
it('uses canonical Contact IDs and searches past unloaded context pages', async () => {
  state.contacts.mockImplementation(({ search }) => Promise.resolve({ data: search ? [{ id: 'contact-id', firstName: 'Mary Jane', lastName: 'Cruz', email: 'mary@example.test' }] : [] }));
  const select = vi.fn(); render(<EntityCombobox entityType="contacts" value={null} onChange={select} debounceMs={0} />);
  fireEvent.click(screen.getByRole('combobox'));
  fireEvent.change(screen.getByRole('combobox', { name: 'Search contacts' }), { target: { value: ' Mary   Cruz ' } });
  fireEvent.click(await screen.findByRole('option', { name: /Mary Jane Cruz/ }));
  expect(state.contacts).toHaveBeenCalledWith({ search: 'Mary   Cruz', limit: 50 }, expect.any(AbortSignal));
  expect(state.leads).not.toHaveBeenCalled();
  expect(screen.queryByText('Lead Only')).toBeNull();
  expect(select).toHaveBeenCalledWith('contact-id');
});
it('loads saved selections directly when absent from the first page', async () => {
  state.contact.mockResolvedValue({ data: { id: 'selected', firstName: 'Previously', lastName: 'Chosen' } });
  render(<EntityCombobox entityType="contacts" value="selected" onChange={vi.fn()} debounceMs={0} />);
  await screen.findByText('Previously Chosen');
  expect(state.contact).toHaveBeenCalledWith('selected');
});
it('shows an API failure and retries the current search', async () => {
  state.accounts.mockRejectedValueOnce(new Error('Unable to search accounts')).mockResolvedValue({ data: [{ id: 'account', name: 'Recovered Account' }] });
  render(<EntityCombobox entityType="accounts" value={null} onChange={vi.fn()} debounceMs={0} />);
  fireEvent.click(screen.getByRole('combobox'));
  await screen.findByText('Unable to search accounts'); fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await screen.findByRole('option', { name: 'Recovered Account' });
  expect(state.accounts).toHaveBeenCalledTimes(2);
});
it('ignores stale results as the query changes', async () => {
  let resolveOld!: (value: unknown) => void;
  state.leads.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; })).mockResolvedValue({ data: [{ id: 'new', firstName: 'Current', lastName: 'Lead' }] });
  render(<EntityCombobox entityType="leads" value={null} onChange={vi.fn()} debounceMs={0} />);
  fireEvent.click(screen.getByRole('combobox')); await waitFor(() => expect(state.leads).toHaveBeenCalled());
  fireEvent.change(screen.getByRole('combobox', { name: 'Search leads' }), { target: { value: 'current' } });
  resolveOld({ data: [{ id: 'old', firstName: 'Stale', lastName: 'Lead' }] });
  await screen.findByRole('option', { name: 'Current Lead' }); expect(screen.queryByText('Stale Lead')).toBeNull();
});
