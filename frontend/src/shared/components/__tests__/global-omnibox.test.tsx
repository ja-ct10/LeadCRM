import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NAVIGATION_INTENT_EVENT, type NavigationAction, type NavigationIntentEvent } from '@/shared/lib/navigation-intent';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ leads: vi.fn(), contacts: vi.fn(), accounts: vi.fn(), deals: vi.fn(), push: vi.fn(), permissions: ['leads', 'contacts', 'accounts', 'deals'] }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('@/store/AuthContext', () => ({ useAuth: () => ({ tenant: { id: 't' }, user: { id: 'u', }, userCan: (module: string) => mocks.permissions.includes(module) }) }));
vi.mock('@/store/DataContext', () => ({ useData: () => ({ deals: [{ id: 'deal-id', title: 'Johnny deal', companyName: 'Jact' }] }) }));
vi.mock('@/features/tenant/crm/leads/services/leads.service', () => ({ leadsService: { getAll: mocks.leads } }));
vi.mock('@/features/tenant/crm/accounts/services/accounts.service', () => ({ accountsService: { getAll: mocks.accounts } }));
vi.mock('@/shared/services/contacts-v2.api', () => ({ contactsV2Api: { list: mocks.contacts } }));
vi.mock('@/shared/services/deals.api', () => ({ dealsApi: { list: mocks.deals } }));
import { GlobalOmnibox } from '../global-omnibox';
import { MobileSearchOverlay } from '../mobile-search-overlay';
beforeEach(() => {
  vi.clearAllMocks();
  mocks.permissions = ['leads', 'contacts', 'accounts', 'deals'];
  mocks.leads.mockResolvedValue({ data: [{ id: 'lead-id', firstName: ' Johnny ', lastName: ' Sins ', companyName: 'Jact Inc.', email: 'johnny123@gmail.com' }] });
  mocks.contacts.mockResolvedValue({ data: [{ id: 'contact-id', firstName: ' May Ann ', lastName: ' Tiron ', companyName: 'Google Inc.', email: 'may@example.com' }] });
  mocks.accounts.mockResolvedValue({ data: [{ id: 'account-id', name: 'Jact account' }] });
  mocks.deals.mockResolvedValue({ data: [{ id: 'deal-id', title: 'Johnny deal', organization: { name: 'Jact' } }] });
});
afterEach(cleanup);
async function search() {
  const input = screen.getByRole('textbox');
  input.focus(); fireEvent.focus(input);
  fireEvent.change(input, { target: { value: 'johnny' } });
  await screen.findByText('Johnny Sins');
  return input as HTMLInputElement;
}
it('defers result selection and its UI changes until the original destination is confirmed', async () => {
  const selected = vi.fn(); render(<GlobalOmnibox onResultSelect={selected} />); const input = await search();
  let pending: NavigationAction | undefined;
  const guard = (event: Event) => { event.preventDefault(); pending = (event as NavigationIntentEvent).detail.navigate; };
  window.addEventListener(NAVIGATION_INTENT_EVENT, guard);
  try {
    fireEvent.click(screen.getByText('Johnny Sins'));
    expect(mocks.push).not.toHaveBeenCalled(); expect(selected).not.toHaveBeenCalled(); expect(input.value).toBe('johnny');
    pending = undefined; expect(screen.getByText('Johnny Sins')).toBeTruthy();
    fireEvent.click(screen.getByText('Johnny Sins'));
    window.removeEventListener(NAVIGATION_INTENT_EVENT, guard); await act(async () => pending?.());
    expect(mocks.push).toHaveBeenCalledOnce(); expect(mocks.push).toHaveBeenCalledWith('/crm/leads?highlight=lead-id');
    expect(selected).toHaveBeenCalledOnce(); expect(input.value).toBe('');
  } finally { window.removeEventListener(NAVIGATION_INTENT_EVENT, guard); }
});
it.each([['Johnny Sins', 'leads', 'lead-id'], ['May Ann Tiron', 'contacts', 'contact-id'], ['Jact account', 'accounts', 'account-id'], ['Johnny deal', 'deals', 'deal-id']])('selects %s, clears and blurs the input, closes results and navigates by ID', async (name, module, id) => {
  const onResultSelect = vi.fn(); render(<GlobalOmnibox onResultSelect={onResultSelect} />);
  const input = await search();
  expect(screen.getByText('Jact Inc. · johnny123@gmail.com')).toBeTruthy();
  fireEvent.click(screen.getByText(name));
  expect(input.value).toBe(''); expect(document.activeElement).not.toBe(input);
  expect(screen.queryByText(name)).toBeNull();
  expect(onResultSelect).toHaveBeenCalledTimes(1);
  expect(mocks.push).toHaveBeenCalledWith(`/crm/${module}?highlight=${id}`);
});
it('closes the actual mobile overlay on selection', async () => {
  function Harness() { const [open, setOpen] = React.useState(true); return <MobileSearchOverlay isOpen={open} onClose={() => setOpen(false)} />; }
  render(<Harness />); await search(); fireEvent.click(screen.getByText('Johnny Sins'));
  await waitFor(() => expect(screen.queryByRole('search')).toBeNull());
});
it('retains the debounce, minimum length and module scope', async () => {
  render(<GlobalOmnibox />);
  const input = screen.getByRole('textbox'); fireEvent.focus(input);
  fireEvent.change(input, { target: { value: 'jo' } });
  await new Promise(resolve => setTimeout(resolve, 350));
  expect(mocks.leads).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Scope Search Module'), { target: { value: 'contacts' } });
  fireEvent.change(input, { target: { value: 'johnny' } });
  expect(mocks.contacts).not.toHaveBeenCalled();
  await screen.findByText('May Ann Tiron');
  expect(mocks.leads).not.toHaveBeenCalled(); expect(mocks.accounts).not.toHaveBeenCalled();
  expect(mocks.deals).not.toHaveBeenCalled();
});
it.each([
  [{ firstName: ' Jane ' }, 'Jane'],
  [{ leadPerson: ' Legacy Name ' }, 'Legacy Name'],
  [{ leadPerson: ' ', displayName: ' Display Name ' }, 'Display Name'],
])('uses safe lead name fallbacks', async (fields, expected) => {
  mocks.leads.mockResolvedValue({ data: [{ id: 'lead', ...fields }] });
  render(<GlobalOmnibox />); const input = screen.getByRole('textbox'); fireEvent.focus(input);
  fireEvent.change(input, { target: { value: 'query' } });
  await screen.findByText(expected); expect(screen.queryByText('undefined undefined')).toBeNull();
});

it('can immediately search the same term again after selecting a result', async () => {
  render(<GlobalOmnibox />); const input = await search();
  fireEvent.click(screen.getByText('Johnny Sins'));
  input.focus(); fireEvent.focus(input);
  fireEvent.change(input, { target: { value: 'johnny' } });
  await screen.findByText('Johnny Sins');
});

it('searches Deals on the server before limiting so records beyond cached pages are discoverable', async () => {
  mocks.deals.mockResolvedValue({ data: [{ id: 'late-deal', title: 'Remote Deal', organization: { name: 'Late Account' } }] });
  render(<GlobalOmnibox />); await search();
  expect(mocks.deals).toHaveBeenCalledWith({ search: 'johnny', limit: 4 });
  fireEvent.click(await screen.findByText('Remote Deal'));
  expect(mocks.push).toHaveBeenCalledWith('/crm/deals?highlight=late-deal');
});
it('skips unauthorized modules and hides their search scopes', async () => {
  mocks.permissions = ['contacts'];
  render(<GlobalOmnibox />); const input = screen.getByRole('textbox'); fireEvent.focus(input);
  fireEvent.change(input, { target: { value: 'johnny' } });
  await screen.findByText('May Ann Tiron');
  expect(mocks.leads).not.toHaveBeenCalled(); expect(mocks.accounts).not.toHaveBeenCalled(); expect(mocks.deals).not.toHaveBeenCalled();
  expect(screen.queryByRole('option', { name: 'Leads' })).toBeNull();
});
it('ignores an older request that resolves after the next query has started', async () => {
  let resolveOld!: (response: unknown) => void;
  mocks.leads.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
  render(<GlobalOmnibox />); const input = screen.getByRole('textbox'); fireEvent.focus(input);
  fireEvent.change(input, { target: { value: 'first' } });
  await waitFor(() => expect(mocks.leads).toHaveBeenCalled());
  fireEvent.change(input, { target: { value: 'second' } });
  resolveOld({ data: [{ id: 'old', firstName: 'Stale', lastName: 'Result' }] });
  await screen.findByText('Johnny Sins');
  expect(screen.queryByText('Stale Result')).toBeNull();
});
