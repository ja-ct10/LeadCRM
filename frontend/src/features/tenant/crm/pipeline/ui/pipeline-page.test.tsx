import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const state = vi.hoisted(() => ({
  role: 'Sales',
  pipelines: [] as any[], rows: [] as any[], params: '', permissions: [] as string[],
  replace: vi.fn(), refetch: vi.fn(), refreshPipelines: vi.fn(), addDeals: vi.fn(), moveDealStage: vi.fn(), setData: vi.fn(),
}));
vi.mock('next/navigation', () => {
  const router = { replace: state.replace };
  return { useRouter: () => router, useSearchParams: () => new URLSearchParams(state.params) };
});
vi.mock('@/store/AuthContext', () => ({ useAuth: () => ({ user: { id: 'actor', role: state.role }, tenant: { id: 'tenant' } }) }));
vi.mock('@/store/DataContext', () => ({ useData: () => ({ pipelines: state.pipelines, deals: [], users: [], addDeals: state.addDeals, moveDealStage: state.moveDealStage, refreshPipelines: state.refreshPipelines }) }));
vi.mock('@/shared/hooks/use-permissions', () => ({ useHasPermission: (permission: string) => state.permissions.includes(permission) }));
vi.mock('@/shared/hooks/use-cached-page', () => ({ useCachedPage: ({ params }: any) => ({ data: state.rows.filter(row => row.pipelineId === params.pipelineId), refetch: state.refetch, setData: state.setData, isInitialLoad: false }) }));
vi.mock('@/lib/config', () => ({ USE_MOCK_DATA: false }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/shared/components/crm', () => ({ DealPanel: () => null }));
vi.mock('@/features/tenant/crm/deals/ui/deal-form', () => ({ DealFormSheet: ({ isOpen, preselect, onSubmit }: any) => isOpen ? <div role="dialog" aria-label="New Deal" data-pipeline={preselect.pipelineId} data-stage={preselect.stageId}>
  <button onClick={() => void onSubmit({ title: 'Created Deal' })}>Save fixture Deal</button>
</div> : null }));
vi.mock('./pipeline-stages-dialog', () => ({ PipelineStagesDialog: ({ pipelineId }: any) => <div role="dialog" aria-label="Pipeline stages">{pipelineId}</div> }));
vi.mock('./pipeline-kanban-board', () => ({ PipelineKanbanBoard: ({ deals, onDealDragEnd }: any) => <div data-testid="board">
  {deals.map((deal: any) => <span key={deal.id}>{deal.title}</span>)}
  <button onClick={() => void onDealDragEnd('one', 'qualified')}>Move fixture Deal</button>
</div> }));
vi.mock('@/shared/components/crm/module-filter-rail', () => ({ ModuleFilterRail: ({ showFilters, onFilterToggle }: any) => showFilters ? <>
  <button onClick={() => onFilterToggle('stage', 'qualified')}>Filter Qualified</button>
  <button onClick={() => onFilterToggle('owner', 'other')}>Filter other owner</button>
</> : null }));
import PipelinePage from './pipeline-page';

beforeEach(() => {
  vi.clearAllMocks(); state.role = 'Sales'; state.params = '';
  state.permissions = ['deals.view_all', 'deals.view_my', 'deals.create', 'deals.edit', 'deals.manage_stages'];
  state.pipelines = [{ id: 'sales', name: 'Sales Pipeline', stages: [{ id: 'lead', name: 'Lead', isDefault: true }, { id: 'qualified', name: 'Qualified' }] }];
  state.rows = [
    { id: 'one', title: 'First Deal', pipelineId: 'sales', stageId: 'lead', priority: 'Low', assignedUserId: 'actor' },
    { id: 'two', title: 'Second Deal', pipelineId: 'sales', stageId: 'qualified', priority: 'High', assignedUserId: 'other' },
  ];
  state.refetch.mockResolvedValue(undefined); state.refreshPipelines.mockResolvedValue(undefined);
  state.addDeals.mockResolvedValue(undefined); state.moveDealStage.mockResolvedValue({ ...state.rows[0], stageId: 'qualified' });
});
afterEach(cleanup);

it('uses the CRM shell spacing and shared search without Deals KPI cards', () => {
  const { container } = render(<PipelinePage />);
  for (const label of ['Active Open Deals', 'Total Open Value', 'Closed Won Revenue']) expect(screen.queryByText(label)).toBeNull();
  expect(container.firstElementChild?.className).not.toMatch(/(?:^|\s)(?:sm:)?p-\d/);
  expect(screen.getByRole('textbox', { name: 'Search deals' }).className).toContain('h-8');
  expect(screen.getByRole('textbox', { name: 'Pipeline' }).className).toContain('h-8');
  expect(screen.getByRole('heading', { name: 'Deals' })).toBeTruthy();
  expect(screen.getByTestId('board')).toBeTruthy();
});

it('omits My Deals for Client Admin and keeps All Deals selected for personal-view URLs', () => {
  state.role = 'Client Admin'; state.params = 'tab=my&view=my';
  render(<PipelinePage />);
  expect(screen.queryByRole('button', { name: 'My Deals', hidden: true })).toBeNull();
  expect(screen.getByRole('button', { name: 'All Deals', pressed: true })).toBeTruthy();
  expect(screen.getByText('First Deal')).toBeTruthy();
  expect(screen.getByText('Second Deal')).toBeTruthy();
  expect(state.replace).toHaveBeenLastCalledWith('/crm/deals?view=my', { scroll: false });
});

it.each(['Sales', 'Account Manager'])('preserves personal Deal filtering for %s', role => {
  state.role = role;
  render(<PipelinePage />);
  const tabs = screen.getByRole('group', { name: 'Deals views' });
  expect(tabs.className).toContain('overflow-x-auto');
  expect(tabs.className).toContain('flex-nowrap');
  expect(within(tabs).getAllByRole('button')).toHaveLength(2);
  expect(within(tabs).getByRole('button', { name: 'All Deals', pressed: true }).querySelector('[aria-hidden]')?.className).toContain('bg-primary');
  fireEvent.click(screen.getByRole('button', { name: 'My Deals' }));
  expect(within(tabs).getByRole('button', { name: 'My Deals', pressed: true })).toBeTruthy();
  expect(screen.getByText('First Deal')).toBeTruthy();
  expect(screen.queryByText('Second Deal')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'All Deals' }));
  expect(screen.getByText('Second Deal')).toBeTruthy();
});

it('clears a mounted personal Deal selection when the role changes to Client Admin', () => {
  const view = render(<PipelinePage />);
  fireEvent.click(screen.getByRole('button', { name: 'My Deals' }));
  expect(screen.queryByText('Second Deal')).toBeNull();
  state.role = 'Client Admin';
  view.rerender(<PipelinePage />);
  expect(screen.queryByRole('button', { name: 'My Deals', hidden: true })).toBeNull();
  expect(screen.getByRole('button', { name: 'All Deals', pressed: true })).toBeTruthy();
  expect(screen.getByText('Second Deal')).toBeTruthy();
  state.role = 'Sales';
  view.rerender(<PipelinePage />);
  expect(screen.getByRole('button', { name: 'My Deals', pressed: false })).toBeTruthy();
  expect(screen.getByText('Second Deal')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'My Deals' }));
  expect(screen.queryByText('Second Deal')).toBeNull();
});

it('preserves Client Admin search, owner and stage filters without a personal tab', () => {
  state.role = 'Client Admin';
  render(<PipelinePage />);
  fireEvent.change(screen.getByRole('textbox', { name: 'Search deals' }), { target: { value: 'First' } });
  expect(screen.getByText('First Deal')).toBeTruthy();
  expect(screen.queryByText('Second Deal')).toBeNull();
  fireEvent.change(screen.getByRole('textbox', { name: 'Search deals' }), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: 'Filter Deals' }));
  fireEvent.click(screen.getByRole('button', { name: 'Filter other owner' }));
  expect(screen.queryByText('First Deal')).toBeNull();
  expect(screen.getByText('Second Deal')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Filter other owner' }));
  expect(screen.getByText('First Deal')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Filter Qualified' }));
  expect(screen.queryByText('First Deal')).toBeNull();
  expect(screen.getByText('Second Deal')).toBeTruthy();
});

it('shows a readable persisted pipeline and a direct New Deal button without import controls', () => {
  render(<PipelinePage />);
  const pipeline = screen.getByRole('textbox', { name: 'Pipeline' }) as HTMLInputElement;
  expect(pipeline.value).toBe('Sales Pipeline'); expect(pipeline.readOnly).toBe(true); expect(pipeline.disabled).toBe(false);
  expect(pipeline.className).toContain('cursor-default');
  expect(screen.queryByRole('combobox', { name: 'Pipeline' })).toBeNull();
  const create = screen.getByRole('button', { name: 'New Deal' });
  expect(create.hasAttribute('aria-haspopup')).toBe(false);
  fireEvent.click(pipeline); expect(state.replace).not.toHaveBeenCalled();
  fireEvent.click(create);
  expect(screen.getByRole('dialog', { name: 'New Deal' }).getAttribute('data-pipeline')).toBe('sales');
  expect(screen.queryByRole('menu')).toBeNull();
  expect(screen.queryByText('Import File')).toBeNull(); expect(screen.queryByText('Create New')).toBeNull();
});

it.each(['default', 'Lead', 'first'])('preserves the %s stage fallback passed to creation', choice => {
  const stages = [{ id: 'first', name: 'First' }, { id: 'lead', name: 'Lead' }, { id: 'default', name: 'Qualified', isDefault: true }];
  state.pipelines[0].stages = choice === 'default' ? stages : choice === 'Lead' ? stages.slice(0, 2) : stages.slice(0, 1);
  render(<PipelinePage />); fireEvent.click(screen.getByRole('button', { name: 'New Deal' }));
  expect(screen.getByRole('dialog', { name: 'New Deal' }).getAttribute('data-stage')).toBe(choice === 'Lead' ? 'lead' : choice);
});

it('prefers Sales Pipeline over the first available record and displays a persisted fallback name', () => {
  state.pipelines.unshift({ id: 'other', name: 'Existing Pipeline', stages: [{ id: 'open', name: 'Open' }] });
  const view = render(<PipelinePage />);
  expect((screen.getByRole('textbox', { name: 'Pipeline' }) as HTMLInputElement).value).toBe('Sales Pipeline');
  state.pipelines = state.pipelines.filter(p => p.id !== 'sales'); view.rerender(<PipelinePage />);
  expect((screen.getByRole('textbox', { name: 'Pipeline' }) as HTMLInputElement).value).toBe('Existing Pipeline');
});

it('retains pipelineId deep-link compatibility without exposing a selector', () => {
  state.params = 'pipelineId=other';
  state.pipelines.push({ id: 'other', name: 'Existing Pipeline', stages: [{ id: 'open', name: 'Open' }] });
  render(<PipelinePage />);
  expect((screen.getByRole('textbox', { name: 'Pipeline' }) as HTMLInputElement).value).toBe('Existing Pipeline');
  expect(screen.queryByRole('combobox', { name: 'Pipeline' })).toBeNull();
});

it('keeps create and stage-management permissions independent', () => {
  state.permissions = ['deals.view_all', 'deals.manage_stages'];
  const view = render(<PipelinePage />);
  expect(screen.queryByRole('button', { name: 'New Deal' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Manage pipeline stages' }));
  expect(screen.getByRole('dialog', { name: 'Pipeline stages' }).textContent).toBe('sales');
  cleanup(); state.permissions = ['deals.view_all', 'deals.view_my', 'deals.create']; view.unmount(); render(<PipelinePage />);
  expect(screen.getByRole('button', { name: 'New Deal' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Manage pipeline stages' })).toBeNull();
});

it('disables creation without a stage and leaves missing pipeline errors retryable', async () => {
  state.pipelines[0].stages = [];
  const view = render(<PipelinePage />);
  expect((screen.getByRole('button', { name: 'New Deal' }) as HTMLButtonElement).disabled).toBe(true);
  state.pipelines = []; state.refreshPipelines.mockRejectedValueOnce(new Error('Pipeline unavailable'));
  view.rerender(<PipelinePage />);
  expect((screen.getByRole('textbox', { name: 'Pipeline' }) as HTMLInputElement).value).toBe('');
  expect(screen.queryByRole('button', { name: 'New Deal' })).toBeNull();
  expect((await screen.findByRole('alert')).textContent).toBe('Pipeline unavailable');
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
  await waitFor(() => expect(state.refreshPipelines).toHaveBeenCalledTimes(2));
  expect(state.refetch).toHaveBeenCalledOnce();
});

it('keeps search, My Deals, filters, refresh, stage movement and creation callbacks working', async () => {
  render(<PipelinePage />);
  fireEvent.change(screen.getByRole('textbox', { name: 'Search deals' }), { target: { value: 'First' } });
  expect(screen.queryByText('Second Deal')).toBeNull();
  fireEvent.change(screen.getByRole('textbox', { name: 'Search deals' }), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: 'My Deals' })); expect(screen.queryByText('Second Deal')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'All Deals' }));
  fireEvent.click(screen.getByRole('button', { name: 'Filter Deals' }));
  fireEvent.click(screen.getByRole('button', { name: 'Filter Qualified' })); expect(screen.queryByText('First Deal')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
  await waitFor(() => expect(state.refetch).toHaveBeenCalledOnce()); expect(state.refreshPipelines).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'Move fixture Deal' }));
  await waitFor(() => expect(state.moveDealStage).toHaveBeenCalledWith('one', 'qualified', undefined, undefined));
  expect(state.setData).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ id: 'one', stageId: 'qualified' })]));
  fireEvent.click(screen.getByRole('button', { name: 'New Deal' })); fireEvent.click(screen.getByRole('button', { name: 'Save fixture Deal' }));
  await waitFor(() => expect(state.addDeals).toHaveBeenCalledWith({ title: 'Created Deal' }));
  expect(state.refetch).toHaveBeenCalledTimes(2); expect(screen.queryByRole('dialog', { name: 'New Deal' })).toBeNull();
});

it('has no dedicated Deal import App Router pages', () => {
  for (const path of ['app/(tenant)/crm/deals/import/page.tsx', 'app/(tenant)/crm/deals/imports/page.tsx', 'app/(tenant)/crm/deals/imports/[importId]/page.tsx']) {
    expect(existsSync(resolve(process.cwd(), path))).toBe(false);
  }
  expect(existsSync(resolve(process.cwd(), 'app/(tenant)/crm/deals/page.tsx'))).toBe(true);
});

it('falls back to My Deals and removes the board when its last tab is revoked', () => {
  state.permissions = ['deals.view_my']; state.params = 'tab=all';
  const view = render(<PipelinePage />);
  expect(screen.queryByRole('button', { name: 'All Deals' })).toBeNull();
  expect(screen.getByRole('button', { name: 'My Deals', pressed: true })).toBeTruthy();
  expect(screen.queryByText('Second Deal')).toBeNull();
  state.permissions = []; view.rerender(<PipelinePage />);
  expect(screen.getByRole('alert').textContent).toContain('You do not have permission');
  expect(screen.queryByTestId('board')).toBeNull();
});
