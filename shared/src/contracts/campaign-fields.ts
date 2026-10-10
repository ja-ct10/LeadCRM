import { getCrmFieldCatalog, type CrmFieldCatalogEntry, type FieldLayout } from './field-catalog';
import type { ClosingField } from './closing-requirements';
import type { AudienceCondition } from './campaign-email';

export function campaignFields(source: 'LEADS' | 'CONTACTS', definitions: ClosingField[] = [], layout?: FieldLayout): CrmFieldCatalogEntry[] {
  const module = source === 'LEADS' ? 'leads' : 'contacts';
  const fields = getCrmFieldCatalog(module, definitions, layout).filter(field => field.active);
  if (!fields.some(field => field.technicalKey === 'createdAt')) fields.push({ technicalKey: 'createdAt', label: 'Created Date', module, kind: 'System', type: 'date', groupId: 'metadata', group: 'Record', order: 10000, required: false, mandatory: false, active: true, visibleInForm: false, visibleInDetails: true, conditionAvailable: true, personalizationAvailable: true });
  return fields;
}
export function campaignConditionField(key: string, fields: CrmFieldCatalogEntry[]) {
  const native = key === 'productInterest' ? 'productInterestIds' : key === 'company' ? (fields[0]?.module === 'leads' ? 'companyName' : 'company') : key;
  return fields.find(field => field.technicalKey === native);
}
export function campaignFieldOperators(field?: CrmFieldCatalogEntry): AudienceCondition['operator'][] {
  const presence: AudienceCondition['operator'][] = ['is_empty', 'is_not_empty'];
  if (!field || field.type === 'file') return presence;
  if (field.type === 'date') return ['any', 'gte', 'lte', 'between', ...presence];
  if (field.type === 'number') return ['equals', 'not_equals', 'gt', 'gte', 'lt', 'lte', ...presence];
  if (['dropdown', 'reference', 'products', 'boolean'].includes(field.type)) return ['equals', 'not_equals', ...presence];
  return ['equals', 'not_equals', 'contains', 'not_contains', 'starts_with', 'ends_with', ...presence];
}
export function campaignConditionError(condition: AudienceCondition, fields: CrmFieldCatalogEntry[]): string | undefined {
  const field = campaignConditionField(condition.field, fields);
  if (!field?.conditionAvailable) return 'This field is unavailable for the selected source. Repair the condition.';
  if (!campaignFieldOperators(field).includes(condition.operator)) return `Choose a supported operator for ${field.label}.`;
  if (['is_empty', 'is_not_empty', 'any'].includes(condition.operator)) return condition.value === null ? undefined : 'This operator has no value.';
  const value = condition.value;
  if (field.type === 'number') return typeof value === 'number' && Number.isFinite(value) ? undefined : `Enter a number for ${field.label}.`;
  if (field.type === 'boolean') return typeof value === 'boolean' ? undefined : `Select Yes or No for ${field.label}.`;
  if (field.type === 'products') return Array.isArray(value) && value.length && value.every(id => /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)) ? undefined : 'Select at least one product.';
  if (field.type === 'reference') return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value) ? undefined : `Select ${field.label}.`;
  if (field.type === 'date') {
    const valid = (date: unknown) => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
    return condition.operator === 'between' ? value && typeof value === 'object' && !Array.isArray(value) && valid(value.from) && valid(value.to) && value.from <= value.to ? undefined : 'Enter valid From and To dates.' : valid(value) ? undefined : 'Select a valid calendar date.';
  }
  if (typeof value !== 'string' || !value.trim()) return `Enter a value for ${field.label}.`;
  if (field.type === 'dropdown' && !field.options?.includes(value)) return `Select a current ${field.label} option.`;
  return undefined;
}
