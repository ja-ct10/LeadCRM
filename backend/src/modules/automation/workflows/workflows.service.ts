import { environmentContext } from '../../../core/environment/environment-context';
import { WorkflowDraftSchema, type WorkflowDraft, type WorkflowTestResult } from '@leadcrm/shared';
import { assertWorkflowPermissions } from '../actions/action-permissions';
import { writeAuditLog } from '../../../core/audit/audit.service';
import { NotFoundError, ValidationError } from '../../../shared/errors/http-error';
import { paginate } from '../../../shared/helpers/pagination';
import * as repo from './workflows.repository';
import { validateWorkflow, validateWorkflowConditions, validateConditionReferences } from './workflow-validation';
import { findTrigger } from '../triggers/trigger-catalog';
import { validateAction } from '../actions/action-validation';
import { evaluateCondition, evaluateRule } from './workflow-conditions';
import { safeWorkflowError } from '../actions/action-dispatcher';
import { findUserEffectivePermissions } from '../../administration/roles/roles.repository';
import { findUser } from '../actions/actions.repository';
import { sanitizeCampaignHtml } from '../../marketing/campaigns/campaign-content';

function sanitizeDraft(draft: WorkflowDraft): WorkflowDraft {
  return { ...draft, actions: draft.actions.map(action => ({ ...action, config: Object.fromEntries(
    Object.entries(action.config).map(([key, value]) => [key, typeof value !== 'string' ? value
      : action.type === 'send_email' && key === 'body' ? sanitizeCampaignHtml(value.trim()) : value.trim()]),
  ) })) };
}

function requireScope(tenantId: string) {
  const scope = environmentContext.getStore();
  if (!scope || scope.tenantId !== tenantId) throw new ValidationError('A matching CRM environment is required for automation.');
}

export async function getOptions(tenantId: string, userId: string) {
  requireScope(tenantId);
  const user = await findUser(userId, tenantId);
  const marketing = user?.role === 'Client Admin' || !!(await findUserEffectivePermissions(userId, tenantId)).campaigns?.canView;
  return repo.builderOptions(tenantId, marketing);
}

export async function getWorkflows(tenantId: string, query: Record<string, unknown>) {
  requireScope(tenantId);
  const result = await repo.listWorkflows(tenantId, query);
  return paginate(result.rows, result.total, result);
}
export async function getWorkflowById(id: string, tenantId: string) {
  requireScope(tenantId);
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
  requireScope(tenantId);
  const draft = parseDraft(dto);
  if (!findTrigger(draft.trigger)) throw new ValidationError('Choose a supported trigger.');
  await validateConditionReferences(draft, tenantId);
  if (!draft.isActive) for (const action of draft.actions) await validateAction(action, findTrigger(draft.trigger)!.entity, tenantId, undefined, true);
  if (draft.isActive) { await validateWorkflow(draft, tenantId); await assertWorkflowPermissions(draft, tenantId, userId); }
  const workflow = await repo.createWorkflow(tenantId, sanitizeDraft(draft), draft.isActive ? userId : undefined);
  await writeAuditLog({ tenantId, userId, action: 'workflow.created', entityType: 'Workflow', entityId: workflow.id });
  return workflow;
}
export async function updateWorkflow(id: string, tenantId: string, userId: string, dto: Record<string, unknown>) {
  requireScope(tenantId);
  const existing = await getWorkflowById(id, tenantId);
  if (existing.isArchived) throw new ValidationError('Archived workflows cannot be edited or activated. Duplicate an available workflow instead.');
  // Pausing must remain possible when a referenced user, template or campaign is no longer valid.
  if (Object.keys(dto).length === 1 && dto.isActive === false) {
    const workflow = await repo.updateWorkflow(id, tenantId, { isActive: false, status: 'PAUSED' });
    if (existing.isActive) await writeAuditLog({ tenantId, userId, action: 'workflow.paused', entityType: 'Workflow', entityId: id });
    return workflow;
  }
  const updates = WorkflowDraftSchema.partial().safeParse(dto);
  if (!updates.success) throw new ValidationError('Use the supported workflow fields.');
  const draft = parseDraft({ name: existing.name, description: existing.description, trigger: existing.trigger,
    conditions: existing.conditions, actions: existing.actions, isActive: existing.isActive, ...updates.data });
  if (!findTrigger(draft.trigger)) throw new ValidationError('Choose a supported trigger.');
  await validateConditionReferences(draft, tenantId);
  if (!draft.isActive) for (const action of draft.actions) await validateAction(action, findTrigger(draft.trigger)!.entity, tenantId, undefined, true);
  if (draft.isActive) { await validateWorkflow(draft, tenantId); await assertWorkflowPermissions(draft, tenantId, userId); }
  const workflow = await repo.updateWorkflow(id, tenantId, { ...sanitizeDraft(draft), status: draft.isActive ? 'ACTIVE' : 'DRAFT', ...(draft.isActive ? { activatedById: userId } : {}) });
  await writeAuditLog({ tenantId, userId, action: existing.isActive !== workflow.isActive ? workflow.isActive ? 'workflow.activated' : 'workflow.paused' : 'workflow.updated', entityType: 'Workflow', entityId: id });
  return workflow;
}
export async function toggleWorkflow(id: string, tenantId: string, userId: string, isActive: boolean) {
  requireScope(tenantId);
  return updateWorkflow(id, tenantId, userId, { isActive });
}

export async function archiveWorkflow(id: string, tenantId: string, userId: string) {
  requireScope(tenantId);
  await getWorkflowById(id, tenantId);
  await repo.updateWorkflow(id, tenantId, { isArchived: true, isActive: false, status: 'PAUSED' });
  await writeAuditLog({ tenantId, userId, action: 'workflow.archived', entityType: 'Workflow', entityId: id });
}
export async function getWorkflowExecutions(id: string, tenantId: string, page = 1) {
  requireScope(tenantId);
  await getWorkflowById(id, tenantId);
  return repo.listExecutions(id, tenantId, page);
}
export async function testWorkflow(id: string, tenantId: string, entityId: string): Promise<WorkflowTestResult> {
  requireScope(tenantId);
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

export async function validateDraft(tenantId: string, userId: string, input: unknown) {
  requireScope(tenantId);
  const draft = parseDraft(input);
  await validateWorkflow(draft, tenantId);
  await assertWorkflowPermissions(draft, tenantId, userId);
  return { valid: true, message: 'Trigger, conditions, action configuration, permissions and references are valid. No actions were executed.' };
}
export async function getExecution(id: string, workflowId: string, tenantId: string) {
  requireScope(tenantId);
  await getWorkflowById(workflowId, tenantId);
  const run = await repo.findExecution(id, workflowId, tenantId);
  if (!run) throw new NotFoundError('Workflow execution');
  return run;
}
