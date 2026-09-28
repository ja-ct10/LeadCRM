import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { WORKFLOW_TRIGGERS } from '@leadcrm/shared';
import WorkflowsPage from './workflows-page';
import { workflowsApi } from '@/shared/services/workflows.api';
import { clearPageCache } from '@/shared/cache/page-cache';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/store/AuthContext', () => ({ useAuth: () => ({ tenant: { id: 'tenant' }, user: { id: 'user', activeEnvironment: 'PRODUCTION' }, userCan: () => true }) }));
vi.mock('./workflow-execution-log-modal', () => ({ WorkflowExecutionLogModal: () => <div>Run history</div> }));
vi.mock('@/shared/services/workflows.api', () => ({
  getWorkflowMetadata: async () => ({ triggers: WORKFLOW_TRIGGERS, actions: [] }),
  workflowsApi: { list: vi.fn(), create: vi.fn(), toggle: vi.fn(), archive: vi.fn() },
}));
const workflow = { id: 'wf', name: 'Follow up', trigger: 'lead.created', status: 'ACTIVE', isActive: true, conditions: null, actions: [] };
beforeEach(() => {
  clearPageCache(); vi.clearAllMocks();
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  vi.mocked(workflowsApi.list).mockImplementation(async query => ({ success: true, data: [{ ...workflow, id: `wf${query?.page}` }], meta: { total: query?.status ? 1 : 31, page: query?.page ?? 1, limit: query?.limit ?? 10, hasMore: true } }) as never);
});
afterEach(() => { cleanup(); clearPageCache(); vi.unstubAllGlobals(); });

it('requests server pages and sizes, uses real totals, and resets filtered pagination', async () => {
  render(<WorkflowsPage />);
  await screen.findByRole('grid');
  expect(screen.getByText('Page 1 of 4')).toBeTruthy();
  fireEvent.click(screen.getByLabelText('Next page'));
  await waitFor(() => expect(workflowsApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, limit: 10 })));
  await screen.findByText('Page 2 of 4');
  fireEvent.click(screen.getByLabelText('Records per page'));
  fireEvent.click(screen.getByRole('option', { name: '20' }));
  await screen.findByText('Page 1 of 2');
  expect(workflowsApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, limit: 20 }));
  fireEvent.click(screen.getByRole('button', { name: 'Filter Workflows' }));
  expect(screen.queryByText('Client Profile created')).toBeNull();
  fireEvent.click(screen.getAllByLabelText('Filter by Active')[0]);
  await screen.findByText('Page 1 of 1');
  expect(workflowsApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, status: 'ACTIVE' }));
  expect((screen.getByLabelText('Next page') as HTMLButtonElement).disabled).toBe(true);
});

it('keeps icon actions wired to edit, duplicate, history, pause, resume and confirmed archive', async () => {
  render(<WorkflowsPage />); await screen.findByRole('grid');
  const action = (label: string) => screen.getByRole('button', { name: label });
  for (const label of ['Edit workflow', 'Duplicate workflow', 'View runs', 'Pause workflow', 'Archive workflow']) expect(action(label).textContent).toBe('');
  fireEvent.click(action('Edit workflow')); expect(push).toHaveBeenCalledWith('/automation/workflows/wf1/edit');
  fireEvent.click(action('View runs')); expect(screen.getByText('Run history')).toBeTruthy();
  fireEvent.click(action('Duplicate workflow'));
  await waitFor(() => expect(workflowsApi.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Follow up (Copy)', isActive: false })));
  await waitFor(() => expect((action('Pause workflow') as HTMLButtonElement).disabled).toBe(false));
  vi.mocked(workflowsApi.list).mockResolvedValue({ success: true, data: [{ ...workflow, id: 'wf1', isActive: false, status: 'PAUSED' }], meta: { total: 1, page: 1, limit: 10, hasMore: false } } as never);
  fireEvent.click(action('Pause workflow'));
  await screen.findByLabelText('Resume workflow');
  expect(workflowsApi.toggle).toHaveBeenCalledWith('wf1', false);
  fireEvent.click(action('Resume workflow'));
  await waitFor(() => expect(workflowsApi.toggle).toHaveBeenCalledWith('wf1', true));
  await waitFor(() => expect((action('Archive workflow') as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(action('Archive workflow'));
  expect(workflowsApi.archive).not.toHaveBeenCalled();
  fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Archive' }));
  await waitFor(() => expect(workflowsApi.archive).toHaveBeenCalledWith('wf1'));
});

it('disables refresh and spins its icon until the in-flight request finishes', async () => {
  render(<WorkflowsPage />); await screen.findByRole('grid');
  let resolve!: (response: any) => void;
  vi.mocked(workflowsApi.list).mockReturnValueOnce(new Promise(done => { resolve = done; }));
  const refresh = screen.getByLabelText('Refresh workflows') as HTMLButtonElement;
  const calls = vi.mocked(workflowsApi.list).mock.calls.length;
  fireEvent.click(refresh); fireEvent.click(refresh);
  expect(refresh.disabled).toBe(true);
  expect(refresh.querySelector('.animate-spin')).toBeTruthy();
  expect(workflowsApi.list).toHaveBeenCalledTimes(calls + 1);
  resolve({ success: true, data: [workflow], meta: { total: 1, page: 1, limit: 10, hasMore: false } });
  await waitFor(() => expect(refresh.disabled).toBe(false));
});
