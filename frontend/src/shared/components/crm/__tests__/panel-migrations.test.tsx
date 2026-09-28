import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
const mocks = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), permissions: ['*'], push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('@/lib/config', () => ({ USE_MOCK_DATA: false }));
vi.mock('@/lib/api/client', () => ({ apiClient: { get: mocks.get, put: mocks.put } }));
vi.mock('@/store/AuthContext', () => ({ useAuth: () => ({ tenant: { id: 'tenant' }, user: { id: 'user', tenantId: 'tenant', role: 'Client Admin', activeEnvironment: 'SANDBOX' } }) }));
vi.mock('@/store/DataContext', () => ({ useData: () => ({ contacts: [], organizations: [], activities: [], users: [], pipelines: [] }) }));
vi.mock('@/shared/hooks/use-permissions', () => ({ useHasPermission: (permission: string) => mocks.permissions.includes('*') || mocks.permissions.includes(permission) }));
vi.mock('@/features/tenant/operations/tasks/ui/related-tasks', () => ({ RelatedTasks: ({ links }: { links: object }) => <div data-testid="related-tasks">{JSON.stringify(links)}</div> }));
vi.mock('@/features/tenant/crm/leads/ui/lead-form', () => ({ LeadFormSheet: () => null }));
vi.mock('@/features/tenant/crm/contacts/ui/contact-form', () => ({ ContactFormSheet: ({ onSave, statusOptions }: { onSave: (value: object) => void; statusOptions: string[] }) => <button onClick={() => onSave({ firstName: 'Nora', lastName: 'Lim', companyName: 'Updated Company', leadSource: 'Referral', productInterest: ['CCTV'], status: 'Warm' })}>Save contact {statusOptions.join(',')}</button> }));
vi.mock('@/features/tenant/crm/accounts/ui/account-form', () => ({ AccountFormSheet: () => null }));
vi.mock('@/features/tenant/crm/leads/ui/convert-lead-dialog', () => ({ ConvertLeadDialog: () => null }));
import { CrmRecordPanel, CrmRecordView, type CrmRecordModule } from '../crm-record-view';
import { clearPageCache } from '@/shared/cache/page-cache';

const records = {
  leads: { id: 'one', firstName: 'Lina', lastName: 'Reyes', email: 'lina@example.test', source: 'Referral', status: 'Warm', productInterest: ['CCTV'], assignedUser: { firstName: 'Sam', lastName: 'Cruz' } },
  contacts: { id: 'one', firstName: 'Nora', lastName: 'Lim', status: 'WARM', company: 'North Company' },
  accounts: { id: 'one', name: 'North Company', industry: 'Services', customerType: 'Prospect', website: 'example.test' },
};
beforeEach(() => {
  clearPageCache(); vi.clearAllMocks(); mocks.permissions = ['*'];
  mocks.get.mockImplementation(async (path: string) => {
    if (path.includes('/relationships')) return { data: { account: null, contact: null, sourceLead: null, deals: [], contacts: [], activities: [] } };
    if (path.includes('/activities')) return { data: [] };
    const module = path.split('/')[2] as CrmRecordModule;
    return { data: records[module] };
  });
});
afterEach(cleanup);

it.each(['leads', 'contacts', 'accounts'] as const)('%s uses the same identity and three tabs on both surfaces', async module => {
  const title = module === 'accounts' ? records.accounts.name : module === 'leads' ? 'Lina Reyes' : 'Nora Lim';
  const panel = render(<CrmRecordPanel module={module} id="one" open onOpenChange={() => {}} />);
  await screen.findByRole('heading', { name: title });
  expect(screen.getByRole('link', { name: /Open full page/ }).getAttribute('href')).toBe(`/crm/${module}/one`);
  expect(screen.getAllByRole('tab').map(el => el.textContent)).toEqual(expect.arrayContaining([expect.stringContaining('Activity'), expect.stringContaining('Details'), 'Files']));
  fireEvent.click(screen.getByRole('tab', { name: /Details/ }));
  await screen.findByRole('button', { name: /^Deals/ });
  expect(screen.getByTestId('related-tasks').textContent).toContain(module === 'leads' ? 'leadId' : module === 'contacts' ? 'contactId' : 'accountId');
  expect(screen.queryByText('Security, Cabling, CCTV')).toBeNull();
  fireEvent.click(screen.getByRole('tab', { name: 'Files' }));
  expect(screen.getByText('No files attached.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /Upload/ })).toBeNull();
  panel.unmount();
  render(<CrmRecordView module={module} id="one" />);
  await screen.findByRole('heading', { name: title });
  expect(screen.getByRole('navigation', { name: 'Breadcrumb' }).textContent).toContain(title);
  expect(screen.queryByRole('link', { name: /Open full page/ })).toBeNull();
});

it('does not refetch relationships when switching tabs and retains collapsible sections', async () => {
  render(<CrmRecordView module="leads" id="one" />);
  await screen.findByText('Lina Reyes', { selector: 'h1' });
  expect(mocks.get.mock.calls.filter(([path]) => path.includes('/relationships'))).toHaveLength(0);
  fireEvent.click(screen.getByRole('tab', { name: /Details/ }));
  await screen.findByRole('button', { name: /Converted contact/ });
  const about = screen.getByRole('button', { name: 'About' });
  fireEvent.click(about);
  expect(about.getAttribute('aria-expanded')).toBe('false');
  fireEvent.click(screen.getByRole('tab', { name: /Activity/ }));
  fireEvent.click(screen.getByRole('tab', { name: /Details/ }));
  expect(mocks.get.mock.calls.filter(([path]) => path.includes('/relationships'))).toHaveLength(1);
});

it('reuses contact relationship history instead of requesting it twice', async () => {
  render(<CrmRecordView module="contacts" id="one" />);
  await screen.findByText('No activity recorded for this record.');
  expect(mocks.get.mock.calls.filter(([path]) => path.includes('/relationships'))).toHaveLength(1);
});

it('hides mutation controls without permissions', async () => {
  mocks.permissions = ['contacts.view'];
  render(<CrmRecordView module="leads" id="one" />);
  await screen.findByRole('heading', { name: 'Lina Reyes' });
  expect(screen.queryByRole('button', { name: 'Record actions' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Warm' })).toBeNull();
  fireEvent.click(screen.getByRole('tab', { name: /Details/ }));
  expect(screen.queryByRole('button', { name: 'Edit record details' })).toBeNull();
});

it('shows related request failures instead of empty relationship counts', async () => {
  const implementation = mocks.get.getMockImplementation()!;
  mocks.get.mockImplementation((path: string) => path.includes('/relationships') ? Promise.reject(new Error('Relationships unavailable')) : implementation(path));
  render(<CrmRecordView module="leads" id="one" />);
  await screen.findByRole('heading', { name: 'Lina Reyes' });
  fireEvent.click(screen.getByRole('tab', { name: /Details/ }));
  await screen.findByText('Relationships unavailable');
  expect(screen.queryByRole('button', { name: /^Deals/ })).toBeNull();
});

it('clears the previous identity while a new record loads', async () => {
  const view = render(<CrmRecordPanel module="leads" id="one" open onOpenChange={() => {}} />);
  await screen.findByRole('heading', { name: 'Lina Reyes' });
  mocks.get.mockImplementation(() => new Promise(() => {}));
  view.rerender(<CrmRecordPanel module="leads" id="two" open onOpenChange={() => {}} />);
  expect(screen.queryByRole('heading', { name: 'Lina Reyes' })).toBeNull();
  expect(screen.getByRole('status', { name: 'Loading lead' })).toBeTruthy();
});

it('shows record access errors with a retry action', async () => {
  mocks.get.mockRejectedValue(Object.assign(new Error('Access denied'), { status: 403 }));
  render(<CrmRecordView module="accounts" id="one" />);
  await screen.findByRole('alert');
  expect(screen.getByRole('alert').textContent).toBe('Access denied');
  expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'North Company' })).toBeNull();
});

it('supports arrow-key tab navigation', async () => {
  render(<CrmRecordView module="leads" id="one" />);
  await screen.findByRole('heading', { name: 'Lina Reyes' });
  const activity = screen.getByRole('tab', { name: /Activity/ });
  activity.focus(); fireEvent.keyDown(activity, { key: 'ArrowRight' });
  await waitFor(() => expect(screen.getByRole('tab', { name: /Details/ }).getAttribute('aria-selected')).toBe('true'));
});

it('maps the existing Contact editor to canonical API fields', async () => {
  mocks.put.mockResolvedValue({ success: true });
  render(<CrmRecordView module="contacts" id="one" />);
  await screen.findByRole('heading', { name: 'Nora Lim' });
  fireEvent.click(screen.getByRole('tab', { name: /Details/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Edit record details' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save contact Hot,Warm,Cold,Cancelled,Closed' }));
  await waitFor(() => expect(mocks.put).toHaveBeenCalledWith('/crm/contacts/one', {
    firstName: 'Nora', lastName: 'Lim', company: 'Updated Company', source: 'Referral', productInterests: ['CCTV'], status: 'WARM',
  }));
});
