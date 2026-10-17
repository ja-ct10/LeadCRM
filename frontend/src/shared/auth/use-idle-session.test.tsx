import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const post = vi.hoisted(() => vi.fn().mockResolvedValue({}));
vi.mock('@/lib/api/client', () => ({ apiClient: { post } }));
import { useIdleSession } from './use-idle-session';
const expire = vi.fn().mockResolvedValue(undefined);
function metadata(age = 0) {
  window.dispatchEvent(new CustomEvent('leadcrm:session-metadata', { detail: { lastActiveAt: new Date(Date.now() - age).toISOString(), idleExpiresAt: new Date(Date.now() - age + 1800000).toISOString(), expiresAt: new Date(Date.now() + 86400000).toISOString(), serverNow: new Date().toISOString() } }));
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2030-01-01T12:00:00Z')); localStorage.clear(); expire.mockClear(); post.mockClear(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });
it('expires exactly at 30 minutes without interactions', async () => {
  renderHook(() => useIdleSession('u', expire)); metadata();
  await act(async () => { vi.advanceTimersByTime(1799000); }); expect(expire).not.toHaveBeenCalled();
  await act(async () => { vi.advanceTimersByTime(1000); }); expect(expire).toHaveBeenCalledWith(true);
});
it('uses server activity on refresh instead of restarting the timer', async () => {
  renderHook(() => useIdleSession('u', expire)); metadata(29 * 60000);
  await act(async () => { vi.advanceTimersByTime(60000); }); expect(expire).toHaveBeenCalledWith(true);
});
it('coalesces real interaction and records the trailing actual interaction time', async () => {
  renderHook(() => useIdleSession('u', expire)); metadata();
  await act(async () => { window.dispatchEvent(new Event('pointermove')); });
  for (let i = 0; i < 10; i++) await act(async () => { vi.advanceTimersByTime(1000); window.dispatchEvent(new Event('keydown')); });
  expect(post).toHaveBeenCalledTimes(1);
  await act(async () => { vi.advanceTimersByTime(50000); });
  expect(post).toHaveBeenCalledTimes(2); expect(post.mock.calls[1][1].lastActiveAt).toBe('2030-01-01T12:00:10.000Z');
});
it('synchronizes activity and logout between tabs and checks elapsed sleep on visibility', async () => {
  renderHook(() => useIdleSession('u', expire)); metadata();
  await act(async () => { vi.advanceTimersByTime(29 * 60000); window.dispatchEvent(new StorageEvent('storage', { key: 'leadcrm:session-activity', newValue: JSON.stringify({ userId: 'u', at: Date.now() }) })); vi.advanceTimersByTime(60000); });
  expect(expire).not.toHaveBeenCalled();
  await act(async () => { window.dispatchEvent(new StorageEvent('storage', { key: 'leadcrm:session-activity', newValue: JSON.stringify({ userId: 'u', logout: true, idle: false }) })); });
  expect(expire).toHaveBeenCalledWith(false);
});
