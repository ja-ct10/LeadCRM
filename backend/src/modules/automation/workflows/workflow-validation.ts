import type { WorkflowDraft } from '@leadcrm/shared';
import { ValidationError } from '../../../shared/errors/http-error';
import { AppError } from '../../../shared/errors/app-error';
import { findTrigger } from '../triggers/trigger-catalog';
import { validateAction } from '../actions/action-validation';

export function validateWorkflowConditions(draft: WorkflowDraft): void {
  const trigger = findTrigger(draft.trigger);
  if (!trigger) throw new ValidationError('Choose a supported trigger.');
  if (!draft.name.trim()) throw new ValidationError('Enter a workflow name.');
  for (const rule of draft.conditions?.conditions ?? []) {
    const field = trigger.fields.find(entry => entry.field === rule.field);
    if (!field) throw new ValidationError(`Choose a condition field available for ${trigger.label}.`);
    if (['is_empty', 'is_not_empty'].includes(rule.operator)) continue;
    if (typeof rule.value !== field.type) throw new ValidationError(`${field.label} requires a ${field.type} value.`);
    if (['greater_than', 'less_than', 'greater_than_or_equal', 'less_than_or_equal'].includes(rule.operator) && field.type !== 'number') {
      throw new ValidationError(`Use a numeric field for ${rule.operator.replace(/_/g, ' ')}.`);
    }
    if (['contains', 'not_contains', 'starts_with', 'ends_with'].includes(rule.operator) && field.type !== 'string') throw new ValidationError('Text operators require a text field.');
  }
}

export async function validateWorkflow(draft: WorkflowDraft, tenantId: string): Promise<void> {
  validateWorkflowConditions(draft);
  const trigger = findTrigger(draft.trigger)!;
  if (!draft.actions.length) throw new ValidationError('Add at least one action before activating.');
  for (const [index, action] of draft.actions.entries()) {
    try { await validateAction(action, trigger.entity, tenantId); }
    catch (error) {
      if (!(error instanceof AppError)) throw error;
      throw new ValidationError(`Action ${index + 1}: ${error.message}`);
    }
  }
}

