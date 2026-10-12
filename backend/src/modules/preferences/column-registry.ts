import { MODULE_TABLE_SORT_FIELDS, CAMPAIGNS_TABLE_COLUMNS, WORKFLOWS_TABLE_COLUMNS, USERS_TABLE_COLUMNS, TASK_COLUMN_DEFINITIONS, LEADS_TABLE_COLUMNS, LEADS_TABLE_SORT_FIELDS, ACCOUNTS_TABLE_COLUMNS, CONTACTS_TABLE_COLUMNS, DEALS_TABLE_COLUMNS, ACCOUNTS_TABLE_SORT_FIELDS, CONTACTS_TABLE_SORT_FIELDS, DEALS_TABLE_SORT_FIELDS } from '@leadcrm/shared';
import { reconcileTableColumns, type ColumnConfig, type ColumnDefinition } from '@leadcrm/shared';

/**
 * Module-level column registry — single source of truth for available
 * columns, their labels, required state, default visibility, and ordering.
 *
 * To add a new module:
 * 1. Define a ModuleRegistry constant
 * 2. Add it to COLUMN_REGISTRIES
 * That's it — the preference API, service, and frontend hooks work automatically.
 */

export interface ModuleRegistry {
  module: string;
  columns: ColumnDefinition[];
  /** Fields that support sorting — if empty, all column IDs are considered sortable */
  sortableFields?: string[];
}

// ─────────────────────────────────────────────────────
// LEADS MODULE REGISTRY
// ─────────────────────────────────────────────────────

export const LEADS_COLUMN_REGISTRY: ModuleRegistry = { module: 'leads', columns: LEADS_TABLE_COLUMNS, sortableFields: LEADS_TABLE_SORT_FIELDS };

// ─────────────────────────────────────────────────────
// ACCOUNTS MODULE REGISTRY
// ─────────────────────────────────────────────────────

export const ACCOUNTS_COLUMN_REGISTRY: ModuleRegistry = { module: 'accounts', columns: ACCOUNTS_TABLE_COLUMNS, sortableFields: ACCOUNTS_TABLE_SORT_FIELDS };

// ─────────────────────────────────────────────────────
// CONTACTS MODULE REGISTRY
// ─────────────────────────────────────────────────────

export const CONTACTS_COLUMN_REGISTRY: ModuleRegistry = { module: 'contacts', columns: CONTACTS_TABLE_COLUMNS, sortableFields: CONTACTS_TABLE_SORT_FIELDS };

// ─────────────────────────────────────────────────────
// DEALS MODULE REGISTRY
// ─────────────────────────────────────────────────────

export const DEALS_COLUMN_REGISTRY: ModuleRegistry = { module: 'deals', columns: DEALS_TABLE_COLUMNS, sortableFields: DEALS_TABLE_SORT_FIELDS };

// ─────────────────────────────────────────────────────
// REGISTRY MAP (keyed by module name)
// ─────────────────────────────────────────────────────

export const COLUMN_REGISTRIES: Record<string, ModuleRegistry> = {
  campaigns: { module: 'campaigns', columns: CAMPAIGNS_TABLE_COLUMNS, sortableFields: MODULE_TABLE_SORT_FIELDS.campaigns },
  workflows: { module: 'workflows', columns: WORKFLOWS_TABLE_COLUMNS, sortableFields: MODULE_TABLE_SORT_FIELDS.workflows },
  users: { module: 'users', columns: USERS_TABLE_COLUMNS, sortableFields: MODULE_TABLE_SORT_FIELDS.users },
  tasks: { module: 'tasks', columns: TASK_COLUMN_DEFINITIONS, sortableFields: MODULE_TABLE_SORT_FIELDS.tasks },
  leads: LEADS_COLUMN_REGISTRY,
  accounts: ACCOUNTS_COLUMN_REGISTRY,
  contacts: CONTACTS_COLUMN_REGISTRY,
  deals: DEALS_COLUMN_REGISTRY,
};

// ─────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────

/**
 * Retrieve the column registry for a given module.
 * Returns undefined if the module is not registered.
 */
export function getRegistryForModule(module: string): ModuleRegistry | undefined {
  return COLUMN_REGISTRIES[module];
}

/**
 * Build the system-default ColumnConfig for a module.
 * All columns at their registry-defined visibility and order.
 */
export function getSystemDefault(module: string): ColumnConfig {
  const registry = COLUMN_REGISTRIES[module];
  if (!registry) {
    return { module, columns: [] };
  }

  const columns = registry.columns.map((col) => ({
    id: col.id,
    visible: col.defaultVisible,
    order: col.defaultOrder,
  }));

  return { module, columns: reconcileTableColumns(module, columns, registry.columns) };
}

/**
 * Return the ids of all required columns for a module.
 * Required columns cannot be hidden by any user or admin.
 */
export function getRequiredColumnIds(module: string): string[] {
  const registry = COLUMN_REGISTRIES[module];
  if (!registry) {
    return [];
  }

  return registry.columns
    .filter((col) => col.required)
    .map((col) => col.id);
}

/**
 * Check whether a module name has a registered column registry.
 */
export function isValidModule(module: string): boolean {
  return module in COLUMN_REGISTRIES;
}

/**
 * Get the sortable fields for a module.
 * If the module doesn't define explicit sortable fields, all column IDs are considered sortable.
 * Returns empty array for unregistered modules.
 */
export function getSortableFields(module: string): string[] {
  const registry = COLUMN_REGISTRIES[module];
  if (!registry) {
    return [];
  }
  if (registry.sortableFields && registry.sortableFields.length > 0) {
    return registry.sortableFields;
  }
  // Fallback: all column IDs are sortable
  return registry.columns.map((col) => col.id);
}

/**
 * Check whether a field is a valid sortable field for a module.
 */
export function isValidSortField(module: string, field: string): boolean {
  const sortableFields = getSortableFields(module);
  return sortableFields.includes(field);
}
