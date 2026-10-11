import { findTrigger, getWorkflowConditionFields, customFieldTechnicalKey, resolveCustomFieldReference, WORKFLOW_MODULES, type WorkflowDraft, type WorkflowEntity } from '@leadcrm/shared';
import prisma from '../../../config/database.config';
import { readConfiguredFields } from '../../crm/closing-requirements/closing-requirements.repository';
import { normalizeWorkflowReferences } from '@leadcrm/shared';

export const workflowCustomFields = (tenantId: string) => readConfiguredFields(prisma, tenantId);
export async function supportedChangedFields(entity: WorkflowEntity, fields: unknown, tenantId: string): Promise<string[]> {
  if (!Array.isArray(fields)) return [];
  const definitions = await workflowCustomFields(tenantId);
  const allowed = new Set(getWorkflowConditionFields(entity, undefined, definitions).map(f => f.field.slice(entity.length + 1)));
  const aliases: Record<string, string> = { productInterest: 'productInterestIds', productInterests: 'productInterestIds', productInterestId: 'productInterestIds', activeProducts: 'activeProductIds' };
  return [...new Set(fields.filter((field): field is string => typeof field === 'string').map(field => {
    const custom = field.startsWith('customFieldValues.') && resolveCustomFieldReference(WORKFLOW_MODULES[entity], field, definitions);
    return custom ? `customFieldValues.${custom.id}` : aliases[field] ?? field;
  }).filter(field => allowed.has(field)))];
}
export async function conditionFields(draft: WorkflowDraft, tenantId: string) {
  const trigger = findTrigger(draft.trigger);
  const custom = draft.conditions?.conditions.some(rule => rule.field.includes('.customFieldValues.'));
  if (!trigger) return [];
  const definitions = custom ? await workflowCustomFields(tenantId) : [];
  const fields = getWorkflowConditionFields(trigger.entity, draft.trigger, definitions);
  return fields.flatMap(field => {
    const definition = definitions.find(item => item.id === field.customFieldId);
    const alias = definition && `${trigger.entity}.${customFieldTechnicalKey(definition)}`;
    return alias && alias !== field.field ? [field, { ...field, field: alias }] : [field];
  });
}
/** Read adapter only. The next explicit save persists deterministic mappings; history is untouched. */
export async function compatibleWorkflow<T extends Pick<WorkflowDraft, 'trigger'> & { conditions?: unknown; actions?: unknown }>(draft: T, tenantId: string): Promise<T> {
  const products = /productInterest|activeProduct/.test(JSON.stringify([draft.conditions, draft.actions]))
    ? await prisma.productInterest.findMany({ where: { tenantId }, select: { id: true, name: true } }) : [];
  const normalized = normalizeWorkflowReferences(draft, products);
  const entity = findTrigger(draft.trigger)?.entity;
  if (!entity || !JSON.stringify([draft.conditions, draft.actions]).includes('customFieldValues.')) return normalized;
  const definitions = await workflowCustomFields(tenantId);
  const canonical = (key: string) => {
    const field = resolveCustomFieldReference(WORKFLOW_MODULES[entity], key, definitions);
    return field ? `customFieldValues.${field.id}` : key;
  };
  const conditions = normalized.conditions as WorkflowDraft['conditions'];
  return { ...normalized,
    conditions: conditions && Array.isArray(conditions.conditions) ? { ...conditions, conditions: conditions.conditions.map(rule =>
      rule?.field?.startsWith(`${entity}.customFieldValues.`) ? { ...rule, field: `${entity}.${canonical(rule.field.slice(entity.length + 1))}` } : rule,
    ) } : normalized.conditions,
    actions: Array.isArray(normalized.actions) ? normalized.actions.map(action => action?.type === 'update_field' && typeof action.config?.field === 'string' && action.config.field.startsWith('customFieldValues.')
      ? { ...action, config: { ...action.config, field: canonical(action.config.field) } } : action) : normalized.actions,
  };
}
