import type { ColumnConfigItem, ColumnDefinition } from '../types/preferences';
import { normalizeLeadColumns } from './lead-column-migration';
import { LEADS_TABLE_SORT_FIELDS } from './lead-table-columns';

/** Shared table choices are limited to persisted fields or included relations. */
export const ACCOUNTS_TABLE_COLUMNS: ColumnDefinition[] = [
  { id: 'name', label: 'Account Name', required: true, defaultVisible: true, defaultOrder: 0, group: 'Account Info', priority: 'required' },
  { id: 'industry', label: 'Industry', required: false, defaultVisible: true, defaultOrder: 1, group: 'Account Info', priority: 'medium' },
  { id: 'size', label: 'Company Size', required: false, defaultVisible: true, defaultOrder: 2, group: 'Account Info', priority: 'medium' },
  { id: 'address', label: 'Company Address', required: false, defaultVisible: true, defaultOrder: 3, group: 'Location', priority: 'low' },
  { id: 'website', label: 'Website', required: false, defaultVisible: false, defaultOrder: 4, group: 'Account Info', priority: 'low' },
  { id: 'tags', label: 'Tags', required: false, defaultVisible: false, defaultOrder: 5, group: 'Account Info', priority: 'low' },
  { id: 'createdAt', label: 'Created Date', required: false, defaultVisible: true, defaultOrder: 6, group: 'System', priority: 'low' },
];
export const ACCOUNTS_TABLE_SORT_FIELDS = ['name', 'industry', 'size', 'address', 'createdAt'];

export const CONTACTS_TABLE_COLUMNS: ColumnDefinition[] = [
  { id: 'firstName', label: 'First Name', required: true, defaultVisible: true, defaultOrder: 0, group: 'Contact Info', priority: 'required' },
  { id: 'lastName', label: 'Last Name', required: true, defaultVisible: true, defaultOrder: 1, group: 'Contact Info', priority: 'required' },
  { id: 'email', label: 'Email', required: false, defaultVisible: true, defaultOrder: 2, group: 'Contact Info', priority: 'low' },
  { id: 'phone', label: 'Phone', required: false, defaultVisible: true, defaultOrder: 3, group: 'Contact Info', priority: 'low' },
  { id: 'companyName', label: 'Company', required: false, defaultVisible: true, defaultOrder: 4, group: 'Organization', priority: 'high' },
  { id: 'status', label: 'Status', required: false, defaultVisible: true, defaultOrder: 5, group: 'Contact Info', priority: 'medium' },
  { id: 'source', label: 'Source', required: false, defaultVisible: false, defaultOrder: 6, group: 'Contact Info', priority: 'medium' },
  { id: 'assignedUserId', label: 'Assigned Agent', required: false, defaultVisible: true, defaultOrder: 7, group: 'Contact Info', priority: 'medium' },
  { id: 'accountId', label: 'Account', required: false, defaultVisible: false, defaultOrder: 8, group: 'Organization', priority: 'low' },
  { id: 'createdAt', label: 'Created Date', required: false, defaultVisible: true, defaultOrder: 9, group: 'System', priority: 'low' },
];
export const CONTACTS_TABLE_SORT_FIELDS = ['firstName', 'lastName', 'email', 'phone', 'companyName', 'status', 'source', 'createdAt', 'lastSalesActivityAt'];

export const DEALS_TABLE_COLUMNS: ColumnDefinition[] = [
  { id: 'title', label: 'Deal Name', required: true, defaultVisible: true, defaultOrder: 0, group: 'Deal Info', priority: 'required' },
  { id: 'value', label: 'Value', required: false, defaultVisible: true, defaultOrder: 1, group: 'Deal Info', priority: 'medium' },
  { id: 'stageId', label: 'Stage', required: false, defaultVisible: true, defaultOrder: 2, group: 'Deal Info', priority: 'medium' },
  { id: 'priority', label: 'Priority', required: false, defaultVisible: true, defaultOrder: 3, group: 'Deal Info', priority: 'medium' },
  { id: 'assignedUserId', label: 'Assigned Agent', required: false, defaultVisible: true, defaultOrder: 4, group: 'Deal Info', priority: 'medium' },
  { id: 'accountId', label: 'Account', required: false, defaultVisible: true, defaultOrder: 5, group: 'Relationships', priority: 'medium' },
  { id: 'expectedCloseDate', label: 'Expected Close', required: false, defaultVisible: true, defaultOrder: 6, group: 'Deal Info', priority: 'low' },
  { id: 'leadSource', label: 'Lead Source', required: false, defaultVisible: false, defaultOrder: 7, group: 'Deal Info', priority: 'medium' },
  { id: 'createdAt', label: 'Created Date', required: false, defaultVisible: false, defaultOrder: 8, group: 'System', priority: 'low' },
];
export const DEALS_TABLE_SORT_FIELDS = ['title', 'value', 'stageId', 'priority', 'expectedCloseDate', 'createdAt'];

/** Preserve saved visibility/order when an existing table column is renamed. */
export function normalizeModuleColumns(module: string, columns: ColumnConfigItem[]): ColumnConfigItem[] {
  if (module === 'leads') return normalizeLeadColumns(columns);
  if (module === 'deals') return columns.filter(column => column.id !== 'industry');
  if (module === 'accounts') {
    const legacyAddressIds = ['city', 'province', 'country'];
    const removedIds = ['assignedUserId', 'assignedUser', 'productInterestIds', 'productInterests', 'productInterest', 'activeProductIds', 'activeProducts', 'internalNotes', ...legacyAddressIds];
    const replacement = columns.some(column => column.id === 'address') ? undefined
      : [...columns].sort((a, b) => a.order - b.order).find(column => legacyAddressIds.includes(column.id));
    return columns.flatMap(column => column === replacement ? [{ ...column, id: 'address' }]
      : removedIds.includes(column.id) ? [] : [column]);
  }
  if (module !== 'users' || !columns.some(column => column.id === 'department')) return columns;
  const hasGroups = columns.some(column => column.id === 'groups');
  return columns.flatMap(column => column.id !== 'department' ? [column]
    : hasGroups ? [] : [{ ...column, id: 'groups' }]);
}

function defineColumns(group: string, entries: [string, string][]): ColumnDefinition[] {
  return entries.map(([id, label], defaultOrder) => ({ id, label, defaultOrder, group,
    required: id === 'name', defaultVisible: true, priority: id === 'name' ? 'required' : 'low' }));
}

export const CAMPAIGNS_TABLE_COLUMNS = defineColumns('Campaigns', [
  ['name', 'Campaign'], ['type', 'Type'], ['status', 'Status'], ['target', 'Target'],
  ['submitted', 'Submitted'], ['opened', 'Opened'], ['clicked', 'Clicked'], ['engagement', 'Engagement'], ['createdAt', 'Created'],
]);
export const WORKFLOWS_TABLE_COLUMNS = defineColumns('Workflows', [
  ['name', 'Name'], ['trigger', 'Trigger'], ['status', 'Status'], ['lastRun', 'Last run'], ['runs', 'Runs'], ['actions', 'Actions'],
]);
export const USERS_TABLE_COLUMNS = defineColumns('Users', [
  ['name', 'User'], ['role', 'Role'], ['email', 'Contact'], ['status', 'Status'], ['groups', 'Groups'], ['activity', 'Actions'],
]).map(column => column.id === 'name' ? { ...column, required: false, priority: 'high' as const, fixedPosition: 'first' as const, pinned: 'left' as const } : column);

/** Only registered person-name projections share this visibility constraint. */
export const PERSON_NAME_COLUMN_GROUPS: Record<string, { combined: string; separate: string[] }> = {
  leads: { combined: 'name', separate: ['firstName', 'lastName'] },
};

/** Shared with the preference API, including sortable fields hidden from the grid. */
export const MODULE_TABLE_SORT_FIELDS: Record<string, string[]> = {
  leads: LEADS_TABLE_SORT_FIELDS,
  contacts: CONTACTS_TABLE_SORT_FIELDS, accounts: ACCOUNTS_TABLE_SORT_FIELDS, deals: DEALS_TABLE_SORT_FIELDS,
  tasks: ['title', 'dueDate', 'createdAt', 'updatedAt'], campaigns: ['name', 'createdAt'],
  workflows: ['name', 'status', 'createdAt'], users: ['name', 'role', 'email', 'status', 'groups', 'createdAt'],
};
