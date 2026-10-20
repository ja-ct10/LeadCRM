import React from 'react';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { NotificationRecordTarget, UnreadNotificationRecord } from '@leadcrm/shared';
import { UnreadRecordDot, useReadRecordNotifications } from '../use-record-notifications';
import { useNotifications } from '../use-notifications';
import { clearNotificationTracking } from '../notification-requests';
import { clearPageCache } from '@/shared/cache/page-cache';
import { PipelineKanbanBoard } from '@/features/tenant/crm/pipeline/ui/pipeline-kanban-board';
import type { Deal, Pipeline } from '@/store/types';

const mocks = vi.hoisted(() => ({
  auth: { tenant: { id: 'tenant' }, user: { id: 'user', role: 'Sales' } },
  counts: vi.fn(), list: vi.fn(), markAllRead: vi.fn(), markRead: vi.fn(), delete: vi.fn(),
}));
vi.mock('@/store/AuthContext', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/lib/config', () => ({ USE_MOCK_DATA: false }));
vi.mock('@/shared/services/notifications.api', () => ({ notificationsApi: mocks }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/shared/hooks/use-crm-record-access', () => ({ useCrmRecordAccess: () => ({ canMutate: () => true }) }));
vi.mock('@/shared/components/crm/deal-card-menu', () => ({ DealCardMenu: () => null }));

const first = { entityType: 'Deal', entityId: '23e0334f-f10b-4cf1-b67c-42984828890a' } as const;
const second = { entityType: 'Deal', entityId: 'adaae32e-b7de-41ec-ac4f-2089929a1ca9' } as const;
let records: UnreadNotificationRecord[];
const summary = () => ({ success: true, totalCount: 5, unreadCount: records.reduce((sum, row) => sum + row.count, 0),
  unreadByModule: records.length ? { deals: records.reduce((sum, row) => sum + row.count, 0) } : {}, unreadRecords: records });
function Open({ ready = false, record = first }: { ready?: boolean; record?: NotificationRecordTarget }) {
  useReadRecordNotifications(record.entityType, record.entityId, ready);
  return <><UnreadRecordDot {...first} /><UnreadRecordDot {...second} /></>;
}
beforeEach(() => {
  vi.clearAllMocks(); clearPageCache(); clearNotificationTracking();
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  mocks.auth.user.id = 'user'; mocks.auth.tenant.id = 'tenant';
  records = [{ ...first, count: 3 }, { ...second, count: 2 }];
  mocks.counts.mockReset().mockImplementation(async () => summary());
  mocks.list.mockReset().mockImplementation(async () => ({ ...summary(), meta: { hasMore: false }, data: [
    { id: 'first-event', ...first, isRead: !records.some(row => row.entityId === first.entityId), createdAt: '2026-01-01T00:00:00Z' },
    { id: 'second-event', ...second, isRead: false, createdAt: '2026-01-01T00:00:00Z' },
  ] }));
  mocks.markAllRead.mockReset().mockImplementation(async (before, record) => {
    records = record ? records.filter(row => row.entityId !== record.entityId || row.entityType !== record.entityType) : [];
    return { ...summary(), readBefore: before, ...(record ? { readRecord: record } : {}) };
  });
});
afterEach(() => { cleanup(); clearNotificationTracking(); clearPageCache(); vi.unstubAllGlobals(); });

it('shares one counts request for the bell and record dots and never reads on module load', async () => {
  render(<Open />);
  const bell = renderHook(() => useNotifications('all', { countsOnly: true }));
  await waitFor(() => expect(screen.getAllByRole('status')).toHaveLength(2));
  await waitFor(() => expect(bell.result.current.unreadCount).toBe(5));
  expect(mocks.counts).toHaveBeenCalledTimes(1);
  expect(mocks.list).not.toHaveBeenCalled(); expect(mocks.markAllRead).not.toHaveBeenCalled();
});

it('shows one dot on the matching Deal card and preserves card and drag-handle interactions', async () => {
  const open = vi.fn();
  render(<PipelineKanbanBoard pipeline={{ id: 'pipeline', name: 'Sales Pipeline', stages: [{ id: 'lead', name: 'Lead', order: 0 }] } as Pipeline}
    deals={[{ id: first.entityId, title: 'Unread Deal', priority: 'Medium', stageId: 'lead' } as Deal]} users={[]} canEdit canDelete={false}
    onDealClick={open} onDealDragEnd={vi.fn()} onAddDeal={vi.fn()} onLoadMore={vi.fn()} loadingStages={new Set()} hasMoreByStage={{}} />);
  await screen.findByRole('status', { name: 'Unread Deal notifications' });
  expect(screen.getAllByRole('status', { name: 'Unread Deal notifications' })).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Drag Unread Deal' }));
  expect(open).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Unread Deal'));
  expect(open).toHaveBeenCalledOnce(); expect(mocks.markAllRead).not.toHaveBeenCalled();
});

it('waits for successful details, then updates the record, module and bell only after read success', async () => {
  let finish!: () => void;
  mocks.markAllRead.mockImplementationOnce((before, record) => new Promise(resolve => { finish = () => {
    records = [{ ...second, count: 2 }]; resolve({ ...summary(), readBefore: before, readRecord: record });
  }; }));
  const view = render(<Open />);
  const bell = renderHook(() => useNotifications('all', { countsOnly: true }));
  const feed = renderHook(() => useNotifications());
  await waitFor(() => expect(screen.getAllByRole('status')).toHaveLength(2));
  view.rerender(<Open ready />);
  await waitFor(() => expect(mocks.markAllRead).toHaveBeenCalledTimes(1));
  expect(screen.getAllByRole('status')).toHaveLength(2); expect(bell.result.current.unreadCount).toBe(5);
  await act(async () => finish());
  await waitFor(() => expect(screen.getAllByRole('status')).toHaveLength(1));
  expect(bell.result.current.unreadCount).toBe(2); expect(bell.result.current.unreadByModule).toEqual({ deals: 2 });
  expect(feed.result.current.notifications.map(row => row.isRead)).toEqual([true, false]);
  expect(mocks.markAllRead).toHaveBeenCalledWith(undefined, first);
  expect(mocks.list).toHaveBeenCalledTimes(1);
  view.rerender(<Open ready record={second} />);
  await waitFor(() => expect(bell.result.current.unreadCount).toBe(0));
  expect(screen.queryByRole('status')).toBeNull(); expect(bell.result.current.unreadByModule).toEqual({});
});

it('retains indicators on read failure and retries on a later open', async () => {
  mocks.markAllRead.mockRejectedValueOnce(new Error('Network unavailable'));
  const view = render(<Open ready />);
  await waitFor(() => expect(mocks.markAllRead).toHaveBeenCalledTimes(1));
  await act(async () => {});
  expect(screen.getAllByRole('status')).toHaveLength(2);
  view.rerender(<Open ready />); expect(mocks.markAllRead).toHaveBeenCalledTimes(1);
  view.unmount(); render(<Open ready />);
  await waitFor(() => expect(screen.getAllByRole('status')).toHaveLength(1));
  expect(mocks.markAllRead).toHaveBeenCalledTimes(2);
});

it('coalesces duplicate opens and queues different records behind an existing mutation', async () => {
  let finish!: () => void;
  mocks.markRead.mockImplementationOnce(() => new Promise(resolve => { finish = () => resolve(summary()); }));
  const bell = renderHook(() => useNotifications('all', { countsOnly: true }));
  await waitFor(() => expect(bell.result.current.hasCounts).toBe(true));
  let pending!: Promise<boolean>;
  act(() => { pending = bell.result.current.markAsRead('an-event'); });
  render(<><Open ready /><Open ready /><Open ready record={second} /></>);
  await act(async () => {});
  expect(mocks.markAllRead).not.toHaveBeenCalled();
  await act(async () => { finish(); await pending; });
  await waitFor(() => expect(mocks.markAllRead).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(bell.result.current.unreadCount).toBe(0));
});

it('does not auto-consume new notifications while an already opened record remains visible', async () => {
  render(<Open ready />);
  await waitFor(() => expect(mocks.markAllRead).toHaveBeenCalledTimes(1));
  records = [{ ...first, count: 1 }, { ...second, count: 2 }];
  act(() => window.dispatchEvent(new Event('focus')));
  await waitFor(() => expect(screen.getAllByRole('status')).toHaveLength(2));
  expect(mocks.markAllRead).toHaveBeenCalledTimes(1);
});

it('replaces record identities even when totals stay equal and rejects stale identity responses', async () => {
  records = [{ ...first, count: 1 }];
  const view = render(<Open />);
  const feed = renderHook(() => useNotifications());
  await waitFor(() => expect(screen.getAllByRole('status')).toHaveLength(1));
  records = [{ ...second, count: 1 }];
  act(() => window.dispatchEvent(new Event('focus')));
  await waitFor(() => expect(feed.result.current.unreadRecords).toEqual(records));
  expect(feed.result.current.unreadCount).toBe(1);
  let resolve!: (value: ReturnType<typeof summary>) => void;
  mocks.counts.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  act(() => window.dispatchEvent(new Event('focus')));
  mocks.auth.user.id = 'another-user';
  mocks.counts.mockReturnValue(new Promise(() => {}));
  view.rerender(<Open />); feed.rerender();
  expect(screen.queryByRole('status')).toBeNull();
  await act(async () => resolve(summary()));
  expect(screen.queryByRole('status')).toBeNull(); expect(feed.result.current.unreadRecords).toEqual([]);
});

it.each(['Lead', 'Contact', 'Account', 'Task', 'Campaign', 'Workflow', 'Form'] as const)('uses the same read flow for %s', async entityType => {
  const record = { ...first, entityType };
  records = [{ ...record, count: 2 }];
  renderHook(() => useReadRecordNotifications(entityType, record.entityId, true));
  await waitFor(() => expect(mocks.markAllRead).toHaveBeenCalledWith(undefined, record));
  expect(mocks.markAllRead).toHaveBeenCalledTimes(1);
});
