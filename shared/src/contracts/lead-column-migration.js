"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeLeadColumns = normalizeLeadColumns;
/** Expand the retired composite only once; later email/phone choices stay independent. */
function normalizeLeadColumns(columns) {
    return normalizeLeadNameColumns(expandEmailAndPhone(columns));
}
function expandEmailAndPhone(columns) {
    const legacy = columns.find(column => column.id === 'emailAndPhone');
    if (!legacy)
        return columns;
    const result = columns.filter(column => column.id !== 'emailAndPhone').map(column => (legacy.visible && ['email', 'phone'].includes(column.id) ? { ...column, visible: true } : column));
    for (const [index, id] of ['email', 'phone'].entries()) {
        if (!result.some(column => column.id === id))
            result.push({ id, visible: true, order: legacy.order + index });
    }
    return result.sort((a, b) => a.order - b.order).map((column, order) => ({ ...column, order }));
}
const previousDefaultVisibleIds = ['firstName', 'assignedUserId', 'email', 'phone', 'companyName', 'status', 'createdAt', 'source'];
const defaultNameColumnIds = ['firstName', 'lastName', 'email', 'phone', 'companyName', 'status', 'assignedUserId'];
/** Upgrade old defaults once, while retaining explicitly saved name-column choices. */
function normalizeLeadNameColumns(columns) {
    if (!columns.some(column => column.id === 'firstName') || columns.some(column => column.id === 'lastName'))
        return columns;
    const ordered = [...columns].sort((a, b) => a.order - b.order);
    const visibleIds = ordered.filter(column => column.visible).map(column => column.id);
    const usesPreviousDefault = visibleIds.length === previousDefaultVisibleIds.length
        && visibleIds.every((id, index) => id === previousDefaultVisibleIds[index]);
    const lastName = { id: 'lastName', visible: true, order: 1 };
    if (usesPreviousDefault) {
        const byId = new Map([...ordered, lastName].map(column => [column.id, column]));
        const primaryIds = new Set(defaultNameColumnIds);
        const primary = defaultNameColumnIds.map(id => byId.get(id));
        const additional = ordered.filter(column => !primaryIds.has(column.id)).map(column => (['createdAt', 'source'].includes(column.id) ? { ...column, visible: false } : column));
        return [...primary, ...additional].map((column, order) => ({ ...column, order }));
    }
    // Insert beside First Name without reordering or changing visibility/widths of saved columns.
    ordered.splice(ordered.findIndex(column => column.id === 'firstName') + 1, 0, lastName);
    return ordered.map((column, order) => ({ ...column, order }));
}
