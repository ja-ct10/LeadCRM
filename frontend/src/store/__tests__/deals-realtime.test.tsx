import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DataProvider, useData } from '../DataContext';
import { clearPageCache, invalidatePageCache } from '@/shared/cache/page-cache';
import { useCachedPage } from '@/shared/hooks/use-cached-page';
import { apiClient } from '@/lib/api/client';
import { toFrontendDeal } from '@/lib/api/adapters/deal.adapter';
import { PipelineKanbanBoard } from '@/features/tenant/crm/pipeline/ui/pipeline-kanban-board';
import type { Deal, Pipeline } from '../types';

const state = vi.hoisted(() => ({ id: 'actor', tenant: 'tenant', denied: false }));
vi.mock('../AuthContext', () => ({ useAuth: () => ({
  user: { id: state.id, role: 'Staff', status: 'ACTIVE' }, tenant: { id: state.tenant },
  userCan: (module: string) => !(state.denied && module === 'deals'), isLoading: false,
}) }));
vi.mock('@/lib/config', () => ({ USE_MOCK_DATA: false }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/shared/hooks/use-crm-record-access', () => ({ useCrmRecordAccess: () => ({ canMutate: () => true }) }));
vi.mock('@/shared/components/crm/deal-card-menu', () => ({ DealCardMenu: () => null }));

class Events extends EventTarget {
  static sources: Events[] = [];
  closed = false;
  constructor(public url: string) { super(); Events.sources.push(this); }
  close() { this.closed = true; }
  emit(type: string, revision = '1') { this.dispatchEvent(new MessageEvent(type, { data: JSON.stringify({ content: revision }) })); }
}
const pipeline = { id: 'pipeline', name: 'Sales', stages: [
  { id: 'lead', name: 'Lead', order: 0, probability: 0, isDefault: true },
  { id: 'lost', name: 'Lost', order: 1, probability: 0, isLost: true },
  { id: 'qualified', name: 'Qualified', order: 2, probability: 50 },
] } as Pipeline;
const row = (stageId = 'lead') => ({ id: 'deal', title: 'Live opportunity', tenantId: state.tenant, pipelineId: pipeline.id, stageId, value: 1000, priority: 'HIGH' });
let rows = [row()];
let intercept: ((url: URL) => Promise<Response> | undefined) | undefined;
const response = (data: unknown, status = 200) => new Response(JSON.stringify({ data, meta: { hasMore: false } }), { status, headers: { 'Content-Type': 'application/json' } });
const fetcher = vi.fn(async (path: string) => {
  const url = new URL(path, 'http://localhost');
  const held = intercept?.(url); if (held) return held;
  if (url.pathname.endsWith('/crm/deals')) return response(rows);
  if (url.pathname.endsWith('/crm/pipelines')) return response([pipeline]);
  return response([]);
});
const sharedReads = () => fetcher.mock.calls.filter(([path]) => { const url = new URL(path, 'http://localhost'); return url.pathname.endsWith('/crm/deals') && !url.searchParams.has('pipelineId'); }).length;
const source = () => [...Events.sources].reverse().find(source => source.url.endsWith('/record-events') && !source.closed)!;

function View({ board = false }: { board?: boolean }) {
  const { deals, refreshDeals } = useData();
  const query = useCachedPage<Deal[]>({ module: 'deals', params: { pipelineId: pipeline.id }, disabled: !board,
    revalidateOnInvalidation: true, fetchFn: async signal => (await apiClient.get<{ data: object[] }>('/crm/deals', { params: { pipelineId: pipeline.id }, signal })).data.map(toFrontendDeal) });
  return <><output data-testid="shared">{deals.map(deal => `${deal.id}:${deal.stageId}`).join(',')}</output>
    <button onClick={() => { void refreshDeals(); void refreshDeals(); }}>Refresh shared</button>
    {board && <>
      <PipelineKanbanBoard pipeline={pipeline} deals={query.data ?? []} users={[]} canEdit={false} canDelete={false}
        onDealClick={vi.fn()} onDealDragEnd={vi.fn()} onAddDeal={vi.fn()} onLoadMore={vi.fn()} loadingStages={new Set()} hasMoreByStage={{}} /></>}</>;
}
beforeEach(() => {
  state.id = 'actor'; state.tenant = 'tenant'; state.denied = false; rows = [row()]; intercept = undefined;
  clearPageCache(); localStorage.clear(); Events.sources = []; fetcher.mockClear();
  vi.stubGlobal('EventSource', Events); vi.stubGlobal('fetch', fetcher);
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
});
afterEach(() => { cleanup(); clearPageCache(); vi.unstubAllGlobals(); });

it('updates Qualified stage, High priority badge and counts through crm-change without a manual refresh', async () => {
  rows = [{ ...row(), priority: 'MEDIUM' }];
  render(<DataProvider><View board /></DataProvider>);
  await waitFor(() => expect(screen.getByTestId('shared').textContent).toBe('deal:lead'));
  await screen.findByText('Live opportunity');
  expect(screen.getByText('Medium')).toBeTruthy();
  const before = sharedReads();
  rows = [row('qualified')];
  act(() => { source().emit('crm-change'); source().emit('crm-change'); source().emit('crm-change'); });
  await waitFor(() => expect(screen.getByTestId('shared').textContent).toBe('deal:qualified'));
  const qualifiedColumn = screen.getByRole('heading', { name: 'Qualified' }).closest('.p-4')!.parentElement!;
  const leadColumn = screen.getByRole('heading', { name: 'Lead' }).closest('.p-4')!.parentElement!;
  await waitFor(() => expect(within(qualifiedColumn).getByText('Live opportunity')).toBeTruthy());
  expect(within(qualifiedColumn).getByText('High')).toBeTruthy();
  expect(screen.queryByText('Medium')).toBeNull();
  expect(within(leadColumn).queryByText('Live opportunity')).toBeNull();
  expect(within(leadColumn).getByText('0', { exact: true })).toBeTruthy();
  expect(within(qualifiedColumn).getByText('1', { exact: true })).toBeTruthy();
  expect(sharedReads() - before).toBe(1);
  // Duplicate revisions must not refetch, including after reconciliation completed.
  act(() => source().emit('crm-change'));
  expect(sharedReads() - before).toBe(1);
});

it('coalesces bootstrap/manual reads and ignores an old bootstrap after a newer revision', async () => {
  let release!: (response: Response) => void; let held = false;
  intercept = url => {
    if (url.pathname.endsWith('/crm/deals') && !held) { held = true; return new Promise(resolve => { release = resolve; }); }
  };
  render(<DataProvider><View /></DataProvider>);
  await waitFor(() => expect(release).toBeTypeOf('function'));
  fireEvent.click(screen.getByText('Refresh shared')); expect(sharedReads()).toBe(1);
  rows = [row('lost')]; act(() => source().emit('crm-change'));
  await waitFor(() => expect(screen.getByTestId('shared').textContent).toBe('deal:lost'));
  await act(async () => { release(response([row('lead')])); });
  expect(screen.getByTestId('shared').textContent).toBe('deal:lost');
});

it('rejects pre-mutation responses, retains data on transport errors, and clears it on access loss', async () => {
  render(<DataProvider><View /></DataProvider>);
  await waitFor(() => expect(screen.getByTestId('shared').textContent).toBe('deal:lead'));
  let release!: (response: Response) => void;
  intercept = url => url.pathname.endsWith('/crm/deals') ? new Promise(resolve => { release = resolve; }) : undefined;
  fireEvent.click(screen.getByText('Refresh shared')); await waitFor(() => expect(release).toBeTypeOf('function'));
  invalidatePageCache('deals', 'tenant');
  await act(async () => { release(response([row('lost')])); });
  expect(screen.getByTestId('shared').textContent).toBe('deal:lead');
  intercept = url => url.pathname.endsWith('/crm/deals') ? Promise.resolve(response([], 503)) : undefined;
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  fireEvent.click(screen.getByText('Refresh shared'));
  await waitFor(() => expect(log).toHaveBeenCalled()); log.mockRestore();
  expect(screen.getByTestId('shared').textContent).toBe('deal:lead');
  act(() => source().emit('crm-access-changed'));
  expect(screen.getByTestId('shared').textContent).toBe('');
  expect(source()).toBeUndefined();
});

it('discards responses from a previous identity and catches up after reconnect or focus', async () => {
  let release!: (response: Response) => void; let held = false;
  intercept = url => url.pathname.endsWith('/crm/deals') && !held ? (held = true, new Promise(resolve => { release = resolve; })) : undefined;
  const view = render(<DataProvider><View /></DataProvider>);
  await waitFor(() => expect(release).toBeTypeOf('function'));
  state.id = 'next-actor'; state.tenant = 'next-tenant'; rows = [row('lost')];
  view.rerender(<DataProvider><View /></DataProvider>);
  await waitFor(() => expect(screen.getByTestId('shared').textContent).toBe('deal:lost'));
  await act(async () => release(response([row('lead')])));
  expect(screen.getByTestId('shared').textContent).toBe('deal:lost');
  rows = [row('lead')]; act(() => { source().emit('open'); source().emit('crm-change'); });
  await waitFor(() => expect(screen.getByTestId('shared').textContent).toBe('deal:lead'));
  rows = [row('lost')]; act(() => window.dispatchEvent(new Event('focus')));
  await waitFor(() => expect(screen.getByTestId('shared').textContent).toBe('deal:lost'));
});
