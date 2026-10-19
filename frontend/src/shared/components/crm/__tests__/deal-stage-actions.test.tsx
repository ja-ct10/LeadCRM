vi.mock('@/shared/hooks/use-crm-record-access', () => ({ useCrmRecordAccess: () => ({ canMutate: () => mocks.canAccess, canReassign: true, policy: { userId: 'actor', tenantId: 'tenant', assignmentRestricted: false, clientAdmin: true } }) }));
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Deal, Pipeline } from '@/store/types';
import { DealActionsProvider, DealCardMenu } from '../deal-card-menu';
import { DealStageDialog } from '../deal-stage-dialog';

const mocks = vi.hoisted(() => ({ pipelines: [] as Pipeline[], deal: {} as Deal, canEdit: true, canTask: false, canAccess: true, userId: 'actor', pathname: '/crm/deals', errorStatus: undefined as number | undefined, moveStage: vi.fn(), movePipeline: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => mocks.pathname }));
vi.mock('@/store/DataContext', () => ({ useData: () => ({ pipelines: mocks.pipelines, deals: [mocks.deal], contacts: [], moveDealStage: mocks.moveStage, moveDealPipeline: mocks.movePipeline }) }));
vi.mock('@/store/AuthContext', () => ({ useAuth: () => ({ user: { id: mocks.userId, tenantId: 'tenant' }, tenant: { id: 'tenant' } }) }));
vi.mock('@/shared/hooks/use-permissions', () => ({ useHasPermission: (key: string) => key === 'deals.edit' && mocks.canEdit || key === 'tasks.create' && mocks.canTask }));
vi.mock('@/shared/hooks/use-cached-page', () => ({ useCachedPage: () => ({ data: undefined, isInitialLoad: false, error: null, errorStatus: mocks.errorStatus }) }));
vi.mock('@/lib/config', () => ({ USE_MOCK_DATA: false }));
vi.mock('@/shared/hooks/use-confirm-dialog', () => ({ useConfirmDialog: () => ({ dialogProps: {}, confirm: vi.fn() }) }));
vi.mock('../confirm-action-dialog', () => ({ ConfirmActionDialog: () => null }));
vi.mock('../crm-record-view', () => ({ CrmRecordPanel: () => null }));
vi.mock('@/features/tenant/crm/deals/ui/deal-form', () => ({ DealFormSheet: ({ initialData, onClose }: any) => <div role="dialog"><input aria-label="Deal title" defaultValue={initialData.title} /><button onClick={onClose}>Cancel</button></div> }));
vi.mock('@/features/tenant/operations/tasks/ui/task-editor', () => ({ TaskEditor: ({ links, onClose }: any) => <div role="dialog" data-deal-id={links.dealIds[0]}><input aria-label="Task title" /><button onClick={onClose}>Close</button></div> }));
vi.mock('motion/react', () => ({ motion: { div: ({ initial, animate, exit, transition, ...props }: any) => <div {...props} /> }, AnimatePresence: ({ children }: any) => children }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const sales = { id: 'sales-id', tenantId: 'tenant', name: 'Sales Pipeline', stages: [
  { id: 'lead', name: 'Lead', order: 0 }, { id: 'qualified', name: 'Qualified', order: 1 },
  { id: 'won', name: 'Closed Deal', order: 2, isWon: true }, { id: 'lost', name: 'Cancelled', order: 3, isLost: true },
] } as Pipeline;
const renewals = { id: 'renewals-id', tenantId: 'tenant', name: 'Renewals', stages: [{ id: 'review', name: 'Review', order: 0 }] } as Pipeline;
const menu = async (onMutated?: (deal?: Deal) => void) => {
  render(<DealCardMenu dealId={mocks.deal.id} dealTitle={mocks.deal.title} deal={mocks.deal} onMutated={onMutated} />);
  fireEvent.click(screen.getByRole('button', { name: 'Actions for Opportunity' }));
  return screen.findByRole('menuitem', { name: /^Change stage/ });
};
beforeEach(() => {
  vi.clearAllMocks(); mocks.canEdit = true; mocks.canTask = false; mocks.canAccess = true; mocks.pipelines = [sales];
  mocks.userId = 'actor'; mocks.pathname = '/crm/deals'; mocks.errorStatus = undefined;
  mocks.deal = { id: 'deal', title: 'Opportunity', pipelineId: sales.id, stageId: 'lead', tenantId: 'tenant', value: 500, companyName: '', contactPerson: '', order: 0, priority: 'Medium' } as Deal;
  mocks.moveStage.mockReset().mockResolvedValue({ ...mocks.deal, stageId: 'qualified' });
  mocks.movePipeline.mockReset().mockResolvedValue({ ...mocks.deal, pipelineId: renewals.id, stageId: 'review' });
});
afterEach(cleanup);

it('opens with only Sales Pipeline, reads its current stage and cancels without a mutation', async () => {
  const action = await menu();
  expect(action.getAttribute('aria-disabled')).toBe('false');
  expect(action.textContent).toContain('Current pipeline: Sales Pipeline');
  fireEvent.click(action);
  const dialog = await screen.findByRole('dialog', { name: 'Change Deal stage' });
  const location = within(dialog).getByRole('region', { name: 'Current deal location' });
  expect(within(location).getByText('Sales Pipeline')).toBeTruthy(); expect(within(location).getByText('Lead')).toBeTruthy();
  expect(within(dialog).queryByLabelText('Choose the target pipeline')).toBeNull();
  expect(within(dialog).getAllByRole('combobox')).toHaveLength(1);
  expect((within(dialog).getByLabelText('Choose the target stage') as HTMLSelectElement).disabled).toBe(false);
  expect((within(dialog).getByRole('button', { name: 'Move deal' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(mocks.moveStage).not.toHaveBeenCalled(); expect(mocks.movePipeline).not.toHaveBeenCalled();
});
it('saves a stage in the current pipeline through the same stage action as drag-and-drop', async () => {
  const changed = vi.fn(); fireEvent.click(await menu(changed));
  const stage = await screen.findByLabelText('Choose the target stage');
  expect((screen.getByRole('option', { name: 'Lead (current)' }) as HTMLOptionElement).disabled).toBe(true);
  expect(screen.queryByRole('option', { name: 'Closed Deal' })).toBeNull(); expect(screen.queryByRole('option', { name: 'Cancelled' })).toBeNull();
  fireEvent.change(stage, { target: { value: 'qualified' } });
  const save = screen.getByRole('button', { name: 'Move deal' }); fireEvent.click(save); fireEvent.click(save);
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(mocks.moveStage).toHaveBeenCalledExactlyOnceWith('deal', 'qualified');
  expect(mocks.movePipeline).not.toHaveBeenCalled(); expect(changed).toHaveBeenCalledWith(expect.objectContaining({ pipelineId: sales.id, stageId: 'qualified' }));
});
it('prevents a no-op move even if the disabled current stage is selected programmatically', async () => {
  fireEvent.click(await menu());
  const stage = await screen.findByLabelText('Choose the target stage');
  fireEvent.change(stage, { target: { value: 'lead' } });
  fireEvent.submit(screen.getByRole('button', { name: 'Move deal' }).closest('form')!);
  expect(mocks.moveStage).not.toHaveBeenCalled(); expect(mocks.movePipeline).not.toHaveBeenCalled();
});
it('reads a renamed pipeline by its ID instead of assuming the Sales Pipeline label', async () => {
  mocks.pipelines = [{ ...sales, name: 'Enterprise Sales' }];
  const action = await menu(); expect(action.textContent).toContain('Current pipeline: Enterprise Sales'); fireEvent.click(action);
  expect(within(await screen.findByRole('region', { name: 'Current deal location' })).getByText('Enterprise Sales')).toBeTruthy();
  expect(screen.queryByLabelText('Choose the target pipeline')).toBeNull();
});
it('uses only the assigned pipeline even when Sales is first in the options', async () => {
  mocks.pipelines = [sales, { ...renewals, stages: [...renewals.stages, { id: 'proposal', name: 'Proposal', order: 1 }] }];
  mocks.deal = { ...mocks.deal, pipelineId: renewals.id, stageId: 'review' };
  fireEvent.click(await menu());
  const location = await screen.findByRole('region', { name: 'Current deal location' });
  expect(within(location).getByText('Renewals')).toBeTruthy(); expect(within(location).getByText('Review')).toBeTruthy();
  expect(screen.queryByLabelText('Choose the target pipeline')).toBeNull();
  expect(screen.queryByRole('option', { name: 'Qualified' })).toBeNull();
  fireEvent.change(screen.getByLabelText('Choose the target stage'), { target: { value: 'proposal' } });
  fireEvent.click(screen.getByRole('button', { name: 'Move deal' }));
  await waitFor(() => expect(mocks.moveStage).toHaveBeenCalledExactlyOnceWith('deal', 'proposal'));
  expect(mocks.movePipeline).not.toHaveBeenCalled();
});
it('defaults a missing pipeline to Sales without offering other pipelines', async () => {
  mocks.deal.pipelineId = '';
  mocks.pipelines = [renewals, sales];
  fireEvent.click(await menu());
  expect(await screen.findByText(/Using Sales Pipeline/)).toBeTruthy();
  expect(screen.getByRole('option', { name: 'Qualified' })).toBeTruthy();
  expect(screen.queryByRole('option', { name: 'Review' })).toBeNull();
  fireEvent.change(screen.getByLabelText('Choose the target stage'), { target: { value: 'qualified' } });
  fireEvent.click(screen.getByRole('button', { name: 'Move deal' }));
  await waitFor(() => expect(mocks.moveStage).toHaveBeenCalledExactlyOnceWith('deal', 'qualified'));
  expect(mocks.movePipeline).not.toHaveBeenCalled();
});
it.each([
  { label: 'archived assigned pipeline', dealPipeline: sales.id, pipelines: [{ ...sales, isArchived: true }, renewals] },
  { label: 'ambiguous Sales defaults', dealPipeline: '', pipelines: [sales, { ...sales, id: 'duplicate' }] },
  { label: 'missing Sales default', dealPipeline: '', pipelines: [renewals] },
])('blocks $label rather than choosing another pipeline', async ({ dealPipeline, pipelines }) => {
  mocks.deal.pipelineId = dealPipeline; mocks.pipelines = pipelines;
  const action = await menu(); expect(action.getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(action); expect(screen.queryByRole('dialog')).toBeNull();
  expect(mocks.moveStage).not.toHaveBeenCalled(); expect(mocks.movePipeline).not.toHaveBeenCalled();
});
it('does not offer terminal or foreign stages and reports a pipeline with no other open stages', async () => {
  const pipeline = { ...sales, stages: sales.stages.filter(stage => stage.id !== 'qualified') };
  const save = vi.fn();
  render(<DealStageDialog deal={mocks.deal} pipelines={[pipeline, renewals]} onMove={save} onClose={vi.fn()} />);
  expect((screen.getByLabelText('Choose the target stage') as HTMLSelectElement).disabled).toBe(true);
  expect(screen.getByRole('status').textContent).toBe('No other open stages are available in this pipeline.');
  expect(screen.queryByRole('option', { name: 'Closed Deal' })).toBeNull();
  expect(screen.queryByRole('option', { name: 'Review' })).toBeNull();
  fireEvent.submit(screen.getByRole('button', { name: 'Move deal' }).closest('form')!); expect(save).not.toHaveBeenCalled();
});
it('retains the selected stage and error when saving fails, then permits a retry', async () => {
  mocks.moveStage.mockRejectedValueOnce(new Error('Missing stage requirements: industry'));
  fireEvent.click(await menu()); fireEvent.change(await screen.findByLabelText('Choose the target stage'), { target: { value: 'qualified' } });
  fireEvent.click(screen.getByRole('button', { name: 'Move deal' }));
  expect((await screen.findByRole('alert')).textContent).toContain('industry');
  expect((screen.getByLabelText('Choose the target stage') as HTMLSelectElement).value).toBe('qualified');
  fireEvent.click(screen.getByRole('button', { name: 'Move deal' })); await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(mocks.moveStage).toHaveBeenCalledTimes(2); expect(mocks.movePipeline).not.toHaveBeenCalled();
});
it('retains closed Deal restrictions even when another pipeline is available', async () => {
  mocks.deal.stageId = 'won'; mocks.pipelines = [sales, renewals];
  const action = await menu(); expect(action.getAttribute('aria-disabled')).toBe('true');
  expect(action.textContent).toContain('Only open deals can change stage here.'); fireEvent.click(action);
  expect(screen.queryByRole('dialog')).toBeNull();
});
it('disables stage changes if the actual current pipeline cannot be read', async () => {
  mocks.pipelines = [renewals]; const action = await menu(); expect(action.getAttribute('aria-disabled')).toBe('true');
  expect(action.textContent).toContain('Current pipeline or stage is unavailable');
});
it('hides the action without deals.edit permission', async () => {
  mocks.canEdit = false;
  render(<DealCardMenu dealId={mocks.deal.id} dealTitle={mocks.deal.title} deal={mocks.deal} />);
  fireEvent.click(screen.getByRole('button', { name: 'Actions for Opportunity' }));
  expect(screen.queryByRole('menuitem', { name: /^Change stage/ })).toBeNull();
});
it('allows authorized Task creation independently of Deal edit access', async () => {
  mocks.canEdit = false; mocks.canTask = true;
  render(<DealCardMenu dealId={mocks.deal.id} dealTitle={mocks.deal.title} deal={mocks.deal} />);
  fireEvent.click(screen.getByRole('button', { name: 'Actions for Opportunity' }));
  expect(await screen.findByRole('menuitem', { name: 'Add a task' })).toBeTruthy();
  expect(screen.queryByRole('menuitem', { name: /^Edit deal/ })).toBeNull();
});
it('hides Task creation when the Deal assignment policy denies association', async () => {
  mocks.canTask = true; mocks.canAccess = false;
  render(<DealCardMenu dealId={mocks.deal.id} dealTitle={mocks.deal.title} deal={mocks.deal} />);
  fireEvent.click(screen.getByRole('button', { name: 'Actions for Opportunity' }));
  expect(screen.queryByRole('menuitem', { name: 'Add a task' })).toBeNull();
});

it.each([['Edit deal', 'Deal title'], ['Add a task', 'Task title']])('preserves the %s draft after its card moves or leaves the list', async (action, label) => {
  mocks.canTask = true;
  const card = <DealCardMenu dealId={mocks.deal.id} dealTitle={mocks.deal.title} deal={mocks.deal} />;
  const view = render(<DealActionsProvider>{card}</DealActionsProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Actions for Opportunity' }));
  fireEvent.click(await screen.findByRole('menuitem', { name: action }));
  fireEvent.change(await screen.findByLabelText(label), { target: { value: 'Unsaved follow-up' } });
  mocks.deal = { ...mocks.deal, title: 'Updated by another session', stageId: 'qualified' };
  view.rerender(<DealActionsProvider><div key="qualified">Moved card</div></DealActionsProvider>);
  expect((screen.getByLabelText(label) as HTMLInputElement).value).toBe('Unsaved follow-up');
  if (label === 'Task title') expect(screen.getByRole('dialog').getAttribute('data-deal-id')).toBe('deal');
  fireEvent.click(screen.getByRole('button', { name: label === 'Task title' ? 'Close' : 'Cancel' }));
  expect(screen.queryByRole('dialog')).toBeNull();
});

it.each(['permission', 'assignment', 'missing', 'identity', 'navigation'])('blocks an open hosted action after %s access changes', async change => {
  const card = <DealCardMenu dealId={mocks.deal.id} dealTitle={mocks.deal.title} deal={mocks.deal} />;
  const view = render(<DealActionsProvider>{card}</DealActionsProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Actions for Opportunity' }));
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Edit deal' }));
  await screen.findByLabelText('Deal title');
  if (change === 'permission') mocks.canEdit = false;
  if (change === 'assignment') mocks.canAccess = false;
  if (change === 'missing') mocks.errorStatus = 404;
  if (change === 'identity') mocks.userId = 'other-actor';
  if (change === 'navigation') mocks.pathname = '/crm/contacts';
  view.rerender(<DealActionsProvider>{card}</DealActionsProvider>);
  expect(screen.queryByRole('dialog')).toBeNull();
});
