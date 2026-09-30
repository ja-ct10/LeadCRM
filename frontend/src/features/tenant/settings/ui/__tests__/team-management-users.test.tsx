import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
const mocks = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock('@/store/AuthContext', () => ({ useAuth: () => ({ user: { id: 'admin', tenantId: 't' }, userCan: () => true }) }));
vi.mock('@/store/DataContext', () => ({ useData: () => ({ roles: [{ id: 'r', name: 'Sales', isArchived: false, isSystemRole: false }], refreshRoles: vi.fn() }) }));
vi.mock('@/features/tenant/administration/users/services/users.service', () => ({ usersService: { getAll: mocks.list } }));
vi.mock('@/shared/services/invitations.api', () => ({ invitationsApi: { list: async () => ({ data: [] }) } }));
import { UsersSubTab } from '../team-management-users';
beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);
it('renders saved avatars through the tenant endpoint and falls back on missing or broken images', async () => {
  mocks.list.mockResolvedValue({ data: [
    { id: 'photo', tenantId: 't', firstName: 'Ana', lastName: 'Photo', avatarUrl: '/api/proxy/auth/profile/avatar/saved-image', role: 'Sales' },
    { id: 'missing', tenantId: 't', firstName: 'Ben', lastName: 'Missing', role: 'Sales' },
  ] });
  render(<UsersSubTab />);
  const image = await screen.findByRole('img', { name: 'Ana Photo' });
  expect(image.getAttribute('src')).toBe('/api/proxy/administration/users/photo/avatar/saved-image');
  expect(screen.getByText('BM')).toBeTruthy();
  fireEvent.error(image);
  expect(screen.queryByRole('img', { name: 'Ana Photo' })).toBeNull();
  expect(screen.getByText('AP')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Filter users' }).title).toBe('Filter users');
  expect(screen.getByRole('button', { name: 'New user' }).title).toBe('New user');
});
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
  fireEvent.click(screen.getByRole('button', { name: 'Filter users' }));
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

it('shows Leads pagination on a single page and pages the complete API-backed user set', async () => {
  const users = Array.from({ length: 27 }, (_, index) => ({ id: String(index), tenantId: 't', firstName: 'Saved', lastName: `User ${index}`, email: `user${index}@example.com`, role: 'Sales', status: 'active' }));
  mocks.list.mockResolvedValue({ data: users, meta: { total: 27, page: 1, limit: 100, hasMore: false } });
  render(<UsersSubTab />); await screen.findByText('Page 1 of 2');
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
  await screen.findByText('Saved User 26');
  expect(screen.queryByText('Saved User 0')).toBeNull();
  fireEvent.click(screen.getByLabelText('Records per page'));
  fireEvent.click(screen.getByRole('option', { name: '50' }));
  await screen.findByText('Page 1 of 1');
  expect(screen.queryByText('27 total records')).toBeNull();
  expect((screen.getByLabelText('Next page') as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByPlaceholderText('Search users...'), { target: { value: 'user26@' } });
  await waitFor(() => expect(screen.queryByText('Saved User 0')).toBeNull());
  expect(screen.getByText('Saved User 26')).toBeTruthy();
});
