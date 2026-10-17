import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import prisma from '../../../../config/database.config';
import { tenantContext } from '../../../../core/tenant/tenant-context';
import { fireWorkflowTrigger } from '../workflow.engine';
import * as workflows from '../workflows.service';
import { sendEmail } from '../../../../integrations/gmail/gmail.service';
import { sendSms } from '../../../../shared/services/sms.service';
import type { WorkflowAction } from '@leadcrm/shared';
vi.mock('../../../../integrations/gmail/gmail.service', async original => ({ ...await original<object>(), sendEmail: vi.fn(async () => ({ messageId: `fixture-${randomUUID()}`, threadId: `fixture-${randomUUID()}` })) }));
vi.mock('../../../../shared/services/sms.service', async original => ({ ...await original<object>(), sendSms: vi.fn(async () => ({ submitted: true, messageId: '66f7c3a8b1c2d3e4f5a6b7c0', status: 'pending' })) }));
const url = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid/');
const disposable = url.hostname === '127.0.0.1' && /^\/leadcrm_workflow_test_\d+$/.test(url.pathname);
if (process.env.LEADCRM_QA_RUN === '1' && !disposable) throw new Error(`Workflow policy fixture expected: ${url.hostname}${url.pathname}`);
describe.skipIf(!disposable)('Workflow policy on native disposable PostgreSQL', () => {
  let tenantId: string, actorId: string, ownerId: string, leadId: string, contactId: string, dealId: string;
  const scope = <T>(work: () => T) => tenantContext.run({ tenantId }, work);
  const create = (trigger: string, actions: WorkflowAction[], conditions?: unknown) => scope(() => workflows.createWorkflow(tenantId, actorId, { name: randomUUID(), trigger, actions, isActive: true, ...(conditions ? { conditions } : {}) }));
  const fire = (trigger: string, id: string, context = {}) => scope(() => fireWorkflowTrigger({ tenantId, actorId, entityType: trigger.split('.')[0], entityId: id, triggerType: trigger, eventId: randomUUID(), context }));
  beforeAll(async () => {
    tenantId = (await prisma.tenant.create({ data: { name: 'Workflow policy fixture', slug: randomUUID(), status: 'ACTIVE', onboardingStep: 3, onboardingCompletedAt: new Date() } })).id;
    actorId = (await prisma.user.create({ data: { tenantId, role: 'Client Admin', email: `${randomUUID()}@camxian.com`, firstName: 'Admin', lastName: 'Actor' } })).id;
    const role = await prisma.roleDefinition.create({ data: { tenantId, name: 'Sales staff' } });
    await prisma.rolePermission.createMany({ data: ['leads', 'contacts', 'deals', 'tasks', 'inbox'].map(module => ({ tenantId, roleId: role.id, module, canView: true, canEdit: true })) });
    const owner = await prisma.user.create({ data: { tenantId, role: 'Sales staff', email: `${randomUUID()}@camxian.com`, firstName: 'Sales', lastName: 'Agent', mustChangePassword: false, onboardingCompletedAt: new Date(), emailVerified: new Date(), userRoles: { create: { roleId: role.id } } } });
    ownerId = owner.id;
    await prisma.emailAccount.create({ data: { tenantId, userId: ownerId, email: owner.email, accessToken: 'fixture-only', scopes: ['gmail.send'] } });
    const pipeline = await prisma.pipeline.create({ data: { tenantId, name: 'Policy pipeline' } });
    const stage = await prisma.stage.create({ data: { tenantId, pipelineId: pipeline.id, name: 'Lead', order: 0 } });
    leadId = (await prisma.lead.create({ data: { tenantId, firstName: 'Ada', lastName: 'Lead', email: 'lead@recipient.test', phone: '+639171234567', assignedUserId: ownerId, status: 'Hot' } })).id;
    contactId = (await prisma.contact.create({ data: { tenantId, firstName: 'Grace', lastName: 'Contact', email: 'contact@recipient.test', phone: '+639181234567', assignedUserId: ownerId } })).id;
    dealId = (await prisma.deal.create({ data: { tenantId, title: 'Policy opportunity', pipelineId: pipeline.id, stageId: stage.id, assignedUserId: ownerId } })).id;
    await prisma.leadDeal.create({ data: { tenantId, leadId, dealId, position: 0 } });
    await prisma.contactDeal.create({ data: { tenantId, contactId, dealId, position: 0 } });
  }, 60000);
  beforeEach(async () => { vi.clearAllMocks(); vi.stubEnv('TEXTBEE_API_KEY', 'fixture-only'); vi.stubEnv('TEXTBEE_DEVICE_ID', ''); await prisma.workflow.updateMany({ where: { tenantId }, data: { isActive: false, status: 'PAUSED' } }); });
  afterAll(async () => { vi.unstubAllEnvs(); await prisma.$disconnect(); });
  it.each(['lead.created', 'lead.updated', 'contact.created', 'contact.updated', 'account.updated'])('rejects Task activation on %s', async trigger => {
    await expect(create(trigger, [{ type: 'create_task', config: { title: 'Invalid' } }])).rejects.toThrow('unavailable');
  });
  it.each(['lead.updated', 'contact.updated', 'deal.updated'])('rejects ownership changes on ordinary %s events through either action', async trigger => {
    await expect(create(trigger, [{ type: 'assign_owner', config: { userId: ownerId } }])).rejects.toThrow('unavailable');
    await expect(create(trigger, [{ type: 'update_field', config: { field: 'assignedUserId', value: ownerId } }])).rejects.toThrow('Use Assign Agent');
  });
  it.each(['lead.created', 'contact.created'])('keeps %s legacy Task drafts repairable without accepting unexpected settings or foreign assignees', async trigger => {
    const save = (config: Record<string, unknown>) => scope(() => workflows.createWorkflow(tenantId, actorId, {
      name: randomUUID(), trigger, isActive: false, actions: [{ type: 'create_task', config }],
    }));
    await expect(save({ title: 'Repair', surprise: 'untrusted' })).rejects.toThrow('unsupported action setting');
    await expect(save({ title: 'Repair', assignmentTarget: { type: 'user', id: randomUUID() } })).rejects.toThrow();
    const draft = await save({ title: 'Repair', assignedUserId: ownerId });
    expect(draft.isActive).toBe(false);
    await expect(scope(() => workflows.toggleWorkflow(draft.id, tenantId, actorId, true))).rejects.toThrow('unavailable');
  });
  it('requires a target status for a handoff and executes a matching transition', async () => {
    const actions: WorkflowAction[] = [{ type: 'assign_owner', config: { userId: ownerId } }];
    await expect(create('lead.status_changed', actions)).rejects.toThrow('explicit target');
    const workflow = await create('lead.status_changed', actions, { operator: 'AND', conditions: [{ field: 'event.newStatus', operator: 'equals', value: 'Hot' }] });
    await fire('lead.status_changed', leadId, { 'event.previousStatus': 'Warm', 'event.newStatus': 'Hot' });
    expect((await scope(() => workflows.getWorkflowExecutions(workflow.id, tenantId)))[0].status).toBe('completed');
  });
  it('pauses incompatible saved definitions before performing any action and preserves their history', async () => {
    const workflow = await prisma.workflow.create({ data: { tenantId, name: randomUUID(), trigger: 'lead.created', isActive: true, status: 'ACTIVE', activatedById: actorId,
      actions: [{ type: 'update_field', config: { field: 'firstName', value: 'Must not change' } }, { type: 'create_task', config: { title: 'Legacy task' } }] } });
    await fire('lead.created', leadId);
    expect(await prisma.workflow.findUniqueOrThrow({ where: { id: workflow.id } })).toMatchObject({ status: 'PAUSED', version: workflow.version, actions: workflow.actions });
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: leadId } })).firstName).toBe('Ada');
    expect((await scope(() => workflows.getWorkflowExecutions(workflow.id, tenantId)))[0]).toMatchObject({ status: 'failed', errorMessage: expect.stringContaining('paused for repair') });
  });
  it.each(['primary_contact', 'primary_lead'])('previews and dispatches Deal email to %s through the authorized Gmail owner', async recipient => {
    const workflow = await create('deal.created', [{ type: 'send_email', config: { recipient, subject: 'Hello {{firstName}}', body: '<p>Your inquiry is with us.</p>' } }]);
    const preview = await scope(() => workflows.testWorkflow(workflow.id, tenantId, dealId, actorId));
    expect(preview.valid, JSON.stringify(preview.actions)).toBe(true); expect(sendEmail).not.toHaveBeenCalled();
    await fire('deal.created', dealId);
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(sendEmail).toHaveBeenCalledWith(tenantId, ownerId, recipient === 'primary_contact' ? 'contact@recipient.test' : 'lead@recipient.test', recipient === 'primary_contact' ? 'Hello Grace' : 'Hello Ada', expect.any(String), undefined, undefined, undefined, expect.anything());
    expect((await scope(() => workflows.getWorkflowExecutions(workflow.id, tenantId)))[0].status).toBe('completed');
  });
  it.each(['lead', 'contact', 'deal'])('checks personalized %s SMS without sending, then records actual submission once', async entity => {
    const recipient = entity === 'deal' ? 'primary_contact' : 'record';
    const id = entity === 'deal' ? dealId : entity === 'lead' ? leadId : contactId;
    const workflow = await create(`${entity}.created`, [{ type: 'send_sms', config: { recipient, message: 'Hello {{firstName}}' } }]);
    const preview = await scope(() => workflows.testWorkflow(workflow.id, tenantId, id, actorId));
    expect(preview.valid).toBe(true); expect(preview.actions[0].message).toContain('personalized content'); expect(sendSms).not.toHaveBeenCalled();
    await fire(`${entity}.created`, id);
    expect(sendSms).toHaveBeenCalledExactlyOnceWith(entity === 'lead' ? '+639171234567' : '+639181234567', entity === 'lead' ? 'Hello Ada' : 'Hello Grace', expect.anything());
    expect((await scope(() => workflows.getWorkflowExecutions(workflow.id, tenantId)))[0].status).toBe('completed');
  });
});
