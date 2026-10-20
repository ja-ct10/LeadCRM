'use client';
import { useEffect, useState } from 'react';
import type { NotificationMutationResponse, NotificationsResponse } from '@leadcrm/shared';
import { notificationsApi } from '@/shared/services/notifications.api';
import { toast } from 'sonner';
import { invalidatePageCache } from '@/shared/cache/page-cache';

// A single clock and request per authenticated scope; feed consumers share in-flight reads.
const pending = new Map<string, Promise<NotificationsResponse>>();
export function sharedNotificationList(scope: string, query: Parameters<typeof notificationsApi.list>[0]) {
  const key = scope + JSON.stringify(query);
  let request = pending.get(key);
  if (!request) {
    request = notificationsApi.list(query).finally(() => { if (pending.get(key) === request) pending.delete(key); });
    pending.set(key, request);
  }
  return request;
}
function clearRequests(scope: string) {
  for (const key of pending.keys()) if (key.startsWith(scope)) pending.delete(key);
}
type Counts = NotificationMutationResponse & { scope: string };
type Session = { since: string; cursor?: string; fastUntil: number; seen: Set<string> };
type Watcher = { listeners: Set<(counts: Counts) => void>; counts?: Counts; version: number; failures: number; loading: boolean; timer?: ReturnType<typeof setTimeout>; focus: () => void; mutation: (event: Event) => void; submitted: (event: Event) => void };
const watchers = new Map<string, Watcher>();
const sessions = new Map<string, Session>();
const storageKey = (scope: string) => `leadcrm:sms-toasts:${scope}`;
function sessionFor(scope: string): Session {
  let session = sessions.get(scope);
  if (!session) {
    let seen: string[] = [];
    try { seen = JSON.parse(sessionStorage.getItem(storageKey(scope)) ?? '[]'); } catch { /* Restricted storage: memory still deduplicates. */ }
    session = { since: new Date().toISOString(), fastUntil: 0, seen: new Set(Array.isArray(seen) ? seen.filter(id => typeof id === 'string') : []) };
    sessions.set(scope, session);
  }
  return session;
}
export function clearNotificationTracking() {
  for (const [scope, watcher] of watchers) { watcher.version++; watcher.counts = undefined; clearRequests(scope); }
  sessions.clear();
  try { for (const key of Object.keys(sessionStorage)) if (key.startsWith('leadcrm:sms-toasts:')) sessionStorage.removeItem(key); } catch { /* Storage is optional. */ }
}
export function trackSmsCampaignSubmission(tenantId: string, userId: string) {
  window.dispatchEvent(new CustomEvent('sms-campaign-submitted', { detail: { tenantId, userId } }));
}
export function useNotificationCounts(scope: string, tenantId: string, userId: string, enabled: boolean) {
  const [state, setState] = useState<Counts>();
  useEffect(() => {
    if (!enabled) return;
    let watcher = watchers.get(scope);
    if (!watcher) {
      const session = sessionFor(scope);
      const schedule = (more = false) => {
        if (watchers.get(scope) !== watcher) return;
        clearTimeout(watcher!.timer);
        const interval = document.visibilityState === 'hidden' ? 30000 : more ? 250 : Date.now() < session.fastUntil ? 2500 : 30000;
        watcher!.timer = setTimeout(() => { void refresh(); }, Math.max(interval, watcher!.failures ? Math.min(30000, 2500 * 2 ** watcher!.failures) : 0));
      };
      const refresh = async () => {
        if (watcher!.loading) return;
        if (document.visibilityState === 'hidden') { schedule(); return; }
        watcher!.loading = true;
        const version = watcher!.version;
        let more = false;
        try {
          const result = await notificationsApi.counts(session.cursor ? { after: session.cursor } : { since: session.since });
          if (watchers.get(scope) !== watcher || watcher!.version !== version) return;
          watcher!.failures = 0;
          if (result.cursor) session.cursor = result.cursor;
          more = result.hasMore === true;
          // A client submission grants at most five minutes; server hints cannot extend it indefinitely.
          const serverUntil = result.activeSmsUntil ? Date.parse(result.activeSmsUntil) : 0;
          if (result.activeSmsUntil !== undefined) session.fastUntil = serverUntil > Date.now() ? Math.min(serverUntil, Date.now() + 300000) : 0;
          const changedCampaigns = new Set<string>();
          for (const update of result.updates ?? []) {
            if (update.tenantId !== tenantId || update.userId !== userId || update.available === false || session.seen.has(update.id)
              || (update.occurredAt && Date.parse(update.occurredAt) < Date.parse(session.since))) continue;
            session.seen.add(update.id);
            if (update.entityId) changedCampaigns.add(update.entityId);
            // Persist before rendering: rerenders and reconnects cannot replay an outcome.
            const identities = [...session.seen].slice(-2000);
            session.seen = new Set(identities);
            try { sessionStorage.setItem(storageKey(scope), JSON.stringify(identities)); } catch { /* Keep memory identity. */ }
            const options = { id: `sms-result:${tenantId}:${userId}:${update.id}` };
            const message = update.body || update.title;
            if (update.type === 'sms_campaign_sent' || update.type === 'sms_campaign_delivered') toast.success(message, options);
            else if (update.type === 'sms_campaign_failed') toast.error(message, options);
            else if (['sms_campaign_partial', 'sms_campaign_unconfirmed', 'sms_campaign_progress'].includes(update.type)) toast.warning(message, options);
          }
          if (changedCampaigns.size) {
            invalidatePageCache('campaigns', tenantId);
            window.dispatchEvent(new CustomEvent('sms-campaign-updated', { detail: { tenantId, userId, campaignIds: [...changedCampaigns] } }));
          }
          const changed = watcher!.counts && (watcher!.counts.totalCount !== result.totalCount || watcher!.counts.unreadCount !== result.unreadCount
            || JSON.stringify(watcher!.counts.unreadRecords) !== JSON.stringify(result.unreadRecords)
            || JSON.stringify(watcher!.counts.unreadByModule) !== JSON.stringify(result.unreadByModule));
          watcher!.counts = { ...result, scope };
          watcher!.listeners.forEach(fn => fn(watcher!.counts!));
          if (changed) window.dispatchEvent(new CustomEvent('notifications-refresh', { detail: { tenantId, userId } }));
        } catch (error) {
          if (watchers.get(scope) !== watcher || watcher!.version !== version) return;
          watcher!.failures++;
          if ([401, 403].includes((error as { status?: number }).status ?? 0)) {
            sessions.delete(scope); session.fastUntil = 0;
            watcher!.counts = { scope, success: false, unreadCount: 0, totalCount: 0 };
            watcher!.listeners.forEach(fn => fn(watcher!.counts!));
          }
        } finally { watcher!.loading = false; schedule(more); }
      };
      const mutation = (event: Event) => {
        const result = (event as CustomEvent<Counts & { tenantId: string; userId: string }>).detail;
        if (result.tenantId !== tenantId || result.userId !== userId) return;
        watcher!.version++;
        watcher!.counts = { ...result, scope };
        watcher!.listeners.forEach(fn => fn(watcher!.counts!));
      };
      const focus = () => { if (document.visibilityState === 'hidden') { watcher!.version++; return; } void refresh(); };
      const submitted = (event: Event) => {
        const detail = (event as CustomEvent<{ tenantId: string; userId: string }>).detail;
        if (detail?.tenantId !== tenantId || detail.userId !== userId) return;
        session.fastUntil = Date.now() + 300000;
        watcher!.version++;
        focus();
      };
      watcher = { listeners: new Set(), version: 0, failures: 0, loading: false, focus, mutation, submitted };
      watchers.set(scope, watcher);
      window.addEventListener('focus', focus);
      window.addEventListener('online', focus);
      document.addEventListener('visibilitychange', focus);
      window.addEventListener('sms-campaign-submitted', submitted);
      window.addEventListener('notifications-changed', mutation);
      void refresh();
    }
    watcher.listeners.add(setState);
    if (watcher.counts) setState(watcher.counts);
    return () => {
      watcher!.listeners.delete(setState);
      if (!watcher!.listeners.size) {
        clearRequests(scope);
        clearTimeout(watcher!.timer); watchers.delete(scope);
        window.removeEventListener('focus', watcher!.focus);
        window.removeEventListener('online', watcher!.focus);
        document.removeEventListener('visibilitychange', watcher!.focus);
        window.removeEventListener('sms-campaign-submitted', watcher!.submitted);
        window.removeEventListener('notifications-changed', watcher!.mutation);
      }
    };
  }, [scope, tenantId, userId, enabled]);
  return enabled && state?.scope === scope ? state : undefined;
}

const locks = new Set<string>();
const waiting = new Map<string, Set<() => void>>();
const recordReads = new Map<string, Promise<boolean>>();
/** Coalesce duplicate opens and wait for an existing bell/feed mutation to finish. */
export function sharedRecordNotificationRead(scope: string, key: string, read: () => Promise<boolean>) {
  const identity = scope + ':' + key;
  const pending = recordReads.get(identity);
  if (pending) return pending;
  const request = (async () => {
    while (locks.has(scope)) await new Promise<void>(resolve => {
      const listeners = waiting.get(scope) ?? new Set();
      listeners.add(resolve); waiting.set(scope, listeners);
    });
    return read();
  })().finally(() => { if (recordReads.get(identity) === request) recordReads.delete(identity); });
  recordReads.set(identity, request);
  return request;
}
export function lockNotificationMutation(scope: string) {
  if (locks.has(scope)) return false;
  clearRequests(scope);
  locks.add(scope); return true;
}
export function unlockNotificationMutation(scope: string) {
  clearRequests(scope); locks.delete(scope);
  const listeners = waiting.get(scope); waiting.delete(scope); listeners?.forEach(resolve => resolve());
}
