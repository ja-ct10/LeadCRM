import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
const state = vi.hoisted(() => ({ role: 'Client Admin', search: false, leads: vi.fn(), deals: vi.fn() }));
vi.mock('@/store/AuthContext', () => ({ useAuth: () => ({ user: { role: state.role }, userCan: (module: string) => state.role === 'Client Admin' || ['contacts', 'deals'].includes(module) }) }));
vi.mock('@/store/DataContext', () => ({ useData: () => ({ roles: [{ name: 'Sales', permissions: ['contacts.view', 'deals.view'] }] }) }));
vi.mock('@/shared/hooks/use-debounce', () => ({ useDebounce: (value: string) => state.search ? value : '' }));
vi.mock('@/features/tenant/crm/leads/services/leads.service', () => ({ leadsService: { getAll: state.leads } }));
vi.mock('@/shared/services/deals.api', () => ({ dealsApi: { list: state.deals } }));
import CommandPalette from '../command-palette';
beforeEach(() => { vi.clearAllMocks(); state.role = 'Client Admin'; state.search = false; state.leads.mockResolvedValue({ data: [] }); state.deals.mockResolvedValue({ data: [] }); });
afterEach(cleanup);
const show = () => render(<CommandPalette navigate={vi.fn()} isOpen setIsOpen={vi.fn()} />);
it('keeps CRM and team navigation without retired administrative destinations', () => {
  show();
  for (const label of ['Leads', 'Accounts', 'Deals', 'Workflows', 'Users', 'Settings']) expect(screen.getByText(label)).toBeTruthy();
  expect(screen.queryByText('Audit Trail')).toBeNull();
  expect(screen.queryByText('Admin Console')).toBeNull();
});
it('respects custom role grants', () => {
  state.role = 'Sales'; show();
  expect(screen.queryByText('Leads')).toBeNull();
  expect(screen.getByText('Client Profiles')).toBeTruthy();
  expect(screen.getByText('Deals')).toBeTruthy();
  expect(screen.queryByText('Users')).toBeNull();
  expect(screen.queryByText('Campaigns')).toBeNull();
});
it('filters navigation by the entered query', () => {
  show(); fireEvent.change(screen.getByRole('textbox'), { target: { value: 'WORK' } });
  expect(screen.getByText('Workflows')).toBeTruthy();
  expect(screen.queryByText('Leads')).toBeNull();
});
it('filters Deals on the server and navigates to the selected ID', async () => {
  state.search = true; state.deals.mockResolvedValue({ data: [{ id: 'remote', title: 'Matching Deal', organization: { name: 'Acme' } }] });
  const navigate = vi.fn(), close = vi.fn(); render(<CommandPalette navigate={navigate} isOpen setIsOpen={close} />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: ' Acme ' } });
  fireEvent.click(await screen.findByText('Matching Deal'));
  expect(state.deals).toHaveBeenCalledWith({ search: 'Acme', limit: 5 });
  expect(navigate).toHaveBeenCalledWith('/crm/deals?highlight=remote');
  expect(close).toHaveBeenCalledWith(false);
});
it('does not request unauthorized records', async () => {
  state.search = true; state.role = 'Sales'; show();
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Acme' } });
  await waitFor(() => expect(state.deals).toHaveBeenCalled());
  expect(state.leads).not.toHaveBeenCalled();
});
