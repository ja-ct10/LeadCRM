import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TASK_COLUMN_DEFINITIONS, type ColumnConfigItem } from '@leadcrm/shared';
import { normalizeTaskColumns } from '../task-columns';
import { useTaskColumns } from '../use-task-columns';

const api = vi.hoisted(() => ({ getEffectiveColumns: vi.fn(), saveUserPreference: vi.fn(), deleteUserPreference: vi.fn() }));
vi.mock('@/lib/config', () => ({ USE_MOCK_DATA: false }));
vi.mock('@/shared/services/preferences.api', () => ({ preferencesApi: api }));
const defaults = (): ColumnConfigItem[] => TASK_COLUMN_DEFINITIONS.map(column => ({ id: column.id, visible: column.defaultVisible, order: column.defaultOrder }));
afterEach(cleanup);
it('clears only Task widths and retains the saved visibility/order using the existing PUT', async () => {
  const saved = normalizeTaskColumns(defaults().map(column => ({ ...column, width: 333, visible: column.id === 'dueDate' ? false : column.visible })));
  api.getEffectiveColumns.mockResolvedValue({ data: { columns: saved } });
  api.saveUserPreference.mockImplementation(async (_module, columns) => ({ data: { columns } }));
  const { result } = renderHook(() => useTaskColumns('tenant:user', true));
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => result.current.resetWidths());
  expect(result.current.columns).toEqual(saved.map(({ width, ...column }) => column));
  expect(api.deleteUserPreference).not.toHaveBeenCalled();
});
beforeEach(() => { vi.resetAllMocks(); api.getEffectiveColumns.mockResolvedValue({ data: { columns: defaults() } }); });

it('preserves supported widths, order and visibility through Task preference normalization', () => {
  const columns = normalizeTaskColumns([
    { id: 'dueDate', visible: false, order: 1, width: 337 },
    { id: 'title', visible: false, order: 4, width: 299 },
    { id: 'unknown', visible: true, order: 100, width: 200 },
    { id: 'completedAt', visible: true, order: 15, width: -1 },
  ]);
  expect(columns.find(column => column.id === 'dueDate')).toMatchObject({ visible: false, width: 337 });
  expect(columns.find(column => column.id === 'title')).toMatchObject({ visible: true, width: 299 });
  expect(columns[0].id).toBe('action');
  expect(columns.map(column => column.order)).toEqual(columns.map((_, index) => index));
  expect(columns.some(column => column.id === 'unknown')).toBe(false);
  expect(columns.find(column => column.id === 'completedAt')?.width).toBeUndefined();
  expect(normalizeTaskColumns(columns)).toEqual(columns);
});

it('declares the existing fixed Action slot so the drawer and Task normalization agree', () => {
  expect(TASK_COLUMN_DEFINITIONS.find(column => column.id === 'action')).toMatchObject({ required: true, fixedPosition: 'first' });
  const normalized = normalizeTaskColumns(defaults().map(column => column.id === 'action' ? { ...column, visible: false, order: 12 } : column));
  expect(normalized[0]).toMatchObject({ id: 'action', visible: true, order: 0 });
  expect(TASK_COLUMN_DEFINITIONS.filter(column => column.fixedPosition).map(column => column.id)).toEqual(['action']);
});

it('serializes successive width writes against the most recent server columns', async () => {
  let confirmFirst!: (value: unknown) => void;
  api.saveUserPreference.mockImplementationOnce(() => new Promise(resolve => { confirmFirst = resolve; }))
    .mockImplementation(async (_module, columns) => ({ data: { columns } }));
  const { result } = renderHook(() => useTaskColumns('tenant:user', true));
  await waitFor(() => expect(result.current.loading).toBe(false));
  let first!: Promise<void>, second!: Promise<void>;
  act(() => { first = result.current.saveWidth('title', 320); second = result.current.saveWidth('dueDate', 280); });
  await waitFor(() => expect(api.saveUserPreference).toHaveBeenCalledTimes(1));
  await act(async () => { confirmFirst({ data: { columns: api.saveUserPreference.mock.calls[0][1] } }); await Promise.all([first, second]); });
  const final = api.saveUserPreference.mock.calls[1][1] as ColumnConfigItem[];
  expect(final.find(column => column.id === 'title')?.width).toBe(320);
  expect(final.find(column => column.id === 'dueDate')?.width).toBe(280);
});

it('uses the authenticated reset fallback and leaves the previous layout after failure', async () => {
  const saved = defaults().map(column => column.id === 'title' ? { ...column, width: 360 } : column);
  api.getEffectiveColumns.mockResolvedValue({ data: { columns: saved } });
  api.deleteUserPreference.mockRejectedValueOnce(new Error('Reset rejected'))
    .mockResolvedValueOnce({ data: { columns: defaults().map(column => ({ ...column, visible: column.id === 'title' || column.id === 'action' })) } });
  const { result } = renderHook(() => useTaskColumns('tenant:user', true));
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => { await expect(result.current.reset()).rejects.toThrow('Reset rejected'); });
  expect(result.current.columns.find(column => column.id === 'title')?.width).toBe(360);
  await act(async () => { await result.current.reset(); });
  expect(api.deleteUserPreference).toHaveBeenCalledWith('tasks');
  expect(api.saveUserPreference).not.toHaveBeenCalled();
  expect(result.current.columns.find(column => column.id === 'dueDate')?.visible).toBe(false);
  expect(result.current.columns.find(column => column.id === 'title')?.width).toBeUndefined();
});
