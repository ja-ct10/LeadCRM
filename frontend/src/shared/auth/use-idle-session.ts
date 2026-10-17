'use client';
import { useEffect, useRef } from 'react';
import { SESSION_IDLE_MS, type SessionMetadata } from '@leadcrm/shared';
import { apiClient } from '@/lib/api/client';

const KEY = 'leadcrm:session-activity';
const COALESCE_MS = 60_000;
/** Browser interactions renew the existing session; passive reads never do. */
export function useIdleSession(userId: string | undefined, expire: (idle: boolean) => Promise<void>) {
  const latest = useRef(expire); latest.current = expire;
  const metadata = useRef<SessionMetadata | null>(null);
  const activity = useRef(0);
  const serverOffset = useRef(0);
  const ending = useRef(false);
  useEffect(() => {
    const receive = (event: Event) => {
      const session = (event as CustomEvent<SessionMetadata>).detail;
      metadata.current = session;
      serverOffset.current = Date.parse(session.serverNow) - Date.now();
      activity.current = Math.max(activity.current, Date.parse(session.lastActiveAt) - serverOffset.current);
    };
    window.addEventListener('leadcrm:session-metadata', receive);
    return () => window.removeEventListener('leadcrm:session-metadata', receive);
  }, []);
  useEffect(() => {
    if (!userId) { ending.current = false; activity.current = 0; return; }
    let sent = 0, pending = false, requestedAt = 0;
    let trailing: ReturnType<typeof setTimeout> | undefined;
    const end = async (idle: boolean, broadcast = true) => {
      if (ending.current) return;
      ending.current = true;
      if (broadcast) localStorage.setItem(KEY, JSON.stringify({ userId, logout: true, idle, at: Date.now() }));
      await latest.current(idle);
    };
    const expired = () => metadata.current && Date.now() >= Math.min(
      Math.max(Date.parse(metadata.current.lastActiveAt) - serverOffset.current, activity.current) + SESSION_IDLE_MS,
      Date.parse(metadata.current.expiresAt) - serverOffset.current);
    const flush = async () => {
      if (pending || ending.current || !activity.current || activity.current <= sent) return;
      if (expired()) { void end(!!metadata.current && Date.now() < Date.parse(metadata.current.expiresAt) - serverOffset.current); return; }
      pending = true; requestedAt = Date.now();
      const at = activity.current;
      try { await apiClient.post('/auth/activity', { lastActiveAt: new Date(at + serverOffset.current).toISOString() }); sent = at; }
      catch { /* Existing API events handle expiry; transient failures retry. */ }
      finally { pending = false; }
    };
    let lastBroadcast = 0;
    const interact = () => {
      if (expired()) { void end(!!metadata.current && Date.now() < Date.parse(metadata.current.expiresAt) - serverOffset.current); return; }
      activity.current = Date.now();
      if (Date.now() - lastBroadcast >= 1000) {
        localStorage.setItem(KEY, JSON.stringify({ userId, at: activity.current })); lastBroadcast = Date.now();
      }
      if (Date.now() - requestedAt >= COALESCE_MS) void flush();
      // One trailing write per minute records the actual last interaction.
      if (!trailing) trailing = setTimeout(() => { trailing = undefined; void flush(); }, Math.max(1, COALESCE_MS - (Date.now() - requestedAt)));
    };
    const check = () => { if (expired()) void end(!!metadata.current && Date.now() < Date.parse(metadata.current.expiresAt) - serverOffset.current); };
    const storage = (event: StorageEvent) => {
      if (event.key !== KEY || !event.newValue) return;
      try {
        const value = JSON.parse(event.newValue);
        if (value.userId !== userId) return;
        if (value.logout) void end(value.idle === true, false);
        else if (typeof value.at === 'number' && value.at <= Date.now()) activity.current = Math.max(activity.current, value.at);
      } catch { /* Ignore invalid storage data. */ }
    };
    const ended = (event: Event) => void end((event as CustomEvent).detail?.code === 'SESSION_IDLE_EXPIRED');
    const events = ['pointermove', 'pointerdown', 'wheel', 'keydown', 'touchstart', 'touchmove', 'popstate'] as const;
    events.forEach(name => window.addEventListener(name, interact, { passive: true }));
    window.addEventListener('storage', storage);
    window.addEventListener('leadcrm:session-ended', ended);
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    const timer = setInterval(check, 1000);
    check();
    return () => {
      clearInterval(timer); if (trailing) clearTimeout(trailing);
      events.forEach(name => window.removeEventListener(name, interact));
      window.removeEventListener('storage', storage); window.removeEventListener('leadcrm:session-ended', ended);
      window.removeEventListener('focus', check); document.removeEventListener('visibilitychange', check);
    };
  }, [userId]);
}
