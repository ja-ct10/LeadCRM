type TextContains = { contains: string; mode: 'insensitive' };
type SearchMatch = Record<string, unknown>;

/** Bounded AND-of-OR search allows a person's first/last name to span columns.
 * Append these clauses to the caller's tenant/permission/filter constraints.
 */
export function buildSearchClauses(
  search: unknown,
  fields: readonly string[],
  relatedMatches?: (contains: TextContains) => SearchMatch[],
): Array<{ OR: SearchMatch[] }> {
  if (typeof search !== 'string') return [];
  const normalized = search.trim().replace(/\s+/g, ' ').slice(0, 150);
  if (!normalized) return [];
  const phoneDigits = /^[+\d ().-]+$/.test(normalized) ? normalized.replace(/\D/g, '') : '';
  // A formatted telephone number is one value, rather than separate name words.
  const terms = phoneDigits.length >= 3 && fields.includes('phone')
    ? [normalized] : [...new Set(normalized.split(' '))].slice(0, 12);
  return terms.map(term => {
    const contains: TextContains = { contains: term, mode: 'insensitive' };
    const OR: SearchMatch[] = fields.map(field => ({ [field]: contains }));
    const termDigits = /^[+\d ().-]+$/.test(term) ? term.replace(/\D/g, '') : '';
    if (termDigits.length >= 3 && fields.includes('phone')) {
      const digits = termDigits.startsWith('09') ? `63${termDigits.slice(1)}` : termDigits;
      OR.push({ phone: { contains: digits, mode: 'insensitive' } });
    }
    OR.push(...(relatedMatches?.(contains) ?? []));
    return { OR };
  });
}
