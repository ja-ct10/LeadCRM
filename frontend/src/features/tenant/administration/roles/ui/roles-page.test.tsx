import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import RolesPage from './roles-page';

const state = vi.hoisted(() => ({ roles: [] as Array<{ id: string; name: string; userCount: number; isSystemRole: boolean; permissions: [] }>,
  canDelete: true, remove: vi.fn(), success: vi.fn() }));
vi.mock('@/shared/hooks/use-permissions', () => ({ useHasPermission: (key: string) => key === 'roles.archive' ? state.canDelete : true }));
vi.mock('sonner', () => ({ toast: { success: state.success } }));
vi.mock('../hooks/use-roles', () => ({ useRoles: () => ({ isLoading: false, error: null, searchQuery: '', setSearchQuery: vi.fn(),
  filteredRoles: state.roles, selectedRole: null, isDetailOpen: false, isBuilderOpen: false, editingRole: null,
  openDetail: vi.fn(), closeDetail: vi.fn(), openBuilder: vi.fn(), closeBuilder: vi.fn(), refetch: vi.fn(), handleArchive: state.remove }) }));
vi.mock('./role-builder-modal', () => ({ RoleBuilderModal: () => null }));
vi.mock('./role-detail-drawer', () => ({ RoleDetailDrawer: () => null }));
vi.mock('./permissions-tab', () => ({ PermissionsTab: () => null }));

beforeEach(() => { vi.clearAllMocks(); state.canDelete = true; state.roles = [{ id: 'role', name: 'Staff', userCount: 0, isSystemRole: false, permissions: [] }]; });
afterEach(cleanup);

it('blocks assigned role deletion on the administration page with a close-only warning', () => {
  state.roles[0].userCount = 2;
  render(<RolesPage />); fireEvent.click(screen.getByRole('button', { name: 'Delete Role' }));
  const dialog = screen.getByRole('alertdialog', { name: 'Role cannot be deleted' });
  expect(within(dialog).queryByRole('button', { name: 'Delete Role' })).toBeNull();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
  expect(state.remove).not.toHaveBeenCalled();
});

it('confirms once and removes an unassigned role after success on the administration page', async () => {
  let finish!: () => void;
  state.remove.mockImplementationOnce(async () => { await new Promise<void>(done => { finish = done; }); state.roles = []; });
  render(<RolesPage />); fireEvent.click(screen.getByRole('button', { name: 'Delete Role' }));
  const confirm = within(screen.getByRole('alertdialog', { name: 'Delete role?' })).getByRole('button', { name: 'Delete Role' });
  fireEvent.click(confirm); fireEvent.click(confirm);
  expect(state.remove).toHaveBeenCalledExactlyOnceWith('role');
  await act(async () => finish());
  await waitFor(() => expect(screen.queryByText('Staff')).toBeNull());
  expect(screen.queryByRole('alertdialog')).toBeNull(); expect(state.success).toHaveBeenCalledWith('Role deleted');
});

it('keeps system roles protected and closes a confirmation when the existing archive grant is revoked', () => {
  const view = render(<RolesPage />); fireEvent.click(screen.getByRole('button', { name: 'Delete Role' }));
  state.canDelete = false; view.rerender(<RolesPage />);
  expect(screen.queryByRole('alertdialog')).toBeNull(); expect(state.remove).not.toHaveBeenCalled();
  state.roles[0].isSystemRole = true; state.canDelete = true; view.rerender(<RolesPage />);
  expect(screen.queryByRole('button', { name: 'Delete Role' })).toBeNull();
});
