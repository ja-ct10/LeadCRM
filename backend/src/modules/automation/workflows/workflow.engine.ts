import { AsyncLocalStorage } from 'node:async_hooks';
import { WorkflowDraftSchema, type WorkflowDraft } from '@leadcrm/shared';
import { environmentContext } from '../../../core/environment/environment-context';
import { ValidationError, NotFoundError } from '../../../shared/errors/http-error';
import * as repo from './workflows.repository';
import { findTrigger } from '../triggers/trigger-catalog';
import { evaluateCondition } from './workflow-conditions';
import { dispatchAction, safeWorkflowError } from '../actions/action-dispatcher';
import { assertWorkflowPermissions } from '../actions/action-permissions';
import { validateWorkflow } from './workflow-validation';
export { evaluateCondition } from './workflow-conditions';

const chain = new AsyncLocalStorage<ReadonlySet<string>>();
export interface WorkflowFireParams {
  triggerType: string; entityType: string; entityId: string; tenantId: string;
  actorId?: string; eventId?: string; context: Record<string, unknown>;
}
export async function fireWorkflowTrigger(params: WorkflowFireParams): Promise<void> {
  const scope = environmentContext.getStore();
  if (!scope || scope.tenantId !== params.tenantId) throw new ValidationError('A matching CRM environment is required for automation.');
  const trigger = findTrigger(params.triggerType);
  if (!trigger) throw new ValidationError('Unsupported workflow trigger.');
  const context = await repo.entityContext(trigger.entity, params.entityId, params.tenantId);
  if (!context) throw new NotFoundError('Triggering record');
  const eventId = params.eventId ?? (params.triggerType.endsWith('.created') ? `${params.triggerType}:${params.entityId}` : undefined);
  if (!eventId || eventId.length > 500) throw new ValidationError('A stable event identifier is required for automation.');
  const actorId = params.actorId;
  if (!actorId || !await repo.findActor(actorId, params.tenantId)) throw new NotFoundError('Workflow actor');
  const visited = chain.getStore() ?? new Set<string>();
  if (visited.size >= 10) return;
  const workflows = await repo.activeWorkflows(params.tenantId, params.triggerType);
  for (const workflow of workflows) {
    if (visited.has(workflow.id)) continue;
    await chain.run(new Set([...visited, workflow.id]), async () => {
      const run = await repo.startRun({ tenantId: params.tenantId, workflowId: workflow.id, triggerType: params.triggerType,
        entityType: trigger.entity, entityId: params.entityId, eventId, recordName: String(context[`${trigger.entity}.title`] ?? `${context[`${trigger.entity}.firstName`] ?? ''} ${context[`${trigger.entity}.lastName`] ?? ''}`).trim().slice(0, 255) });
      if (!run) return;
      let status = 'completed';
      let errorMessage: string | undefined;
      let recordedSteps = 0;
      let pendingStepId: string | undefined;
      try {
        const parsed = WorkflowDraftSchema.safeParse({ name: workflow.name, description: workflow.description, trigger: workflow.trigger,
          conditions: workflow.conditions, actions: workflow.actions, isActive: workflow.isActive });
        if (!parsed.success) throw new ValidationError('This workflow uses an invalid configuration. Edit and save it before activating.');
        const draft: WorkflowDraft = parsed.data;
        await validateWorkflow(draft, params.tenantId);
        if (!workflow.activatedById) throw new ValidationError('Reactivate this workflow to confirm its author permissions.');
        await assertWorkflowPermissions(draft, params.tenantId, workflow.activatedById);
        if (draft.conditions && !evaluateCondition(draft.conditions, context)) status = 'skipped';
        for (let index = 0; index < draft.actions.length; index++) {
          const action = draft.actions[index];
          const current = await repo.findWorkflowById(workflow.id, params.tenantId);
          if (!current?.isActive || current.isArchived || current.updatedAt.getTime() !== workflow.updatedAt.getTime()) status = status === 'failed' ? status : 'skipped';
          if (status !== 'completed') {
            await repo.createExecutionStep({ tenantId: params.tenantId, executionId: run.id, stepIndex: index, actionType: action.type, status: 'skipped' });
            recordedSteps++;
            continue;
          }
          await assertWorkflowPermissions(draft, params.tenantId, workflow.activatedById);
          const step = await repo.createExecutionStep({ tenantId: params.tenantId, executionId: run.id, stepIndex: index, actionType: action.type, status: 'running' });
          pendingStepId = step.id;
          const freshContext = await repo.entityContext(trigger.entity, params.entityId, params.tenantId);
          const result = freshContext ? await dispatchAction(action, freshContext, params.tenantId, workflow.activatedById)
            : { success: false, error: 'The triggering record is no longer available.' };
          await repo.finishExecutionStep(step.id, params.tenantId, { status: result.success ? 'success' : 'failed', output: result.output, error: result.error });
          pendingStepId = undefined;
          recordedSteps++;
          if (!result.success) { status = 'failed'; errorMessage = result.error; }
        }
      } catch (error) {
        status = 'failed'; errorMessage = safeWorkflowError(error);
        if (pendingStepId) await repo.finishExecutionStep(pendingStepId, params.tenantId, { status: 'failed', error: 'Action outcome requires review. Check CRM records and delivery history before any replay.' });
        else if (!recordedSteps) await repo.createExecutionStep({ tenantId: params.tenantId, executionId: run.id,
          stepIndex: 0, actionType: 'validation', status: 'failed', error: errorMessage });
      }
      await repo.updateExecutionRun(run.id, params.tenantId, { status, errorMessage, completedAt: new Date() });
      console.info('[Workflow]', { workflowId: workflow.id, executionId: run.id, trigger: params.triggerType, status, durationMs: Date.now() - run.startedAt.getTime() });
      await repo.recordRunActivity(params.tenantId, actorId, trigger.entity, params.entityId, workflow.id, run.id, workflow.name, status);
    });
  }
}
