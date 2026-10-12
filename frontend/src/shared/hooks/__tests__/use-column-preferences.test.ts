import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { LEADS_TABLE_COLUMNS, type ColumnConfigItem } from '@leadcrm/shared';
import { useColumnPreferences } from '../use-column-preferences';

const mocks = vi.hoisted(() => ({
  api: { getEffectiveColumns: vi.fn(), saveUserPreference: vi.fn(), deleteUserPreference: vi.fn() },
  auth: { user: { id: 'actor' }, tenant: { id: 'tenant' } },
}));
vi.mock('@/shared/services/preferences.api', () => ({ preferencesApi: mocks.api }));
vi.mock('@/store/AuthContext', () => ({ useAuth: () => mocks.auth }));

const baseline: ColumnConfigItem[] = LEADS_TABLE_COLUMNS.map(column => ({ id: column.id, order: column.defaultOrder, visible: column.defaultVisible, width: 180 }));
const response = (columns: ColumnConfigItem[]) => ({ data: { module: 'leads', columns } });
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((accept, decline) => { resolve = accept; reject = decline; });
  return { promise, resolve, reject };
}
async function loadedHook() {
  const rendered = renderHook(() => useColumnPreferences('leads'));
  await waitFor(() => expect(rendered.result.current.isLoading).toBe(false));
  return rendered;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.user = { id: 'actor' }; mocks.auth.tenant = { id: 'tenant' };
  mocks.api.getEffectiveColumns.mockResolvedValue(response(baseline));
  mocks.api.saveUserPreference.mockImplementation(async (_module: string, columns: ColumnConfigItem[]) => response(columns));
});
afterEach(cleanup);

it('resets only widths with PUT, preserves the layout and recovers from a failed reset', async () => {
  const saved = baseline.map(column => column.id === 'email' ? { ...column, visible: false } : column);
  mocks.api.getEffectiveColumns.mockResolvedValue(response(saved));
  const { result } = await loadedHook();
  mocks.api.saveUserPreference.mockRejectedValueOnce(new Error('Offline'));
  await act(async () => { await expect(result.current.resetColumnWidths()).rejects.toThrow('Offline'); });
  expect(result.current.effectiveColumns).toEqual(saved);
  await act(async () => result.current.resetColumnWidths());
  expect(result.current.effectiveColumns).toEqual(saved.map(({ width, ...column }) => column));
  expect(mocks.api.deleteUserPreference).not.toHaveBeenCalled();
  expect(mocks.api.saveUserPreference).toHaveBeenCalledTimes(2);
});

it('makes reset failures observable and retains the previous columns', async () => {
  const error = new Error('Reset request failed');
  mocks.api.deleteUserPreference.mockRejectedValue(error);
  const { result } = await loadedHook();
  await act(async () => { await expect(result.current.resetColumns()).rejects.toBe(error); });
  expect(result.current.effectiveColumns).toEqual(baseline);
  expect(result.current.saveError).toBe(error.message);
  expect(result.current.isSaving).toBe(false);
});

it('rolls back a failed width save without losing visibility or other widths', async () => {
  const saved = baseline.map(column => column.id === 'email' ? { ...column, visible: false, width: 250 } : column);
  mocks.api.getEffectiveColumns.mockResolvedValue(response(saved));
  const error = new Error('Width request failed');
  mocks.api.saveUserPreference.mockRejectedValue(error);
  const { result } = await loadedHook();
  await act(async () => { await expect(result.current.saveColumnWidth('name', 320)).rejects.toBe(error); });
  const attempted = mocks.api.saveUserPreference.mock.calls[0][1] as ColumnConfigItem[];
  expect(attempted.find(column => column.id === 'name')?.width).toBe(320);
  expect(attempted.find(column => column.id === 'email')).toMatchObject({ visible: false, width: 250 });
  expect(result.current.effectiveColumns).toEqual(saved);
  expect(result.current.retryCount).toBe(1);
});

it('serializes a resize behind Save and merges its width into the latest confirmed configuration', async () => {
  const pending = deferred<ReturnType<typeof response>>();
  mocks.api.saveUserPreference.mockImplementationOnce(() => pending.promise);
  const { result } = await loadedHook();
  const config = baseline.map(column => column.id === 'email' ? { ...column, visible: false } : column);
  let save!: Promise<void>, resize!: Promise<void>;
  await act(async () => { save = result.current.saveColumns(config); resize = result.current.saveColumnWidth('name', 333); });
  expect(mocks.api.saveUserPreference).toHaveBeenCalledTimes(1);
  expect(result.current.effectiveColumns.find(column => column.id === 'email')?.visible).toBe(false);
  await act(async () => { pending.resolve(response(config)); await Promise.all([save, resize]); });
  expect(mocks.api.saveUserPreference).toHaveBeenCalledTimes(2);
  const last = mocks.api.saveUserPreference.mock.calls[1][1] as ColumnConfigItem[];
  expect(last.find(column => column.id === 'name')?.width).toBe(333);
  expect(last.find(column => column.id === 'email')?.visible).toBe(false);
  expect(result.current.effectiveColumns).toEqual(last);
});

it('ignores an older initial fetch after a successful mutation', async () => {
  const initialFetch = deferred<ReturnType<typeof response>>();
  mocks.api.getEffectiveColumns.mockReturnValue(initialFetch.promise);
  const { result } = renderHook(() => useColumnPreferences('leads'));
  const saved = baseline.map(column => column.id === 'firstName' ? { ...column, visible: true } : column.id === 'name' ? { ...column, visible: false } : column);
  await act(async () => result.current.saveColumns(saved));
  await act(async () => initialFetch.resolve(response(baseline)));
  expect(result.current.effectiveColumns.find(column => column.id === 'firstName')?.visible).toBe(true);
});

it('ignores former-owner responses and rejects queued writes after a tenant/session change', async () => {
  const oldSave = deferred<ReturnType<typeof response>>();
  mocks.api.saveUserPreference.mockImplementationOnce(() => oldSave.promise);
  const { result, rerender } = await loadedHook();
  let first!: Promise<void>, queued!: Promise<void>;
  await act(async () => {
    first = result.current.saveColumns(baseline);
    queued = result.current.saveColumnWidth('name', 700);
    // Observe rejection immediately, even if it settles before our final assertion.
    void queued.catch(() => {});
  });
  const newOwnerColumns = baseline.map(column => ({ ...column, width: 280 }));
  mocks.auth.tenant = { id: 'different-tenant' }; mocks.auth.user = { id: 'different-user' };
  mocks.api.getEffectiveColumns.mockResolvedValue(response(newOwnerColumns));
  rerender();
  await waitFor(() => expect(result.current.effectiveColumns).toEqual(newOwnerColumns));
  await act(async () => {
    oldSave.resolve(response(baseline));
    await first;
    await expect(queued).rejects.toThrow('session changed');
  });
  expect(mocks.api.saveUserPreference).toHaveBeenCalledTimes(1);
  expect(result.current.effectiveColumns).toEqual(newOwnerColumns);
  expect(result.current.saveError).toBeNull();
});
