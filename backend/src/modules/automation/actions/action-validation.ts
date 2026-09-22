import { z } from 'zod';
import type { WorkflowAction, WorkflowEntity } from '@leadcrm/shared';
import { ValidationError, NotFoundError } from '../../../shared/errors/http-error';
import { getAvailableActions } from './actions.service';
import * as repo from './actions.repository';
import { validateDealStageMove } from '../../crm/deals/deals.service';

export function actionEntity(context: Record<string, unknown>): WorkflowEntity {
  const matches = (['lead', 'contact', 'deal'] as const).filter(entity => typeof context[`${entity}.id`] === 'string');
  if (matches.length !== 1) throw new ValidationError('Choose one triggering CRM record.');
  return matches[0];
}
export function actionUser(config: Record<string, unknown>, key: string, entity: WorkflowEntity, context?: Record<string, unknown>): string {
  return String(config[key] || context?.[`${entity}.assignedUserId`] || '');
}
export async function validateAction(action: WorkflowAction, entity: WorkflowEntity, tenantId: string, context?: Record<string, unknown>): Promise<void> {
  const definition = getAvailableActions().find(entry => entry.type === action.type);
  if (!definition || !definition.entities.includes(entity)) throw new ValidationError(`Action ${action.type} is not supported for ${entity}.`);
  for (const key of Object.keys(action.config)) {
    if (!definition.configSchema[key]) throw new ValidationError(`Remove unsupported action setting: ${key}.`);
  }
  for (const [key, field] of Object.entries(definition.configSchema)) {
    const value = action.config[key];
    if (field.required && (typeof value !== 'string' || !value.trim())) throw new ValidationError(`${field.label} is required.`);
    if (value === undefined || value === '') continue;
    if (field.type === 'number') {
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 365) throw new ValidationError(`${field.label} must be a whole number from 0 to 365.`);
    } else if (typeof value !== 'string' || value.length > 10000) throw new ValidationError(`${field.label} must be text.`);
    if (field.options && !field.options.includes(String(value))) throw new ValidationError(`Choose a supported ${field.label.toLowerCase()}.`);
    if (field.type === 'user' && !await repo.findUser(String(value), tenantId)) throw new NotFoundError('Active workspace user');
  }
  if (action.type === 'update_field' && action.config.field !== (entity === 'contact' ? 'notes' : 'description')) {
    throw new ValidationError('Relationship Status and other protected fields cannot be automated. Choose notes for Client Profiles or description for Leads/Deals.');
  }
  if (context && ['create_task', 'create_notification'].includes(action.type)) {
    const key = action.type === 'create_task' ? 'assignedUserId' : 'userId';
    const userId = actionUser(action.config, key, entity, context);
    if (!userId) throw new ValidationError('Choose a user or assign an owner to the triggering record.');
    if (!await repo.findUser(userId, tenantId)) throw new NotFoundError('Active workspace user');
  }
  if (action.type === 'move_deal_stage') {
    const stage = await repo.findStage(String(action.config.stageId), tenantId);
    if (!stage) throw new NotFoundError('Stage');
    if (stage.isLost && !String(action.config.lostReason ?? '').trim()) throw new ValidationError('Enter a reason for closing the deal as lost.');
    if (context) {
      await validateDealStageMove(String(context['deal.id']), tenantId, { stageId: stage.id, lostReason: String(action.config.lostReason ?? '') });
    }
  }
  if (action.type === 'send_email') await validateEmail(action, entity, tenantId, context);
}
export async function validateEmail(action: WorkflowAction, entity: WorkflowEntity, tenantId: string, context?: Record<string, unknown>): Promise<void> {
  const template = await repo.findTemplate(String(action.config.templateId), tenantId);
  if (!template) throw new NotFoundError('Email template');
  if (!template.subject?.trim() || !template.content.trim()) throw new ValidationError('Choose an email template with a subject and content.');
  // Unknown placeholders must not reach a customer; supported fields are escaped when rendered.
  for (const match of `${template.subject} ${template.content}`.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)) {
    if (!['first_name', 'last_name', 'email', 'company'].includes(match[1])) throw new ValidationError(`Unsupported template field: ${match[1]}.`);
  }
  if (!await repo.findSender(String(action.config.senderUserId), tenantId)) throw new ValidationError('Connect the selected sender to Gmail before activating.');
  if (context) {
    if (!z.string().email().safeParse(context[`${entity}.email`]).success) throw new ValidationError('No valid email address found for the triggering record.');
    if (context[`${entity}.doNotContact`] === true) throw new ValidationError('This Client Profile is marked Do not contact.');
  }
}

