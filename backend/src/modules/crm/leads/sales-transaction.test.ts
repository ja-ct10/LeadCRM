import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { salesTransaction } from './lead-automation.service';
import { salesContext } from './sales-context';

const mocks = vi.hoisted(() => ({ transaction: vi.fn(), fence: vi.fn(), actor: vi.fn() }));
vi.mock('../../../config/database.config', () => ({ default: { $transaction: mocks.transaction } }));
vi.mock('../../automation/workflows/workflow-lease', () => ({ fenceWorkflowLease: mocks.fence }));
vi.mock('../../notifications/notification-actor', () => ({ setNotificationActor: mocks.actor, withAssignmentReason: vi.fn() }));

const conflict = (code = 'P2034', meta?: Record<string, unknown>) => new Prisma.PrismaClientKnownRequestError('transaction conflict', { code, meta, clientVersion: '5.22.0' });
const tx = {} as Prisma.TransactionClient;

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  mocks.transaction.mockImplementation(work => work(tx));
});
afterEach(() => vi.useRealTimers());

describe('serializable sales transactions', () => {
  it.each([
    ['serialization', conflict()],
    ['unique creation', conflict('P2002')],
    ['SQL serialization', conflict('P2010', { code: '40001' })],
    ['SQL deadlock', conflict('P2010', { code: '40P01' })],
  ])('backs off and opens a fresh transaction after a %s conflict', async (_, error) => {
    mocks.transaction.mockRejectedValueOnce(error).mockRejectedValueOnce(error);
    const work = vi.fn(async () => {
      expect(salesContext.getStore()).toBe(tx);
      return 'committed';
    });
    const pending = salesTransaction(work);
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(work).not.toHaveBeenCalled();
    await vi.runAllTimersAsync();
    await expect(pending).resolves.toBe('committed');
    expect(mocks.transaction).toHaveBeenCalledTimes(3);
    expect(mocks.transaction).toHaveBeenLastCalledWith(expect.any(Function), { isolationLevel: 'Serializable', timeout: 20000 });
    expect(work).toHaveBeenCalledOnce();
    expect(mocks.fence).toHaveBeenCalledWith(tx);
    expect(mocks.actor).toHaveBeenCalledWith(tx);
    expect(salesContext.getStore()).toBeUndefined();
  });

  it('retries the entire callback after a commit conflict', async () => {
    const stale = {} as Prisma.TransactionClient;
    mocks.transaction.mockImplementationOnce(async work => { await work(stale); throw conflict(); });
    const seen: Prisma.TransactionClient[] = [];
    const pending = salesTransaction(async current => { seen.push(current); return current; });
    await vi.runAllTimersAsync();
    await expect(pending).resolves.toBe(tx);
    expect(seen).toEqual([stale, tx]);
    expect(mocks.actor).toHaveBeenCalledTimes(2);
  });

  it('surfaces an exhausted conflict after the existing five-attempt limit', async () => {
    const error = conflict();
    mocks.transaction.mockRejectedValue(error);
    const rejected = expect(salesTransaction(vi.fn())).rejects.toBe(error);
    await vi.runAllTimersAsync();
    await rejected;
    expect(mocks.transaction).toHaveBeenCalledTimes(5);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([new Error('provider unavailable'), conflict('P2025'), conflict('P2010', { code: '42501' })])('propagates non-retryable failures', async error => {
    mocks.transaction.mockRejectedValue(error);
    await expect(salesTransaction(vi.fn())).rejects.toBe(error);
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('lets the owning transaction handle conflicts from nested work', async () => {
    const error = conflict();
    await expect(salesContext.run(tx, () => salesTransaction(async current => {
      expect(current).toBe(tx);
      throw error;
    }))).rejects.toBe(error);
    expect(mocks.fence).toHaveBeenCalledWith(tx);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
