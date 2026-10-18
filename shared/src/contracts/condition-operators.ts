/** Shared presentation and capabilities. Consumers retain their persisted keys and execution semantics. */
export type ConditionFieldKind = 'text' | 'number' | 'date' | 'boolean' | 'choice' | 'reference' | 'collection' | 'file';
export type ConditionProfile = 'workflow' | 'audience' | 'crm';
export type ConditionValueShape = 'none' | 'scalar' | 'range' | 'collection';
export const CONDITION_OPERATOR_METADATA = {
  equals: { label: 'Equals', summary: 'is', valueShape: 'scalar' },
  not_equals: { label: 'Not equals', summary: 'is not', valueShape: 'scalar' },
  gt: { label: 'Greater than', summary: 'is greater than', valueShape: 'scalar' },
  gte: { label: 'Greater than or equal', summary: 'is at least', valueShape: 'scalar' },
  lt: { label: 'Less than', summary: 'is less than', valueShape: 'scalar' },
  lte: { label: 'Less than or equal', summary: 'is at most', valueShape: 'scalar' },
  contains: { label: 'Contains', summary: 'contains', valueShape: 'scalar' },
  not_contains: { label: 'Does not contain', summary: 'does not contain', valueShape: 'scalar' },
  starts_with: { label: 'Starts with', summary: 'starts with', valueShape: 'scalar' },
  ends_with: { label: 'Ends with', summary: 'ends with', valueShape: 'scalar' },
  is_empty: { label: 'Is empty', summary: 'is empty', valueShape: 'none' },
  is_not_empty: { label: 'Is not empty', summary: 'is not empty', valueShape: 'none' },
  before: { label: 'Before', summary: 'is before', valueShape: 'scalar' },
  after: { label: 'After', summary: 'is after', valueShape: 'scalar' },
  any: { label: 'Any date', summary: 'is any date', valueShape: 'none' },
  between: { label: 'Date range', summary: 'is between', valueShape: 'range' },
  in: { label: 'Is one of', summary: 'is one of', valueShape: 'collection' },
  not_in: { label: 'Is not one of', summary: 'is not one of', valueShape: 'collection' },
  is_null: { label: 'Is missing', summary: 'is missing', valueShape: 'none' },
  is_not_null: { label: 'Is present', summary: 'is present', valueShape: 'none' },
} as const;
export type ConditionOperatorKey = keyof typeof CONDITION_OPERATOR_METADATA;
const workflowAliases: Record<string, ConditionOperatorKey> = {
  greater_than: 'gt', greater_than_or_equal: 'gte', less_than: 'lt', less_than_or_equal: 'lte',
};
export function semanticConditionOperator(key: string): ConditionOperatorKey | undefined {
  if (Object.prototype.hasOwnProperty.call(workflowAliases, key)) return workflowAliases[key];
  return Object.prototype.hasOwnProperty.call(CONDITION_OPERATOR_METADATA, key) ? key as ConditionOperatorKey : undefined;
}
export function conditionOperatorLabel(key: string, context: 'dropdown' | 'summary' = 'dropdown', kind?: ConditionFieldKind): string {
  const semantic = semanticConditionOperator(key);
  if (!semantic) return 'Unavailable operator';
  if (kind === 'date') {
    const dates: Partial<Record<ConditionOperatorKey, string>> = { equals: 'On', not_equals: 'Not on', gt: 'After', after: 'After', gte: 'On or after', lt: 'Before', before: 'Before', lte: 'On or before', between: 'Between', any: 'Any date' };
    const label = dates[semantic];
    if (label) return context === 'summary' && semantic !== 'any' ? `is ${label.toLowerCase()}` : label;
  }
  const descriptor = CONDITION_OPERATOR_METADATA[semantic];
  return context === 'summary' ? descriptor.summary : descriptor.label;
}
export function conditionOperatorValueShape(key: string): ConditionValueShape | undefined {
  const semantic = semanticConditionOperator(key);
  return semantic && CONDITION_OPERATOR_METADATA[semantic].valueShape;
}
/** Resolve declared catalog types only. Never infer type from a value or label. */
export function conditionFieldKind(type?: string): ConditionFieldKind | undefined {
  switch (type?.toLowerCase()) {
    case 'string': case 'text': case 'longtext': case 'long text': return 'text';
    case 'number': return 'number';
    case 'date': return 'date';
    case 'boolean': return 'boolean';
    case 'enum': case 'dropdown': case 'choice': return 'choice';
    case 'reference': case 'user': case 'account': case 'stage': case 'pipeline': return 'reference';
    case 'products': case 'list': case 'contacts': case 'leads': case 'collection': return 'collection';
    case 'file': case 'file upload': return 'file';
    default: return undefined;
  }
}
const presence: ConditionOperatorKey[] = ['is_empty', 'is_not_empty'];
const equality: ConditionOperatorKey[] = ['equals', 'not_equals'];
const numeric: ConditionOperatorKey[] = [...equality, 'gt', 'gte', 'lt', 'lte'];
const text: ConditionOperatorKey[] = [...equality, 'contains', 'not_contains', 'starts_with', 'ends_with', ...presence];
export function conditionOperators(profile: ConditionProfile, kind?: ConditionFieldKind): ConditionOperatorKey[] {
  if (!kind) return [];
  if (profile === 'crm') {
    const nullable: ConditionOperatorKey[] = ['is_null', 'is_not_null'];
    if (kind === 'file' || kind === 'collection') return [];
    if (kind === 'number' || kind === 'date') return ['equals', 'gt', 'gte', 'lt', 'lte', ...(kind === 'number' ? ['in', 'not_in'] as const : []), ...nullable];
    if (kind === 'boolean') return ['equals', ...nullable];
    return ['equals', ...(kind === 'text' ? ['contains'] as const : []), 'in', 'not_in', ...nullable];
  }
  if (kind === 'number') return [...numeric, ...(profile === 'audience' ? presence : [])];
  if (kind === 'text') return [...text];
  if (kind === 'date') return profile === 'workflow' ? [...equality, 'before', 'after', ...presence] : ['any', 'gte', 'lte', 'between', ...presence];
  if (kind === 'file') return profile === 'audience' ? [...presence] : [];
  if (kind === 'collection') return profile === 'workflow' ? ['contains', 'not_contains', ...presence] : [...equality, ...presence];
  if (kind === 'boolean') return [...equality, ...(profile === 'audience' ? presence : [])];
  return [...equality, ...presence];
}
/** Typed scalar checks shared by HTTP validation and editor guidance; domain choices are validated by callers. */
export function validConditionScalar(kind: ConditionFieldKind, value: unknown): boolean {
  if (kind === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (kind === 'boolean') return typeof value === 'boolean';
  if (kind === 'date') return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  return typeof value === 'string';
}
