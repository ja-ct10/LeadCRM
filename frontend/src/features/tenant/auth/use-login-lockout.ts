'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { LOGIN_LOCKOUT_MS } from '@leadcrm/shared';
import type { ApiRequestError } from '@/lib/api/client';
import { authApi } from '@/shared/services/auth.api';
import { USE_MOCK_AUTH } from '@/lib/config';

type Lockout = { identity: string | null; deadline: number };

export function countdownDeadline(retryAt: string, serverNow?: string, receivedAt = Date.now()): number {
  const expiry = Date.parse(retryAt), server = serverNow ? Date.parse(serverNow) : receivedAt;
  // The server supplies both times; the browser's timezone/clock is irrelevant.
  return receivedAt + Math.max(0, Math.min(LOGIN_LOCKOUT_MS, expiry - server));
}

export function formatLoginCountdown(seconds: number): string {
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}

export function useLoginLockout(email: string) {
  const identity = email.trim().toLowerCase();
  const [lockout, setLockout] = useState<Lockout | null>(null);
  const [now, setNow] = useState(Date.now());
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(!USE_MOCK_AUTH);
  const generation = useRef(0);

  const apply = useCallback((retryAt: string, serverNow: string | undefined, lockedIdentity: string | null) => {
    const receivedAt = Date.now();
    const deadline = countdownDeadline(retryAt, serverNow, receivedAt);
    if (!Number.isFinite(deadline) || deadline <= receivedAt) return;
    setNow(receivedAt);
    setLockout({ identity: lockedIdentity, deadline });
    setOpen(true);
  }, []);

  useEffect(() => {
    const requestGeneration = ++generation.current;
    if (USE_MOCK_AUTH || (identity && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identity))) {
      setChecking(false);
      return;
    }
    setChecking(true);
    const timer = window.setTimeout(() => {
      // Only a previously issued HttpOnly proof permits a database lookup.
      // Changing the input validates whether it matches that proof; no address
      // or countdown is persisted in localStorage/sessionStorage.
      void authApi.restoreLoginLockout(identity || undefined).then(response => {
        if (requestGeneration !== generation.current) return;
        if (response.data.locked && response.data.retryAt) apply(response.data.retryAt, response.data.serverNow, identity || null);
        else { setLockout(null); setOpen(false); }
      }).catch(() => {
        // A network failure cannot clear a known lockout. Login still goes
        // through authoritative enforcement when restoration is unavailable.
      }).finally(() => {
        if (requestGeneration === generation.current) setChecking(false);
      });
    }, identity ? 300 : 0);
    return () => { window.clearTimeout(timer); generation.current += 1; };
  }, [identity, apply]);

  useEffect(() => {
    if (!lockout) return;
    const update = () => {
      const current = Date.now();
      setNow(current);
      if (current >= lockout.deadline) { setLockout(null); setOpen(false); }
    };
    const timer = window.setInterval(update, 1000);
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, [lockout]);

  const activate = useCallback((error: ApiRequestError) => {
    if (!error.retryAt) return false;
    generation.current += 1; // Ignore an earlier restoration response.
    setChecking(false);
    apply(error.retryAt, error.serverNow, identity);
    return true;
  }, [apply, identity]);

  const seconds = lockout ? Math.max(0, Math.ceil((lockout.deadline - now) / 1000)) : 0;
  const locked = seconds > 0 && (lockout?.identity === null || lockout?.identity === identity);
  return { locked, checking, seconds, countdown: formatLoginCountdown(seconds), open: open && locked, setOpen, activate };
}
