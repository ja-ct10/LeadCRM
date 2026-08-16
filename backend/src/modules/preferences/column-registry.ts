import type { ColumnConfig, ColumnConfigItem, ColumnDefinition } from '@leadcrm/shared';

/**
 * Module-level column registry — single source of truth for available
 * columns, their labels, required state, default visibility, and ordering.
 */

export interface ModuleRegistry {
  module: string;
  columns: ColumnDefinition[];
}

// ─────────────────────────────────────────────────────
// LEADS MODULE REGISTRY
// ─────────────────────────────────────────────────────

export const LEADS_COLUMN_REGISTRY: ModuleRegistry = {
  module: 'leads',
  columns: [
    { id: 'firstName',       label: 'First Name',        required: true,  defaultVisible: true,  defaultOrder: 0 },
    { id: 'lastName',        label: 'Last Name',         required: true,  defaultVisible: true,  defaultOrder: 1 },
    { id: 'email',           label: 'Email',             required: false, defaultVisible: true,  defaultOrder: 2 },
    { id: 'phone',           label: 'Phone',             required: false, defaultVisible: true,  defaultOrder: 3 },
    { id: 'companyName',     label: 'Company',           required: false, defaultVisible: true,  defaultOrder: 4 },
    { id: 'status',          label: 'Status',            required: true,  defaultVisible: true,  defaultOrder: 5 },
    { id: 'source',          label: 'Source',            required: false, defaultVisible: true,  defaultOrder: 6 },
    { id: 'assignedUserId',  label: 'Assigned To',       required: false, defaultVisible: true,  defaultOrder: 7 },
    { id: 'productInterest', label: 'Product Interest',  required: false, defaultVisible: false, defaultOrder: 8 },
    { id: 'address',         label: 'Address',           required: false, defaultVisible: false, defaultOrder: 9 },
    { id: 'createdAt',       label: 'Created Date',      required: false, defaultVisible: true,  defaultOrder: 10 },
    { id: 'accountId',       label: 'Account',           required: false, defaultVisible: false, defaultOrder: 11 },
  ],
};

// ─────────────────────────────────────────────────────
// REGISTRY MAP (keyed by module name)
// ─────────────────────────────────────────────────────

export const COLUMN_REGISTRIES: Record<string, ModuleRegistry> = {
  leads: LEADS_COLUMN_REGISTRY,
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

  const columns: ColumnConfigItem[] = registry.columns.map((col) => ({
    id: col.id,
    visible: col.defaultVisible,
    order: col.defaultOrder,
  }));

  return { module, columns };
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
