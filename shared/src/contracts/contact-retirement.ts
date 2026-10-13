/** Contact database properties retired by the governed column rollout. */
export const RETIRED_CONTACT_FIELDS = ['customerType', 'recordType', 'score', 'linkedinUrl', 'activeProducts', 'lastContactedAt', 'qualifiedAt', 'disqualifiedReason', 'jobTitle'] as const;
const retiredKeys = new Set<string>([...RETIRED_CONTACT_FIELDS, 'activeProductIds', 'linkedin']);

export function isRetiredContactField(field: string, entity?: string): boolean {
  return field.startsWith('contact.') ? retiredKeys.has(field.slice(8)) : entity === 'contact' && retiredKeys.has(field);
}

/** Inspect selectors only. Message bodies and custom field IDs are historical data. */
export function retiredContactReferences(value: unknown, entity?: string): string[] {
  const found = new Set<string>();
  const visit = (node: unknown) => {
    if (Array.isArray(node)) { node.forEach(visit); return; }
    if (!node || typeof node !== 'object') return;
    if ('field' in node && node.field === 'event.changedFields' && 'value' in node) {
      for (const field of Array.isArray(node.value) ? node.value : [node.value]) if (typeof field === 'string' && isRetiredContactField(field, entity)) found.add(field);
    }
    for (const [key, child] of Object.entries(node)) {
      if (key === 'field' && typeof child === 'string' && isRetiredContactField(child, entity)) found.add(child);
      if (key === 'changedFields' && Array.isArray(child)) for (const field of child) if (typeof field === 'string' && isRetiredContactField(field, entity)) found.add(field);
      visit(child);
    }
  };
  visit(value);
  return [...found];
}

export function withoutRetiredContactFields<T extends object>(record: T): T {
  return Object.fromEntries(Object.entries(record).filter(([key]) => !retiredKeys.has(key))) as T;
}
