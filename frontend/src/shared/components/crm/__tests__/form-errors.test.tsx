vi.mock('@/shared/hooks/use-crm-record-access', () => ({ useCrmRecordAccess: () => ({ canMutate: () => true, canReassign: true, policy: { userId: 'actor', tenantId: 'tenant', assignmentRestricted: false, clientAdmin: true } }) }));
import React from 'react';
vi.mock('@/shared/hooks/use-email-availability', () => ({ useEmailAvailability: (email: string) => ({ available: true, blocked: false, confirm: () => true, email: email.trim(), retry: vi.fn(), reject: vi.fn() }) }));
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { InlineEditRows } from '../inline-edit-rows';
import { INTERNAL_EMPLOYEE_CUSTOMER_EMAIL_ERROR as employeeMessage } from '@leadcrm/shared';
import { toast } from '@/shared/utils/toast';
vi.mock('@/shared/utils/toast', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/store/DataContext', () => ({ useData: () => ({ users: [], organizations: [], contacts: [], pipelines: [] }) }));
vi.mock('@/store/AuthContext', () => ({ useAuth: () => ({ user: { role: 'Client Admin' }, userCan: () => true }) }));
vi.mock('@/shared/hooks/use-permissions', () => ({ useHasPermission: () => true }));
vi.mock('@/shared/hooks/use-scroll-to-error', () => ({ useScrollToError: vi.fn() }));
vi.mock('@/features/tenant/crm/deals/ui/deal-account-field', () => ({ DealAccountField: () => <div /> }));
vi.mock('@/features/tenant/crm/deals/ui/deal-contacts-field', () => ({ DealContactsField: () => <div /> }));
import { AddLeadForm } from '@/features/tenant/crm/leads/ui/lead-form';
import { ContactFormInner } from '@/features/tenant/crm/contacts/ui/contact-form';
import { AccountFormInner } from '@/features/tenant/crm/accounts/ui/account-form';
import { DealForm } from '@/features/tenant/crm/deals/ui/deal-form';
import { DealEditForm } from '@/features/tenant/crm/deals/ui/deal-edit-form';
import type { Deal } from '@/store/types';
import { EntityCombobox } from '@/shared/components/entity-combobox';
afterEach(cleanup);
it('keeps an inline employee email edit open with an error toast and accepts correction', async () => {
  vi.clearAllMocks();
  const save = vi.fn().mockRejectedValueOnce(Object.assign(new Error(employeeMessage), { status: 400, fieldErrors: { email: [employeeMessage] } })).mockResolvedValue(undefined);
  render(<InlineEditRows canEdit onSave={save} rows={[{ label: 'Email', apiField: 'email', value: 'customer@example.test', type: 'email' }]} />);
  fireEvent.click(screen.getByRole('button', { name: 'Edit Email' }));
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'employee@example.test' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await screen.findByRole('alert');
  expect(screen.getByRole('alert').textContent).toBe(employeeMessage);
  expect(screen.getByLabelText('Email')).toHaveProperty('value', 'employee@example.test');
  expect(toast.error).toHaveBeenCalledExactlyOnceWith(employeeMessage);
  expect(toast.success).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'external@example.test' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.queryByLabelText('Email')).toBeNull());
});
beforeEach(() => { HTMLElement.prototype.scrollIntoView = vi.fn(); });

const emptyDeal: Deal = {
  id: 'deal', tenantId: 'tenant', pipelineId: 'pipeline', stageId: 'stage', title: '',
  contactIds: [], value: 0, order: 0, priority: 'MEDIUM', companyName: '', contactPerson: '',
  createdAt: '2026-09-24T00:00:00Z',
};

const cases = [
  { name: 'Lead', component: <AddLeadForm onSave={vi.fn()} onCancel={vi.fn()} />, labels: ['First Name *', 'Last Name *'] },
  { name: 'Contact', component: <ContactFormInner onSave={vi.fn()} onCancel={vi.fn()} />, labels: ['First Name *', 'Last Name *'] },
  { name: 'Account', component: <AccountFormInner onSave={vi.fn()} onCancel={vi.fn()} />, labels: ['Account Name *'] },
  { name: 'New Deal', component: <DealForm mode="create" onSubmit={vi.fn()} onCancel={vi.fn()} />, labels: ['Title *'] },
  { name: 'Edit Deal', component: <DealEditForm deal={emptyDeal} onSave={vi.fn()} onCancel={vi.fn()} />, labels: ['Title *'] },
];
it.each(cases)('$name renders one accessible error below each required field', async ({ name, component, labels }) => {
  const { container } = render(component);
  fireEvent.submit(container.querySelector('form')!);
  for (const label of labels) {
    const input = screen.getByLabelText(label);
    const expectedMessage = name === 'Lead' ? 'Name is required' : label.startsWith('First') ? 'First name is required' : label.startsWith('Last') ? 'Last name is required' : label.startsWith('Account') ? 'Account name is required.' : 'Title is required';
    await screen.findAllByText(expectedMessage);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const error = document.getElementById(input.getAttribute('aria-describedby')!);
    expect(error).not.toBeNull();
    expect(within(error!.parentElement!).getAllByText(expectedMessage)).toHaveLength(1);
    expect(input.compareDocumentPosition(error!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.querySelector(`label[for="${input.id}"]`)?.textContent).toBe(label);
    expect(input.className).toContain('border-red-500');
  }
});

it('keeps one associated selector error when opening the account search', () => {
  render(<EntityCombobox entityType="accounts" value={null} onChange={vi.fn()} error="Invalid account" />);
  const trigger = screen.getByRole('combobox');
  const error = screen.getByRole('alert');
  expect(trigger.getAttribute('aria-invalid')).toBe('true');
  expect(trigger.getAttribute('aria-describedby')).toBe(error.id);
  expect(trigger.compareDocumentPosition(error) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  fireEvent.click(trigger);
  expect(screen.getAllByText('Invalid account')).toHaveLength(1);
  expect(screen.getByRole('combobox', { name: 'Search accounts' }).getAttribute('aria-describedby')).toBe(error.id);
});


it.each([
  { name: 'Contact', component: <ContactFormInner onSave={vi.fn()} onCancel={vi.fn()} />, labels: ['First Name *', 'Last Name *'] },
  { name: 'Account', component: <AccountFormInner onSave={vi.fn()} onCancel={vi.fn()} />, labels: ['Account Name *'] },
])('rejects whitespace in required $name fields', async ({ component, labels }) => {
  render(component);
  for (const label of labels) fireEvent.change(screen.getByLabelText(label), { target: { value: '   ' } });
  fireEvent.submit(screen.getByLabelText(labels[0]).closest('form')!);
  for (const label of labels) {
    await screen.findByText(label.startsWith('First') ? 'First name is required' : label.startsWith('Last') ? 'Last name is required' : 'Account name is required.');
    expect(screen.getByLabelText(label).getAttribute('aria-invalid')).toBe('true');
  }
});
