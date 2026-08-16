/**
 * Frontend column registry definitions — mirrors the backend column-registry.ts.
 * Used by the ManageColumnsDrawer to display labels and enforce required columns.
 *
 * To add a new module: define a ColumnDefinition[] array and add it to MODULE_COLUMN_REGISTRIES.
 * The preference hook + drawer work automatically for any registered module.
 */

import type { ColumnDefinition } from '@leadcrm/shared';

// ─────────────────────────────────────────────────────
// LEADS
// ─────────────────────────────────────────────────────

export const LEADS_COLUMN_REGISTRY: ColumnDefinition[] = [
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
];

// ─────────────────────────────────────────────────────
// ACCOUNTS
// ─────────────────────────────────────────────────────

export const ACCOUNTS_COLUMN_REGISTRY: ColumnDefinition[] = [
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
];

// ─────────────────────────────────────────────────────
// CONTACTS
// ─────────────────────────────────────────────────────

export const CONTACTS_COLUMN_REGISTRY: ColumnDefinition[] = [
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
];

// ─────────────────────────────────────────────────────
// DEALS
// ─────────────────────────────────────────────────────

export const DEALS_COLUMN_REGISTRY: ColumnDefinition[] = [
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
];

// ─────────────────────────────────────────────────────
// REGISTRY MAP — use this for lookups by module name
// ─────────────────────────────────────────────────────

export const MODULE_COLUMN_REGISTRIES: Record<string, ColumnDefinition[]> = {
  leads: LEADS_COLUMN_REGISTRY,
  accounts: ACCOUNTS_COLUMN_REGISTRY,
  contacts: CONTACTS_COLUMN_REGISTRY,
  deals: DEALS_COLUMN_REGISTRY,
};
