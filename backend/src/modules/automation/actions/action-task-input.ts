import { CreateTaskSchema, type CreateTaskDto, type WorkflowAction, type WorkflowEntity } from '@leadcrm/shared';
import { ValidationError } from '../../../shared/errors/http-error';
import { renderMessage, resolveMessageValues } from './action-message';
import { resolveTaskDealIds } from './action-task-deals';

interface TaskPreparation {
  action: WorkflowAction; entity: WorkflowEntity; tenantId: string; context: Record<string, unknown>;
  assignedUserId: string; requestId?: string; now?: Date;
}
type WorkflowTaskInput = CreateTaskDto & { assignedUserId: string };
/** A recovery uses the original payload so dates, assignees and receipt fingerprints stay stable. */
export function restoredWorkflowTaskInput(value: unknown, requestId: string): WorkflowTaskInput | undefined {
  const parsed = CreateTaskSchema.safeParse(value);
  if (!parsed.success || !parsed.data.assignedUserId) return undefined;
  if (parsed.data.requestId !== requestId) throw new ValidationError('The saved task request is unavailable. Review this execution before trying again.');
  return { ...parsed.data, assignedUserId: parsed.data.assignedUserId };
}

/** Preview and execution render and validate the same canonical Task payload. */
export async function prepareWorkflowTaskInput(input: TaskPreparation): Promise<WorkflowTaskInput> {
  const { action, entity, tenantId, context, assignedUserId, requestId, now = new Date() } = input;
  const config = action.config;
  const values = await resolveMessageValues(`${config.title} ${config.description ?? ''}`, tenantId, entity, context);
  const parsed = CreateTaskSchema.safeParse({ ...(requestId ? { requestId } : {}),
    title: renderMessage(String(config.title).trim(), values, false),
    description: config.description ? renderMessage(String(config.description).trim(), values, false) : undefined,
    priority: config.priority || 'Medium', status: 'pending', assignedUserId,
    dueDate: new Date(+now + (typeof config.dueDaysFromNow === 'number' ? config.dueDaysFromNow : 3) * 86400000).toISOString(),
    dealIds: await resolveTaskDealIds(action, entity, tenantId, context),
  });
  if (!parsed.success) throw new ValidationError(`Rendered Task ${parsed.error.issues[0]?.path.join('.') || 'input'}: ${parsed.error.issues[0]?.message ?? 'Review this action.'}`);
  return { ...parsed.data, assignedUserId };
}
