import { WorkflowDraftSchema, type WorkflowDraft, type WorkflowTestResult } from '@leadcrm/shared';
import { writeAuditLog } from '../../../core/audit/audit.service';
import { NotFoundError, ValidationError } from '../../../shared/errors/http-error';
import { paginate } from '../../../shared/helpers/pagination';
import * as repo from './workflows.repository';
import { validateWorkflow, validateWorkflowConditions } from './workflow-validation';
import { findTrigger } from '../triggers/trigger-catalog';
import { validateAction } from '../actions/action-validation';
import { evaluateCondition, evaluateRule } from './workflow-conditions';
import { safeWorkflowError } from '../actions/action-dispatcher';

export async function getWorkflows(tenantId: string, query: Record<string, unknown>) {
  const result = await repo.listWorkflows(tenantId, query);
  return paginate(result.rows, result.total, result);
}
export async function getWorkflowById(id: string, tenantId: string) {
  const workflow = await repo.findWorkflowById(id, tenantId);
  if (!workflow) throw new NotFoundError('Workflow');
  return workflow;
}
function parseDraft(value: unknown): WorkflowDraft {
  const result = WorkflowDraftSchema.safeParse(value);
  if (!result.success) throw new ValidationError(result.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; '));
  return result.data;
}
export async function createWorkflow(tenantId: string, userId: string, dto: unknown) {
  const draft = parseDraft(dto);
  if (!findTrigger(draft.trigger)) throw new ValidationError('Choose a supported trigger.');
  if (draft.isActive) await validateWorkflow(draft, tenantId);
  const workflow = await repo.createWorkflow(tenantId, draft);
  await writeAuditLog({ tenantId, userId, action: 'workflow.created', entityType: 'Workflow', entityId: workflow.id });
  return workflow;
}
export async function updateWorkflow(id: string, tenantId: string, userId: string, dto: Record<string, unknown>) {
  const existing = await getWorkflowById(id, tenantId);
  if (existing.isArchived) throw new ValidationError('Archived workflows cannot be edited or activated. Duplicate an available workflow instead.');
  const updates = WorkflowDraftSchema.partial().safeParse(dto);
  if (!updates.success) throw new ValidationError('Use the supported workflow fields.');
  const draft = parseDraft({ name: existing.name, description: existing.description, trigger: existing.trigger,
    conditions: existing.conditions, actions: existing.actions, isActive: existing.isActive, ...updates.data });
  if (draft.isActive) await validateWorkflow(draft, tenantId);
  const workflow = await repo.updateWorkflow(id, tenantId, draft);
  await writeAuditLog({ tenantId, userId, action: 'workflow.updated', entityType: 'Workflow', entityId: id });
  return workflow;
}
export async function toggleWorkflow(id: string, tenantId: string, userId: string) {
  const existing = await getWorkflowById(id, tenantId);
  if (existing.isArchived) throw new ValidationError('Archived workflows cannot be activated.');
  if (!existing.isActive) await validateWorkflow(parseDraft({ name: existing.name, description: existing.description,
    trigger: existing.trigger, conditions: existing.conditions, actions: existing.actions, isActive: true }), tenantId);
  const workflow = await repo.updateWorkflow(id, tenantId, { isActive: !existing.isActive });
  await writeAuditLog({ tenantId, userId, action: workflow.isActive ? 'workflow.activated' : 'workflow.deactivated', entityType: 'Workflow', entityId: id });
  return workflow;
}
export async function archiveWorkflow(id: string, tenantId: string, userId: string) {
  await getWorkflowById(id, tenantId);
  await repo.updateWorkflow(id, tenantId, { isArchived: true, isActive: false });
  await writeAuditLog({ tenantId, userId, action: 'workflow.archived', entityType: 'Workflow', entityId: id });
}
export async function getWorkflowExecutions(id: string, tenantId: string, page = 1) {
  await getWorkflowById(id, tenantId);
  return repo.listExecutions(id, tenantId, page);
}
export async function testWorkflow(id: string, tenantId: string, entityId: string): Promise<WorkflowTestResult> {
  const existing = await getWorkflowById(id, tenantId);
  const draft = parseDraft({ name: existing.name, description: existing.description, trigger: existing.trigger,
    conditions: existing.conditions, actions: existing.actions, isActive: false });
  const trigger = findTrigger(draft.trigger);
  if (!trigger) throw new ValidationError('Choose a supported trigger.');
  const context = await repo.entityContext(trigger.entity, entityId, tenantId);
  if (!context) throw new NotFoundError('Sample record');
  const conditionContext = { ...context };
  const actions: WorkflowTestResult['actions'] = [];
  for (const action of draft.actions) {
    try { await validateAction(action, trigger.entity, tenantId, context); actions.push({ type: action.type, valid: true,
      message: action.type === 'send_email' ? 'Recipient resolved; template and sender available. No email sent.' : 'Configuration and references valid. No changes made.' });
      // Project validated earlier actions into this in-memory sample only.
      if (action.type === 'assign_owner') context[`${trigger.entity}.assignedUserId`] = action.config.userId;
      if (action.type === 'update_field') context[`${trigger.entity}.${String(action.config.field)}`] = action.config.value;
    }
    catch (error) { actions.push({ type: action.type, valid: false, message: safeWorkflowError(error) }); }
  }
  validateWorkflowConditions(draft);
  const rules = draft.conditions?.conditions ?? [];
  return { trigger: { type: draft.trigger, matched: true }, conditions: { total: rules.length,
    passed: rules.filter(rule => evaluateRule(rule, conditionContext)).length, matched: !draft.conditions || evaluateCondition(draft.conditions, conditionContext) },
    actions, valid: actions.length > 0 && actions.every(action => action.valid) };
}
