"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeLeadColumns = normalizeLeadColumns;
/** Expand the retired composite only once; later email/phone choices stay independent. */
function normalizeLeadColumns(columns) {
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
