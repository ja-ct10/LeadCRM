'use client';
import { preferencesApi } from '@/shared/services/preferences.api';
import { ColumnItemSchema, LEADS_TABLE_COLUMNS, RETIRED_LEAD_TABLE_IDS, reconcileTableColumns } from '@leadcrm/shared';
const MIGRATION_KEY = 'leadcrm_leads_columns';
const MIGRATION_DONE_KEY = 'leadcrm_leads_columns_migrated_v2';

/** Retry old browser preferences on failure; erase the source only after confirmed persistence. */
export async function migrateLocalStorageColumns(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    if (localStorage.getItem(MIGRATION_DONE_KEY) === 'true') return;
    const raw = localStorage.getItem(MIGRATION_KEY);
    if (raw) {
      let saved: unknown;
      try { saved = JSON.parse(raw); } catch { saved = null; }
      const known = new Set([...LEADS_TABLE_COLUMNS.map(column => column.id), ...RETIRED_LEAD_TABLE_IDS, 'emailAndPhone']);
      // Browser imports can salvage valid items; the API still rejects arbitrary IDs.
      const valid = Array.isArray(saved) ? saved.slice(0, 100).flatMap(item => {
        const parsed = ColumnItemSchema.safeParse(item);
        return parsed.success && known.has(parsed.data.id) ? [parsed.data] : [];
      }) : [];
      if (valid.length) {
        const columns = reconcileTableColumns('leads', valid, LEADS_TABLE_COLUMNS);
        await preferencesApi.saveUserPreference('leads', columns);
      }
    }
    localStorage.removeItem(MIGRATION_KEY);
    localStorage.setItem(MIGRATION_DONE_KEY, 'true');
  } catch { /* A transient save failure keeps the original layout for the next visit. */ }
}
