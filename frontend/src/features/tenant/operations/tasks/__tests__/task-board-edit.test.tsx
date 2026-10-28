import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { TaskRecord } from '@leadcrm/shared';

const fixture = vi.hoisted(() => ({
  task: {} as TaskRecord, update: vi.fn(), create: vi.fn(), canEdit: true,
  detail: {} as { data: TaskRecord; error: null; isInitialLoad: boolean; isRefreshing: boolean; refetch: ReturnType<typeof vi.fn>; setData: ReturnType<typeof vi.fn> },
}));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock('@/lib/config', () => ({ USE_MOCK_DATA: false }));
vi.mock('@/store/AuthContext', () => ({ useAuth: () => ({ user: { id: 'agent', role: 'Client Admin' }, tenant: { id: 'tenant' } }) }));
vi.mock('@/store/DataContext', () => ({ useData: () => ({ users: [], updateTask: fixture.update, addTask: fixture.create, bulkTasks: vi.fn() }) }));
vi.mock('@/shared/hooks/use-permissions', () => ({ useHasPermission: (permission: string) => permission !== 'tasks.edit' || fixture.canEdit }));
vi.mock('@/shared/hooks/use-cached-page', () => ({ useCachedPage: () => fixture.detail }));
vi.mock('@/shared/hooks/use-table-preferences', () => ({ useTablePreferences: () => ({ sort: null, setSort: vi.fn() }) }));
vi.mock('@/shared/hooks/use-view-type-preference', () => ({ useViewTypePreference: () => ({ viewType: 'table', setViewType: vi.fn() }) }));
vi.mock('@/shared/hooks/use-field-layout', () => ({ useConfiguredColumnDefinitions: (_module: string, columns: unknown[]) => columns }));
vi.mock('../use-tasks', () => ({ useTasks: () => ({
  tasks: [fixture.task], meta: { total: 1 }, summary: { active: 1, overdue: 0, completed: 0 },
  loading: false, refreshing: false, canRead: true, identity: 'tenant:agent', refresh: vi.fn(),
}) }));
vi.mock('../use-task-columns', async () => {
  const { normalizeTaskColumns } = await import('../task-columns');
  return { useTaskColumns: () => ({ columns: normalizeTaskColumns([]), loading: false }) };
});
vi.mock('@/shared/components/manage-columns-drawer', () => ({ ManageColumnsDrawer: () => null }));
import TaskBoard from '../ui/task-board';

beforeEach(() => {
  vi.clearAllMocks(); fixture.canEdit = true;
  fixture.task = { id: 'existing-task', tenantId: 'tenant', title: 'Original task', description: 'Saved notes',
    createdById: 'agent', assignedUserId: 'agent', status: 'pending', priority: 'High',
    dueDate: '2030-09-27T13:30:00.000Z', createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' };
  fixture.detail = { data: fixture.task, error: null, isInitialLoad: false, isRefreshing: false,
    refetch: vi.fn(), setData: vi.fn((saved: TaskRecord) => { fixture.task = saved; fixture.detail.data = saved; }) };
  fixture.update.mockImplementation(async (_id, patch) => {
    const { expectedUpdatedAt, ...changes } = patch;
    return { ...fixture.task, ...changes, updatedAt: '2026-10-02T00:00:00.000Z' };
  });
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} })));
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function openRowAction(name: 'Edit' | 'View') {
  fireEvent.click(screen.getByRole('button', { name: 'Row actions' }));
  fireEvent.click(screen.getByRole('menuitem', { name }));
  return within(screen.getByRole('dialog'));
}

it('opens Client Admin list-menu Edit on another agent task and updates the existing task and list', async () => {
  fixture.task.createdById = 'other-creator'; fixture.task.assignedUserId = 'other-agent';
  render(<TaskBoard />);
  const panel = openRowAction('Edit');
  fireEvent.click(panel.getByRole('button', { name: 'Edit Title' }));
  expect(panel.getByRole('textbox', { name: 'Title' })).toHaveProperty('value', 'Original task');
  fireEvent.change(panel.getByRole('textbox', { name: 'Title' }), { target: { value: 'Updated from the list' } });
  fireEvent.click(panel.getByRole('button', { name: 'Save' }));
  await panel.findByRole('heading', { name: 'Updated from the list' });
  expect(fixture.update).toHaveBeenCalledExactlyOnceWith('existing-task', { title: 'Updated from the list', expectedUpdatedAt: '2026-10-01T00:00:00.000Z' });
  expect(fixture.create).not.toHaveBeenCalled();
  await waitFor(() => expect(panel.getByRole('button', { name: 'Close record' })).toHaveProperty('disabled', false));
  fireEvent.click(panel.getByRole('button', { name: 'Close record' }));
  expect(screen.getByRole('button', { name: 'Updated from the list' })).toBeTruthy();
});

it('allows direct inline editing from View and preserves cancellation', () => {
  render(<TaskBoard />);
  const panel = openRowAction('View');
  expect(panel.getByRole('button', { name: 'Edit Title' })).toHaveProperty('disabled', false);
  expect(panel.queryByRole('textbox')).toBeNull();
  fireEvent.click(panel.getByRole('button', { name: 'Edit Title' }));
  fireEvent.change(panel.getByRole('textbox', { name: 'Title' }), { target: { value: 'Unsaved task' } });
  fireEvent.click(panel.getByRole('button', { name: 'Cancel' }));
  expect(panel.getByRole('heading', { name: 'Original task' })).toBeTruthy();
  expect(fixture.update).not.toHaveBeenCalled();
});

it('preserves a failed edit for retry and rejects an empty title without a request', async () => {
  fixture.update.mockRejectedValueOnce(new Error('Task update failed'));
  render(<TaskBoard />);
  const panel = openRowAction('Edit');
  fireEvent.click(panel.getByRole('button', { name: 'Edit Title' }));
  const title = panel.getByRole('textbox', { name: 'Title' });
  fireEvent.change(title, { target: { value: '   ' } });
  fireEvent.click(panel.getByRole('button', { name: 'Save' }));
  expect(panel.getByRole('alert').textContent).toContain('Enter a task title.');
  expect(fixture.update).not.toHaveBeenCalled();
  fireEvent.change(title, { target: { value: 'Keep this draft' } });
  fireEvent.click(panel.getByRole('button', { name: 'Save' }));
  await panel.findByText('Task update failed');
  expect(title).toHaveProperty('value', 'Keep this draft');
  await waitFor(() => expect(panel.getByRole('button', { name: 'Save' })).toHaveProperty('disabled', false));
  fireEvent.click(panel.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(panel.queryByRole('textbox')).toBeNull());
  expect(fixture.update).toHaveBeenCalledTimes(2);
});
