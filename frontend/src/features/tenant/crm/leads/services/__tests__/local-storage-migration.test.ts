import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const MIGRATION_KEY = 'leadcrm_leads_columns';
const MIGRATION_DONE_KEY = 'leadcrm_leads_columns_migrated';

const { mockSaveUserPreference } = vi.hoisted(() => ({
  mockSaveUserPreference: vi.fn().mockResolvedValue({ success: true, data: {} }),
}));

// Mock the preferences API module used by the migration source.
vi.mock('@/shared/services/preferences.api', () => ({
  preferencesApi: {
    saveUserPreference: mockSaveUserPreference,
  },
}));

// Import the function under test after mocking
import { migrateLocalStorageColumns } from '../local-storage-migration';

describe('migrateLocalStorageColumns', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('migrates valid localStorage data to server via API and clears localStorage', async () => {
    const validConfig = [
      { id: 'firstName', visible: true, order: 0 },
      { id: 'lastName', visible: true, order: 1 },
      { id: 'email', visible: true, order: 2 },
    ];
    localStorage.setItem(MIGRATION_KEY, JSON.stringify(validConfig));

    await migrateLocalStorageColumns();

    expect(mockSaveUserPreference).toHaveBeenCalledWith('leads', validConfig);
    expect(localStorage.getItem(MIGRATION_KEY)).toBeNull();
    expect(localStorage.getItem(MIGRATION_DONE_KEY)).toBe('true');
  });

  it('handles invalid JSON by clearing localStorage without calling API', async () => {
    localStorage.setItem(MIGRATION_KEY, 'not-valid-json{{{');

    await migrateLocalStorageColumns();

    expect(mockSaveUserPreference).not.toHaveBeenCalled();
    expect(localStorage.getItem(MIGRATION_KEY)).toBeNull();
    expect(localStorage.getItem(MIGRATION_DONE_KEY)).toBe('true');
  });

  it('filters out unknown column ids and sends only valid ones to API', async () => {
    const mixedConfig = [
      { id: 'firstName', visible: true, order: 0 },
      { id: 'unknownColumn', visible: true, order: 1 },
      { id: 'email', visible: true, order: 2 },
      { id: 'anotherInvalid', visible: false, order: 3 },
    ];
    localStorage.setItem(MIGRATION_KEY, JSON.stringify(mixedConfig));

    await migrateLocalStorageColumns();

    expect(mockSaveUserPreference).toHaveBeenCalledWith('leads', [
      { id: 'firstName', visible: true, order: 0 },
      { id: 'email', visible: true, order: 2 },
    ]);
    expect(localStorage.getItem(MIGRATION_KEY)).toBeNull();
  });

  it('does not call API and does not throw when localStorage is empty', async () => {
    await migrateLocalStorageColumns();

    expect(mockSaveUserPreference).not.toHaveBeenCalled();
    expect(localStorage.getItem(MIGRATION_DONE_KEY)).toBe('true');
  });

  it('does not re-run migration when migration done flag is already set', async () => {
    localStorage.setItem(MIGRATION_DONE_KEY, 'true');
    const validConfig = [{ id: 'firstName', visible: true, order: 0 }];
    localStorage.setItem(MIGRATION_KEY, JSON.stringify(validConfig));

    await migrateLocalStorageColumns();

    expect(mockSaveUserPreference).not.toHaveBeenCalled();
    // Original localStorage data remains untouched since migration skipped
    expect(localStorage.getItem(MIGRATION_KEY)).not.toBeNull();
  });

  it('does not throw when API call fails and sets migration done flag', async () => {
    mockSaveUserPreference.mockRejectedValueOnce(new Error('Network error'));
    const validConfig = [
      { id: 'firstName', visible: true, order: 0 },
      { id: 'lastName', visible: true, order: 1 },
    ];
    localStorage.setItem(MIGRATION_KEY, JSON.stringify(validConfig));

    // Should not throw — migration failure is silent
    await expect(migrateLocalStorageColumns()).resolves.toBeUndefined();

    // Migration done flag is set to prevent re-runs
    expect(localStorage.getItem(MIGRATION_DONE_KEY)).toBe('true');
  });

  it('discards data when all column ids are unknown', async () => {
    const invalidConfig = [
      { id: 'unknownCol1', visible: true, order: 0 },
      { id: 'unknownCol2', visible: false, order: 1 },
    ];
    localStorage.setItem(MIGRATION_KEY, JSON.stringify(invalidConfig));

    await migrateLocalStorageColumns();

    expect(mockSaveUserPreference).not.toHaveBeenCalled();
    expect(localStorage.getItem(MIGRATION_KEY)).toBeNull();
    expect(localStorage.getItem(MIGRATION_DONE_KEY)).toBe('true');
  });

  it('discards data when localStorage contains a non-array JSON value', async () => {
    localStorage.setItem(MIGRATION_KEY, JSON.stringify({ id: 'firstName', visible: true }));

    await migrateLocalStorageColumns();

    expect(mockSaveUserPreference).not.toHaveBeenCalled();
    expect(localStorage.getItem(MIGRATION_KEY)).toBeNull();
    expect(localStorage.getItem(MIGRATION_DONE_KEY)).toBe('true');
  });

  it('filters out entries with invalid shape (missing fields)', async () => {
    const partialConfig = [
      { id: 'firstName', visible: true, order: 0 }, // valid
      { id: 'email' }, // missing visible and order
      { id: 'phone', visible: true }, // missing order
      { visible: true, order: 3 }, // missing id
    ];
    localStorage.setItem(MIGRATION_KEY, JSON.stringify(partialConfig));

    await migrateLocalStorageColumns();

    expect(mockSaveUserPreference).toHaveBeenCalledWith('leads', [
      { id: 'firstName', visible: true, order: 0 },
    ]);
    expect(localStorage.getItem(MIGRATION_KEY)).toBeNull();
  });
});
