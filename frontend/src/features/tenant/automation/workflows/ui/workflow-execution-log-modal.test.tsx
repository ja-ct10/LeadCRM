import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { WorkflowExecutionLogModal } from './workflow-execution-log-modal';
import { workflowsApi } from '@/shared/services/workflows.api';
const push = vi.fn();
const permissions = vi.hoisted(() => ({ denied: [] as string[] }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/store/AuthContext', () => ({ useAuth: () => ({ userCan: (module: string) => !permissions.denied.includes(module) }) }));
vi.mock('@/shared/services/workflows.api', () => ({ workflowsApi: { get: vi.fn(), getExecutions: vi.fn(), toggle: vi.fn(), duplicate: vi.fn(), archive: vi.fn() } }));
const run = { id: 'run', status: 'completed', startedAt: '2026-10-01T12:00:00Z', completedAt: '2026-10-01T12:01:00Z', entityType: 'lead', trigger: { payload: { recordName: 'Ada Lovelace' }, triggerType: 'lead_created' }, steps: [{ id: 'step', stepIndex: 0, actionType: 'create_task', status: 'completed' }] };
const workflow = { id: 'wf', name: 'Follow up', isActive: true, status: 'ACTIVE' };
beforeEach(() => {
  permissions.denied = [];
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.mocked(workflowsApi.get).mockResolvedValue({ data: workflow } as never);
  vi.mocked(workflowsApi.getExecutions).mockResolvedValue({ data: Array.from({ length: 25 }, (_, i) => ({ ...run, id: `run-${i}` })), meta: { total: 51, page: 1, limit: 25, hasMore: true } } as never);
});
it('links persisted Tasks and source records and explains skipped actions without claiming assignment', async () => {
  vi.mocked(workflowsApi.getExecutions).mockResolvedValue({ data: [{ ...run, entityId: 'source/id',
    steps: [{ ...run.steps[0], status: 'success', output: { taskId: 'task/id', cleanupWarning: 'Assignment reservation will expire.' } },
      { ...run.steps[0], id: 'skip', stepIndex: 1, status: 'skipped', output: { resolvedUserId: 'user', resolvedUserName: 'Ana', reason: 'A newer stage entry superseded this event.' } }],
  }], meta: { total: 1, page: 1, limit: 25, hasMore: false } } as never);
  mount(); await settled();
  expect(screen.getByRole('link', { name: 'Open Task' }).getAttribute('href')).toBe('/operations/taskboard?taskId=task%2Fid');
  expect(screen.getByRole('link', { name: 'Open lead' }).getAttribute('href')).toBe('/crm/leads/source%2Fid');
  expect(screen.getByText('A newer stage entry superseded this event.')).toBeTruthy();
  expect(screen.getByText('Selected assignee: Ana')).toBeTruthy();
  expect(screen.queryByText(/Assigned to Ana/)).toBeNull();
  expect(screen.getByText('Assignment reservation will expire.')).toBeTruthy();
});
it('hides output destinations when the viewer lacks their module permissions', async () => {
  permissions.denied = ['tasks', 'leads'];
  vi.mocked(workflowsApi.getExecutions).mockResolvedValue({ data: [{ ...run, entityId: 'source', steps: [{ ...run.steps[0], output: { taskId: 'task' } }] }], meta: { total: 1, page: 1, limit: 25, hasMore: false } } as never);
  mount(); await settled();
  expect(screen.queryByRole('link', { name: 'Open Task' })).toBeNull();
  expect(screen.queryByRole('link', { name: 'Open lead' })).toBeNull();
});
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.unstubAllGlobals(); });
const mount = (close = vi.fn(), updated = vi.fn()) => render(<WorkflowExecutionLogModal workflowId="wf" name="Follow up" status="Active" onClose={close} onUpdated={updated} />);
const settled = () => waitFor(() => expect((screen.getByLabelText('Refresh workflow activity') as HTMLButtonElement).disabled).toBe(false));
it('shows the executed version, snapshot and resolved assignee independently of the current definition', async () => {
  vi.mocked(workflowsApi.get).mockResolvedValue({ data: { ...workflow, version: 4 } } as never);
  vi.mocked(workflowsApi.getExecutions).mockResolvedValue({ data: [{ ...run, workflowVersion: 2,
    definitionSnapshot: { name: 'Original follow-up', trigger: 'lead.created', actions: [{ type: 'create_task', config: { title: 'Old title' } }] },
    steps: [{ ...run.steps[0], output: { resolvedUserId: 'user', resolvedUserName: 'Ana', assignmentTargetName: 'Sales team', strategy: 'round_robin' } }],
  }], meta: { total: 1, page: 1, limit: 25, hasMore: false } } as never);
  mount(); await settled();
  expect(screen.getByText(/Workflow details/).textContent).toBe('Workflow details · Active · v4');
  expect(screen.getByText('Definition used in this run · v2')).toBeTruthy();
  expect(screen.getByText(/Oct 1, 2026 08:00:00 PM/)).toBeTruthy();
  expect(screen.getByText(/Finished:/).textContent).toContain('Oct 1, 2026 08:01:00 PM');
  expect(screen.getByText(/Assigned to Ana · Sales team · Round-robin/)).toBeTruthy();
  expect(screen.getByText('Original follow-up')).toBeTruthy();
  expect(screen.getByText('Old title')).toBeTruthy();
});
it('does not claim a completed assignment when the action failed after resolving a user', async () => {
  vi.mocked(workflowsApi.getExecutions).mockResolvedValue({ data: [{ ...run, status: 'failed',
    steps: [{ ...run.steps[0], status: 'failed', error: 'Unable to create task.', output: { resolvedUserId: 'user', resolvedUserName: 'Ana' } }],
  }], meta: { total: 1, page: 1, limit: 25, hasMore: false } } as never);
  mount(); await settled();
  expect(screen.getByText('Selected assignee: Ana')).toBeTruthy();
  expect(screen.queryByText(/Assigned to Ana/)).toBeNull();
  expect(screen.getByText('Unable to create task.')).toBeTruthy();
});
it('preserves retired assignment labels in historical runs', async () => {
  vi.mocked(workflowsApi.getExecutions).mockResolvedValue({ data: [{ ...run,
    steps: [{ ...run.steps[0], output: { resolvedUserId: 'user', resolvedUserName: 'Ana', assignmentTargetName: 'Sales team', strategy: 'sticky' } }],
  }], meta: { total: 1, page: 1, limit: 25, hasMore: false } } as never);
  mount(); await settled();
  expect(screen.getByText(/Assigned to Ana · Sales team · Previous assignee \/ Sticky assignment/)).toBeTruthy();
});
it('uses shared pagination and retains loaded runs while refreshing definition plus current run page', async () => {
  const close = vi.fn(); mount(close);
  expect(screen.getByRole('status', { name: 'Loading workflow runs' })).toBeTruthy();
  expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull();
  const dialog = await screen.findByRole('dialog', { name: 'Workflow details — Follow up' });
  expect(dialog.className).toContain('md:max-w-xl');
  await screen.findByText('Page 1 of 3');
  expect(dialog.querySelectorAll('details')).toHaveLength(25);
  expect(dialog.querySelector('details')!.textContent).toContain('1. Create Task — completed');
  fireEvent.click(screen.getByRole('button', { name: 'Next page' })); await screen.findByText('Page 2 of 3');
  expect(workflowsApi.getExecutions).toHaveBeenLastCalledWith('wf', 2, 25);
  fireEvent.click(screen.getByLabelText('Refresh workflow activity')); fireEvent.click(screen.getByLabelText('Refresh workflow activity'));
  expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeTruthy();
  expect(screen.getByRole('status', { name: 'Refreshing workflow runs...' })).toBeTruthy();
  expect(dialog.querySelectorAll('details')).toHaveLength(25);
  await settled();
  expect(workflowsApi.get).toHaveBeenCalledTimes(2); expect(workflowsApi.getExecutions).toHaveBeenCalledTimes(3);
  fireEvent.click(screen.getByLabelText('Records per page')); fireEvent.click(screen.getByRole('option', { name: '10' }));
  await screen.findByText('Page 1 of 6'); expect(workflowsApi.getExecutions).toHaveBeenLastCalledWith('wf', 1, 10);
  fireEvent.click(screen.getByLabelText('Close workflow details')); expect(close).toHaveBeenCalledOnce();
});
it('orders header actions and toggles, dismisses and executes the existing workflow menu', async () => {
  const updated = vi.fn(), close = vi.fn(); mount(close, updated); await settled();
  expect(Array.from(screen.getByRole('dialog').querySelectorAll('header button')).map(b => b.getAttribute('aria-label'))).toEqual(['Refresh workflow activity', 'Workflow actions', 'Close workflow details']);
  const menu = () => fireEvent.click(screen.getByLabelText('Workflow actions'));
  menu(); expect(screen.getAllByRole('menuitem').map(item => item.textContent)).toEqual(['Edit', 'Pause', 'Duplicate', 'Archive']);
  menu(); expect(screen.queryByRole('menu')).toBeNull();
  menu(); fireEvent.mouseDown(document.body); expect(screen.queryByRole('menu')).toBeNull();
  menu(); fireEvent.keyDown(document, { key: 'Escape' }); expect(screen.queryByRole('menu')).toBeNull(); expect(close).not.toHaveBeenCalled();
  menu(); fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' })); expect(push).toHaveBeenCalledWith('/automation/workflows/wf/edit');
  vi.mocked(workflowsApi.get).mockResolvedValue({ data: { ...workflow, isActive: false, status: 'PAUSED' } } as never);
  menu(); fireEvent.click(screen.getByRole('menuitem', { name: 'Pause' })); await settled();
  expect(workflowsApi.toggle).toHaveBeenCalledWith('wf', false); await waitFor(() => expect(screen.getByText(/Workflow details/).textContent).toBe('Workflow details · Paused'));
  menu(); expect(screen.queryByRole('menuitem', { name: 'Pause' })).toBeNull(); fireEvent.click(screen.getByRole('menuitem', { name: 'Resume' })); await settled();
  expect(workflowsApi.toggle).toHaveBeenCalledWith('wf', true);
  menu(); fireEvent.click(screen.getByRole('menuitem', { name: 'Duplicate' })); await settled(); expect(workflowsApi.duplicate).toHaveBeenCalledWith('wf');
  menu(); fireEvent.click(screen.getByRole('menuitem', { name: 'Archive' })); expect(workflowsApi.archive).not.toHaveBeenCalled();
  fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Archive' }));
  await waitFor(() => expect(workflowsApi.archive).toHaveBeenCalledWith('wf')); await waitFor(() => expect(updated).toHaveBeenCalledTimes(4));
});
