import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { subscribeMailboxEvents } from './mailbox-events';

const streams: FakeSource[] = [];
class FakeSource extends EventTarget {
  close = vi.fn();
  constructor(readonly url: string) { super(); streams.push(this); }
}
const subscriptions: { close: () => void }[] = [];
const listen = (tenant = 'tenant', user = 'user') => {
  const callbacks = { onChange: vi.fn(), onAccessChanged: vi.fn(), onOpen: vi.fn(), onError: vi.fn() };
  const subscription = subscribeMailboxEvents(tenant, user, callbacks);
  subscriptions.push(subscription);
  return { ...subscription, ...callbacks };
};
beforeEach(() => { vi.useFakeTimers(); streams.length = 0; vi.stubGlobal('EventSource', FakeSource); });
afterEach(() => { subscriptions.splice(0).forEach(item => item.close()); vi.useRealTimers(); vi.unstubAllGlobals(); });

it('shares the existing endpoint and removes listeners after the final subscriber leaves', () => {
  const first = listen(), second = listen();
  expect(streams.map(source => source.url)).toEqual(['/api/proxy/integrations/gmail/events']);
  streams[0].dispatchEvent(new Event('mailbox-change'));
  expect(first.onChange).toHaveBeenCalledOnce(); expect(second.onChange).toHaveBeenCalledOnce();
  first.close(); streams[0].dispatchEvent(new Event('mailbox-access-changed'));
  expect(first.onAccessChanged).not.toHaveBeenCalled(); expect(second.onAccessChanged).toHaveBeenCalledOnce();
  expect(streams[0].close).not.toHaveBeenCalled();
  second.close(); streams[0].dispatchEvent(new Event('mailbox-change'));
  expect(second.onChange).toHaveBeenCalledOnce(); expect(streams[0].close).toHaveBeenCalledOnce();
});
it('isolates tenant and user identities', () => {
  const first = listen(), otherUser = listen('tenant', 'other'), otherTenant = listen('other', 'user');
  streams[0].dispatchEvent(new Event('mailbox-change'));
  expect(first.onChange).toHaveBeenCalledOnce(); expect(otherUser.onChange).not.toHaveBeenCalled(); expect(otherTenant.onChange).not.toHaveBeenCalled();
  expect(streams).toHaveLength(3);
});
it('bounds reconnection and reports successful reconnects without polling', () => {
  const subscriber = listen();
  streams[0].dispatchEvent(new Event('error'));
  expect(streams[0].close).toHaveBeenCalledOnce(); expect(subscriber.onError).toHaveBeenCalledOnce();
  vi.advanceTimersByTime(4_999); expect(streams).toHaveLength(1);
  vi.advanceTimersByTime(1); expect(streams).toHaveLength(2);
  streams[1].dispatchEvent(new Event('open')); expect(subscriber.onOpen).toHaveBeenCalledOnce();
  vi.advanceTimersByTime(180_000); expect(streams).toHaveLength(2);
  streams[1].dispatchEvent(new Event('error')); subscriber.close();
  vi.advanceTimersByTime(180_000); expect(streams).toHaveLength(2);
});
it('lets Inbox retain its own reconnect policy by unsubscribing on error', () => {
  const onChange = vi.fn();
  const subscription = subscribeMailboxEvents('tenant', 'inbox', { onChange, onAccessChanged: vi.fn(), onError: () => subscription.close() });
  streams[0].dispatchEvent(new Event('error')); vi.advanceTimersByTime(120_000);
  expect(streams).toHaveLength(1); expect(streams[0].close).toHaveBeenCalledOnce();
});
it('does not connect without a complete identity or EventSource support', () => {
  listen('', 'user'); listen('tenant', '');
  vi.stubGlobal('EventSource', undefined); listen();
  expect(streams).toHaveLength(0);
});
