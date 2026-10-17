import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { TaskRecord } from '@leadcrm/shared';
import TaskBoard from '../ui/task-board';

const mocks = vi.hoisted(() => ({
  canCreate: true, mockData: true, searchParams: '',
  data: {
    tasks: [] as TaskRecord[], meta: { total: 0 }, summary: { active: 0, overdue: 0, completed: 0 },
    loading: false, refreshing: false, error: undefined as string | undefined,
    canRead: true, identity: 'tenant:agent', refresh: vi.fn(),
  },
  columnsLoading: false, query: vi.fn(), users: [],
}));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(mocks.searchParams) }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/lib/config', () => ({ get USE_MOCK_DATA() { return mocks.mockData; } }));
vi.mock('@/store/AuthContext', () => ({ useAuth: () => ({ user: { id: 'agent' } }) }));
vi.mock('@/store/DataContext', () => ({ useData: () => ({ users: mocks.users, updateTask: vi.fn(), bulkTasks: vi.fn() }) }));
vi.mock('@/shared/hooks/use-permissions', () => ({ useHasPermission: (permission: string) => permission === 'tasks.create' ? mocks.canCreate : true }));
vi.mock('@/shared/hooks/use-table-preferences', () => ({ useTablePreferences: () => ({ sort: { field: 'createdAt', direction: 'desc' }, setSort: vi.fn() }) }));
vi.mock('@/shared/hooks/use-view-type-preference', () => ({ useViewTypePreference: () => ({ viewType: 'table', setViewType: vi.fn() }) }));
vi.mock('@/shared/hooks/use-field-layout', () => ({ useConfiguredColumnDefinitions: (_module: string, columns: unknown[]) => columns }));
vi.mock('../use-tasks', () => ({ useTasks: (query: unknown) => { mocks.query(query); return mocks.data; } }));
vi.mock('../use-task-columns', () => ({ useTaskColumns: () => ({ columns: [], loading: mocks.columnsLoading, resetWidths: vi.fn() }) }));
vi.mock('../ui/task-editor', () => ({
  TaskEditor: ({ task, taskId, onClose }: any) => <div role="dialog" aria-label={task || taskId ? 'Existing Task panel' : 'Create Task panel'} data-task-id={task?.id ?? taskId}><button onClick={onClose}>Close panel</button></div>,
  TaskSelector: () => null,
}));
vi.mock('@/shared/components/manage-columns-drawer', () => ({ ManageColumnsDrawer: () => null }));

beforeEach(() => {
  vi.clearAllMocks(); mocks.canCreate = true; mocks.columnsLoading = false; mocks.mockData = true; mocks.searchParams = '';
  Object.assign(mocks.data, { tasks: [], meta: { total: 0 }, loading: false, refreshing: false, error: undefined, canRead: true, identity: 'tenant:agent' });
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} })));
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function expectNoTable() {
  expect(screen.queryByRole('grid')).toBeNull();
  expect(screen.queryByRole('columnheader')).toBeNull();
  expect(document.querySelector('[role="region"] .overflow-auto')).toBeNull();
  expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull();
}

it('disables every bulk mutation for a mixed-owner selection while preserving selection and viewing', () => {
  mocks.data.tasks = ['agent', 'other'].map((createdById, index) => ({ id: `task-${index}`, tenantId: 'tenant', title: `Task ${index}`, createdById, assignedUserId: 'agent', status: 'pending', description: '', dueDate: '2030-01-01T00:00:00Z', createdAt: '2026-10-01T00:00:00Z' }));
  mocks.data.meta.total = 2;
  render(<TaskBoard />);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select all records' }));
  for (const name of ['Mark as done', 'Assign', 'Reschedule', 'Archive']) expect(screen.getByRole('button', { name })).toHaveProperty('disabled', true);
  expect(screen.getByRole('checkbox', { name: 'Select all records' })).toHaveProperty('checked', true);
});

it('opens an ID-only destination after the scope reset and permission readiness, and respects closing it', () => {
  mocks.mockData = false; mocks.searchParams = 'taskId=linked-task'; mocks.data.canRead = false;
  const { rerender } = render(<TaskBoard />);
  expect(screen.queryByRole('dialog')).toBeNull();
  mocks.data.canRead = true; mocks.data.identity = 'tenant:authorized-agent';
  rerender(<TaskBoard />);
  expect(screen.getByRole('dialog', { name: 'Existing Task panel' }).getAttribute('data-task-id')).toBe('linked-task');
  fireEvent.click(screen.getByRole('button', { name: 'Close panel' }));
  mocks.data.refreshing = true;
  rerender(<TaskBoard />);
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('reuses the card with the Tasks icon and opens the same create panel as the header', () => {
  render(<TaskBoard />);
  const card = screen.getByRole('heading', { name: 'No tasks yet' }).closest('.border-dashed')!;
  expect(card.querySelector('.lucide-list-todo')).toBeTruthy();
  expect(card.querySelector('.lucide-plus')).toBeTruthy();
  expect(screen.getByText('Create your first task to start managing follow-ups and activities.')).toBeTruthy();
  expectNoTable();
  expect(screen.getByPlaceholderText('Search tasks...')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Today' })).toBeTruthy();
  expect(screen.getByText('0 active')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Add Task' }));
  expect(screen.getByRole('dialog', { name: 'Create Task panel' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Close panel' }));
  fireEvent.click(screen.getByRole('button', { name: 'Create Task' }));
  expect(screen.getByRole('dialog', { name: 'Create Task panel' })).toBeTruthy();
});

it('hides both creation entry points without Create permission and preserves read denial', () => {
  mocks.canCreate = false;
  const { rerender } = render(<TaskBoard />);
  expect(screen.getByRole('heading', { name: 'No tasks yet' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Add Task' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Create Task' })).toBeNull();
  mocks.data.canRead = false;
  rerender(<TaskBoard />);
  expect(screen.getByText('You do not have permission to view tasks.')).toBeTruthy();
  expect(screen.queryByText('No tasks yet')).toBeNull();
});

it.each(['Overdue', 'Today', 'This week'])('shows matching-results copy on the %s tab', (tab) => {
  render(<TaskBoard />);
  fireEvent.click(screen.getByRole('button', { name: tab }));
  expect(screen.getByRole('heading', { name: 'No matching records' })).toBeTruthy();
  expect(screen.getByText('Try a different search term or clear your filters.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Add Task' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Create Task' })).toBeTruthy();
  expectNoTable();
});

it.each(['To do', 'High', 'Active tasks', 'Completed tasks', 'Archived tasks'])('shows matching-results copy for the %s filter', (filter) => {
  render(<TaskBoard />);
  fireEvent.click(screen.getByRole('button', { name: 'Filter Tasks' }));
  fireEvent.click(screen.getByRole('checkbox', { name: `Filter by ${filter}` }));
  expect(screen.getByRole('heading', { name: 'No matching records' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Add Task' })).toBeNull();
  expectNoTable();
});

it('treats default filter values as unfiltered and restores the first-record card after clearing', () => {
  render(<TaskBoard />);
  fireEvent.click(screen.getByRole('button', { name: 'Filter Tasks' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Filter by All task states' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Filter by Current tasks' }));
  expect(screen.getByRole('heading', { name: 'No tasks yet' })).toBeTruthy();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Filter by Active tasks' }));
  expect(screen.getByRole('heading', { name: 'No matching records' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  expect(screen.getByRole('heading', { name: 'No tasks yet' })).toBeTruthy();
});

it('distinguishes debounced search from whitespace', async () => {
  render(<TaskBoard />);
  fireEvent.change(screen.getByPlaceholderText('Search tasks...'), { target: { value: 'missing' } });
  await screen.findByRole('heading', { name: 'No matching records' });
  expect(mocks.query).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'missing' }));
  expect(screen.queryByRole('button', { name: 'Add Task' })).toBeNull();
  fireEvent.change(screen.getByPlaceholderText('Search tasks...'), { target: { value: '   ' } });
  await screen.findByRole('heading', { name: 'No tasks yet' });
});

it('does not claim the module is empty when the page total remains positive', () => {
  mocks.data.meta = { total: 1 };
  render(<TaskBoard />);
  expect(screen.getByRole('heading', { name: 'No matching records' })).toBeTruthy();
  expectNoTable();
});

it('preserves loading, retry, empty-card refresh and populated table transitions', () => {
  mocks.data.loading = true;
  const { rerender } = render(<TaskBoard />);
  expect(screen.getByText('Loading tasks...').closest('[role="status"]')).toBeTruthy();
  expect(screen.queryByText('No tasks yet')).toBeNull();
  mocks.data.loading = false; mocks.columnsLoading = true;
  rerender(<TaskBoard />);
  expect(screen.queryByText('No tasks yet')).toBeNull();
  mocks.columnsLoading = false; mocks.data.error = 'Unable to load tasks';
  rerender(<TaskBoard />);
  expect(screen.getByRole('alert').textContent).toContain('Unable to load tasks');
  expect(screen.queryByText('No tasks yet')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(mocks.data.refresh).toHaveBeenCalledTimes(1);
  mocks.data.error = undefined;
  rerender(<TaskBoard />);
  const heading = screen.getByRole('heading', { name: 'No tasks yet' });
  mocks.data.refreshing = true;
  rerender(<TaskBoard />);
  expect(screen.getByRole('status', { name: 'Refreshing data...' })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'No tasks yet' })).toBeNull();
  mocks.data.refreshing = false;
  rerender(<TaskBoard />);
  expect(screen.getByRole('heading', { name: 'No tasks yet' })).toBe(heading);
  mocks.data.tasks = [{ id: 'task', tenantId: 'tenant', title: 'Follow up', status: 'pending', dueDate: '2026-10-14T00:00:00Z', createdAt: '2026-10-13T00:00:00Z' } as TaskRecord];
  mocks.data.meta = { total: 1 };
  rerender(<TaskBoard />);
  expect(screen.getByRole('grid')).toBeTruthy();
  expect(screen.getByText('Follow up')).toBeTruthy();
  expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeTruthy();
  mocks.data.error = 'Refresh failed';
  rerender(<TaskBoard />);
  expect(screen.getByText('Follow up')).toBeTruthy();
  mocks.data.error = undefined; mocks.data.tasks = []; mocks.data.meta = { total: 0 };
  rerender(<TaskBoard />);
  expect(screen.getByRole('heading', { name: 'No tasks yet' })).toBeTruthy();
  expectNoTable();
});
