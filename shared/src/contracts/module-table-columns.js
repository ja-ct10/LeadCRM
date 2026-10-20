"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MODULE_TABLE_SORT_FIELDS = exports.PERSON_NAME_COLUMN_GROUPS = exports.USERS_TABLE_COLUMNS = exports.WORKFLOWS_TABLE_COLUMNS = exports.CAMPAIGNS_TABLE_COLUMNS = exports.DEALS_TABLE_SORT_FIELDS = exports.DEALS_TABLE_COLUMNS = exports.CONTACTS_TABLE_SORT_FIELDS = exports.CONTACTS_TABLE_COLUMNS = exports.ACCOUNTS_TABLE_SORT_FIELDS = exports.ACCOUNTS_TABLE_COLUMNS = void 0;
exports.normalizeModuleColumns = normalizeModuleColumns;
const lead_column_migration_1 = require("./lead-column-migration");
const lead_table_columns_1 = require("./lead-table-columns");
/** Shared table choices are limited to persisted fields or included relations. */
exports.ACCOUNTS_TABLE_COLUMNS = [
    { id: 'name', label: 'Account Name', required: true, defaultVisible: true, defaultOrder: 0, group: 'Account Info', priority: 'required' },
    { id: 'industry', label: 'Industry', required: false, defaultVisible: true, defaultOrder: 1, group: 'Account Info', priority: 'medium' },
    { id: 'size', label: 'Company Size', required: false, defaultVisible: true, defaultOrder: 2, group: 'Account Info', priority: 'medium' },
    { id: 'address', label: 'Company Address', required: false, defaultVisible: true, defaultOrder: 3, group: 'Location', priority: 'low' },
    { id: 'website', label: 'Website', required: false, defaultVisible: false, defaultOrder: 4, group: 'Account Info', priority: 'low' },
    { id: 'tags', label: 'Tags', required: false, defaultVisible: false, defaultOrder: 5, group: 'Account Info', priority: 'low' },
    { id: 'createdAt', label: 'Created Date', required: false, defaultVisible: true, defaultOrder: 6, group: 'System', priority: 'low' },
];
exports.ACCOUNTS_TABLE_SORT_FIELDS = ['name', 'industry', 'size', 'address', 'createdAt'];
exports.CONTACTS_TABLE_COLUMNS = [
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
exports.CONTACTS_TABLE_SORT_FIELDS = ['firstName', 'lastName', 'email', 'phone', 'companyName', 'status', 'source', 'createdAt', 'lastSalesActivityAt'];
exports.DEALS_TABLE_COLUMNS = [
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
exports.DEALS_TABLE_SORT_FIELDS = ['title', 'value', 'stageId', 'priority', 'expectedCloseDate', 'createdAt'];
/** Preserve saved visibility/order when an existing table column is renamed. */
function normalizeModuleColumns(module, columns) {
    if (module === 'leads')
        return (0, lead_column_migration_1.normalizeLeadColumns)(columns);
    if (module === 'deals')
        return columns.filter(column => column.id !== 'industry');
    if (module === 'accounts') {
        const legacyAddressIds = ['city', 'province', 'country'];
        const removedIds = ['assignedUserId', 'assignedUser', 'productInterestIds', 'productInterests', 'productInterest', 'activeProductIds', 'activeProducts', 'internalNotes', ...legacyAddressIds];
        const replacement = columns.some(column => column.id === 'address') ? undefined
            : [...columns].sort((a, b) => a.order - b.order).find(column => legacyAddressIds.includes(column.id));
        return columns.flatMap(column => column === replacement ? [{ ...column, id: 'address' }]
            : removedIds.includes(column.id) ? [] : [column]);
    }
    if (module !== 'users' || !columns.some(column => column.id === 'department'))
        return columns;
    const hasGroups = columns.some(column => column.id === 'groups');
    return columns.flatMap(column => column.id !== 'department' ? [column]
        : hasGroups ? [] : [{ ...column, id: 'groups' }]);
}
function defineColumns(group, entries) {
    return entries.map(([id, label], defaultOrder) => ({ id, label, defaultOrder, group,
        required: id === 'name', defaultVisible: true, priority: id === 'name' ? 'required' : 'low' }));
}
exports.CAMPAIGNS_TABLE_COLUMNS = defineColumns('Campaigns', [
    ['name', 'Campaign'], ['type', 'Type'], ['status', 'Status'], ['target', 'Target'],
    ['submitted', 'Submitted'], ['opened', 'Opened'], ['clicked', 'Clicked'], ['engagement', 'Engagement'], ['createdAt', 'Created'],
]);
exports.WORKFLOWS_TABLE_COLUMNS = defineColumns('Workflows', [
    ['name', 'Name'], ['trigger', 'Trigger'], ['status', 'Status'], ['lastRun', 'Last run'], ['runs', 'Runs'], ['actions', 'Actions'],
]);
exports.USERS_TABLE_COLUMNS = defineColumns('Users', [
    ['name', 'User'], ['role', 'Role'], ['email', 'Contact'], ['status', 'Status'], ['groups', 'Groups'], ['activity', 'Actions'],
]).map(column => column.id === 'name' ? { ...column, required: false, priority: 'high', fixedPosition: 'first', pinned: 'left' } : column);
/** Only registered person-name projections share this visibility constraint. */
exports.PERSON_NAME_COLUMN_GROUPS = {
    leads: { combined: 'name', separate: ['firstName', 'lastName'] },
};
/** Shared with the preference API, including sortable fields hidden from the grid. */
exports.MODULE_TABLE_SORT_FIELDS = {
    leads: lead_table_columns_1.LEADS_TABLE_SORT_FIELDS,
    contacts: exports.CONTACTS_TABLE_SORT_FIELDS, accounts: exports.ACCOUNTS_TABLE_SORT_FIELDS, deals: exports.DEALS_TABLE_SORT_FIELDS,
    tasks: ['title', 'dueDate', 'createdAt', 'updatedAt'], campaigns: ['name', 'createdAt'],
    workflows: ['name', 'status', 'createdAt'], users: ['name', 'role', 'email', 'status', 'groups', 'createdAt'],
};
