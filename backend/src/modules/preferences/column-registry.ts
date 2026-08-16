import type { ColumnConfig, ColumnConfigItem, ColumnDefinition } from '@leadcrm/shared';

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
// ACCOUNTS MODULE REGISTRY
// ─────────────────────────────────────────────────────

export const ACCOUNTS_COLUMN_REGISTRY: ModuleRegistry = {
  module: 'accounts',
  columns: [
    { id: 'name',            label: 'Account Name',      required: true,  defaultVisible: true,  defaultOrder: 0 },
    { id: 'industry',        label: 'Industry',          required: false, defaultVisible: true,  defaultOrder: 1 },
    { id: 'customerType',    label: 'Account Type',      required: false, defaultVisible: true,  defaultOrder: 2 },
    { id: 'size',            label: 'Company Size',      required: false, defaultVisible: true,  defaultOrder: 3 },
    { id: 'city',            label: 'City',              required: false, defaultVisible: true,  defaultOrder: 4 },
    { id: 'country',         label: 'Country',           required: false, defaultVisible: false, defaultOrder: 5 },
    { id: 'assignedUserId',  label: 'Owner',             required: false, defaultVisible: true,  defaultOrder: 6 },
    { id: 'website',         label: 'Website',           required: false, defaultVisible: false, defaultOrder: 7 },
    { id: 'tags',            label: 'Tags',              required: false, defaultVisible: false, defaultOrder: 8 },
    { id: 'createdAt',       label: 'Created Date',      required: false, defaultVisible: true,  defaultOrder: 9 },
  ],
};

// ─────────────────────────────────────────────────────
// CONTACTS MODULE REGISTRY
// ─────────────────────────────────────────────────────

export const CONTACTS_COLUMN_REGISTRY: ModuleRegistry = {
  module: 'contacts',
  columns: [
    { id: 'firstName',       label: 'First Name',        required: true,  defaultVisible: true,  defaultOrder: 0 },
    { id: 'lastName',        label: 'Last Name',         required: true,  defaultVisible: true,  defaultOrder: 1 },
    { id: 'email',           label: 'Email',             required: false, defaultVisible: true,  defaultOrder: 2 },
    { id: 'phone',           label: 'Phone',             required: false, defaultVisible: true,  defaultOrder: 3 },
    { id: 'companyName',     label: 'Company',           required: false, defaultVisible: true,  defaultOrder: 4 },
    { id: 'status',          label: 'Status',            required: false, defaultVisible: true,  defaultOrder: 5 },
    { id: 'source',          label: 'Source',            required: false, defaultVisible: false, defaultOrder: 6 },
    { id: 'assignedUserId',  label: 'Assigned To',       required: false, defaultVisible: true,  defaultOrder: 7 },
    { id: 'accountId',       label: 'Account',           required: false, defaultVisible: false, defaultOrder: 8 },
    { id: 'createdAt',       label: 'Created Date',      required: false, defaultVisible: true,  defaultOrder: 9 },
  ],
};

// ─────────────────────────────────────────────────────
// DEALS MODULE REGISTRY
// ─────────────────────────────────────────────────────

export const DEALS_COLUMN_REGISTRY: ModuleRegistry = {
  module: 'deals',
  columns: [
    { id: 'title',            label: 'Deal Name',         required: true,  defaultVisible: true,  defaultOrder: 0 },
    { id: 'value',            label: 'Value',             required: false, defaultVisible: true,  defaultOrder: 1 },
    { id: 'stageId',          label: 'Stage',             required: false, defaultVisible: true,  defaultOrder: 2 },
    { id: 'priority',         label: 'Priority',          required: false, defaultVisible: true,  defaultOrder: 3 },
    { id: 'assignedUserId',   label: 'Assigned To',       required: false, defaultVisible: true,  defaultOrder: 4 },
    { id: 'accountId',        label: 'Account',           required: false, defaultVisible: true,  defaultOrder: 5 },
    { id: 'expectedCloseDate',label: 'Expected Close',    required: false, defaultVisible: true,  defaultOrder: 6 },
    { id: 'leadSource',       label: 'Lead Source',       required: false, defaultVisible: false, defaultOrder: 7 },
    { id: 'industry',         label: 'Industry',          required: false, defaultVisible: false, defaultOrder: 8 },
    { id: 'createdAt',        label: 'Created Date',      required: false, defaultVisible: false, defaultOrder: 9 },
  ],
};

// ─────────────────────────────────────────────────────
// REGISTRY MAP (keyed by module name)
// ─────────────────────────────────────────────────────

export const COLUMN_REGISTRIES: Record<string, ModuleRegistry> = {
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
