import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { EMPTY_PERMISSION_FLAGS, PERMISSION_MODULES, ARCHIVE_TYPES, type ArchiveType } from '@leadcrm/shared';
import prisma from '../../../../config/database.config';
import { tenantContext } from '../../../../core/tenant/tenant-context';
import { issueAuthSession } from '../../../../core/auth/auth-session';
import { crmActor } from '../../../crm/access/crm-record-access.service';
import { activeWorkflows, findWorkflowById } from '../../../automation/workflows/workflows.repository';
import app from '../../../../app';
import { dispatchDueCampaigns, drainCampaignSubmissions } from '../campaigns.service';
import { sendMail } from '../../../../shared/services/email.service';
vi.mock('express-rate-limit', async original => {
  const actual = await original<typeof import('express-rate-limit')>();
  return { ...actual, default: (options: Partial<import('express-rate-limit').Options>) =>
    actual.default({ ...options, limit: options.limit === 5 ? 100 : options.limit }) };
});
vi.mock('../../../../shared/services/email.service', async original => ({
  ...await original<object>(), assertBrevoConfigured: vi.fn(),
  sendMail: vi.fn(async () => ({ submitted: true, messageId: randomUUID() })),
}));
vi.mock('../../../notifications/notification-events.service', async original => ({
  ...await original<object>(), requestNotificationDispatch: vi.fn(),
}));
const url = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid/');
const disposable = ['127.0.0.1', 'localhost'].includes(url.hostname) && /^[/]leadcrm_campaign_test_[0-9]+$/.test(url.pathname);
describe.skipIf(!disposable)('role visibility through authenticated HTTP and real PostgreSQL', () => {
  let tenantId: string, foreignTenant: string, server: Server, base: string;
  let a: any, b: any, admin: any, foreignAdmin: any, denied: any;
  let ca: any, cb: any, cf: any, wa: any, wb: any, wf: any, group: any, otherGroup: any;
  const scope = <T>(work: () => T) => tenantContext.run({ tenantId }, work);
  const as = <T>(user: any, work: () => T) => scope(() => crmActor.run({ tenantId, userId: user.id }, async () => await work()));
  const call = async (user: any, path: string, method = 'GET', body?: unknown) => {
    const res = await fetch(base + path, { method, headers: { Authorization: 'Bearer ' + user.token, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: res.status, body: await res.json() };
  };
  async function user(tenant: string, role: string) {
    const row = await prisma.user.create({ data: { tenantId: tenant, role, firstName: 'Visibility', lastName: role,
      email: randomUUID() + '@camxian.com', mustChangePassword: false, emailVerified: new Date(), onboardingCompletedAt: new Date() } });
    return { ...row, token: (await issueAuthSession(row)).token };
  }
  const campaign = (owner: any, name: string) => prisma.campaign.create({ data: { tenantId: owner.tenantId, createdById: owner.id, name, type: 'EMAIL',
    audienceSource: 'LEADS', subject: 'Hello', body: 'Hello', sentCount: 3 } });
  const workflow = (owner: any, name: string) => prisma.workflow.create({ data: { tenantId: owner.tenantId, createdById: owner.id, name,
    trigger: 'lead.created', actions: [], isActive: false, status: 'DRAFT' } });
  beforeAll(async () => {
    vi.stubEnv('BREVO_FROM_EMAIL', 'fixture-sender@example.test');
    tenantId = (await prisma.tenant.create({ data: { name: 'Visibility', slug: randomUUID(), status: 'ACTIVE', onboardingCompletedAt: new Date(), onboardingStep: 3 } })).id;
    foreignTenant = (await prisma.tenant.create({ data: { name: 'Foreign visibility', slug: randomUUID(), status: 'ACTIVE', onboardingCompletedAt: new Date(), onboardingStep: 3 } })).id;
    admin = await user(tenantId, 'Client Admin'); foreignAdmin = await user(foreignTenant, 'Client Admin');
    const role = await scope(() => prisma.roleDefinition.create({ data: { tenantId, name: 'Full custom staff', permissions: { create:
      PERMISSION_MODULES.map(module => ({ ...EMPTY_PERMISSION_FLAGS, module: module.key, ...Object.fromEntries(module.actions.map(action => [action, true])) })) } } }));
    a = await user(tenantId, role.name); b = await user(tenantId, role.name); denied = await user(tenantId, 'No grants');
    await scope(() => prisma.userRole.createMany({ data: [a, b].map(row => ({ tenantId, roleId: role.id, userId: row.id })) }));
    ca = await campaign(a, 'Owned campaign'); cb = await campaign(b, 'Other campaign'); cf = await campaign(foreignAdmin, 'Foreign campaign');
    wa = await workflow(a, 'Owned workflow'); wb = await workflow(b, 'Other workflow'); wf = await workflow(foreignAdmin, 'Foreign workflow');
    group = await scope(() => prisma.tenantGroup.create({ data: { tenantId, name: 'Member group' } }));
    otherGroup = await scope(() => prisma.tenantGroup.create({ data: { tenantId, name: 'Nonmember group' } }));
    await scope(() => prisma.tenantGroupMember.createMany({ data: [{ tenantId, groupId: group.id, userId: a.id }, { tenantId, groupId: otherGroup.id, userId: b.id }] }));
    for (const owner of [a, b, foreignAdmin]) {
      await prisma.lead.create({ data: { tenantId: owner.tenantId, firstName: 'Recipient', lastName: owner.id, assignedUserId: owner.id, email: randomUUID() + '@example.test', companyName: owner.id } });
      await prisma.contact.create({ data: { tenantId: owner.tenantId, firstName: 'Recipient', lastName: owner.id, assignedUserId: owner.id, email: randomUUID() + '@example.test', companyName: owner.id } });
    }
    await scope(() => prisma.lead.create({ data: { tenantId, firstName: 'Unassigned', lastName: 'Hidden', email: 'unassigned@example.test' } }));
    await scope(() => prisma.contact.create({ data: { tenantId, firstName: 'Opted', lastName: 'Out', assignedUserId: a.id, email: 'opted@example.test', doNotContact: true } }));
    server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
    base = 'http://127.0.0.1:' + (server.address() as { port: number }).port + '/api/v1';
  }, 30000);
  afterAll(async () => { await drainCampaignSubmissions(); if (server) await new Promise<void>(done => server.close(() => done())); await prisma.$disconnect(); });
  it('uses identical campaign ownership for lists, pagination, metrics and reporting', async () => {
    for (const suffix of ['', '?search=campaign&sort=name:asc&limit=1', '?type=EMAIL&status=DRAFT']) {
      const res = await call(a, '/marketing/campaigns' + suffix);
      expect(res.status, JSON.stringify(res.body)).toBe(200); expect(res.body.meta.total).toBe(1); expect(res.body.data.map((r: any) => r.id)).toEqual([ca.id]);
    }
    expect((await call(admin, '/marketing/campaigns')).body.meta.total).toBe(2);
    expect((await call(a, '/marketing/campaigns/metrics')).body.data.sent).toBe(3);
    expect((await call(a, '/reporting/campaign-summary')).body.data.map((r: any) => r.id)).toEqual([ca.id]);
    expect((await call(denied, '/marketing/campaigns')).status).toBe(403);
  });
  it.each(['', '/report', '/duplicate', '/archive', '/send', '/schedule'])('blocks foreign campaign direct action %s', async suffix => {
    const method = suffix === '/duplicate' ? 'POST' : ['/archive', '/send', '/schedule'].includes(suffix) ? 'PATCH' : 'GET';
    for (const [actor, record] of [[a, cb], [a, cf], [admin, cf]]) {
      const res = await call(actor, '/marketing/campaigns/' + record.id + suffix, method,
        suffix === '/schedule' ? { scheduledFor: new Date(Date.now() + 3600000).toISOString() } : method === 'POST' ? {} : undefined);
      expect(res.status, JSON.stringify(res.body)).toBe(404);
    }
  });
  it('blocks schedule cancellation by noncreators and foreign-tenant administrators', async () => {
    for (const [actor, row] of [[a, cb], [a, cf], [admin, cf]]) {
      expect((await call(actor, '/marketing/campaigns/' + row.id + '/schedule', 'DELETE')).status).toBe(404);
    }
  });
  it.each(['LEADS', 'CONTACTS'] as const)('scopes %s previews, OR conditions, counts and company suggestions to assignment', async source => {
    const res = await call(a, '/marketing/audiences/preview', 'POST', { source, page: 1, limit: 1, conditions: [] });
    expect(res.status, JSON.stringify(res.body)).toBe(200); expect(res.body.data.eligible).toBe(1);
    expect(res.body.data.recipients.map((r: any) => r.name)).toEqual(['Recipient ' + a.id]); expect(res.body.data.meta.total).toBe(1);
    const tampered = await call(a, '/marketing/audiences/preview', 'POST', { source, matchMode: 'OR',
      conditions: [{ field: 'assignedUserId', operator: 'equals', value: b.id }] });
    expect(tampered.status, JSON.stringify(tampered.body)).toBe(200); expect(tampered.body.data.eligible).toBe(0);
    const all = await call(admin, '/marketing/audiences/preview', 'POST', { source, conditions: [] });
    expect(all.body.data.eligible).toBe(source === 'LEADS' ? 3 : 2);
    const companies = await call(a, '/marketing/audiences/companies?source=' + source);
    expect(companies.body.data).toEqual([a.id]);
    expect((await call(a, '/marketing/audiences/preview', 'POST', { source, recipientIds: [b.id] })).status).toBe(400);
  });
  it('rejects forged creators and records the current workflow creator when creating or duplicating', async () => {
    expect((await call(a, '/marketing/campaigns', 'POST', { name: 'Forged', type: 'EMAIL', audienceSource: 'LEADS', createdById: b.id })).status).toBe(400);
    const draft = { name: 'Created ownership', trigger: 'lead.created', actions: [], isActive: false };
    expect((await call(a, '/automation/workflows', 'POST', { ...draft, createdById: b.id })).status).toBe(400);
    const made = await call(a, '/automation/workflows', 'POST', draft);
    expect(made.status, JSON.stringify(made.body)).toBe(201); expect(made.body.data.createdById).toBe(a.id);
    const copy = await call(a, '/automation/workflows/' + made.body.data.id + '/duplicate', 'POST', {});
    expect(copy.status, JSON.stringify(copy.body)).toBe(201); expect(copy.body.data.createdById).toBe(a.id);
  });
  it('rechecks assignment at actual scheduled dispatch without a logged-in browser session', async () => {
    const company = 'Scheduled ownership ' + randomUUID();
    const leads = await scope(async () => Promise.all([a, b].map(owner => prisma.lead.create({ data: {
      tenantId, firstName: 'Scheduled', lastName: owner.id, assignedUserId: owner.id, companyName: company, email: randomUUID() + '@example.test',
    } }))));
    const audience = await call(a, '/marketing/audiences', 'POST', { name: company, source: 'LEADS',
      conditions: [{ field: 'companyName', operator: 'equals', value: company }] });
    expect(audience.status, JSON.stringify(audience.body)).toBe(201);
    const made = await call(a, '/marketing/campaigns', 'POST', { name: company, type: 'EMAIL',
      targetAudienceId: audience.body.data.id, subject: 'Hello', body: 'Hello' });
    expect(made.status, JSON.stringify(made.body)).toBe(201);
    const scheduled = await call(a, '/marketing/campaigns/' + made.body.data.id + '/schedule', 'PATCH', {
      scheduledFor: new Date(Date.now() + 3600000).toISOString(),
    });
    expect(scheduled.status, JSON.stringify(scheduled.body)).toBe(200);
    // Only the originally unauthorized person is assigned to the sender at dispatch.
    await scope(async () => {
      await prisma.lead.update({ where: { id: leads[0].id }, data: { assignedUserId: b.id } });
      await prisma.lead.update({ where: { id: leads[1].id }, data: { assignedUserId: a.id } });
    });
    vi.mocked(sendMail).mockClear();
    await dispatchDueCampaigns(new Date(Date.now() + 7200000));
    await vi.waitFor(async () => {
      const finished = await prisma.campaign.findUniqueOrThrow({ where: { id: made.body.data.id }, select: { submissionFinishedAt: true } });
      expect(finished.submissionFinishedAt).not.toBeNull();
    }, { timeout: 10000 });
    const recipients = await prisma.campaignContact.findMany({ where: { campaignId: made.body.data.id, status: { not: 'excluded' } } });
    const persisted = await prisma.campaign.findUnique({ where: { id: made.body.data.id }, select: { status: true, scheduleConfig: true, recipientCount: true } });
    expect(recipients.map(r => r.leadId), JSON.stringify(persisted)).toEqual([leads[1].id]);
    expect(vi.mocked(sendMail)).toHaveBeenCalledTimes(1);
  });
  it('scopes workflow counts and preserves tenant-scoped internal discovery', async () => {
    const res = await call(b, '/automation/workflows?sort=name:asc');
    expect(res.status, JSON.stringify(res.body)).toBe(200); expect(res.body.meta.total).toBe(1); expect(res.body.data[0].id).toBe(wb.id);
    await scope(() => prisma.workflow.update({ where: { id: wb.id }, data: { isActive: true, status: 'ACTIVE' } }));
    const internal = await as(a, () => activeWorkflows(tenantId, 'lead.created'));
    expect(internal.map(r => r.id)).toContain(wb.id);
    expect((await as(a, () => findWorkflowById(wb.id, tenantId)))?.id).toBe(wb.id);
  });
  it.each(['', '/executions', '/versions', '/duplicate', '/archive', '/toggle', '/test', '/versions/1/restore', '/draft', '/publish'])('protects workflow action %s', async suffix => {
    const method = ['/duplicate', '/test', '/versions/1/restore', '/publish'].includes(suffix) ? 'POST'
      : ['/archive', '/toggle'].includes(suffix) ? 'PATCH' : suffix === '/draft' ? 'PUT' : 'GET';
    const body = suffix === '/toggle' ? { isActive: false } : suffix === '/test' ? { entityId: randomUUID() }
      : ['/draft', '/publish'].includes(suffix) ? { draft: { name: 'Attempt', trigger: 'lead.created', actions: [], isActive: false }, expectedVersion: 1, expectedDraftRevision: 0 }
      : suffix === '/versions/1/restore' ? { expectedVersion: 1, expectedDraftRevision: 0 } : method === 'POST' ? {} : undefined;
    for (const [actor, record] of [[a, wb], [a, wf], [admin, wf]]) {
      const res = await call(actor, '/automation/workflows/' + record.id + suffix, method, body);
      expect(res.status, JSON.stringify(res.body)).toBe(404);
    }
  });
  it('guards workflow validation IDs and update IDs', async () => {
    expect((await call(a, '/automation/workflows/validate', 'POST', { name: 'Attempt', trigger: 'lead.created', actions: [], isActive: false, workflowId: wb.id })).status).toBe(404);
    expect((await call(a, '/automation/workflows/' + wb.id, 'PUT', { name: 'Attempt' })).status).toBe(404);
    expect((await call(a, '/marketing/campaigns/' + cb.id, 'PUT', { name: 'Attempt' })).status).toBe(404);
  });
  it('filters Groups by actual membership without creating membership or granting writes', async () => {
    const res = await call(a, '/administration/groups'); expect(res.body.data.map((r: any) => r.id)).toEqual([group.id]);
    expect((await call(admin, '/administration/groups')).body.data).toHaveLength(2);
    const options = await call(a, '/automation/workflow-options');
    expect(options.status, JSON.stringify(options.body)).toBe(200);
    expect(options.body.data.groups.map((row: any) => row.id)).toEqual([group.id]);
    expect((await call(admin, '/automation/workflow-options')).body.data.groups).toHaveLength(2);
    expect((await call(a, '/administration/groups/' + otherGroup.id, 'PUT', { name: 'Attempt' })).status).toBe(404);
    expect((await call(a, '/administration/groups/' + otherGroup.id, 'DELETE')).status).toBe(404);
    expect((await call(a, '/administration/groups/' + group.id + '/members', 'POST', { userId: b.id })).status).toBe(403);
    const made = await call(a, '/administration/groups', 'POST', { name: 'Created without membership' });
    expect(made.status).toBe(201);
    expect(await prisma.tenantGroupMember.count({ where: { groupId: made.body.data.id } })).toBe(0);
    expect((await call(a, '/administration/groups')).body.data.some((r: any) => r.id === made.body.data.id)).toBe(false);
    await scope(() => prisma.tenantGroupMember.deleteMany({ where: { groupId: group.id, userId: a.id } }));
    expect((await call(a, '/administration/groups')).body.data).toEqual([]);
    expect((await call(a, '/automation/workflow-options')).body.data.groups).toEqual([]);
    expect((await call(a, '/administration/groups/' + group.id, 'PUT', { name: 'Revoked' })).status).toBe(404);
  });
  const archives = new Map<ArchiveType, { own: any; other: any; unknown: any }>();
  it('prepares archives for every supported type using real ownership transitions', async () => {
    const pipeline = await scope(() => prisma.pipeline.create({ data: { tenantId, name: 'Archive pipeline' } }));
    const stage = await scope(() => prisma.stage.create({ data: { tenantId, pipelineId: pipeline.id, name: 'Stage', order: 0 } }));
    for (const type of ARCHIVE_TYPES) {
      const rows: any[] = [];
      for (const owner of [a, b, null]) {
        const label = 'Archive visibility ' + type + ' ' + (owner?.id ?? 'unknown');
        const delegate = (prisma as any)[type === 'Product' ? 'productInterest' : type.toLowerCase()];
        const data = { tenantId, ...(type === 'User' ? { email: randomUUID() + '@camxian.com', role: 'Inactive fixture', firstName: label, lastName: 'Fixture' }
          : ['Lead', 'Contact'].includes(type) ? { firstName: label, lastName: 'Fixture', assignedUserId: a.id }
          : type === 'Deal' ? { title: label, pipelineId: pipeline.id, stageId: stage.id, assignedUserId: a.id, tags: [], productInterests: [] }
          : type === 'Task' ? { title: label, assignedUserId: a.id, dueDate: new Date() }
          : type === 'Campaign' ? { name: label, type: 'EMAIL', audienceSource: 'LEADS', createdById: a.id }
          : type === 'Workflow' ? { name: label, trigger: 'lead.created', actions: [], createdById: a.id }
          : type === 'Product' ? { name: label, dealValue: 10 } : { name: label }) };
        const row = await scope(() => delegate.create({ data }));
        const archiveData = type === 'User' ? { status: 'INACTIVE' } : type === 'Product' ? { active: false }
          : { isArchived: true, ...(['Lead', 'Contact', 'Account'].includes(type) ? { deletedBy: owner?.id ?? null, deletedAt: new Date() } : {}) };
        await (owner ? as(owner, () => prisma.$transaction(async tx => {
          await (tx as any)[type === 'Product' ? 'productInterest' : type.toLowerCase()].update({ where: { id: row.id }, data: archiveData });
          if (type === 'Task') await tx.auditLog.create({ data: { tenantId, userId: owner.id, action: 'task.archived', entityType: 'Task', entityId: row.id } });
        }))
          : scope(() => delegate.update({ where: { id: row.id }, data: archiveData })));
        rows.push(row);
      }
      archives.set(type, { own: rows[0], other: rows[1], unknown: rows[2] });
    }
  });
  it.each(ARCHIVE_TYPES)('filters %s archives consistently across every sort and direct restoration', async type => {
    const rows = archives.get(type)!;
    for (const sortBy of ['archivedAt', 'name', 'type', 'detail']) {
      const path = '/administration/archived-data?type=' + type + '&search=Archive%20visibility&limit=1&sortBy=' + sortBy;
      const res = await call(a, path);
      expect(res.status, JSON.stringify(res.body)).toBe(200); expect(res.body.meta.total).toBe(1); expect(res.body.data[0].id).toBe(rows.own.id);
      expect((await call(admin, path)).body.meta.total).toBe(3);
    }
    const restoreBase = ({ Lead: '/crm/leads/', Contact: '/crm/contacts/', Account: '/crm/accounts/', Deal: '/crm/deals/', User: '/administration/users/' } as Partial<Record<ArchiveType, string>>)[type] ?? '/administration/archived-data/' + type + '/';
    const denied = await call(a, restoreBase + rows.other.id + '/restore', 'PATCH');
    expect(denied.status, JSON.stringify(denied.body)).toBe(404);
    const unknown = await call(a, restoreBase + rows.unknown.id + '/restore', 'PATCH'); expect(unknown.status).toBe(404);
    const restored = await call(a, restoreBase + rows.own.id + '/restore', 'PATCH');
    expect(restored.status, JSON.stringify(restored.body)).toBe(200);
    const model = type === 'Product' ? 'productInterest' : type.toLowerCase();
    const saved = await (prisma as any)[model].findUniqueOrThrow({ where: { id: rows.own.id } });
    if (type === 'User') expect(saved.status).not.toBe('INACTIVE');
    else if (type === 'Product') expect(saved.active).toBe(true);
    else expect(saved.isArchived).toBe(false);
    if ('assignedUserId' in saved) expect(saved.assignedUserId).toBe(a.id);
    // Keep the same fixtures archived for subsequent source-query/cycle assertions.
    await as(a, () => prisma.$transaction(async tx => {
      await (tx as any)[model].update({ where: { id: rows.own.id }, data: type === 'User' ? { status: 'INACTIVE' }
        : type === 'Product' ? { active: false } : { isArchived: true,
          ...(['Lead', 'Contact', 'Account'].includes(type) ? { deletedBy: a.id, deletedAt: new Date() } : {}) } });
      if (type === 'Task') await tx.auditLog.create({ data: { tenantId, userId: a.id, action: 'task.archived', entityType: 'Task', entityId: rows.own.id } });
    }));

  });
  it('protects source archived queries, aliases and user status/bulk reactivation', async () => {
    const paths = [
      '/crm/leads?archived=true', '/crm/contacts?archived=true', '/crm/accounts?archived=true',
      '/crm/deals?archived=true', '/operations/tasks?archived=true',
      '/marketing/campaigns?archived=true', '/automation/workflows?archived=true',
    ];
    for (const path of paths) {
      const res = await call(a, path);
      expect(res.status, JSON.stringify({ path, ...res })).toBe(200);
      const returned = JSON.stringify(res.body.data);
      for (const rows of archives.values()) { expect(returned).not.toContain(rows.other.id); expect(returned).not.toContain(rows.unknown.id); }
    }
    expect((await call(a, '/crm/companies/' + archives.get('Account')!.other.id + '/restore', 'PATCH')).status).toBe(404);
    const other = archives.get('User')!.other;
    expect((await call(a, '/administration/users/' + other.id, 'PUT', { status: 'ACTIVE' })).status).toBe(404);
    expect((await call(a, '/administration/users/bulk-update', 'POST', { ids: [other.id], status: 'ACTIVE' })).status).toBe(404);
  });
  it('keeps unknown creators admin-only and does not replace archive ownership on repeated archive attempts', async () => {
    const legacy = await scope(() => prisma.workflow.create({ data: { tenantId, name: 'Unknown creator', trigger: 'lead.created', actions: [] } }));
    expect((await call(a, '/automation/workflows/' + legacy.id)).status).toBe(404);
    expect((await call(admin, '/automation/workflows/' + legacy.id)).status).toBe(200);
    const row = archives.get('Account')!.other;
    expect((await call(a, '/crm/accounts/' + row.id + '/archive', 'PATCH')).status).toBe(404);
    expect((await prisma.account.findUniqueOrThrow({ where: { id: row.id } })).deletedBy).toBe(b.id);
  });
  it('allows owned restoration and requires new ownership after a later archive cycle', async () => {
    const row = archives.get('Campaign')!.own;
    const path = '/administration/archived-data/Campaign/' + row.id + '/restore';
    const restored = await call(a, path, 'PATCH'); expect(restored.status, JSON.stringify(restored.body)).toBe(200);
    await as(admin, () => prisma.campaign.update({ where: { id: row.id }, data: { isArchived: true } }));
    expect((await call(a, path, 'PATCH')).status).toBe(404);
    expect((await call(admin, path, 'PATCH')).status).toBe(200);
  });
  it('protects legacy recovery types and keeps cross-tenant admin restoration blocked', async () => {
    const pipeline = await scope(() => prisma.pipeline.create({ data: { tenantId, name: 'Legacy recovery' } }));
    await as(b, () => prisma.pipeline.update({ where: { id: pipeline.id }, data: { isArchived: true } }));
    const pp = '/administration/archived-data/Pipeline/' + pipeline.id + '/restore';
    expect((await call(a, pp, 'PATCH')).status).toBe(404);
    expect((await call(admin, pp, 'PATCH')).status).toBe(200);
    const template = await scope(() => prisma.template.create({ data: { tenantId, name: 'Legacy template', type: 'Email', content: 'Hello' } }));
    await as(b, () => prisma.template.update({ where: { id: template.id }, data: { isArchived: true } }));
    expect((await call(a, '/administration/archived-data/Template/' + template.id + '/restore', 'PATCH')).status).toBe(404);
    expect((await call(foreignAdmin, '/administration/archived-data/Template/' + template.id + '/restore', 'PATCH')).status).toBe(404);
    expect((await call(b, '/administration/archived-data/Template/' + template.id + '/restore', 'PATCH')).status).toBe(200);
  });
  it('hides ambiguous historical archivers and stale metadata from previous archive cycles', async () => {
    const historical = await scope(() => prisma.workflow.create({ data: { tenantId, createdById: a.id, name: 'Ambiguous archive', trigger: 'lead.created', actions: [], isArchived: true } }));
    const at = new Date('2026-01-01');
    await prisma.auditLog.createMany({ data: [a, b].map(owner => ({ tenantId, userId: owner.id, entityType: 'Workflow', entityId: historical.id, action: 'workflow.archived', createdAt: at })) });
    const res = await call(a, '/administration/archived-data?type=Workflow&search=Ambiguous');
    expect(res.body.meta.total).toBe(0);
    expect((await call(admin, '/administration/archived-data?type=Workflow&search=Ambiguous')).body.meta.total).toBe(1);
    const lead = await scope(() => prisma.lead.create({ data: { tenantId, firstName: 'Stale archive cycle', lastName: 'Fixture', assignedUserId: a.id, isArchived: true, deletedAt: new Date('2026-02-01') } }));
    await prisma.auditLog.create({ data: { tenantId, userId: a.id, entityType: 'Lead', entityId: lead.id, action: 'lead.archived', createdAt: at } });
    expect((await call(a, '/administration/archived-data?type=Lead&search=Stale')).body.meta.total).toBe(0);
  });
  it('serializes competing owned restores without transferring ownership or duplicating transitions', async () => {
    const product = await scope(() => prisma.productInterest.create({ data: { tenantId, name: 'Competing owned recovery', dealValue: 1 } }));
    await as(a, () => prisma.productInterest.update({ where: { id: product.id }, data: { active: false } }));
    const path = '/administration/archived-data/Product/' + product.id + '/restore';
    const attempts = await Promise.all([call(a, path, 'PATCH'), call(a, path, 'PATCH')]);
    expect(attempts.map(result => result.status).sort()).toEqual([200, 404]);
    expect(await prisma.auditLog.count({ where: { tenantId, entityId: product.id, action: 'archive.restored' } })).toBe(1);
  });
  it('requires existing assignment visibility in addition to being the proven archiver', async () => {
    const role = await scope(() => prisma.roleDefinition.create({ data: { tenantId, name: 'Restricted archive reader', crmAssignmentRestricted: true,
      permissions: { create: [{ module: 'leads', canView: true, canViewMy: true, canArchive: true },
        { module: 'archived_data', canView: true, canRestore: true }] } } }));
    const restricted = await user(tenantId, role.name);
    await scope(() => prisma.userRole.create({ data: { tenantId, userId: restricted.id, roleId: role.id } }));
    const lead = await scope(() => prisma.lead.create({ data: { tenantId, firstName: 'Assignment boundary', lastName: 'Fixture',
      assignedUserId: restricted.id, isArchived: true, deletedBy: restricted.id, deletedAt: new Date() } }));
    expect((await call(restricted, '/administration/archived-data?type=Lead&search=Assignment%20boundary')).body.meta.total).toBe(1);
    await scope(() => prisma.lead.update({ where: { id: lead.id }, data: { assignedUserId: b.id } }));
    expect((await call(restricted, '/administration/archived-data?type=Lead&search=Assignment%20boundary')).body.meta.total).toBe(0);
    expect((await call(restricted, '/crm/leads/' + lead.id + '/restore', 'PATCH')).status).toBe(404);
  });
  it('rolls back archive state if its transactional ownership audit fails', async () => {
    const row = await scope(() => prisma.campaign.create({ data: { tenantId, createdById: a.id, name: 'Rollback archive', type: 'EMAIL' } }));
    await expect(as(a, () => prisma.$transaction(async tx => {
      await tx.campaign.update({ where: { id: row.id }, data: { isArchived: true } });
      throw new Error('Rollback fixture');
    }))).rejects.toThrow('Rollback fixture');
    expect((await prisma.campaign.findUniqueOrThrow({ where: { id: row.id } })).isArchived).toBe(false);
    expect(await prisma.auditLog.count({ where: { entityId: row.id, action: 'archive.archived' } })).toBe(0);
  });
  it('requires Restore permission on an owned user reactivation alias', async () => {
    const role = await scope(() => prisma.roleDefinition.create({ data: { tenantId, name: 'Activator without restore',
      permissions: { create: [{ module: 'users', canView: true, canActivate: true },
        { module: 'archived_data', canView: true, canRestore: false }] } } }));
    const activator = await user(tenantId, role.name), target = await user(tenantId, 'Inactive target');
    await scope(() => prisma.userRole.create({ data: { tenantId, userId: activator.id, roleId: role.id } }));
    await as(activator, () => prisma.user.update({ where: { id: target.id }, data: { status: 'INACTIVE' } }));
    const result = await call(activator, '/administration/users/' + target.id, 'PUT', { status: 'ACTIVE' });
    expect(result.status, JSON.stringify(result.body)).toBe(403);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: target.id } })).status).toBe('INACTIVE');
  });
  it('records every Product removed by an authenticated bulk catalog archive', async () => {
    const products = await scope(() => Promise.all([0, 1].map(index => prisma.productInterest.create({
      data: { tenantId, name: 'Bulk archive evidence ' + index, dealValue: 1 },
    }))));
    const response = await call(a, '/administration/product-interests', 'DELETE');
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    for (const product of products) {
      expect((await prisma.productInterest.findUniqueOrThrow({ where: { id: product.id } })).active).toBe(false);
      expect(await prisma.auditLog.count({ where: { tenantId, userId: a.id, entityType: 'Product',
        entityId: product.id, action: 'archive.archived' } })).toBe(1);
    }
  });

  it('retains workflow creator access during archive recovery after administrative access is lost', async () => {
    for (const createdById of [b.id, null]) {
      const row = await scope(() => prisma.workflow.create({ data: { tenantId, createdById, name: 'Creator boundary ' + randomUUID(),
        trigger: 'lead.created', actions: [], isArchived: true } }));
      await prisma.auditLog.create({ data: { tenantId, userId: a.id, action: 'workflow.archived', entityType: 'Workflow', entityId: row.id } });
      expect((await call(a, '/administration/archived-data?type=Workflow&search=' + encodeURIComponent(row.name))).body.meta.total).toBe(0);
      expect((await call(a, '/administration/archived-data/Workflow/' + row.id + '/restore', 'PATCH')).status).toBe(404);
      expect((await call(admin, '/administration/archived-data?type=Workflow&search=' + encodeURIComponent(row.name))).body.meta.total).toBe(1);
    }
  });

});
