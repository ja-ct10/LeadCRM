import { z } from 'zod';
import { campaignVariableKeys, EmailSubjectSchema, workflowMessageEntity, type WorkflowAction, type WorkflowEntity } from '@leadcrm/shared';
import prisma from '../../../config/database.config';
import { NotFoundError, ValidationError } from '../../../shared/errors/http-error';
import { AppError } from '../../../shared/errors/app-error';
import { authorizedMailbox } from '../../../integrations/gmail/mailbox-store';
import { assertMailboxRecipients } from '../../../integrations/gmail/mailbox-recipient-access';
import { mailboxAddress, projectMailboxScope } from '../../../integrations/gmail/mailbox-scope';
import { sanitizeCampaignHtml } from '../../marketing/campaigns/campaign-content';
import { renderMessage, resolveMessageValues, validateMessageVariables } from './action-message';
import { findTemplate, findUser } from './actions.repository';
import { workflowEmailContent } from './action-email-content';
export { workflowEmailContent } from './action-email-content';

/** Old saved sender settings are accepted but never choose a mailbox. */
export function normalizeWorkflowEmailAction(action: WorkflowAction): WorkflowAction {
  if (action.type !== 'send_email' || !Object.prototype.hasOwnProperty.call(action.config, 'senderUserId')) return action;
  const { senderUserId: _sender, ...config } = action.config;
  return { ...action, config };
}

export async function validateWorkflowEmailContent(action: WorkflowAction, entity: WorkflowEntity, tenantId: string) {
  if (entity === 'account') throw new ValidationError('Account workflows support Update Fields only.');
  if (entity === 'deal' ? !['primary_contact', 'primary_lead'].includes(String(action.config.recipient)) : action.config.recipient !== undefined && action.config.recipient !== 'record')
    throw new ValidationError('Choose a recipient relationship available for this record.');
  const template = action.config.templateId ? await findTemplate(String(action.config.templateId), tenantId) : null;
  if (action.config.templateId && !template) throw new NotFoundError('Email template');
  const content = workflowEmailContent(action.config, template);
  if (!content.subject.trim() || !sanitizeCampaignHtml(content.body).trim()) throw new ValidationError('Choose a complete template or enter an email subject and message.');
  if (!EmailSubjectSchema.safeParse(content.subject).success) throw new ValidationError('Email subject must be at most 200 characters without line breaks or control characters.');
  await validateMessageVariables(`${content.subject} ${content.body}`, workflowMessageEntity(entity, action.config.recipient), tenantId);
  return content;
}

function senderAccessError(error: unknown, entity: 'lead' | 'contact'): never {
  if (error instanceof AppError && error.statusCode === 403) {
    if (/ownership/i.test(error.message)) throw new AppError('The assigned agent’s Gmail connection does not match their work email. Ask that agent to reconnect their own work Gmail in Inbox.', 403, error.code);
    throw new AppError(`The assigned agent cannot send email to the triggering ${entity === 'lead' ? 'Lead' : 'Contact'}. Ask an administrator to restore the agent’s ${entity === 'lead' ? 'Lead' : 'Contact'} view/edit permissions and mailbox access, or assign an eligible connected agent.`, 403, error.code);
  }
  if (error instanceof AppError && error.statusCode === 409) throw new AppError('The assigned agent’s Gmail connection is unavailable. Ask that agent to reconnect their work Gmail in Inbox, then run the check again.', 409, error.code);
  throw error;
}

/** Pure preparation: shared by Run Check and delivery; no logs, provider calls or assignment writes. */
export async function prepareWorkflowEmailInput(action: WorkflowAction, entity: WorkflowEntity, tenantId: string, context: Record<string, unknown>) {
  const content = await validateWorkflowEmailContent(action, entity, tenantId);
  const recipientEntity = workflowMessageEntity(entity, action.config.recipient) as 'lead' | 'contact';
  let recipientContext = context;
  if (entity === 'deal') {
    const recipientId = context[recipientEntity === 'lead' ? 'deal.leadId' : 'deal.contactId'];
    if (!recipientId) throw new ValidationError('The Deal has no primary recipient for the selected relationship.');
    const where = { id: String(recipientId), tenantId, isArchived: false, deletedAt: null };
    const person = recipientEntity === 'lead' ? await prisma.lead.findFirst({ where: { ...where, convertedAt: null } }) : await prisma.contact.findFirst({ where });
    if (!person) throw new NotFoundError('Active email recipient');
    recipientContext = Object.fromEntries(Object.entries(person).map(([key, value]) => [`${recipientEntity}.${key}`, value]));
  }
  const senderId = context[`${entity}.assignedUserId`];
  if (typeof senderId !== 'string' || !senderId) throw new ValidationError('No assigned agent can send this email. Assign an agent to the triggering record or add an earlier Assign Agent action, then connect that agent’s work Gmail in Inbox.');
  if (!await findUser(senderId, tenantId)) throw new ValidationError('The assigned agent is unavailable. Assign an active workspace agent with access to this record and a connected work Gmail account.');
  if (!await prisma.emailAccount.findFirst({ where: { tenantId, userId: senderId, provider: 'gmail', isActive: true }, select: { id: true } })) throw new ValidationError('The assigned agent has no connected Gmail account. Ask that agent to connect their work Gmail in Inbox, or assign an authorized connected agent.');
  const recipient = recipientContext[`${recipientEntity}.email`];
  if (!z.string().email().safeParse(recipient).success) throw new ValidationError('No valid email address found for the triggering record. Add a valid email address before sending.');
  if (recipientContext[`${recipientEntity}.doNotContact`] === true) throw new ValidationError('This Contact is marked Do not contact. Review its contact preferences before sending.');
  const where = { tenantId, id: String(recipientContext[`${recipientEntity}.id`]), isArchived: false, deletedAt: null };
  const record = recipientEntity === 'lead' ? await prisma.lead.findFirst({ where: { ...where, convertedAt: null }, select: { id: true } })
    : await prisma.contact.findFirst({ where, select: { id: true } });
  if (!record) throw new NotFoundError('Active email recipient');
  const { account, scope, permissions } = await authorizedMailbox(tenantId, senderId).catch(error => senderAccessError(error, recipientEntity));
  const email = mailboxAddress(String(recipient))!;
  const projectedScope = entity === 'deal' ? scope : projectMailboxScope(scope, permissions, { type: recipientEntity, id: record.id, email, assignedUserId: senderId });
  await assertMailboxRecipients(account, projectedScope, permissions, [email], '', { type: recipientEntity, id: record.id, email }).catch(error => senderAccessError(error, recipientEntity));
  const values = await resolveMessageValues(`${content.subject}\n${content.body}`, tenantId, recipientEntity, recipientContext, senderId);
  const subject = EmailSubjectSchema.safeParse(renderMessage(content.subject, values, false));
  if (!subject.success) throw new ValidationError('The rendered email subject exceeds 200 characters or contains unsupported characters. Shorten the subject or its variables.');
  const body = sanitizeCampaignHtml(renderMessage(content.body, values));
  const bodyText = body.replace(/<[^>]*>/g, '').replace(/&(?:nbsp|#160|#xA0);/gi, ' ').trim();
  if (!subject.data || (!bodyText && !/<img\b[^>]*\bsrc=/i.test(body))) throw new ValidationError('Email variables left the subject or message empty. Fill in the triggering record’s values or update this email content.');
  const missing = campaignVariableKeys(`${content.subject}\n${content.body}`).filter(key => !values[key]?.trim());
  const warnings = missing.length ? [`Missing values for ${missing.map(key => '{{' + key + '}}').join(', ')} will appear blank. Fill in the triggering record or update the message.`] : [];
  return { senderId, senderName: values.sender_name ?? '', senderEmail: account.email, recipient: email, recipientEntity, recipientId: record.id, subject: subject.data, body, warnings };
}
