import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useDuplicateCheck } from './use-duplicate-check';
import { apiClient } from '@/lib/api/client';

vi.mock('@/lib/config', () => ({ USE_MOCK_DATA: false }));
vi.mock('@/lib/api/client', () => ({ apiClient: { post: vi.fn() } }));
const match = { id: 'one', entityType: 'lead' as const, name: 'Customer', confidence: 'HIGH' as const, matchedFields: ['email'] };
const advance = async () => { await act(async () => { await vi.advanceTimersByTimeAsync(600); }); };
beforeEach(() => { vi.useFakeTimers(); vi.mocked(apiClient.post).mockReset().mockResolvedValue({ success: true, data: { matches: [] } }); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

it.each(['customer@', 'customer@example', 'bad@@example.test', '   '])('does not send an incomplete email (%s)', async email => {
  renderHook(() => useDuplicateCheck({ email }));
  await advance();
  expect(apiClient.post).not.toHaveBeenCalled();
});
it('omits an invalid email while checking trimmed names, company and phone', async () => {
  renderHook(() => useDuplicateCheck({ email: 'customer@', firstName: ' Customer ', lastName: ' One ', companyName: ' Acme ', phone: ' 09171234567 ' }));
  await advance();
  expect(apiClient.post).toHaveBeenCalledWith('/crm/duplicate-check', {
    firstName: 'Customer', lastName: 'One', companyName: 'Acme', phone: '09171234567', entityTypes: ['account', 'contact', 'lead'],
  }, { signal: expect.any(AbortSignal) });
});
it('debounces rapid edits and avoids repeating the same normalized payload', async () => {
  const { rerender } = renderHook(({ email }) => useDuplicateCheck({ email }), { initialProps: { email: 'first@example.test' } });
  await act(async () => { await vi.advanceTimersByTimeAsync(400); });
  rerender({ email: ' final@example.test ' }); await advance();
  expect(apiClient.post).toHaveBeenCalledTimes(1);
  expect(vi.mocked(apiClient.post).mock.calls[0][1]).toMatchObject({ email: 'final@example.test' });
  rerender({ email: 'final@example.test' }); await advance();
  expect(apiClient.post).toHaveBeenCalledTimes(1);
});
it('cancels superseded checks and ignores their results and finalizers', async () => {
  let finish!: (value: unknown) => void;
  vi.mocked(apiClient.post).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  vi.mocked(apiClient.post).mockImplementationOnce(() => new Promise(() => {}));
  const { result, rerender } = renderHook(({ email }) => useDuplicateCheck({ email }), { initialProps: { email: 'first@example.test' } });
  await advance();
  const signal = vi.mocked(apiClient.post).mock.calls[0][2]!.signal!;
  rerender({ email: 'second@example.test' });
  expect(signal.aborted).toBe(true);
  await advance();
  await act(async () => finish({ success: true, data: { matches: [match] } }));
  expect(result.current.matches).toEqual([]);
  expect(result.current.isChecking).toBe(true);
});
it('includes entity types and excluded IDs in request identity and resets dismissal', async () => {
  vi.mocked(apiClient.post).mockResolvedValue({ success: true, data: { matches: [match] } });
  const { result, rerender } = renderHook(({ excludeId, entityTypes }) => useDuplicateCheck({ email: 'customer@example.test', excludeId, entityTypes }), {
    initialProps: { excludeId: 'first', entityTypes: ['lead'] as ('lead' | 'contact')[] },
  });
  await advance(); act(() => result.current.dismiss()); expect(result.current.isDismissed).toBe(true);
  rerender({ excludeId: 'second', entityTypes: ['contact'] }); await advance();
  expect(result.current.hasDuplicates).toBe(true);
  expect(apiClient.post).toHaveBeenLastCalledWith('/crm/duplicate-check', { email: 'customer@example.test', excludeId: 'second', entityTypes: ['contact'] }, expect.anything());
});
it.each(['disable', 'clear', 'unmount'])('cancels and discards pending results on %s', async action => {
  let finish!: (value: unknown) => void;
  vi.mocked(apiClient.post).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const { result, rerender, unmount } = renderHook(({ email, enabled }) => useDuplicateCheck({ email, enabled }), { initialProps: { email: 'customer@example.test', enabled: true } });
  await advance();
  const signal = vi.mocked(apiClient.post).mock.calls[0][2]!.signal!;
  if (action === 'unmount') unmount();
  else rerender({ email: action === 'clear' ? '' : 'customer@example.test', enabled: action !== 'disable' });
  expect(signal.aborted).toBe(true);
  await act(async () => finish({ success: true, data: { matches: [match] } }));
  if (action !== 'unmount') { expect(result.current.matches).toEqual([]); expect(result.current.isChecking).toBe(false); }
});
