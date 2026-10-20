import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { clearPageCache, invalidatePageCache } from '@/shared/cache/page-cache';

const state = vi.hoisted(() => ({
  userId: 'first-user', get: vi.fn(),
  pages: {} as Record<number, Record<string, unknown>[]>,
  pipelines: [{ id: 'sales', name: 'Sales Pipeline', stages: [{ id: 'qualified', name: 'Qualified', order: 0 }] }],
}));
vi.mock('next/navigation', () => {
  const router = { replace: vi.fn() };
  return { useRouter: () => router, useSearchParams: () => new URLSearchParams() };
});
vi.mock('@/store/AuthContext', () => ({ useAuth: () => ({ user: { id: state.userId, role: 'Client Admin' }, tenant: { id: 'tenant' } }) }));
vi.mock('@/store/DataContext', () => ({ useData: () => ({ pipelines: state.pipelines, deals: [], users: [],
  addDeals: vi.fn(), moveDealStage: vi.fn(), refreshPipelines: vi.fn() }) }));
vi.mock('@/shared/hooks/use-permissions', () => ({ useHasPermission: () => true }));
vi.mock('@/features/tenant/notifications/hooks/use-record-notifications', () => ({ UnreadRecordDot: () => null }));
vi.mock('@/shared/hooks/use-crm-record-access', () => ({ useCrmRecordAccess: () => ({ canMutate: () => true }) }));
vi.mock('@/lib/config', () => ({ USE_MOCK_DATA: false }));
vi.mock('@/lib/api/client', () => ({ apiClient: { get: state.get } }));
vi.mock('@/shared/components/crm', () => ({ DealPanel: ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) =>
  open ? <button onClick={() => onOpenChange(false)}>Close Deal Details</button> : null }));
vi.mock('@/shared/components/crm/deal-card-menu', () => ({ DealCardMenu: () => null }));
vi.mock('@/features/tenant/crm/deals/ui/deal-form', () => ({ DealFormSheet: () => null }));
vi.mock('./pipeline-stages-dialog', () => ({ PipelineStagesDialog: () => null }));
import PipelinePage from './pipeline-page';

const raw = (id: string, createdAt: string, lastStageChangeDate: string) => ({
  id, title: id, pipelineId: 'sales', stageId: 'qualified', createdAt, lastStageChangeDate, priority: 'HIGH', value: 100,
});
const order = () => Array.from(document.querySelectorAll('[data-deal-id]'), card => card.getAttribute('data-deal-id'));
beforeEach(() => {
  clearPageCache(); vi.clearAllMocks(); state.userId = 'first-user';
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  state.pages = {
    1: [raw('resident', '2026-10-19T00:00:00Z', '2026-10-19T00:00:00Z')],
    2: [raw('older-moved', '2000-01-01T00:00:00Z', '2026-10-20T00:00:00Z')],
  };
  state.get.mockImplementation(async (path: string, options: { params: { page: number } }) => {
    expect(path).toBe('/crm/deals');
    const page = options.params.page;
    return { data: state.pages[page], meta: { hasMore: page === 1 } };
  });
});
afterEach(() => { cleanup(); clearPageCache(); vi.unstubAllGlobals(); });

it('orders later pages, Deal Details refreshes and Workflow invalidations consistently after reload and for another user', async () => {
  const view = render(<PipelinePage />);
  await waitFor(() => expect(order()).toEqual(['older-moved', 'resident']));
  expect(state.get).toHaveBeenCalledTimes(2);
  expect(state.get.mock.calls.map(call => call[1].params.page)).toEqual([1, 2]);

  fireEvent.click(document.querySelector('[data-deal-id="resident"]')!);
  state.pages[1] = [raw('resident', '2026-10-19T00:00:00Z', '2026-10-21T00:00:00Z')];
  fireEvent.click(screen.getByRole('button', { name: 'Close Deal Details' }));
  await waitFor(() => expect(order()).toEqual(['resident', 'older-moved']));
  expect(state.get).toHaveBeenCalledTimes(4);

  state.pages[2] = [raw('older-moved', '2000-01-01T00:00:00Z', '2026-10-22T00:00:00Z')];
  act(() => invalidatePageCache('deals', 'tenant'));
  await waitFor(() => expect(order()).toEqual(['older-moved', 'resident']));
  expect(state.get).toHaveBeenCalledTimes(6);

  view.unmount(); clearPageCache();
  const reload = render(<PipelinePage />);
  await waitFor(() => expect(order()).toEqual(['older-moved', 'resident']));
  expect(state.get).toHaveBeenCalledTimes(8);
  reload.unmount(); state.userId = 'second-user';
  render(<PipelinePage />);
  await waitFor(() => expect(order()).toEqual(['older-moved', 'resident']));
  expect(state.get).toHaveBeenCalledTimes(10);
});
