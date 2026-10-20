import { TASK_COLUMN_DEFINITIONS, LEADS_TABLE_COLUMNS, ACCOUNTS_TABLE_COLUMNS, CONTACTS_TABLE_COLUMNS, DEALS_TABLE_COLUMNS, CAMPAIGNS_TABLE_COLUMNS, WORKFLOWS_TABLE_COLUMNS, USERS_TABLE_COLUMNS } from '@leadcrm/shared';
/**
 * Frontend column registry definitions — mirrors the backend column-registry.ts.
 * Used by the ManageColumnsDrawer to display labels and enforce required columns.
 *
 * To add a new module: define a ColumnDefinition[] array and add it to MODULE_COLUMN_REGISTRIES.
 * The preference hook + drawer work automatically for any registered module.
 */

import type { ColumnDefinition, TableSortOption } from '@leadcrm/shared';
import { MODULE_TABLE_SORT_FIELDS } from '@leadcrm/shared';

// ─────────────────────────────────────────────────────
// LEADS
// ─────────────────────────────────────────────────────

export const LEADS_COLUMN_REGISTRY: ColumnDefinition[] = LEADS_TABLE_COLUMNS;

// ─────────────────────────────────────────────────────
// ACCOUNTS
// ─────────────────────────────────────────────────────

export const ACCOUNTS_COLUMN_REGISTRY: ColumnDefinition[] = ACCOUNTS_TABLE_COLUMNS;

// ─────────────────────────────────────────────────────
// CONTACTS
// ─────────────────────────────────────────────────────

export const CONTACTS_COLUMN_REGISTRY: ColumnDefinition[] = CONTACTS_TABLE_COLUMNS;

// ─────────────────────────────────────────────────────
// DEALS
// ─────────────────────────────────────────────────────

export const DEALS_COLUMN_REGISTRY: ColumnDefinition[] = DEALS_TABLE_COLUMNS;

// ─────────────────────────────────────────────────────
// REGISTRY MAP — use this for lookups by module name
// ─────────────────────────────────────────────────────

export const MODULE_COLUMN_REGISTRIES: Record<string, ColumnDefinition[]> = {
  campaigns: CAMPAIGNS_TABLE_COLUMNS,
  workflows: WORKFLOWS_TABLE_COLUMNS,
  users: USERS_TABLE_COLUMNS,
  tasks: TASK_COLUMN_DEFINITIONS,
  leads: LEADS_COLUMN_REGISTRY,
  accounts: ACCOUNTS_COLUMN_REGISTRY,
  contacts: CONTACTS_COLUMN_REGISTRY,
  deals: DEALS_COLUMN_REGISTRY,
};

export function getTableSortFields(module: string): TableSortOption[] {
  const registry = MODULE_COLUMN_REGISTRIES[module] ?? [];
  const labels: Record<string, string> = { createdAt: 'Created', updatedAt: 'Updated', lastSalesActivityAt: 'Most Recent Activity' };
  return (MODULE_TABLE_SORT_FIELDS[module] ?? []).map(id => ({ id,
    label: registry.find(column => column.id === id)?.label ?? labels[id] ?? id,
    kind: ['createdAt', 'updatedAt', 'lastSalesActivityAt', 'dueDate', 'expectedCloseDate'].includes(id) ? 'date'
      : id === 'phone' ? 'phone' : id === 'size' ? 'size' : id === 'value' ? 'number' : 'text',
  }));
}
