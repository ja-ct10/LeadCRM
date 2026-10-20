import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { clearNotificationTracking, trackSmsCampaignSubmission, useNotificationCounts } from '../notification-requests';
const mocks = vi.hoisted(() => ({ counts: vi.fn(), success: vi.fn(), error: vi.fn(), warning: vi.fn() }));
vi.mock('@/shared/services/notifications.api', () => ({ notificationsApi: { counts: mocks.counts } }));
vi.mock('sonner', () => ({ toast: mocks }));
const now = new Date('2026-10-14T02:00:00Z');
const outcome = (type: string, id = type) => ({ id, tenantId: 'tenant', userId: 'user', entityId: 'campaign', entityType: 'Campaign', type,
  body: `${type}: verified recipient counts`, title: type, occurredAt: now.toISOString(), createdAt: now.toISOString(), available: true, isRead: false });
const response = (updates: ReturnType<typeof outcome>[] = [], active = true) => ({ success: true, totalCount: updates.length, unreadCount: updates.length,
  cursor: 'cursor', updates, hasMore: false, activeSmsUntil: active ? new Date(+now + 300000).toISOString() : null });
const mount = (scope = 'scope', tenant = 'tenant', user = 'user') => renderHook(() => useNotificationCounts(scope, tenant, user, true));
const flush = () => act(async () => { await vi.advanceTimersByTimeAsync(0); });
const tick = (ms = 2500) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(now); vi.clearAllMocks(); clearNotificationTracking();
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  mocks.counts.mockReset().mockResolvedValue(response());
});
afterEach(() => { cleanup(); clearNotificationTracking(); vi.useRealTimers(); });

it('uses one watcher for multiple consumers and separate exactly-once Sent/Delivered toasts', async () => {
  const changed = vi.fn();
  window.addEventListener('sms-campaign-updated', changed);
  mount(); mount(); await flush(); expect(mocks.counts).toHaveBeenCalledTimes(1);
  mocks.counts.mockResolvedValue(response([outcome('sms_campaign_sent')])); await tick();
  expect(mocks.success).toHaveBeenCalledTimes(1);
  mocks.counts.mockResolvedValue(response([outcome('sms_campaign_sent'), outcome('sms_campaign_delivered')], false)); await tick();
  expect(mocks.success).toHaveBeenCalledTimes(2);
  expect(mocks.success.mock.calls.map(call => call[0])).toEqual(['sms_campaign_sent: verified recipient counts', 'sms_campaign_delivered: verified recipient counts']);
  await tick(30000); expect(mocks.success).toHaveBeenCalledTimes(2);
  expect(changed).toHaveBeenCalledTimes(2);
  expect(changed.mock.calls[0][0].detail).toEqual({ tenantId: 'tenant', userId: 'user', campaignIds: ['campaign'] });
  window.removeEventListener('sms-campaign-updated', changed);
});

it('refreshes record identities when unread totals remain equal without adding another timer', async () => {
  const refreshed = vi.fn();
  window.addEventListener('notifications-refresh', refreshed);
  try {
    mocks.counts.mockResolvedValue({ ...response([], false), unreadCount: 1, unreadByModule: { deals: 1 }, unreadRecords: [{ entityType: 'Deal', entityId: 'a', count: 1 }] });
    const hook = mount(); await flush();
    mocks.counts.mockResolvedValue({ ...response([], false), unreadCount: 1, unreadByModule: { deals: 1 }, unreadRecords: [{ entityType: 'Deal', entityId: 'b', count: 1 }] });
    await tick(30000);
    expect(hook.result.current?.unreadRecords).toEqual([{ entityType: 'Deal', entityId: 'b', count: 1 }]);
    expect(refreshed).toHaveBeenCalledOnce(); expect(mocks.counts).toHaveBeenCalledTimes(2);
  } finally { window.removeEventListener('notifications-refresh', refreshed); }
});

it('keeps completion delivery active across navigation without replaying duplicate poll results', async () => {
  const first = mount(); await flush(); first.unmount();
  mocks.counts.mockResolvedValue(response([outcome('sms_campaign_sent')]));
  const second = mount(); await flush(); expect(mocks.success).toHaveBeenCalledTimes(1);
  second.unmount(); mount(); await flush(); expect(mocks.success).toHaveBeenCalledTimes(1);
  expect(mocks.counts).toHaveBeenLastCalledWith({ after: 'cursor' });
});

it('shows Delivered directly without manufacturing Sent and uses error/warning outcomes accurately', async () => {
  mocks.counts.mockResolvedValue(response([outcome('sms_campaign_delivered'), outcome('sms_campaign_failed'), outcome('sms_campaign_partial'), outcome('sms_campaign_unconfirmed')], false));
  mount(); await flush();
  expect(mocks.success).toHaveBeenCalledTimes(1); expect(mocks.error).toHaveBeenCalledTimes(1); expect(mocks.warning).toHaveBeenCalledTimes(2);
});

it('never replays old completion events on a new page session or leaks another scope', async () => {
  const old = { ...outcome('sms_campaign_sent'), occurredAt: new Date(+now - 60000).toISOString() };
  mocks.counts.mockResolvedValue(response([old, { ...outcome('sms_campaign_delivered'), userId: 'another-user' }, { ...outcome('sms_campaign_failed'), available: false }], false));
  mount(); await flush();
  expect(mocks.counts).toHaveBeenCalledWith({ since: now.toISOString() });
  expect(mocks.success).not.toHaveBeenCalled(); expect(mocks.error).not.toHaveBeenCalled();
});

it('bounds fast polling, stops on completion, and preserves the idle interval', async () => {
  mocks.counts.mockResolvedValue(response([], false)); mount(); await flush(); await tick(2500);
  expect(mocks.counts).toHaveBeenCalledTimes(1);
  mocks.counts.mockResolvedValue(response());
  await act(async () => { trackSmsCampaignSubmission('tenant', 'user'); }); await flush();
  expect(mocks.counts).toHaveBeenCalledTimes(2); await tick(); expect(mocks.counts).toHaveBeenCalledTimes(3);
  mocks.counts.mockResolvedValue(response([outcome('sms_campaign_delivered')], false)); await tick();
  const count = mocks.counts.mock.calls.length; await tick(29999); expect(mocks.counts).toHaveBeenCalledTimes(count);
  await tick(1); expect(mocks.counts).toHaveBeenCalledTimes(count + 1);
});

it('expires the five-minute fast window even when the gateway remains unconfirmed', async () => {
  mount(); await flush(); await tick(300000);
  const count = mocks.counts.mock.calls.length; await tick(29999); expect(mocks.counts).toHaveBeenCalledTimes(count);
  await tick(1); expect(mocks.counts).toHaveBeenCalledTimes(count + 1);
});

it('pauses hidden-page requests and resumes once on visibility/reconnection', async () => {
  mount(); await flush();
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  await act(async () => { document.dispatchEvent(new Event('visibilitychange')); }); await tick(60000);
  expect(mocks.counts).toHaveBeenCalledTimes(1);
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  await act(async () => { document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('online')); }); await flush();
  expect(mocks.counts).toHaveBeenCalledTimes(2);
});

it('backs off failed checks and drops responses from an unmounted identity', async () => {
  const hook = mount(); await flush(); mocks.counts.mockRejectedValueOnce(new Error('offline'));
  await tick(); const count = mocks.counts.mock.calls.length; await tick(4999); expect(mocks.counts).toHaveBeenCalledTimes(count);
  await tick(1); expect(mocks.counts).toHaveBeenCalledTimes(count + 1);
  let finish!: (value: ReturnType<typeof response>) => void;
  mocks.counts.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })); await tick();
  hook.unmount(); clearNotificationTracking();
  await act(async () => { finish(response([outcome('sms_campaign_sent')])); });
  expect(mocks.success).not.toHaveBeenCalled();
});
