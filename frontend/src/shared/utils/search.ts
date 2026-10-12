/** Match every whitespace-separated term across the searchable display fields. */
export function matchesSearch(query: string, ...fields: Array<unknown>): boolean {
  const terms = query.trim().toLowerCase().slice(0, 150).split(/\s+/).filter(Boolean).slice(0, 12);
  const text = fields.filter(value => typeof value === 'string' || typeof value === 'number').join(' ').toLowerCase();
  return terms.every(term => text.includes(term));
}
