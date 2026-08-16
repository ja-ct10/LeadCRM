'use client';

import { preferencesApi } from '@/shared/services/preferences.api';
import type { ColumnConfigItem } from '@leadcrm/shared';

const MIGRATION_KEY = 'leadcrm_leads_columns';
const MIGRATION_DONE_KEY = 'leadcrm_leads_columns_migrated';

/**
 * Valid column ids from the leads registry.
 * Mirrors backend column-registry.ts — used for client-side validation
 * before attempting the migration API call.
 */
const VALID_COLUMN_IDS = new Set([
  'firstName',
  'lastName',
  'email',
  'phone',
  'companyName',
  'status',
  'source',
  'assignedUserId',
  'productInterest',
  'address',
  'createdAt',
  'accountId',
]);

/**
 * One-time migration of localStorage column config to server-persisted User_Preference.
 *
 * - Runs silently — never blocks page load or shows errors to the user
 * - If localStorage has valid column config: saves via API, then clears localStorage
 * - If invalid/empty: just clears localStorage key
 * - Tracks migration completion to avoid re-running
 */
export async function migrateLocalStorageColumns(): Promise<void> {
  try {
    // Guard: SSR safety
    if (typeof window === 'undefined') return;

    // Check if migration already completed
    if (localStorage.getItem(MIGRATION_DONE_KEY) === 'true') return;

    const raw = localStorage.getItem(MIGRATION_KEY);

    // Mark as done immediately to prevent re-runs even on failure
    localStorage.setItem(MIGRATION_DONE_KEY, 'true');

    if (!raw) {
      // No localStorage data — nothing to migrate
      localStorage.removeItem(MIGRATION_KEY);
      return;
    }

    // Try to parse
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Invalid JSON — discard
      localStorage.removeItem(MIGRATION_KEY);
      return;
    }

    // Validate shape: expect an array of { id, visible, order }
    if (!Array.isArray(parsed)) {
      localStorage.removeItem(MIGRATION_KEY);
      return;
    }

    const validColumns: ColumnConfigItem[] = [];
    for (const entry of parsed) {
      if (
        typeof entry === 'object' &&
        entry !== null &&
        typeof entry.id === 'string' &&
        typeof entry.visible === 'boolean' &&
        typeof entry.order === 'number' &&
        VALID_COLUMN_IDS.has(entry.id)
      ) {
        validColumns.push({
          id: entry.id,
          visible: entry.visible,
          order: entry.order,
        });
      }
    }

    if (validColumns.length === 0) {
      // No valid columns after filtering — discard
      localStorage.removeItem(MIGRATION_KEY);
      return;
    }

    // Save via API — fire-and-forget style (don't block page load on failure)
    await preferencesApi.saveUserPreference('leads', validColumns);

    // Clear localStorage after successful migration
    localStorage.removeItem(MIGRATION_KEY);
  } catch {
    // Migration failure — silently continue, don't block page load
    // The MIGRATION_DONE_KEY prevents re-runs regardless of outcome
  }
}
