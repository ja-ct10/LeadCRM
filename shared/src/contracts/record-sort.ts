export interface RecordSort { field: string; direction: 'asc' | 'desc' }

/** Nulls remain last in either direction. Date accessors must return Date or timestamps. */
export function compareSortValues(a: unknown, b: unknown, direction: 'asc' | 'desc'): number {
  if (a === b) return 0;
  const av = a instanceof Date ? a.getTime() : a;
  const bv = b instanceof Date ? b.getTime() : b;
  const aMissing = av == null || av === '' || (typeof av === 'number' && Number.isNaN(av));
  const bMissing = bv == null || bv === '' || (typeof bv === 'number' && Number.isNaN(bv));
  if (aMissing || bMissing) return aMissing === bMissing ? 0 : aMissing ? 1 : -1;
  const comparison = typeof av === 'number' && typeof bv === 'number'
    ? av - bv
    : String(av).localeCompare(String(bv), 'en', { sensitivity: 'base', numeric: true });
  return direction === 'asc' ? comparison : -comparison;
}
