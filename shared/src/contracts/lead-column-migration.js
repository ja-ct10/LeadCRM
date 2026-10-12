"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeLeadColumns = normalizeLeadColumns;
const lead_table_columns_1 = require("./lead-table-columns");
const historicalDefaults = [
    ['firstName', 'assignedUserId', 'email', 'phone', 'companyName', 'status', 'createdAt', 'source'],
    ['firstName', 'lastName', 'email', 'phone', 'companyName', 'status', 'assignedUserId'],
    ['firstName', 'lastName', 'email', 'phone', 'companyName', 'status', 'source', 'assignedUserId', 'createdAt'],
];
/** Idempotent upgrade of documented static preferences; custom data is never touched. */
function normalizeLeadColumns(columns) {
    if (!columns.length)
        return columns;
    const expanded = expandEmailAndPhone(columns);
    const ordered = [...expanded].sort((a, b) => a.order - b.order);
    const visibleIds = ordered.filter(column => column.visible).map(column => column.id);
    const usesHistoricalDefault = !ordered.some(column => column.id === 'name') && historicalDefaults.some(ids => ids.length === visibleIds.length && ids.every((id, index) => id === visibleIds[index]));
    const retiredIds = new Set(lead_table_columns_1.RETIRED_LEAD_TABLE_IDS);
    const supported = ordered.filter(column => !retiredIds.has(column.id));
    let result;
    if (usesHistoricalDefault) {
        const byId = new Map(supported.map(column => [column.id, column]));
        result = lead_table_columns_1.LEADS_TABLE_COLUMNS.map(definition => ({
            ...byId.get(definition.id), id: definition.id, visible: definition.defaultVisible, order: definition.defaultOrder,
        }));
        // Preserve unknown IDs for validation, never silently legitimize arbitrary input.
        result.push(...supported.filter(column => !result.some(item => item.id === column.id)));
    }
    else {
        const name = supported.find(column => column.id === 'name') ?? {
            id: 'name', visible: !supported.some(column => ['firstName', 'lastName'].includes(column.id) && column.visible), order: 0,
        };
        // Existing conflicting layouts prefer combined Name. Explicitly hidden Name
        // and pre-combined customized layouts preserve their separate-name choices.
        result = [name, ...supported.filter(column => column.id !== 'name')
                .map(column => name.visible && ['firstName', 'lastName'].includes(column.id) ? { ...column, visible: false } : column)];
        if (!result.some(column => column.id === 'lastName'))
            result.push({ id: 'lastName', visible: false, order: result.length });
    }
    return result.map((column, order) => ({ ...column, order }));
}
function expandEmailAndPhone(columns) {
    const legacy = columns.find(column => column.id === 'emailAndPhone');
    if (!legacy)
        return columns;
    const result = columns.filter(column => column.id !== 'emailAndPhone').map(column => (legacy.visible && ['email', 'phone'].includes(column.id) ? { ...column, visible: true } : column));
    for (const [index, id] of ['email', 'phone'].entries()) {
        if (!result.some(column => column.id === id))
            result.push({ id, visible: legacy.visible, order: legacy.order + index });
    }
    return result.sort((a, b) => a.order - b.order).map((column, order) => ({ ...column, order }));
}
