'use client';

interface MailboxListeners {
  onChange: () => void;
  onAccessChanged: () => void;
  onOpen?: () => void;
  onError?: () => void;
}

export interface MailboxSubscription { close: () => void }
export const MAILBOX_RECONNECT_DELAY_MS = 5_000;

interface MailboxObserver {
  listeners: Set<MailboxListeners>;
  stop: () => void;
}

// Share only the transport. Inbox and CRM retain their own data and refresh rules.
const observers = new Map<string, MailboxObserver>();

export function subscribeMailboxEvents(tenantId: string, userId: string, listener: MailboxListeners): MailboxSubscription {
  if (!tenantId || !userId || typeof EventSource === 'undefined') return { close: () => {} };
  const key = JSON.stringify([tenantId, userId]);
  let observer = observers.get(key);
  if (!observer) {
    const listeners = new Set<MailboxListeners>();
    let disconnect: (() => void) | undefined;
    let reconnect: ReturnType<typeof setTimeout> | undefined;
    const connect = () => {
      reconnect = undefined;
      if (!listeners.size) return;
      const source = new EventSource('/api/proxy/integrations/gmail/events');
      const changed = () => [...listeners].forEach(item => item.onChange());
      const accessChanged = () => [...listeners].forEach(item => item.onAccessChanged());
      const opened = () => [...listeners].forEach(item => item.onOpen?.());
      const failed = () => {
        disconnect?.();
        disconnect = undefined;
        [...listeners].forEach(item => item.onError?.());
        // Bound retries, including the server's intentional connection expiry.
        if (listeners.size) reconnect = setTimeout(connect, MAILBOX_RECONNECT_DELAY_MS);
      };
      source.addEventListener('mailbox-change', changed);
      source.addEventListener('mailbox-access-changed', accessChanged);
      source.addEventListener('open', opened);
      source.addEventListener('error', failed);
      disconnect = () => {
        source.removeEventListener('mailbox-change', changed);
        source.removeEventListener('mailbox-access-changed', accessChanged);
        source.removeEventListener('open', opened);
        source.removeEventListener('error', failed);
        source.close();
      };
    };
    observer = { listeners, stop: () => { disconnect?.(); clearTimeout(reconnect); } };
    observers.set(key, observer);
    listeners.add(listener);
    connect();
  } else observer.listeners.add(listener);
  const subscribed = observer;
  let active = true;
  return { close: () => {
    if (!active) return;
    active = false;
    subscribed.listeners.delete(listener);
    if (!subscribed.listeners.size) {
      subscribed.stop();
      if (observers.get(key) === subscribed) observers.delete(key);
    }
  } };
}
