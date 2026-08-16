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
    // ── Leads ──────────────────────────────────────────────────
    { id: 'firstName',           label: 'Name',                          required: true,  defaultVisible: true,  defaultOrder: 0,  group: 'Leads' },
    { id: 'emailAndPhone',       label: 'Email & Phone',                 required: false, defaultVisible: true,  defaultOrder: 1,  group: 'Leads' },
    { id: 'email',               label: 'Email address',                 required: false, defaultVisible: false, defaultOrder: 2,  group: 'Leads' },
    { id: 'phone',               label: 'Phone number',                  required: false, defaultVisible: false, defaultOrder: 3,  group: 'Leads' },
    { id: 'companyName',         label: 'Contacts',                      required: false, defaultVisible: true,  defaultOrder: 4,  group: 'Leads' },
    { id: 'status',              label: 'Status',                        required: true,  defaultVisible: true,  defaultOrder: 5,  group: 'Leads' },
    { id: 'description',         label: 'Description',                   required: false, defaultVisible: false, defaultOrder: 6,  group: 'Leads' },
    { id: 'website',             label: 'URL',                           required: false, defaultVisible: false, defaultOrder: 7,  group: 'Leads' },
    { id: 'createdAt',           label: 'Created',                       required: false, defaultVisible: true,  defaultOrder: 8,  group: 'Leads' },
    { id: 'createdBy',           label: 'Created by',                    required: false, defaultVisible: false, defaultOrder: 9,  group: 'Leads' },
    { id: 'updatedAt',           label: 'Updated',                       required: false, defaultVisible: false, defaultOrder: 10, group: 'Leads' },
    { id: 'updatedBy',           label: 'Updated by',                    required: false, defaultVisible: false, defaultOrder: 11, group: 'Leads' },
    { id: 'latestStatusChangeDate', label: 'Latest status change date',  required: false, defaultVisible: false, defaultOrder: 12, group: 'Leads' },
    { id: 'source',              label: 'Source',                        required: false, defaultVisible: true,  defaultOrder: 13, group: 'Leads' },
    { id: 'localTime',           label: 'Local time',                    required: false, defaultVisible: false, defaultOrder: 14, group: 'Leads' },
    { id: 'primaryAddressCityState', label: 'Primary Address (City, State)', required: false, defaultVisible: false, defaultOrder: 15, group: 'Leads' },
    { id: 'address',             label: 'Primary address',               required: false, defaultVisible: false, defaultOrder: 16, group: 'Leads' },

    // ── Lead Custom Fields ─────────────────────────────────────
    { id: 'productInterest',     label: 'Product Interest Keywords',     required: false, defaultVisible: false, defaultOrder: 17, group: 'Lead Custom Fields' },
    { id: 'linkedinUrl',         label: 'LinkedIn URL',                  required: false, defaultVisible: false, defaultOrder: 18, group: 'Lead Custom Fields' },
    { id: 'classifyB2bB2c',      label: 'Classify as B2B or B2C',        required: false, defaultVisible: false, defaultOrder: 19, group: 'Lead Custom Fields' },

    // ── Communication ──────────────────────────────────────────
    { id: 'latestCommunication',     label: 'Latest communication',          required: false, defaultVisible: false, defaultOrder: 20, group: 'Communication' },
    { id: 'latestCommunicationDate', label: 'Latest communication date',     required: false, defaultVisible: false, defaultOrder: 21, group: 'Communication' },
    { id: 'latestCommunicationUser', label: 'Latest communication user',     required: false, defaultVisible: false, defaultOrder: 22, group: 'Communication' },
    { id: 'firstCommunication',      label: 'First communication',           required: false, defaultVisible: false, defaultOrder: 23, group: 'Communication' },
    { id: 'firstCommunicationDate',  label: 'First communication date',      required: false, defaultVisible: false, defaultOrder: 24, group: 'Communication' },
    { id: 'firstCommunicationUser',  label: 'First communication user',      required: false, defaultVisible: false, defaultOrder: 25, group: 'Communication' },
    { id: 'timesCommunicated',       label: 'Times communicated',            required: false, defaultVisible: false, defaultOrder: 26, group: 'Communication' },

    // ── Emails ─────────────────────────────────────────────────
    { id: 'latestEmailDate',         label: 'Latest email date',             required: false, defaultVisible: false, defaultOrder: 27, group: 'Emails' },
    { id: 'latestReceivedEmailDate', label: 'Latest received email date',    required: false, defaultVisible: false, defaultOrder: 28, group: 'Emails' },
    { id: 'latestSentEmailDate',     label: 'Latest sent email date',        required: false, defaultVisible: false, defaultOrder: 29, group: 'Emails' },
    { id: 'latestEmailSubject',      label: 'Latest email subject',          required: false, defaultVisible: false, defaultOrder: 30, group: 'Emails' },
    { id: 'emailLastOpened',         label: 'Email last opened',             required: false, defaultVisible: false, defaultOrder: 31, group: 'Emails' },
    { id: 'emailCount',              label: '# Emails',                      required: false, defaultVisible: false, defaultOrder: 32, group: 'Emails' },
    { id: 'sentEmailCount',          label: '# Sent emails',                 required: false, defaultVisible: false, defaultOrder: 33, group: 'Emails' },
    { id: 'receivedEmailCount',      label: '# Received emails',             required: false, defaultVisible: false, defaultOrder: 34, group: 'Emails' },
    { id: 'emailAttachmentCount',    label: '# Email attachments',           required: false, defaultVisible: false, defaultOrder: 35, group: 'Emails' },

    // ── Calls ──────────────────────────────────────────────────
    { id: 'latestCallDate',          label: 'Latest call date',              required: false, defaultVisible: false, defaultOrder: 36, group: 'Calls' },
    { id: 'latestIncomingCallDate',  label: 'Latest incoming call date',     required: false, defaultVisible: false, defaultOrder: 37, group: 'Calls' },
    { id: 'latestOutgoingCallDate',  label: 'Latest outgoing call date',     required: false, defaultVisible: false, defaultOrder: 38, group: 'Calls' },
    { id: 'latestCallNote',          label: 'Latest call note',              required: false, defaultVisible: false, defaultOrder: 39, group: 'Calls' },
    { id: 'firstCallDate',           label: 'First call date',               required: false, defaultVisible: false, defaultOrder: 40, group: 'Calls' },
    { id: 'firstCallNote',           label: 'First call note',               required: false, defaultVisible: false, defaultOrder: 41, group: 'Calls' },
    { id: 'callCount',               label: '# Calls',                       required: false, defaultVisible: false, defaultOrder: 42, group: 'Calls' },
    { id: 'outgoingCallCount',       label: '# Outgoing calls',              required: false, defaultVisible: false, defaultOrder: 43, group: 'Calls' },
    { id: 'incomingCallCount',       label: '# Incoming calls',              required: false, defaultVisible: false, defaultOrder: 44, group: 'Calls' },

    // ── SMS messages ───────────────────────────────────────────
    { id: 'latestSmsDate',           label: 'Latest SMS date',               required: false, defaultVisible: false, defaultOrder: 45, group: 'SMS messages' },
    { id: 'latestReceivedSmsDate',   label: 'Latest received SMS date',      required: false, defaultVisible: false, defaultOrder: 46, group: 'SMS messages' },
    { id: 'latestSentSmsDate',       label: 'Latest sent SMS date',          required: false, defaultVisible: false, defaultOrder: 47, group: 'SMS messages' },
    { id: 'latestSmsMessage',        label: 'Latest SMS message',            required: false, defaultVisible: false, defaultOrder: 48, group: 'SMS messages' },
    { id: 'firstSmsDate',            label: 'First SMS date',                required: false, defaultVisible: false, defaultOrder: 49, group: 'SMS messages' },
    { id: 'firstSmsMessage',         label: 'First SMS message',             required: false, defaultVisible: false, defaultOrder: 50, group: 'SMS messages' },
    { id: 'smsCount',                label: '# SMS messages',                required: false, defaultVisible: false, defaultOrder: 51, group: 'SMS messages' },
    { id: 'sentSmsCount',            label: '# Sent SMS',                    required: false, defaultVisible: false, defaultOrder: 52, group: 'SMS messages' },
    { id: 'receivedSmsCount',        label: '# Received SMS',                required: false, defaultVisible: false, defaultOrder: 53, group: 'SMS messages' },

    // ── Notes ──────────────────────────────────────────────────
    { id: 'noteCount',               label: '# Notes',                       required: false, defaultVisible: false, defaultOrder: 54, group: 'Notes' },
    { id: 'latestNoteDate',          label: 'Latest note date',              required: false, defaultVisible: false, defaultOrder: 55, group: 'Notes' },

    // ── Opportunities ──────────────────────────────────────────
    { id: 'activeOppValue',          label: 'Active opp. value',             required: false, defaultVisible: false, defaultOrder: 56, group: 'Opportunities' },
    { id: 'wonOppValue',             label: 'Won opp. value',                required: false, defaultVisible: false, defaultOrder: 57, group: 'Opportunities' },
    { id: 'lostOppValue',            label: 'Lost opp. value',               required: false, defaultVisible: false, defaultOrder: 58, group: 'Opportunities' },
    { id: 'allOppValue',             label: 'All opp. value',                required: false, defaultVisible: false, defaultOrder: 59, group: 'Opportunities' },
    { id: 'primaryOppStatus',        label: 'Primary opp. status',           required: false, defaultVisible: false, defaultOrder: 60, group: 'Opportunities' },
    { id: 'primaryOppCloseDate',     label: 'Primary opp. close date',       required: false, defaultVisible: false, defaultOrder: 61, group: 'Opportunities' },
    { id: 'primaryOppCreated',       label: 'Primary opp. created',          required: false, defaultVisible: false, defaultOrder: 62, group: 'Opportunities' },
    { id: 'primaryOppUpdated',       label: 'Primary opp. updated',          required: false, defaultVisible: false, defaultOrder: 63, group: 'Opportunities' },
    { id: 'primaryOppConfidence',    label: 'Primary opp. confidence %',     required: false, defaultVisible: false, defaultOrder: 64, group: 'Opportunities' },
    { id: 'primaryOppValue',         label: 'Primary opp. value',            required: false, defaultVisible: false, defaultOrder: 65, group: 'Opportunities' },
    { id: 'primaryOppUser',          label: 'Primary opp. user',             required: false, defaultVisible: false, defaultOrder: 66, group: 'Opportunities' },
    { id: 'lastOppStatusChangeDate', label: 'Last opp. status change date',  required: false, defaultVisible: false, defaultOrder: 67, group: 'Opportunities' },
    { id: 'opportunityCount',        label: '# Opportunities',               required: false, defaultVisible: false, defaultOrder: 68, group: 'Opportunities' },
    { id: 'activeOpportunityCount',  label: '# Active opportunities',        required: false, defaultVisible: false, defaultOrder: 69, group: 'Opportunities' },
    { id: 'wonOpportunityCount',     label: '# Won opportunities',           required: false, defaultVisible: false, defaultOrder: 70, group: 'Opportunities' },
    { id: 'lostOpportunityCount',    label: '# Lost opportunities',          required: false, defaultVisible: false, defaultOrder: 71, group: 'Opportunities' },

    // ── Tasks ──────────────────────────────────────────────────
    { id: 'nextTask',                label: 'Next task',                     required: false, defaultVisible: false, defaultOrder: 72, group: 'Tasks' },
    { id: 'nextTaskDate',            label: 'Next task date',                required: false, defaultVisible: false, defaultOrder: 73, group: 'Tasks' },
    { id: 'nextTaskUser',            label: 'Next task user',                required: false, defaultVisible: false, defaultOrder: 74, group: 'Tasks' },
    { id: 'taskCount',               label: '# Tasks',                       required: false, defaultVisible: false, defaultOrder: 75, group: 'Tasks' },
    { id: 'completedTaskCount',      label: '# Completed tasks',             required: false, defaultVisible: false, defaultOrder: 76, group: 'Tasks' },
    { id: 'incompleteTaskCount',     label: '# Incomplete tasks',            required: false, defaultVisible: false, defaultOrder: 77, group: 'Tasks' },
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
