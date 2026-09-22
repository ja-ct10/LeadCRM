import type { WorkflowAction } from '@leadcrm/shared';
import { environmentContext } from '../../../core/environment/environment-context';
import { AppError } from '../../../shared/errors/app-error';
import { ValidationError } from '../../../shared/errors/http-error';
import { sendEmail } from '../../../integrations/gmail/gmail.service';
import * as repo from './actions.repository';
import { actionEntity, actionUser, validateAction } from './action-validation';
import { createTask } from '../../operations/tasks/tasks.service';
import { createNotification } from '../../notifications/notifications.service';
import { createActivity } from '../../crm/activities/activities.service';
import { moveDealStage, updateDeal } from '../../crm/deals/deals.service';
import { updateContact as updateLead } from '../../crm/contacts/contacts.service';
import { updateContact as updateClientProfile } from '../../crm/contacts-v2/contacts-v2.service';

type ActionResult = { success: boolean; output?: Record<string, unknown>; error?: string };
export function safeWorkflowError(error: unknown): string {
  return error instanceof AppError ? error.message : 'The action could not complete. Check the record and integration, then try again.';
}
export async function dispatchAction(action: WorkflowAction, context: Record<string, unknown>, tenantId: string, actorId: string): Promise<ActionResult> {
  try {
    const entity = actionEntity(context);
    await validateAction(action, entity, tenantId, context);
    const config = action.config;
    const entityId = String(context[`${entity}.id`]);
    if (action.type === 'create_task') {
      const task = await createTask(tenantId, actorId, { title: String(config.title), description: config.description ? String(config.description) : undefined,
        priority: (config.priority ?? 'Medium') as 'Low' | 'Medium' | 'High', status: 'pending',
        dueDate: new Date(Date.now() + Number(config.dueDaysFromNow ?? 3) * 86400000).toISOString(),
        assignedUserId: actionUser(config, 'assignedUserId', entity, context),
        ...(entity === 'lead' ? { leadId: entityId } : entity === 'contact' ? { customerId: entityId } : { dealId: entityId }) });
      return { success: true, output: { taskId: task.id } };
    }
    if (action.type === 'create_notification') {
      await createNotification({ tenantId, userId: actionUser(config, 'userId', entity, context), type: 'workflow_triggered',
        title: String(config.title), body: config.body ? String(config.body) : undefined, entityType: entity, entityId });
      return { success: true, output: { notified: true } };
    }
    if (action.type === 'send_email') return { success: true, output: await deliverEmail(action, context, tenantId) };
    if (action.type === 'move_deal_stage') {
      if (context['deal.stageId'] === config.stageId) return { success: true, output: { unchanged: true, stageId: config.stageId } };
      const result = await moveDealStage(entityId, tenantId, actorId, { stageId: String(config.stageId), lostReason: config.lostReason ? String(config.lostReason) : undefined });
      return { success: true, output: { historyId: result.stageHistory.id, stageId: config.stageId } };
    }
    const update = action.type === 'assign_owner' ? { assignedUserId: String(config.userId) } : { [String(config.field)]: String(config.value) };
    if (entity === 'deal') {
      await updateDeal(entityId, tenantId, actorId, update);
    } else if (entity === 'lead') {
      await updateLead(entityId, tenantId, actorId, update);
    } else {
      await updateClientProfile(entityId, tenantId, update, actorId);
    }
    await createActivity(tenantId, actorId, { type: 'workflow', title: action.type === 'assign_owner' ? 'Workflow assigned record owner' : 'Workflow updated record notes',
      ...(entity === 'lead' ? { leadId: entityId } : entity === 'contact' ? { customerId: entityId } : { dealId: entityId }) });
    return { success: true, output: { entityId, updatedFields: Object.keys(update) } };
  } catch (error) { return { success: false, error: safeWorkflowError(error) }; }
}
function render(content: string, context: Record<string, unknown>, entity: string): string {
  const values: Record<string, unknown> = { first_name: context[`${entity}.firstName`], last_name: context[`${entity}.lastName`],
    email: context[`${entity}.email`], company: context[`${entity}.company`] ?? context[`${entity}.companyName`] };
  return content.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_, key: string) => String(values[key] ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!)));
}
async function deliverEmail(action: WorkflowAction, context: Record<string, unknown>, tenantId: string): Promise<Record<string, unknown>> {
  if (environmentContext.getStore()?.environment !== 'PRODUCTION') throw new ValidationError('External workflow email is disabled in Sandbox. Use Test workflow to validate safely.');
  const entity = actionEntity(context);
  const senderId = String(action.config.senderUserId);
  const [template, sender] = await Promise.all([repo.findTemplate(String(action.config.templateId), tenantId), repo.findSender(senderId, tenantId)]);
  if (!template || !sender) throw new ValidationError('Reconnect the sender and choose an available email template.');
  const recipient = String(context[`${entity}.email`]);
  const subject = render(template.subject!, context, entity);
  const log = await repo.createDelivery({ tenantId, fromEmail: sender.email, toEmail: recipient, subject,
    ...(entity === 'lead' ? { leadId: String(context['lead.id']) } : { customerId: String(context['contact.id']) }) });
  let sent: Awaited<ReturnType<typeof sendEmail>>;
  try {
    sent = await sendEmail(tenantId, senderId, recipient, subject, render(template.content, context, entity));
  } catch {
    await repo.finishDelivery(log.id, tenantId, { status: 'failed', errorMessage: 'Gmail delivery failed. Check the sender connection.' });
    throw new ValidationError('Gmail delivery failed. Check the sender connection.');
  }
  try {
    await repo.finishDelivery(log.id, tenantId, { status: 'sent', gmailMessageId: sent.messageId, gmailThreadId: sent.threadId, sentAt: new Date() });
  } catch {
    throw new ValidationError('Gmail accepted the message, but its receipt could not be saved. Check Gmail before sending again.');
  }
  return { deliveryLogId: log.id, messageId: sent.messageId, status: 'sent' };
}

