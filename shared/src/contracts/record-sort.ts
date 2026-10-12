export interface RecordSort { field: string; direction: 'asc' | 'desc' }
export type TableSortKind = 'text' | 'date' | 'number' | 'size' | 'phone';
export interface TableSortOption { id: string; label: string; kind?: TableSortKind }

/** Direction wording describes the value users see, independently of API keys. */
export function tableSortLabels(kind: TableSortKind = 'text'): { asc: string; desc: string } {
  switch (kind) {
    case 'date': return { asc: 'Oldest first', desc: 'Newest first' };
    case 'number': return { asc: 'Lowest first', desc: 'Highest first' };
    case 'size': return { asc: 'Smallest first', desc: 'Largest first' };
    case 'phone': return { asc: 'Sort ascending', desc: 'Sort descending' };
    default: return { asc: 'Sort A–Z', desc: 'Sort Z–A' };
  }
}

export function workflowStatusLabel(workflow: { status?: string; isActive?: boolean }): string {
  return workflow.status === 'DRAFT' ? 'Draft' : workflow.isActive ? 'Active' : 'Paused';
}

/** Nulls remain last in either direction. Date accessors must return Date or timestamps. */
export function compareSortValues(a: unknown, b: unknown, direction: 'asc' | 'desc'): number {
  if (a === b) return 0;
  const av = a instanceof Date ? a.getTime() : typeof a === 'string' ? a.trim() : a;
  const bv = b instanceof Date ? b.getTime() : typeof b === 'string' ? b.trim() : b;
  const aMissing = av == null || av === '' || (typeof av === 'number' && Number.isNaN(av));
  const bMissing = bv == null || bv === '' || (typeof bv === 'number' && Number.isNaN(bv));
  if (aMissing || bMissing) return aMissing === bMissing ? 0 : aMissing ? 1 : -1;
  const comparison = typeof av === 'number' && typeof bv === 'number'
    ? av - bv
    : String(av).localeCompare(String(bv), 'en', { sensitivity: 'base', numeric: true });
  return direction === 'asc' ? comparison : -comparison;
}
