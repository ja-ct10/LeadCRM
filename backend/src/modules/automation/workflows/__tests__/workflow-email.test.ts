import { beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { AppError } from '../../../../shared/errors/app-error';
import type { WorkflowAction } from '@leadcrm/shared';
import { prepareWorkflowEmailInput, validateWorkflowEmailContent, workflowEmailContent } from '../../actions/action-email';

const fixtures = vi.hoisted(() => ({
  template: vi.fn(), user: vi.fn(), account: vi.fn(), record: vi.fn(), values: vi.fn(), validate: vi.fn(), mailbox: vi.fn(), recipients: vi.fn(),
}));
vi.mock('../../../../config/database.config', () => ({ default: {
  emailAccount: { findFirst: fixtures.account }, lead: { findFirst: fixtures.record }, contact: { findFirst: fixtures.record },
} }));
vi.mock('../../actions/actions.repository', () => ({ findTemplate: fixtures.template, findUser: fixtures.user }));
vi.mock('../../actions/action-message', async original => ({ ...await original<typeof import('../../actions/action-message')>(),
  validateMessageVariables: fixtures.validate, resolveMessageValues: fixtures.values,
}));
vi.mock('../../../../integrations/gmail/mailbox-store', () => ({ authorizedMailbox: fixtures.mailbox }));
vi.mock('../../../../integrations/gmail/mailbox-recipient-access', () => ({ assertMailboxRecipients: fixtures.recipients }));
vi.mock('../../../../integrations/gmail/mailbox-scope', () => ({ mailboxAddress: (value: string) => value.toLowerCase(), projectMailboxScope: (scope: unknown) => scope }));

describe('Workflow email preparation', () => {
  const ownerId = randomUUID(), recordId = randomUUID(), tenantId = randomUUID();
  const context = { 'lead.id': recordId, 'lead.assignedUserId': ownerId, 'lead.email': 'ada@example.test' };
  const action: WorkflowAction = { type: 'send_email', config: { subject: 'Hi {{firstName}}', body: '<p>Call {{phone}}</p>' } };
  beforeEach(() => {
    vi.clearAllMocks();
    fixtures.template.mockResolvedValue(null); fixtures.user.mockResolvedValue({ id: ownerId }); fixtures.account.mockResolvedValue({ id: 'mailbox' });
    fixtures.record.mockResolvedValue({ id: recordId }); fixtures.values.mockResolvedValue({ firstName: 'Ada', phone: '', sender_name: 'Assigned Agent' });
    fixtures.mailbox.mockResolvedValue({ account: { email: 'agent@example.test' }, scope: {}, permissions: {} });
    fixtures.validate.mockResolvedValue(undefined); fixtures.recipients.mockResolvedValue(undefined);
  });
  it('uses template fallback independently for whitespace overrides', () => {
    expect(workflowEmailContent({ subject: ' \n ', body: ' \t ' }, { subject: 'Template', content: '<p>Template</p>' })).toEqual({ subject: 'Template', body: '<p>Template</p>' });
    expect(workflowEmailContent({ subject: ' Override ', body: '' }, { subject: 'Template', content: '<p>Template</p>' })).toEqual({ subject: 'Override', body: '<p>Template</p>' });
  });
  it.each(['primary_contact', 'primary_lead'])('sends Deal email to its explicitly selected %s without projecting ownership onto that person', async recipient => {
    fixtures.record.mockResolvedValue({ id: recordId, email: 'customer@example.test', firstName: 'Ada', doNotContact: false });
    const prepared = await prepareWorkflowEmailInput({ ...action, config: { ...action.config, recipient } }, 'deal', tenantId,
      { 'deal.id': 'deal', 'deal.assignedUserId': ownerId, 'deal.contactId': recordId, 'deal.leadId': recordId });
    expect(prepared).toMatchObject({ senderId: ownerId, recipient: 'customer@example.test', recipientId: recordId, recipientEntity: recipient === 'primary_lead' ? 'lead' : 'contact' });
    expect(fixtures.validate).toHaveBeenCalledWith(expect.any(String), recipient === 'primary_lead' ? 'lead' : 'contact', tenantId);
    expect(fixtures.recipients).toHaveBeenCalledWith(expect.anything(), {}, {}, ['customer@example.test'], '', expect.objectContaining({ id: recordId }));
  });
  it('rejects missing relationships, unavailable recipients, opt-outs and mailbox denials for Deal email', async () => {
    const deal = { 'deal.id': 'deal', 'deal.assignedUserId': ownerId, 'deal.contactId': recordId };
    const selected = { ...action, config: { ...action.config, recipient: 'primary_contact' } };
    await expect(prepareWorkflowEmailInput(action, 'deal', tenantId, deal)).rejects.toThrow('recipient relationship');
    await expect(prepareWorkflowEmailInput(selected, 'deal', tenantId, { ...deal, 'deal.contactId': null })).rejects.toThrow('no primary recipient');
    fixtures.record.mockResolvedValueOnce(null);
    await expect(prepareWorkflowEmailInput(selected, 'deal', tenantId, deal)).rejects.toThrow('Active email recipient');
    fixtures.record.mockResolvedValue({ id: recordId, email: 'customer@example.test', doNotContact: true });
    await expect(prepareWorkflowEmailInput(selected, 'deal', tenantId, deal)).rejects.toThrow('Do not contact');
    fixtures.record.mockResolvedValue({ id: recordId, email: 'customer@example.test' });
    fixtures.recipients.mockRejectedValueOnce(new AppError('Forbidden', 403));
    await expect(prepareWorkflowEmailInput(selected, 'deal', tenantId, deal)).rejects.toMatchObject({ statusCode: 403 });
  });
  it('resolves only the assigned agent and ignores a legacy unrelated sender', async () => {
    const prepared = await prepareWorkflowEmailInput({ ...action, config: { ...action.config, senderUserId: randomUUID() } }, 'lead', tenantId, context);
    expect(prepared).toMatchObject({ senderId: ownerId, senderName: 'Assigned Agent', senderEmail: 'agent@example.test', recipient: 'ada@example.test', subject: 'Hi Ada', body: '<p>Call </p>' });
    expect(fixtures.mailbox).toHaveBeenCalledWith(tenantId, ownerId);
    expect(prepared.warnings).toEqual([expect.stringContaining('{{phone}}')]);
  });
  it('validates saved content without requiring a future record or mailbox', async () => {
    await validateWorkflowEmailContent(action, 'lead', tenantId);
    expect(fixtures.account).not.toHaveBeenCalled(); expect(fixtures.mailbox).not.toHaveBeenCalled();
  });
  it('explains missing assignment and never selects another connected user', async () => {
    await expect(prepareWorkflowEmailInput(action, 'lead', tenantId, { ...context, 'lead.assignedUserId': null })).rejects.toThrow('Assign an agent');
    expect(fixtures.account).not.toHaveBeenCalled(); expect(fixtures.mailbox).not.toHaveBeenCalled();
  });
  it('explains missing Gmail and retains mailbox permission failures', async () => {
    fixtures.account.mockResolvedValueOnce(null);
    await expect(prepareWorkflowEmailInput(action, 'lead', tenantId, context)).rejects.toThrow('connect their work Gmail');
    fixtures.mailbox.mockRejectedValueOnce(new AppError('Access denied', 403));
    await expect(prepareWorkflowEmailInput(action, 'lead', tenantId, context)).rejects.toThrow('restore the agent’s Lead view/edit permissions');
  });
  it('rejects empty or oversized rendered subjects before delivery', async () => {
    fixtures.values.mockResolvedValueOnce({ firstName: '' });
    await expect(prepareWorkflowEmailInput({ ...action, config: { ...action.config, subject: '{{firstName}}' } }, 'lead', tenantId, context)).rejects.toThrow('left the subject or message empty');
    fixtures.values.mockResolvedValueOnce({ firstName: 'x'.repeat(201) });
    await expect(prepareWorkflowEmailInput(action, 'lead', tenantId, context)).rejects.toThrow('exceeds 200');
    await expect(prepareWorkflowEmailInput({ ...action, config: { ...action.config, body: '<p>{{phone}}&nbsp;</p>' } }, 'lead', tenantId, context)).rejects.toThrow('left the subject or message empty');
  });
});
