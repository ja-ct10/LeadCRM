import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
const mocks = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock('@/store/AuthContext', () => ({ useAuth: () => ({ user: { id: 'admin', tenantId: 't' }, userCan: () => true }) }));
vi.mock('@/store/DataContext', () => ({ useData: () => ({ roles: [{ id: 'r', name: 'Sales', isArchived: false, isSystemRole: false }], refreshRoles: vi.fn() }) }));
vi.mock('@/features/tenant/administration/users/services/users.service', () => ({ usersService: { getAll: mocks.list } }));
vi.mock('@/shared/services/invitations.api', () => ({ invitationsApi: { list: async () => ({ data: [] }) } }));
import { UsersSubTab } from '../team-management-users';
beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);
it('keeps the toolbar/header, shows a spinner until API rows arrive and opens readonly details', async () => {
  let resolve!: (value: unknown) => void;
  mocks.list.mockReturnValueOnce(new Promise(done => { resolve = done; }));
  render(<UsersSubTab />);
  expect(screen.getByPlaceholderText('Search users...')).toBeTruthy();
  expect(screen.getByText('Loading users...').querySelector('.animate-spin')).toBeTruthy();
  expect(screen.queryByText('No users found')).toBeNull();
  resolve({ data: [{ id: 'u', tenantId: 't', firstName: 'Juan', lastName: 'Dela Cruz', email: 'juan@camxian.com', role: 'Sales', status: 'active' }], meta: { hasMore: false } });
  fireEvent.click(await screen.findByRole('button', { name: 'View Juan Dela Cruz' }));
  expect(await screen.findByText('User Details')).toBeTruthy();
  expect(screen.queryByText('Save Changes')).toBeNull();
  expect(screen.getByText('Edit User')).toBeTruthy();
});
it('shows retry on fetch failure and a genuine empty state after retry', async () => {
  mocks.list.mockRejectedValueOnce(new Error('Network unavailable')).mockResolvedValueOnce({ data: [], meta: { hasMore: false } });
  render(<UsersSubTab />);
  await screen.findByText('Network unavailable');
  fireEvent.click(screen.getByText('Retry'));
  expect(await screen.findByText('No users found')).toBeTruthy();
});

it('uses a responsive filter rail with persisted departments and roles and combines filters', async () => {
  mocks.list.mockResolvedValue({ data: [
    { id: 'a', tenantId: 't', firstName: 'Ana', lastName: 'Sales', role: 'Sales', status: 'active', department: 'Field', email: 'a@camxian.com' },
    { id: 'b', tenantId: 't', firstName: 'Ben', lastName: 'Sales', role: 'Sales', status: 'inactive', isArchived: true, department: 'Field', email: 'b@camxian.com' },
    { id: 'c', tenantId: 't', firstName: 'Cal', lastName: 'Sales', role: 'Sales', status: 'active', department: 'Office', email: 'c@camxian.com' },
    { id: 'd', tenantId: 't', firstName: 'Deleted', lastName: 'User', role: 'Sales', isArchived: true, department: 'Archived department', email: 'd@camxian.com' },
  ], meta: { hasMore: false } });
  render(<UsersSubTab />); await screen.findByRole('button', { name: 'View Ana Sales' });
  for (const label of ['Show archived', 'Export', 'Invite']) expect(screen.queryByText(label)).toBeNull();
  expect(screen.queryByRole('complementary')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
  const panel = screen.getByRole('complementary', { name: 'User filters' });
  expect(panel.className).toContain('fixed');
  expect(panel.className).toContain('sm:static');
  expect(screen.queryByLabelText('Filter by Pending')).toBeNull();
  expect(screen.getByLabelText('Filter by Archived department')).toBeTruthy();
  fireEvent.click(screen.getByLabelText('Filter by Active'));
  expect(screen.queryByRole('button', { name: 'View Ben Sales' })).toBeNull();
  fireEvent.click(screen.getByLabelText('Filter by Field'));
  fireEvent.click(screen.getByLabelText('Filter by Sales'));
  expect(screen.getByRole('button', { name: 'View Ana Sales' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'View Cal Sales' })).toBeNull();
  fireEvent.click(screen.getByLabelText('Filter by Inactive'));
  expect(screen.getByRole('button', { name: 'View Ben Sales' })).toBeTruthy();
  fireEvent.click(screen.getByLabelText('Close filters'));
  expect(screen.queryByRole('complementary')).toBeNull();
});
