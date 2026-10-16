import { afterEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ accounts: vi.fn(), scheduled: vi.fn() }));
vi.mock('../../config/database.config', () => ({ default: { emailAccount: { findMany: mocks.accounts } } }));
vi.mock('./scheduled-mailbox.service', () => ({ runScheduledMailboxEmails: mocks.scheduled }));
import { startMailboxScheduler } from './mailbox-sync.service';

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.resetAllMocks(); });

it('drains both pending mailbox jobs on stop, prevents overlap, and does not schedule more work', async () => {
  vi.useFakeTimers();
  vi.spyOn(console, 'info').mockImplementation(() => {});
  let releaseSync!: (accounts: []) => void, releaseSend!: () => void;
  mocks.accounts.mockImplementation(() => new Promise(resolve => { releaseSync = resolve; }));
  mocks.scheduled.mockImplementation(() => new Promise<void>(resolve => { releaseSend = resolve; }));
  const stop = startMailboxScheduler();
  try {
    await vi.advanceTimersByTimeAsync(20000);
    expect(mocks.accounts).toHaveBeenCalledOnce();
    expect(mocks.scheduled).toHaveBeenCalledOnce();
    let stopped = false;
    const drained = stop().then(() => { stopped = true; });
    await Promise.resolve();
    expect(stopped).toBe(false);
    releaseSync([]);
    await vi.advanceTimersByTimeAsync(0);
    expect(stopped).toBe(false);
    releaseSend();
    await drained;
    expect(stopped).toBe(true);
    await vi.advanceTimersByTimeAsync(30000);
    expect(mocks.accounts).toHaveBeenCalledOnce();
    expect(mocks.scheduled).toHaveBeenCalledOnce();
    await stop();
  } finally { releaseSync([]); releaseSend(); await stop(); }
});
