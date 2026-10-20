import React from 'react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
const state = vi.hoisted(() => ({ get: vi.fn(), replace: vi.fn(), refetch: vi.fn(), params: 'highlight=selected',
  pipelines: [{ id: 'sales', name: 'Sales Pipeline', stages: [] }, { id: 'other', name: 'Other Pipeline', stages: [{ id: 'last', name: 'Last' }] }],
  rows: [{ id: 'selected', title: 'Search-selected Deal', pipelineId: 'other', stageId: 'last', value: 10, priority: 'Low' }],
}));
vi.mock('next/navigation', () => { const router = { replace: state.replace }; return { useRouter: () => router, useSearchParams: () => new URLSearchParams(state.params) }; });
vi.mock('@/store/AuthContext', () => ({ useAuth: () => ({ user: { id: 'actor', tenantId: 'tenant' }, tenant: { id: 'tenant' } }) }));
vi.mock('@/store/DataContext', () => ({ useData: () => ({ pipelines: state.pipelines, deals: [], users: [], refreshPipelines: vi.fn() }) }));
vi.mock('@/shared/hooks/use-permissions', () => ({ useHasPermission: () => true }));
vi.mock('@/shared/hooks/use-cached-page', () => ({ useCachedPage: ({ params }: any) => ({ data: state.rows.filter(row => row.pipelineId === params.pipelineId), refetch: state.refetch, setData: vi.fn() }) }));
vi.mock('@/lib/config', () => ({ USE_MOCK_DATA: false }));
vi.mock('@/lib/api/client', () => ({ apiClient: { get: state.get } }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/shared/components/crm', () => ({ DealPanel: ({ open, deal, onOpenChange }: any) => open ? <div role="dialog" data-deal-id={deal.id}>
  {deal.title}<button onClick={() => onOpenChange(false)}>Close Deal details</button>
</div> : null }));
vi.mock('@/features/tenant/crm/deals/ui/deal-form', () => ({ DealFormSheet: () => null }));
vi.mock('./pipeline-kanban-board', () => ({ PipelineKanbanBoard: ({ pipeline, deals, highlightDealId, onDealClick }: any) => <div data-testid="board" data-pipeline={pipeline.id}>
  {deals.map((deal: any) => <button key={deal.id} data-search-highlight={highlightDealId === deal.id || undefined} onClick={() => onDealClick(deal)}>{deal.title}</button>)}
</div> }));
vi.mock('./pipeline-stages-dialog', () => ({ PipelineStagesDialog: () => null }));
import PipelinePage from './pipeline-page';
beforeEach(() => { vi.clearAllMocks(); state.params = 'highlight=selected'; state.rows = [{ id: 'selected', title: 'Search-selected Deal', pipelineId: 'other', stageId: 'last', value: 10, priority: 'Low' }]; state.refetch.mockResolvedValue(undefined); state.get.mockResolvedValue({ data: state.rows[0] }); }); afterEach(cleanup);
it('selects the exact pipeline and highlights its card without automatically opening details', async () => {
  const { rerender } = render(<PipelinePage />);
  const card = await screen.findByRole('button', { name: 'Search-selected Deal' });
  expect(screen.getByTestId('board').getAttribute('data-pipeline')).toBe('other');
  expect(card.getAttribute('data-search-highlight')).toBe('true');
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(state.get).toHaveBeenCalledWith('/crm/deals/selected', { signal: expect.any(AbortSignal) });
  expect(state.replace).toHaveBeenCalledWith('/crm/deals?highlight=selected&pipelineId=other', { scroll: false });
  fireEvent.click(card);
  expect(screen.getByRole('dialog').getAttribute('data-deal-id')).toBe('selected');
  expect(card.getAttribute('data-search-highlight')).toBeNull();
  expect(state.params).toBe('highlight=selected');
  expect(state.replace).toHaveBeenLastCalledWith('/crm/deals?pipelineId=other', { scroll: false });

  state.params = new URL(state.replace.mock.lastCall![0], 'http://localhost').searchParams.toString();
  rerender(<PipelinePage />);
  expect(screen.getByRole('dialog').getAttribute('data-deal-id')).toBe('selected');
  expect(screen.getByTestId('board').getAttribute('data-pipeline')).toBe('other');
  const refreshes = state.refetch.mock.calls.length;
  fireEvent.click(screen.getByRole('button', { name: 'Close Deal details' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(state.refetch).toHaveBeenCalledTimes(refreshes + 1);
  expect(screen.getByRole('button', { name: 'Search-selected Deal' }).getAttribute('data-search-highlight')).toBeNull();
});

it('preserves the pipeline, tab and other query parameters when consuming the highlight', async () => {
  state.params = 'highlight=selected&pipelineId=other&tab=my&accountId=account&contactId=contact&view=compact';
  const { rerender } = render(<PipelinePage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Search-selected Deal' }));
  expect(state.replace).toHaveBeenLastCalledWith('/crm/deals?pipelineId=other&tab=my&accountId=account&contactId=contact&view=compact', { scroll: false });
  state.params = new URL(state.replace.mock.lastCall![0], 'http://localhost').searchParams.toString();
  rerender(<PipelinePage />);
  expect(screen.getByRole('dialog').getAttribute('data-deal-id')).toBe('selected');
  expect(screen.getByTestId('board').getAttribute('data-pipeline')).toBe('other');
  expect(document.querySelector('[data-search-highlight="true"]')).toBeNull();
});

it('keeps the highlight cleared when details close before the URL replacement completes', async () => {
  state.params = 'highlight=selected&pipelineId=other';
  const { rerender } = render(<PipelinePage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Search-selected Deal' }));
  fireEvent.click(screen.getByRole('button', { name: 'Close Deal details' }));
  rerender(<PipelinePage />);
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByRole('button', { name: 'Search-selected Deal' }).getAttribute('data-search-highlight')).toBeNull();
});

it.each(['selected', 'second'])('highlights %s after a new explicit search following consumption', async nextId => {
  state.params = 'highlight=selected&pipelineId=other';
  const { rerender } = render(<PipelinePage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Search-selected Deal' }));
  state.params = new URL(state.replace.mock.lastCall![0], 'http://localhost').searchParams.toString();
  rerender(<PipelinePage />);
  fireEvent.click(screen.getByRole('button', { name: 'Close Deal details' }));

  const next = { ...state.rows[0], id: nextId, title: 'New search Deal' };
  state.rows = [next]; state.get.mockResolvedValue({ data: next });
  state.params = 'highlight=' + nextId + '&pipelineId=other';
  rerender(<PipelinePage />);
  await waitFor(() => expect(screen.getByRole('button', { name: next.title }).getAttribute('data-search-highlight')).toBe('true'));
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('opens ordinary cards without changing the URL', () => {
  state.params = 'pipelineId=other';
  render(<PipelinePage />);
  fireEvent.click(screen.getByRole('button', { name: 'Search-selected Deal' }));
  expect(screen.getByRole('dialog').getAttribute('data-deal-id')).toBe('selected');
  expect(state.replace).not.toHaveBeenCalled();
  expect(state.get).not.toHaveBeenCalled();
});

it('consumes the search highlight when another Deal card opens', async () => {
  state.params = 'highlight=selected&pipelineId=other';
  state.rows.push({ ...state.rows[0], id: 'another', title: 'Another Deal' });
  render(<PipelinePage />);
  const highlighted = await screen.findByRole('button', { name: 'Search-selected Deal' });
  await waitFor(() => expect(highlighted.getAttribute('data-search-highlight')).toBe('true'));
  fireEvent.click(screen.getByRole('button', { name: 'Another Deal' }));
  expect(screen.getByRole('dialog').getAttribute('data-deal-id')).toBe('another');
  expect(highlighted.getAttribute('data-search-highlight')).toBeNull();
  expect(state.replace).toHaveBeenLastCalledWith('/crm/deals?pipelineId=other', { scroll: false });
});

it('bypasses local filters only for the authorized target and displays its pipeline read-only', async () => {
  render(<PipelinePage />);
  fireEvent.change(screen.getByRole('textbox', { name: 'Search deals' }), { target: { value: 'No match' } });
  expect(await screen.findByRole('button', { name: 'Search-selected Deal' })).toBeTruthy();
  const field = screen.getByRole('textbox', { name: 'Pipeline' }) as HTMLInputElement;
  expect(field.value).toBe('Other Pipeline');
  expect(field.readOnly).toBe(true);
  expect(screen.queryByRole('combobox', { name: 'Pipeline' })).toBeNull();
  fireEvent.click(field);
  expect(state.replace).toHaveBeenCalledExactlyOnceWith('/crm/deals?highlight=selected&pipelineId=other', { scroll: false });
});
it('preserves explicit Deal-detail navigation', async () => {
  state.params = 'dealId=selected'; render(<PipelinePage />);
  expect(await screen.findByRole('dialog')).toBeTruthy();
});
it('refreshes the board when an authorized search target is absent from its loaded snapshot', async () => {
  const record = state.rows[0]; state.rows = [];
  state.get.mockResolvedValue({ data: record });
  state.refetch.mockImplementation(async () => { state.rows = [record]; });
  render(<PipelinePage />);
  expect(await screen.findByRole('button', { name: record.title })).toBeTruthy();
  expect(state.refetch).toHaveBeenCalled();
  expect(screen.queryByRole('dialog')).toBeNull();
});
it.each(['denied', 'archived', 'deleted', 'wrong-id'])('never highlights an unavailable or mismatched target: %s', async reason => {
  if (reason === 'denied') state.get.mockRejectedValue(new Error('Access denied'));
  else state.get.mockResolvedValue({ data: { ...state.rows[0], ...(reason === 'archived' ? { isArchived: true } : reason === 'deleted' ? { deletedAt: '2026-10-01' } : { id: 'wrong' }) } });
  render(<PipelinePage />);
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(document.querySelector('[data-search-highlight="true"]')).toBeNull();
  expect(screen.queryByRole('dialog')).toBeNull();
});
it('aborts the old lookup on another search and ignores its late response', async () => {
  let finish!: (value: unknown) => void;
  state.get.mockReturnValueOnce(new Promise(done => { finish = done; }));
  const { rerender } = render(<PipelinePage />);
  const signal = state.get.mock.calls[0][1].signal as AbortSignal;
  state.params = 'highlight=second'; state.get.mockResolvedValue({ data: { ...state.rows[0], id: 'second' } });
  rerender(<PipelinePage />);
  await waitFor(() => expect(state.get).toHaveBeenCalledWith('/crm/deals/second', expect.anything()));
  expect(signal.aborted).toBe(true);
  await act(async () => finish({ data: state.rows[0] }));
  expect(document.querySelector('[data-search-highlight="true"]')).toBeNull();
  expect(screen.getByRole('alert').textContent).toContain('no longer available');
  expect(screen.queryByRole('dialog')).toBeNull();
});
