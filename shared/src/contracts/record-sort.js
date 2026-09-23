"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compareSortValues = compareSortValues;
/** Nulls remain last in either direction. Date accessors must return Date or timestamps. */
function compareSortValues(a, b, direction) {
    if (a === b)
        return 0;
    const av = a instanceof Date ? a.getTime() : a;
    const bv = b instanceof Date ? b.getTime() : b;
    const aMissing = av == null || av === '' || (typeof av === 'number' && Number.isNaN(av));
    const bMissing = bv == null || bv === '' || (typeof bv === 'number' && Number.isNaN(bv));
    if (aMissing || bMissing)
        return aMissing === bMissing ? 0 : aMissing ? 1 : -1;
    const comparison = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv), 'en', { sensitivity: 'base', numeric: true });
    return direction === 'asc' ? comparison : -comparison;
}
