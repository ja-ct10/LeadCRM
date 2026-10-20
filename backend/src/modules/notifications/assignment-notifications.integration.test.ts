import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import prisma from '../../config/database.config';
import app from '../../app';
import { issueAuthSession } from '../../core/auth/auth-session';
import { tenantContext } from '../../core/tenant/tenant-context';
import { salesPipeline, salesTransaction } from '../crm/leads/lead-automation.service';
import { deactivateUser } from '../administration/users/user-deactivation.service';
import { dispatchTenantNotifications } from './notification-events.service';
import { presentAssignmentActivities } from './assignment-presentation';

const url = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid/');
const modules = ['Lead', 'Contact', 'Deal', 'Task'] as const;
type Module = typeof modules[number];
describe.skipIf(url.hostname !== '127.0.0.1' || url.pathname !== '/leadcrm_forms_test_2')('Assignment names on disposable PostgreSQL and authenticated HTTP', () => {
  let tenantId: string, roleId: string, adminId: string, nextId: string, adminToken: string, nextToken: string;
  let pipelineId: string, stageId: string, server: Server, base: string;
  const newUser = (firstName: string, role = 'Sales', tenant = tenantId) => prisma.user.create({ data: {
    tenantId: tenant, firstName, lastName: role === 'Client Admin' ? 'Admin' : 'Agent', role,
    email: randomUUID() + '@camxian.com', mustChangePassword: false, onboardingCompletedAt: new Date(),
    ...(tenant === tenantId && role === 'Sales' ? { userRoles: { create: { roleId } } } : {}),
  } });
  const drain = async () => { for (let i = 0; i < 30; i++) if (!(await dispatchTenantNotifications(tenantId, new Date(Date.now() + 1000), 100)).claimed) break; };
  const request = async (path: string, method = 'GET', body?: unknown, auth = adminToken) => {
    const response = await fetch(base + path, { method, headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json() };
  };
  const notices = (id: string) => prisma.notification.findMany({ where: { tenantId, entityId: id } });
  const events = (id: string) => prisma.notificationEvent.findMany({ where: { tenantId, entityId: id, eventKey: { startsWith: 'assignment:' } } });
  const record = async (module: Module, owner: string) => {
    const scope = { tenantId, assignedUserId: owner };
    if (module === 'Lead') return prisma.lead.create({ data: { ...scope, firstName: 'Record', lastName: 'Lead', email: randomUUID() + '@example.test', createdById: adminId } });
    if (module === 'Contact') return prisma.contact.create({ data: { ...scope, firstName: 'Record', lastName: 'Contact', email: randomUUID() + '@example.test' } });
    if (module === 'Deal') return prisma.deal.create({ data: { ...scope, title: 'Record Deal', pipelineId, stageId } });
    const deal = await prisma.deal.create({ data: { tenantId, assignedUserId: nextId, title: 'Task context', pipelineId, stageId } });
    return prisma.task.create({ data: { ...scope, title: 'Record Task', dueDate: new Date(Date.now() + 7 * 86400000), assignedById: adminId, createdById: adminId,
      dealLinks: { create: { dealId: deal.id, position: 0 } } } });
  };
  const path = (module: Module, id: string) => module === 'Task' ? '/operations/tasks/' + id : '/crm/' + ({ Lead: 'leads', Contact: 'contacts', Deal: 'deals' } as const)[module] + '/' + id;
  const history = (module: Module, id: string) => prisma.activity.findMany({ where: { tenantId, [`${module.toLowerCase()}Id`]: id } });

  beforeAll(async () => {
    tenantId = (await prisma.tenant.create({ data: { name: 'Assignment context', slug: randomUUID(), onboardingCompletedAt: new Date(), onboardingStep: 3 } })).id;
    roleId = (await prisma.roleDefinition.create({ data: { tenantId, name: 'Sales', permissions: { create: ['leads', 'contacts', 'accounts', 'deals', 'tasks'].map(module => ({ module, canView: true, canEdit: true, canCreate: true,
      ...(['leads', 'contacts', 'accounts', 'deals'].includes(module) ? { canViewAll: true, canViewMy: true } : {}) })) } } })).id;
    const admin = await newUser('Actual', 'Client Admin'); adminId = admin.id; adminToken = (await issueAuthSession(admin)).token;
    const adminRole = await prisma.roleDefinition.create({ data: { tenantId, name: 'Client Admin', isSystemRole: true } });
    await prisma.userRole.create({ data: { tenantId, userId: adminId, roleId: adminRole.id } });
    const next = await newUser('Next'); nextId = next.id; nextToken = (await issueAuthSession(next)).token;
    const pipeline = await salesTransaction(tx => salesPipeline(tx, tenantId)); pipelineId = pipeline.pipeline.id; stageId = pipeline.initial.id;
    server = app.listen(0, '127.0.0.1'); await new Promise<void>(done => server.once('listening', done));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1`;
  });
  afterAll(async () => { if (server) await new Promise<void>(done => server.close(() => done())); await prisma.$disconnect(); });

  it('rejects Account assignment, preserves historical activity and emits no assignment on edit or deactivation', async () => {
    const old = await newUser('Previous');
    const account = await prisma.account.create({ data: { tenantId, name: 'Shared Account' } });
    const activity = await prisma.activity.create({ data: { tenantId, accountId: account.id, createdById: adminId,
      type: 'assignment', title: 'Historical Account assignment', metadata: { newAssignedUserId: old.id } } });
    const rejected = await request('/crm/accounts/' + account.id, 'PUT', { assignedUserId: nextId });
    expect(rejected.status).toBe(400);
    expect(rejected.body.error).toContain('retired');
    expect((await request('/crm/accounts/' + account.id, 'PUT', { name: 'Updated shared Account' }, nextToken)).status).toBe(200);
    expect((await request('/administration/users/' + old.id + '/deactivate', 'POST', { replacementAgentId: nextId })).status).toBe(200);
    await drain();
    expect(await events(account.id)).toHaveLength(0);
    expect(await notices(account.id)).toHaveLength(0);
    expect(await prisma.activity.findUnique({ where: { id: activity.id } })).toEqual(activity);
  });

  it.each(modules)('persists the replacement, previous agent, deactivation reason and distinct actor for %s', async module => {
    const old = await newUser('Previous'), row = await record(module, old.id);
    const result = await request('/administration/users/' + old.id + '/deactivate', 'POST', { replacementAgentId: nextId });
    expect(result.status).toBe(200); await drain();
    const content = { title: 'Assigned Agent changed to Next Agent', body: 'Ownership transferred because Previous Agent was deactivated. The record is now assigned to Next Agent.' };
    const stored = (await notices(row.id)).find(notice => notice.userId === nextId)!;
    expect(stored).toMatchObject(content);
    expect((await events(row.id))[0]).toMatchObject({ actorId: adminId, ownerId: nextId, payload: {
      assignmentChanged: true, previousAssignedUserId: old.id, newAssignedUserId: nextId, previousAssignedName: 'Previous Agent', assignedName: 'Next Agent', actorName: 'Actual Admin', reason: 'user_deactivation',
    } });
    const activity = (await history(module, row.id)).find(activity => activity.title === content.title)!;
    expect(activity).toMatchObject({ createdById: adminId, description: content.body });
    const feed = await request('/notifications?limit=100', 'GET', undefined, nextToken);
    expect(feed.status).toBe(200); expect(feed.body.data.find((item: { id: string }) => item.id === stored.id)).toMatchObject(content);
    const reloaded = await request('/notifications?limit=100', 'GET', undefined, nextToken);
    expect(reloaded.body.data.find((item: { id: string }) => item.id === stored.id)).toMatchObject({ ...content, createdAt: stored.createdAt.toISOString(), isRead: false });
    const timeline = await request('/crm/activities?' + module.toLowerCase() + 'Id=' + row.id);
    expect(timeline.status).toBe(200); expect(timeline.body.data.find((item: { id: string }) => item.id === activity.id)).toMatchObject({ title: content.title, description: content.body, createdBy: { id: adminId } });
    expect((await request('/administration/users/' + old.id + '/deactivate', 'POST', { replacementAgentId: nextId })).status).toBe(409);
    await drain(); expect((await notices(row.id)).filter(notice => notice.userId === nextId)).toHaveLength(1);
  });

  it.each(modules)('formats manual %s reassignment without claiming deactivation and ignores identical retries', async module => {
    const old = await newUser('Previous'), row = await record(module, old.id);
    expect((await request(path(module, row.id), 'PUT', { assignedUserId: nextId })).status).toBe(200);
    await drain();
    const notice = (await notices(row.id)).find(notice => notice.userId === nextId)!;
    expect(notice).toMatchObject({ title: 'Assigned Agent changed to Next Agent', body: 'Assigned Agent changed from Previous Agent to Next Agent.' });
    expect((await events(row.id))[0]).toMatchObject({ actorId: adminId, payload: { previousAssignedName: 'Previous Agent', assignedName: 'Next Agent', reason: null } });
    if (['Lead', 'Contact', 'Task'].includes(module)) expect((await history(module, row.id)).find(activity => activity.title === notice.title)).toMatchObject({ createdById: adminId, description: notice.body });
    expect((await request(path(module, row.id), 'PUT', { assignedUserId: nextId })).status).toBe(200);
    await drain(); expect(await events(row.id)).toHaveLength(1);
    expect((await notices(row.id)).filter(notice => notice.userId === nextId)).toHaveLength(1);
  });

  it('keeps event-time names after a profile rename and preserves deleted-delivery identity on replay', async () => {
    const old = await newUser('Previous'), row = await record('Contact', old.id);
    await request(path('Contact', row.id), 'PUT', { assignedUserId: nextId });
    await prisma.user.update({ where: { id: nextId }, data: { firstName: 'Renamed' } });
    try {
      await drain();
      const stored = (await notices(row.id)).find(notice => notice.userId === nextId)!;
      expect(stored.title).toBe('Assigned Agent changed to Next Agent');
      const feed = await request('/notifications?limit=100', 'GET', undefined, nextToken);
      expect(feed.body.data.find((item: { id: string }) => item.id === stored.id).title).toBe(stored.title);
      await prisma.notification.delete({ where: { id: stored.id } });
      await prisma.notificationEvent.updateMany({ where: { tenantId, entityId: row.id, eventKey: stored.eventKey }, data: { processedAt: null } });
      await drain(); expect((await notices(row.id)).filter(notice => notice.userId === nextId)).toHaveLength(0);
      expect(await prisma.notificationDelivery.count({ where: { tenantId, userId: nextId, eventKey: stored.eventKey! } })).toBe(1);
    } finally { await prisma.user.update({ where: { id: nextId }, data: { firstName: 'Next' } }); }
  });

  it('recovers historical names from exact IDs while preserving stored rows and excluding foreign or deleted users', async () => {
    const old = await newUser('Previous'), row = await record('Contact', nextId);
    const foreignTenant = (await prisma.tenant.create({ data: { name: 'Foreign', slug: randomUUID() } })).id;
    const foreign = await newUser('Foreign Secret', 'Sales', foreignTenant);
    const activity = await prisma.activity.create({ data: { tenantId, contactId: row.id, createdById: adminId, type: 'assignment', title: 'Assigned Agent changed',
      description: 'Original historical description', metadata: { previousAssignedUserId: old.id, newAssignedUserId: nextId, reason: 'user_deactivation' } } });
    const [presented] = await presentAssignmentActivities(tenantId, [activity]);
    expect(presented).toMatchObject({ title: 'Assigned Agent changed to Next Agent', description: 'Ownership transferred because Previous Agent was deactivated. The record is now assigned to Next Agent.' });
    expect(await prisma.activity.findUnique({ where: { id: activity.id } })).toMatchObject({ title: activity.title, description: activity.description });
    const legacyKey = 'assignment:' + randomUUID();
    await prisma.notificationEvent.create({ data: { tenantId, type: 'contact_assigned', eventKey: legacyKey, entityType: 'Contact', entityId: row.id, ownerId: nextId, processedAt: new Date(), payload: { previousAssignedUserId: old.id } } });
    const legacy = await prisma.notification.create({ data: { tenantId, userId: nextId, type: 'contact_assigned', title: 'Old generic title', eventKey: legacyKey, entityType: 'Contact', entityId: row.id } });
    const feed = await request('/notifications?limit=100', 'GET', undefined, nextToken);
    expect(feed.body.data.find((item: { id: string }) => item.id === legacy.id)).toMatchObject({ title: presented.title, body: 'Assigned Agent changed from Previous Agent to Next Agent.' });
    expect((await prisma.notification.findUniqueOrThrow({ where: { id: legacy.id } })).title).toBe('Old generic title');
    for (const id of [foreign.id, randomUUID()]) {
      const [missing] = await presentAssignmentActivities(tenantId, [{ ...activity, metadata: { previousAssignedUserId: id, newAssignedUserId: id, reason: 'user_deactivation' } }]);
      expect(JSON.stringify(missing.title + missing.description)).not.toMatch(/Foreign Secret|undefined|null|[0-9a-f]{8}-/);
      expect(missing.title).toBe('Assigned Agent changed');
    }
    expect((await request('/crm/contacts/' + row.id, 'PUT', { assignedUserId: foreign.id })).status).toBeGreaterThanOrEqual(400);
    expect((await prisma.contact.findUniqueOrThrow({ where: { id: row.id } })).assignedUserId).toBe(nextId);
  });

  it('rolls back assignments, Activity and outbox together when history fails', async () => {
    const old = await newUser('Previous'), row = await record('Lead', old.id);
    let rejectHistory = true;
    prisma.$use(async (params, next) => {
      if (rejectHistory && params.model === 'Activity' && params.action === 'createMany') throw new Error('Simulated assignment history failure');
      return next(params);
    });
    try { await expect(tenantContext.run({ tenantId }, () => salesTransaction(() => deactivateUser(old.id, tenantId, adminId, nextId)))).rejects.toThrow(); }
    finally { rejectHistory = false; }
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: row.id } })).assignedUserId).toBe(old.id);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: old.id } })).status).toBe('ACTIVE');
    expect(await events(row.id)).toHaveLength(0); expect(await history('Lead', row.id)).toHaveLength(0);
  });

  it('preserves initial Lead creation wording and does not leak creation context into later reassignment', async () => {
    const old = await newUser('Previous');
    const created = await request('/crm/leads', 'POST', { firstName: 'Created', lastName: 'Lead', email: randomUUID() + '@example.test', assignedUserId: old.id });
    expect(created.status).toBe(201); await drain();
    expect((await notices(created.body.data.id)).find(notice => notice.userId === old.id)).toMatchObject({ title: 'Lead Assigned to You', body: 'Created Lead has been assigned to you.' });
    await request('/crm/leads/' + created.body.data.id, 'PUT', { assignedUserId: nextId }); await drain();
    expect((await notices(created.body.data.id)).find(notice => notice.userId === nextId)?.title).toBe('Assigned Agent changed to Next Agent');
  });
});
