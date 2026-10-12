import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const MIGRATION_KEY = 'leadcrm_leads_columns';
const MIGRATION_DONE_KEY = 'leadcrm_leads_columns_migrated_v2';
const { mockSaveUserPreference } = vi.hoisted(() => ({ mockSaveUserPreference: vi.fn() }));
vi.mock('@/shared/services/preferences.api', () => ({ preferencesApi: { saveUserPreference: mockSaveUserPreference } }));
import { migrateLocalStorageColumns } from '../local-storage-migration';

describe('migrateLocalStorageColumns', () => {
  beforeEach(() => { localStorage.clear(); mockSaveUserPreference.mockReset().mockResolvedValue({ success: true, data: {} }); });
  afterEach(() => localStorage.clear());
  const saved = () => mockSaveUserPreference.mock.calls[0][1];

  it('imports separate-name choices and widths with contiguous orders', async () => {
    localStorage.setItem(MIGRATION_KEY, JSON.stringify([
      { id: 'firstName', visible: true, order: 0, width: 210 },
      { id: 'lastName', visible: true, order: 1 }, { id: 'email', visible: false, order: 2 },
    ]));
    await migrateLocalStorageColumns();
    expect(mockSaveUserPreference.mock.calls[0][0]).toBe('leads');
    expect(saved().slice(0, 4)).toEqual([
      { id: 'name', visible: false, order: 0 },
      { id: 'firstName', visible: true, order: 1, width: 210 },
      { id: 'lastName', visible: true, order: 2 }, { id: 'email', visible: false, order: 3 },
    ]);
    expect(saved().every((column: { order: number }, index: number) => column.order === index)).toBe(true);
    expect(localStorage.getItem(MIGRATION_KEY)).toBeNull();
    expect(localStorage.getItem(MIGRATION_DONE_KEY)).toBe('true');
  });

  it('retains the original source on a transient save failure and retries on the next visit', async () => {
    const source = JSON.stringify([{ id: 'email', visible: false, order: 0, width: 240 }]);
    localStorage.setItem(MIGRATION_KEY, source);
    mockSaveUserPreference.mockRejectedValueOnce(new Error('Network error'));
    await expect(migrateLocalStorageColumns()).resolves.toBeUndefined();
    expect(localStorage.getItem(MIGRATION_KEY)).toBe(source);
    expect(localStorage.getItem(MIGRATION_DONE_KEY)).toBeNull();
    await migrateLocalStorageColumns();
    expect(mockSaveUserPreference).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem(MIGRATION_KEY)).toBeNull();
    expect(localStorage.getItem(MIGRATION_DONE_KEY)).toBe('true');
  });

  it.each(['not-valid-json{{{', JSON.stringify({ id: 'firstName', visible: true }), JSON.stringify([{ id: 'unknownCol', visible: true, order: 0 }])])('discards unusable browser data without a server write: %s', async raw => {
    localStorage.setItem(MIGRATION_KEY, raw);
    await migrateLocalStorageColumns();
    expect(mockSaveUserPreference).not.toHaveBeenCalled();
    expect(localStorage.getItem(MIGRATION_KEY)).toBeNull();
    expect(localStorage.getItem(MIGRATION_DONE_KEY)).toBe('true');
  });

  it('salvages valid entries while removing invalid shapes and unknown IDs', async () => {
    localStorage.setItem(MIGRATION_KEY, JSON.stringify([
      { id: 'firstName', visible: true, order: 0 }, { id: 'email' },
      { id: 'phone', visible: true }, { id: 'unknownColumn', visible: true, order: 3 },
      { id: 'address', visible: true, order: 4, width: 320 },
    ]));
    await migrateLocalStorageColumns();
    expect(saved()).toContainEqual({ id: 'firstName', visible: true, order: 1 });
    expect(saved()).toContainEqual({ id: 'address', visible: true, order: 2, width: 320 });
    expect(saved().some((column: { id: string }) => column.id === 'unknownColumn')).toBe(false);
  });

  it('retires known unsupported fields and expands the historical combined contact column', async () => {
    localStorage.setItem(MIGRATION_KEY, JSON.stringify([
      { id: 'emailAndPhone', visible: true, order: 0 }, { id: 'emailCount', visible: true, order: 79 },
    ]));
    await migrateLocalStorageColumns();
    expect(saved().slice(0, 3).map((column: { id: string; visible: boolean }) => [column.id, column.visible])).toEqual([
      ['name', true], ['email', true], ['phone', true],
    ]);
    expect(saved().some((column: { id: string }) => ['emailAndPhone', 'emailCount'].includes(column.id))).toBe(false);
  });

  it('skips completed v2 imports but rechecks an obsolete v1 marker', async () => {
    localStorage.setItem('leadcrm_leads_columns_migrated', 'true');
    localStorage.setItem(MIGRATION_KEY, JSON.stringify([{ id: 'address', visible: true, order: 0 }]));
    await migrateLocalStorageColumns();
    await migrateLocalStorageColumns();
    expect(mockSaveUserPreference).toHaveBeenCalledTimes(1);
  });

  it('marks an empty browser source complete without a write', async () => {
    await migrateLocalStorageColumns();
    expect(mockSaveUserPreference).not.toHaveBeenCalled();
    expect(localStorage.getItem(MIGRATION_DONE_KEY)).toBe('true');
  });
});
