"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tableSortLabels = tableSortLabels;
exports.workflowStatusLabel = workflowStatusLabel;
exports.compareSortValues = compareSortValues;
/** Direction wording describes the value users see, independently of API keys. */
function tableSortLabels(kind = 'text') {
    switch (kind) {
        case 'date': return { asc: 'Oldest first', desc: 'Newest first' };
        case 'number': return { asc: 'Lowest first', desc: 'Highest first' };
        case 'size': return { asc: 'Smallest first', desc: 'Largest first' };
        case 'phone': return { asc: 'Sort ascending', desc: 'Sort descending' };
        default: return { asc: 'Sort A–Z', desc: 'Sort Z–A' };
    }
}
function workflowStatusLabel(workflow) {
    return workflow.status === 'DRAFT' ? 'Draft' : workflow.isActive ? 'Active' : 'Paused';
}
/** Nulls remain last in either direction. Date accessors must return Date or timestamps. */
function compareSortValues(a, b, direction) {
    if (a === b)
        return 0;
    const av = a instanceof Date ? a.getTime() : typeof a === 'string' ? a.trim() : a;
    const bv = b instanceof Date ? b.getTime() : typeof b === 'string' ? b.trim() : b;
    const aMissing = av == null || av === '' || (typeof av === 'number' && Number.isNaN(av));
    const bMissing = bv == null || bv === '' || (typeof bv === 'number' && Number.isNaN(bv));
    if (aMissing || bMissing)
        return aMissing === bMissing ? 0 : aMissing ? 1 : -1;
    const comparison = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv), 'en', { sensitivity: 'base', numeric: true });
    return direction === 'asc' ? comparison : -comparison;
}
