import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({ role: 'Sales' }));
vi.mock('@/store/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'current', tenantId: 'tenant', role: mocks.role } }),
}));
vi.mock('@/store/DataContext', () => ({ useData: () => ({ users: [] }) }));
vi.mock('../team-management-users', () => ({ UsersSubTab: ({ renderHeader }: { renderHeader: (action: React.ReactNode) => React.ReactNode }) => <>{renderHeader(null)}<div>Users tab content</div></> }));
vi.mock('../team-management-groups', () => ({ GroupsSubTab: ({ renderHeader }: { renderHeader: (action: React.ReactNode) => React.ReactNode }) => <>{renderHeader(null)}<div>Groups tab content</div></> }));

import { TeamManagement } from '../team-management';

afterEach(() => { cleanup(); mocks.role = 'Sales'; });

it('shows only Groups to non-admin roles and opens the Groups content', async () => {
  render(<TeamManagement />);
  expect(screen.queryByRole('button', { name: 'Users' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Groups' })).toBeTruthy();
  expect(await screen.findByText('Groups tab content')).toBeTruthy();
  expect(screen.queryByText('Users tab content')).toBeNull();
});

it('shows Users and Groups to Client Admin', async () => {
  mocks.role = 'Client Admin';
  render(<TeamManagement />);
  expect(screen.getByRole('button', { name: 'Users' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Groups' })).toBeTruthy();
  expect(await screen.findByText('Users tab content')).toBeTruthy();
});
