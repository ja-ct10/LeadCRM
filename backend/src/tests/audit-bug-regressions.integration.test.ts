import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import prisma from '../config/database.config';
import app from '../app';
import { issueAuthSession } from '../core/auth/auth-session';
import { tenantContext } from '../core/tenant/tenant-context';
import { crmActor } from '../modules/crm/access/crm-record-access.service';
import { createCampaign, sendCampaign, scheduleCampaign, dispatchDueCampaigns } from '../modules/marketing/campaigns/campaigns.service';
import { sendMail } from '../shared/services/email.service';

vi.mock('../shared/services/email.service', async original => ({ ...await original<object>(), sendMail: vi.fn() }));
vi.mock('../modules/notifications/notification-events.service', async original => ({ ...await original<object>(), requestNotificationDispatch: vi.fn() }));

const database = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid/');
const disposable = ['127.0.0.1', 'localhost'].includes(database.hostname) && database.pathname === '/leadcrm_forms_test_2';

describe.skipIf(!disposable).sequential('audit bug regressions through current permissions and persisted data', { timeout: 30000 }, () => {
  let server: Server, base: string, tenantId: string, roleId: string, staffId: string, adminId: string;
  let token: string, adminToken: string, leadId: string, contactId: string, ownLeadId: string, ownContactId: string, dealId: string, workflowId: string;
  const scope = <T>(work: () => Promise<T>) => tenantContext.run({ tenantId }, work);
  async function call(path: string, method = 'GET', body?: unknown, bearer = token) {
    const response = await fetch(base + path, { method, headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json() };
  }
  async function grant(module: string, flags: { canView: boolean; canViewMy?: boolean; canViewAll?: boolean; canViewActive?: boolean }) {
    await prisma.rolePermission.update({ where: { roleId_module: { roleId, module } },
      data: { canViewAll: false, canViewMy: false, canViewActive: false, ...flags } });
  }
  async function campaign(source: 'LEADS' | 'CONTACTS' = 'LEADS') {
    return scope(() => createCampaign(tenantId, staffId, { name: `Scoped ${randomUUID()}`, type: 'EMAIL', audienceSource: source, subject: 'Hello', body: 'Hi {{first_name}}' }));
  }

  beforeAll(async () => {
    vi.stubEnv('BREVO_API_KEY', 'xkeysib-test-only-not-a-real-key'); vi.stubEnv('BREVO_FROM_EMAIL', 'sender@example.test');
    vi.stubEnv('BREVO_SANDBOX_EMAILS', ''); vi.stubEnv('BREVO_DAILY_EMAIL_LIMIT', '300');
    tenantId = (await prisma.tenant.create({ data: { name: 'Audit regression', slug: randomUUID(), status: 'ACTIVE', onboardingStep: 3, onboardingCompletedAt: new Date() } })).id;
    const admin = await prisma.user.create({ data: { tenantId, firstName: 'Audit', lastName: 'Admin', email: `${randomUUID()}@camxian.com`, role: 'Client Admin', mustChangePassword: false, onboardingCompletedAt: new Date() } });
    adminId = admin.id; adminToken = (await issueAuthSession(admin)).token;
    const role = await prisma.roleDefinition.create({ data: { tenantId, name: 'Scoped auditor', crmAssignmentRestricted: true, permissions: { create: [
      ...['leads', 'contacts', 'deals'].map(module => ({ module, canView: true, canViewMy: true, canEdit: true })),
      { module: 'campaigns', canView: true, canSend: true }, { module: 'workflows', canView: true, canActivate: true },
    ] } } });
    roleId = role.id;
    const staff = await prisma.user.create({ data: { tenantId, firstName: 'Scoped', lastName: 'Staff', email: `${randomUUID()}@camxian.com`, role: role.name, mustChangePassword: false, onboardingCompletedAt: new Date(), userRoles: { create: { roleId } } } });
    staffId = staff.id; token = (await issueAuthSession(staff)).token;
    const person = { tenantId, firstName: 'Private', lastName: 'Person', assignedUserId: adminId, address: 'Secret address' };
    leadId = (await prisma.lead.create({ data: { ...person, email: 'private-lead@example.test', companyName: 'Private company' } })).id;
    contactId = (await prisma.contact.create({ data: { ...person, email: 'private-contact@example.test' } })).id;
    ownLeadId = (await prisma.lead.create({ data: { ...person, firstName: 'Visible', assignedUserId: staffId, email: 'visible-lead@example.test', address: 'Visible address' } })).id;
    ownContactId = (await prisma.contact.create({ data: { ...person, firstName: 'Visible', assignedUserId: staffId, email: 'visible-contact@example.test', address: 'Visible contact address' } })).id;
    const foreign = await prisma.tenant.create({ data: { name: 'Foreign', slug: randomUUID() } });
    await prisma.lead.create({ data: { tenantId: foreign.id, firstName: 'Foreign', lastName: 'Person', email: 'foreign@example.test' } });
    const pipeline = await prisma.pipeline.create({ data: { tenantId, name: 'Audit pipeline' } });
    const stage = await prisma.stage.create({ data: { tenantId, pipelineId: pipeline.id, name: 'Lead', order: 0 } });
    dealId = (await prisma.deal.create({ data: { tenantId, title: 'Owned Deal', assignedUserId: staffId, pipelineId: pipeline.id, stageId: stage.id,
      addressSource: { type: 'lead', id: leadId }, leadDeals: { create: [{ leadId, position: 0 }, { leadId: ownLeadId, position: 1 }] },
      contactDeals: { create: [{ contactId, position: 0 }, { contactId: ownContactId, position: 1 }] } } })).id;
    const definition = { name: 'Sample access', trigger: 'lead.created', conditions: { operator: 'AND', conditions: [{ field: 'lead.email', operator: 'equals', value: 'private-lead@example.test' }] },
      actions: [{ type: 'update_field', config: { field: 'firstName', value: 'Would change' } }], isActive: false };
    workflowId = (await prisma.workflow.create({ data: { tenantId, createdById: staffId, ...definition, draftDefinition: definition } })).id;
    server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1`;
  }, 30000);
  beforeEach(async () => {
    for (const module of ['leads', 'contacts', 'deals']) await grant(module, { canView: true, canViewMy: true });
    vi.mocked(sendMail).mockReset().mockResolvedValue({ submitted: true, messageId: randomUUID() });
  });
  afterAll(async () => { if (server) await new Promise<void>(resolve => server.close(() => resolve())); await prisma.$disconnect(); vi.unstubAllEnvs(); });

  it.each(['LEADS', 'CONTACTS'] as const)('limits %s previews and counts to the current CRM scope', async source => {
    const response = await call('/marketing/audiences/preview', 'POST', { source, conditions: [], limit: 1 });
    expect(response.status).toBe(200);
    expect(response.body.data.meta).toMatchObject({ total: 1, hasMore: false });
    expect(response.body.data.recipients.map((row: { id: string }) => row.id)).toEqual([source === 'LEADS' ? ownLeadId : ownContactId]);
    expect(JSON.stringify(response.body)).not.toMatch(/private-|foreign@example/);
    const filtered = await call('/marketing/audiences/preview', 'POST', { source, conditions: [{ field: 'email', operator: 'equals', value: 'private-lead@example.test' }] });
    expect(filtered.status).toBe(200); expect(filtered.body.data.meta.total).toBe(0);
  });
  it.each(['LEADS', 'CONTACTS'] as const)('denies %s preview when source View is revoked', async source => {
    await grant(source === 'LEADS' ? 'leads' : 'contacts', { canView: false });
    expect((await call('/marketing/audiences/preview', 'POST', { source, conditions: [] })).status).toBe(403);
  });
  it('keeps Campaign ownership restrictions with unrestricted CRM grants and permits Client Admin tenant reads', async () => {
    await prisma.roleDefinition.update({ where: { id: roleId }, data: { crmAssignmentRestricted: false } });
    try {
      await grant('leads', { canView: true, canViewAll: true });
      const result = await call('/marketing/audiences/preview', 'POST', { source: 'LEADS', conditions: [] });
      expect(result.status).toBe(200); expect(result.body.data.meta.total).toBe(1);
      expect(result.body.data.recipients.map((row: { id: string }) => row.id)).toEqual([ownLeadId]);
      const admin = await call('/marketing/audiences/preview', 'POST', { source: 'LEADS', conditions: [] }, adminToken);
      expect(admin.status).toBe(200); expect(admin.body.data.meta.total).toBe(2);
      expect(JSON.stringify(admin.body)).not.toContain('foreign@example.test');
    } finally { await prisma.roleDefinition.update({ where: { id: roleId }, data: { crmAssignmentRestricted: true } }); }
  });
  it.each(['LEADS', 'CONTACTS'] as const)('limits immediate %s sends even without an HTTP actor', async source => {
    const draft = await campaign(source);
    await scope(() => sendCampaign(draft.id, tenantId, staffId));
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: source === 'LEADS' ? 'visible-lead@example.test' : 'visible-contact@example.test' }));
    expect((await prisma.campaignContact.findMany({ where: { campaignId: draft.id } })).map(row => row.leadId ?? row.contactId)).toEqual([source === 'LEADS' ? ownLeadId : ownContactId]);
  });
  it('retains tenant-wide suppression when a matching opt-out Contact is unreadable', async () => {
    const optOut = await prisma.contact.create({ data: { tenantId, firstName: 'Opt', lastName: 'Out', assignedUserId: adminId, email: 'visible-lead@example.test', doNotContact: true } });
    try {
      await grant('contacts', { canView: false });
      const draft = await campaign();
      await expect(scope(() => sendCampaign(draft.id, tenantId, staffId))).rejects.toMatchObject({ statusCode: 400 });
      expect(sendMail).not.toHaveBeenCalled();
      expect((await prisma.campaign.findUniqueOrThrow({ where: { id: draft.id } })).status).toBe('DRAFT');
    } finally { await prisma.contact.delete({ where: { id: optOut.id } }); }
  });
  it('scopes related Deal personalization and refuses values from a revoked module', async () => {
    const deal = await prisma.deal.update({ where: { id: dealId }, data: { value: 250 } });
    const hidden = await prisma.deal.create({ data: { tenantId, title: 'Hidden value', value: 999, pipelineId: deal.pipelineId, stageId: deal.stageId,
      assignedUserId: adminId, leadDeals: { create: { leadId: ownLeadId } } } });
    const draft = () => scope(() => createCampaign(tenantId, staffId, { name: randomUUID(), type: 'EMAIL', audienceSource: 'LEADS', subject: 'Value {{value}}', body: 'Hello {{firstName}}' }));
    try {
      await scope(async () => sendCampaign((await draft()).id, tenantId, staffId));
      expect(sendMail).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ subject: 'Value 250' }));
      await grant('deals', { canView: false });
      const denied = await draft();
      await expect(scope(() => sendCampaign(denied.id, tenantId, staffId))).rejects.toMatchObject({ statusCode: 400 });
      expect(sendMail).toHaveBeenCalledTimes(1);
      expect(await prisma.campaignContact.count({ where: { campaignId: denied.id } })).toBe(0);
    } finally { await prisma.deal.delete({ where: { id: hidden.id } }); }
  });
  it('reevaluates scheduled recipients under the current sender scope', async () => {
    const draft = await campaign(), due = new Date(Date.now() + 60000);
    await scope(() => scheduleCampaign(draft.id, tenantId, staffId, { scheduledFor: due.toISOString() }));
    await prisma.lead.update({ where: { id: ownLeadId }, data: { assignedUserId: adminId } });
    const added = await prisma.lead.create({ data: { tenantId, firstName: 'New', lastName: 'Recipient', assignedUserId: staffId, email: 'new-scheduled@example.test' } });
    try {
      expect(await dispatchDueCampaigns(new Date(due.getTime() + 1))).toBe(1);
      await expect.poll(async () => (await prisma.campaign.findUniqueOrThrow({ where: { id: draft.id } })).submissionFinishedAt, { timeout: 10000 }).not.toBeNull();
      expect(sendMail).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ to: 'new-scheduled@example.test' }));
      expect((await prisma.campaignContact.findMany({ where: { campaignId: draft.id } })).map(row => row.leadId)).toEqual([added.id]);
    } finally {
      await prisma.lead.update({ where: { id: ownLeadId }, data: { assignedUserId: staffId } });
      await prisma.lead.delete({ where: { id: added.id } });
    }
  });
  it('rechecks scheduled sender access and leaves a denied campaign unsent with its existing failure reason', async () => {
    const draft = await campaign();
    const due = new Date(Date.now() + 60000);
    await scope(() => scheduleCampaign(draft.id, tenantId, staffId, { scheduledFor: due.toISOString() }));
    await grant('leads', { canView: false });
    expect(await dispatchDueCampaigns(new Date(due.getTime() + 1))).toBe(0);
    const saved = await prisma.campaign.findUniqueOrThrow({ where: { id: draft.id } });
    expect(saved.status).toBe('DRAFT'); expect(saved.scheduleConfig).toMatchObject({ scheduleFailureReason: expect.any(String) });
    expect(await prisma.campaignContact.count({ where: { campaignId: draft.id } })).toBe(0);
    expect(sendMail).not.toHaveBeenCalled();
  });
  it('redacts inaccessible Deal participants, singular aliases and address context without deleting links', async () => {
    for (const method of ['GET', 'PUT']) {
      const result = await call(`/crm/deals/${dealId}`, method, method === 'PUT' ? { title: 'Edited safely' } : undefined);
      expect(result.status, JSON.stringify(result.body)).toBe(200);
      expect(result.body.data).toMatchObject({ leadId: ownLeadId, contactId: ownContactId, addressSource: null,
        lead: { id: ownLeadId }, contact: { id: ownContactId } });
      expect(JSON.stringify(result.body)).not.toMatch(/Private|Secret address/);
      expect(JSON.stringify(result.body)).not.toContain(leadId); expect(JSON.stringify(result.body)).not.toContain(contactId);
    }
    await grant('leads', { canView: false }); await grant('contacts', { canView: false });
    const hidden = await call(`/crm/deals/${dealId}`, 'PUT', { title: 'Still editable' });
    expect(hidden.status).toBe(200);
    expect(hidden.body.data).toMatchObject({ leadId: null, contactId: null, lead: null, contact: null, leadDeals: [], contactDeals: [] });
    expect(await prisma.leadDeal.count({ where: { dealId } })).toBe(2);
    expect(await prisma.contactDeal.count({ where: { dealId } })).toBe(2);
  });
  it.each([false, true])('rejects an unreadable Workflow sample before evaluation (draft=%s)', async useDraft => {
    expect((await call(`/crm/leads/${leadId}`)).status).toBe(404);
    const result = await call(`/automation/workflows/${workflowId}/test`, 'POST', { entityId: leadId, useDraft });
    expect(result.status).toBe(404); expect(result.body.data).toBeUndefined();
    const visible = await call(`/automation/workflows/${workflowId}/test`, 'POST', { entityId: ownLeadId, useDraft });
    expect(visible.status, JSON.stringify(visible.body)).toBe(200);
    expect(visible.body.data.conditions.matched).toBe(false);
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: ownLeadId } })).firstName).toBe('Visible');
    expect(await prisma.workflowExecutionRun.count({ where: { workflowId } })).toBe(0);
  });
  it('enforces sample scope for direct Workflow service calls too', async () => {
    const { testWorkflow } = await import('../modules/automation/workflows/workflows.service');
    await expect(scope(() => testWorkflow(workflowId, tenantId, leadId, staffId))).rejects.toMatchObject({ statusCode: 404 });
    expect(crmActor.getStore()).toBeUndefined();
  });

  it.each(['create', 'update', 'archive', 'assign', 'unassign'] as const)('rolls back role %s after audit failure, then commits its audit on retry', async operation => {
    const old = await prisma.roleDefinition.create({ data: { tenantId, name: `Old ${randomUUID()}`, permissions: { create: { module: 'leads', canView: true, canViewMy: true } } } });
    const next = await prisma.roleDefinition.create({ data: { tenantId, name: `Next ${randomUUID()}` } });
    const user = await prisma.user.create({ data: { tenantId, firstName: 'Role', lastName: 'Fixture', email: `${randomUUID()}@camxian.com`, role: old.name,
      userRoles: { create: [{ roleId: old.id }, ...(operation === 'unassign' ? [{ roleId: next.id }] : [])] } } });
    const requests = {
      create: { path: '/administration/roles', method: 'POST', body: { name: `New ${randomUUID()}`, permissions: [] }, action: 'role.created' },
      update: { path: `/administration/roles/${old.id}`, method: 'PUT', body: { name: `Renamed ${randomUUID()}`, permissions: [{ module: 'deals', canView: true, canViewAll: true, canCreate: false, canEdit: false, canDelete: false }] }, action: 'role.updated' },
      archive: { path: `/administration/roles/${next.id}/archive`, method: 'PATCH', body: undefined, action: 'role.deleted' },
      assign: { path: '/administration/roles/assign', method: 'POST', body: { userId: user.id, roleId: next.id }, action: 'role.assigned' },
      unassign: { path: '/administration/roles/unassign', method: 'DELETE', body: { userId: user.id, roleId: next.id }, action: 'role.removed' },
    };
    const request = requests[operation];
    const snapshot = () => Promise.all([
      prisma.roleDefinition.findMany({ where: { tenantId }, orderBy: { id: 'asc' } }),
      prisma.rolePermission.findMany({ where: { tenantId }, orderBy: { id: 'asc' } }),
      prisma.user.findUnique({ where: { id: user.id } }),
      prisma.userRole.findMany({ where: { userId: user.id }, orderBy: { id: 'asc' } }),
      prisma.auditLog.count({ where: { tenantId } }),
    ]);
    const before = await snapshot();
    await prisma.$executeRawUnsafe(`CREATE FUNCTION qa_fail_role_audit() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'QA role audit failure'; END;$$`);
    await prisma.$executeRawUnsafe('CREATE TRIGGER qa_fail_role_audit BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION qa_fail_role_audit()');
    try {
      const failed = await call(request.path, request.method, request.body, adminToken);
      expect(failed.status, JSON.stringify(failed.body)).toBe(500);
      expect(await snapshot()).toEqual(before);
    } finally {
      await prisma.$executeRawUnsafe('DROP TRIGGER qa_fail_role_audit ON "AuditLog"');
      await prisma.$executeRawUnsafe('DROP FUNCTION qa_fail_role_audit()');
    }
    const result = await call(request.path, request.method, request.body, adminToken);
    expect(result.status, JSON.stringify(result.body)).toBe(operation === 'create' ? 201 : 200);
    expect(await prisma.auditLog.count({ where: { tenantId } })).toBe((before[4] as number) + 1);
    expect(await prisma.auditLog.findFirst({ where: { tenantId, action: request.action }, orderBy: { createdAt: 'desc' } })).toBeTruthy();
  });
});
