import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { EMPTY_PERMISSION_FLAGS, isTaskOverdue, taskDisplayStatus, taskDateRange } from '@leadcrm/shared';
import prisma from '../../../../config/database.config';
import { tenantContext } from '../../../../core/tenant/tenant-context';
import { issueAuthSession } from '../../../../core/auth/auth-session';
import app from '../../../../app';

const url = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid/');
const disposable = ['localhost', '127.0.0.1'].includes(url.hostname) && /^\/leadcrm_workflow_test_\d+$/.test(url.pathname);

describe.skipIf(!disposable)('Task assignment visibility through authenticated HTTP', { timeout: 20000 }, () => {
  type Actor = { id: string; token: string };
  type Row = { id: string; title: string; assignedUserId: string; status: string; dueDate: Date; isArchived: boolean };
  let tenantId: string, dealId: string, base: string, server: Server;
  let a: Actor, b: Actor, representative: Actor, manager: Actor, head: Actor, solo: Actor, outsider: Actor, top: Actor, admin: Actor, viewer: Actor, denied: Actor;
  let foreignId: string;
  const rows: Row[] = [];
  const scope = <T>(work: () => T) => tenantContext.run({ tenantId }, work);
  async function call(actor: Actor, path: string, method = 'GET', body?: unknown) {
    const response = await fetch(base + path, { method, headers: { Authorization: `Bearer ${actor.token}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json() };
  }
  const list = (actor: Actor, suffix = '') => call(actor, `/operations/tasks?search=Visibility&limit=100${suffix}`);
  const ownRows = (actor: Actor) => rows.filter(row => row.assignedUserId === actor.id && !row.isArchived);
  beforeAll(async () => {
    const stamp = Date.now();
    tenantId = (await prisma.tenant.create({ data: { name: 'Task visibility', slug: `task-visibility-${stamp}`, status: 'ACTIVE',
      onboardingStep: 3, onboardingCompletedAt: new Date() } })).id;
    const roles = new Map<string, string>();
    async function user(name: string, role: string, grant = true): Promise<Actor> {
      if (grant && role !== 'Client Admin' && !roles.has(role)) {
        const definition = await prisma.roleDefinition.create({ data: { tenantId, name: role, permissions: { create:
          ['tasks', 'leads', 'contacts', 'accounts', 'deals', 'archived_data'].map(module => ({ ...EMPTY_PERMISSION_FLAGS, module,
            canView: true, canViewAll: true, canCreate: true, canEdit: true, canAssign: true, canComplete: true, canArchive: true, canRestore: true })) } } });
        roles.set(role, definition.id);
      }
      const person = await prisma.user.create({ data: { tenantId, role, email: `${name}-${stamp}@camxian.com`, firstName: name, lastName: 'Visibility',
        mustChangePassword: false, onboardingCompletedAt: new Date(), emailVerified: new Date(),
        ...(grant && roles.has(role) ? { userRoles: { create: { roleId: roles.get(role)! } } } : {}) } });
      return { id: person.id, token: (await issueAuthSession(person)).token };
    }
    a = await user('agent-a', 'Sales Agent'); b = await user('agent-b', 'Sales Agent');
    representative = await user('representative', 'Sales Representative'); manager = await user('manager', 'Sales Manager');
    head = await user('head', 'Head of Sales'); solo = await user('solo', 'Sales Manager'); outsider = await user('outside', 'Sales Agent');
    top = await user('top', 'Top Management'); admin = await user('admin', 'Client Admin');
    viewer = await user('viewer', 'Task Viewer'); denied = await user('denied', 'Sales Agent', false);
    await scope(async () => {
      for (const [name, members] of [['First team', [manager, a]], ['Second team', [manager, head, b, representative]]] as const) {
        await prisma.tenantGroup.create({ data: { tenantId, name, members: { create: members.map(member => ({ tenantId, userId: member.id })) } } });
      }
      const pipeline = await prisma.pipeline.create({ data: { tenantId, name: 'Visibility pipeline' } });
      const stage = await prisma.stage.create({ data: { tenantId, pipelineId: pipeline.id, name: 'Lead', order: 0, requiredFields: [] } });
      dealId = (await prisma.deal.create({ data: { tenantId, pipelineId: pipeline.id, stageId: stage.id, title: 'Visibility deal', assignedUserId: a.id,
        tags: [], productInterests: [] } })).id;
      const today = Date.parse(taskDateRange('today').dueFrom), week = Date.parse(taskDateRange('week').dueFrom);
      for (const actor of [a, b, representative]) {
        for (const [index, status] of ['pending', 'in_progress', 'blocked', 'completed', 'cancelled', 'completed', 'pending'].entries()) {
          const dueDate = new Date(index === 0 ? Date.now() - 8 * 86400000 : index === 1 ? today + 12 * 3600000 : week + index * 86400000 + 3600000);
          const row = await prisma.task.create({ data: { tenantId, title: `Visibility ${actor.id} ${index}`, assignedUserId: actor.id, createdById: manager.id,
            dueDate, status, priority: 'High', isArchived: index === 6, dealLinks: { create: { tenantId, dealId, position: 0 } } } });
          rows.push(row);
          await prisma.activity.create({ data: { tenantId, taskId: row.id, type: 'task', title: `${row.title} history`, description: 'Visibility history', createdById: manager.id } });
        }
      }
    });
    const foreignTenant = await prisma.tenant.create({ data: { name: 'Foreign task visibility', slug: `foreign-task-visibility-${stamp}`, status: 'ACTIVE' } });
    const foreignUser = await prisma.user.create({ data: { tenantId: foreignTenant.id, role: 'Sales Agent', email: `foreign-${stamp}@camxian.com`, firstName: 'Foreign', lastName: 'Visibility' } });
    foreignId = (await tenantContext.run({ tenantId: foreignTenant.id }, () => prisma.task.create({ data: { tenantId: foreignTenant.id, assignedUserId: foreignUser.id,
      title: 'Visibility foreign secret', dueDate: new Date() } }))).id;
    server = app.listen(0); await new Promise<void>(resolve => server.once('listening', resolve));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1`;
  }, 30000);
  afterAll(async () => {
    if (server) await new Promise<void>(resolve => server.close(() => resolve()));
    await prisma.$disconnect();
  });

  it.each(['agent', 'representative'])('%s lists and aggregates all statuses only within its assignment', async role => {
    const actor = role === 'agent' ? a : representative;
    const expected = ownRows(actor);
    const result = await list(actor);
    expect(result.status, JSON.stringify(result.body)).toBe(200);
    expect(result.body.data.map((row: Row) => row.id).sort()).toEqual(expected.map(row => row.id).sort());
    expect(result.body.meta.total).toBe(expected.length);
    for (const query of [{}, { overdue: true }, taskDateRange('today'), taskDateRange('week'), ...['pending', 'in_progress', 'overdue', 'completed', 'cancelled'].map(status => ({ status }))]) {
      const params = new URLSearchParams(Object.entries(query).map(([key, value]) => [key, String(value)]));
      const filtered = expected.filter(row => (!('overdue' in query) || isTaskOverdue({ ...row, dueDate: row.dueDate.toISOString() })) &&
        (!('dueFrom' in query) || row.dueDate >= new Date(query.dueFrom as string) && row.dueDate < new Date(query.dueTo as string)) &&
        (!('status' in query) || taskDisplayStatus({ ...row, dueDate: row.dueDate.toISOString() }) === query.status));
      const page = await list(actor, `&${params}`);
      const summary = await call(actor, `/operations/tasks/summary?search=Visibility&${params}`);
      expect(page.body.data.map((row: Row) => row.id).sort()).toEqual(filtered.map(row => row.id).sort());
      expect(summary.body.data.total).toBe(filtered.length);
      expect(summary.body.data.completed).toBe(filtered.filter(row => row.status === 'completed').length);
      expect(summary.body.data.overdue).toBe(filtered.filter(row => isTaskOverdue({ ...row, dueDate: row.dueDate.toISOString() })).length);
      expect(summary.body.data.workload.every((entry: { assignedUserId: string }) => entry.assignedUserId === actor.id)).toBe(true);
      expect(Object.keys(summary.body.data.byStatus).sort()).toEqual(['pending', 'in_progress', 'completed', 'overdue', 'cancelled'].sort());
      expect(Object.values(summary.body.data.byStatus).reduce((sum: number, count) => sum + Number(count), 0)).toBe(filtered.length);
      expect(Number.isFinite(Date.parse(summary.body.data.evaluatedAt))).toBe(true);
    }
    const pages = await Promise.all([1, 2, 3].map(page => call(actor, `/operations/tasks?search=Visibility&sortBy=title&sortOrder=asc&limit=2&page=${page}`)));
    expect(pages.flatMap(page => page.body.data).map((row: Row) => row.id)).toEqual([...expected].sort((x, y) => x.title.localeCompare(y.title)).map(row => row.id));
    expect(pages.every(page => page.body.meta.total === expected.length)).toBe(true);
  });

  it.each(['agent', 'representative'])('%s cannot forge filters or read and mutate another assignment', async role => {
    const actor = role === 'agent' ? a : representative, hidden = ownRows(b)[0];
    expect((await list(actor, `&assignedUserId=${b.id}`)).body.data).toEqual([]);
    expect((await call(actor, `/operations/tasks/summary?assignedUserId=${b.id}`)).body.data.total).toBe(0);
    expect((await call(actor, `/operations/tasks?search=${encodeURIComponent(hidden.title)}`)).body.data).toEqual([]);
    for (const id of [hidden.id, foreignId]) {
      expect((await call(actor, `/operations/tasks/${id}`)).status).toBe(404);
      expect((await call(actor, `/crm/activities?taskId=${id}`)).status).toBe(404);
      expect((await call(actor, `/operations/tasks/${id}`, 'PUT', { title: 'Forbidden edit' })).status).toBe(404);
      expect((await call(actor, `/operations/tasks/${id}/complete`, 'PATCH')).status).toBe(404);
      expect((await call(actor, `/operations/tasks/${id}/archive`, 'PATCH')).status).toBe(404);
    }
    for (const operation of ['complete', 'archive', 'assign', 'reschedule']) {
      const result = await call(actor, '/operations/tasks/bulk', 'POST', { operation, ids: [hidden.id],
        ...(operation === 'assign' ? { assignedUserId: actor.id } : operation === 'reschedule' ? { dueDate: new Date(Date.now() + 86400000).toISOString() } : {}) });
      expect(result.body.data.succeeded).toEqual([]);
      expect(result.body.data.failed).toHaveLength(1);
    }
    expect((await scope(() => prisma.task.findUniqueOrThrow({ where: { id: hidden.id } })))).toMatchObject({ title: hidden.title, status: hidden.status, assignedUserId: b.id, isArchived: false });
  });

  it('scopes related tasks, histories, archived counts and both archive sort paths', async () => {
    for (const actor of [a, representative]) {
      const related = await call(actor, `/crm/deals/${dealId}/relationships`);
      expect(related.status, JSON.stringify(related.body)).toBe(200);
      expect(related.body.data.tasks.map((row: Row) => row.id).sort()).toEqual(ownRows(actor).map(row => row.id).sort());
      const history = await call(actor, '/crm/activities?type=task&search=Visibility&limit=100');
      expect(history.status, JSON.stringify(history.body)).toBe(200);
      const allowedIds = rows.filter(row => row.assignedUserId === actor.id).map(row => row.id);
      expect(history.body.data.length).toBe(allowedIds.length);
      expect(history.body.data.every((row: { taskId: string }) => allowedIds.includes(row.taskId))).toBe(true);
      for (const sortBy of ['archivedAt', 'name']) {
        const archive = await call(actor, `/administration/archived-data?type=Task&sortBy=${sortBy}`);
        expect(archive.status, JSON.stringify(archive.body)).toBe(200);
        expect(archive.body.meta.total).toBe(1);
        expect(archive.body.data.map((row: { id: string }) => row.id)).toEqual(rows.filter(row => row.assignedUserId === actor.id && row.isArchived).map(row => row.id));
      }
      const hiddenArchive = rows.find(row => row.assignedUserId === b.id && row.isArchived)!;
      expect((await call(actor, `/administration/archived-data/Task/${hiddenArchive.id}/restore`, 'PATCH')).status).toBe(404);
    }
  });

  it('preserves manager, management, administrator and unrelated authorized role access', async () => {
    for (const actor of [manager, top, admin, viewer]) {
      const result = await list(actor);
      expect(result.status, JSON.stringify(result.body)).toBe(200);
      expect(result.body.meta.total).toBe(rows.filter(row => !row.isArchived).length);
      expect((await call(actor, `/operations/tasks/${ownRows(b)[0].id}`)).status).toBe(200);
      expect((await call(actor, `/operations/tasks/${foreignId}`)).status).toBe(404);
    }
    for (const path of ['/operations/tasks', '/operations/tasks/summary', `/operations/tasks/${ownRows(a)[0].id}`]) expect((await call(denied, path)).status).toBe(403);
    const policy = await call(a, '/crm/record-access');
    expect(policy.body.data).not.toHaveProperty('taskAssignmentRestricted');
  });

  it('rejects agent assignment to another user even with Assign, and permits assigned-only progress updates', async () => {
    const created = await call(a, '/operations/tasks', 'POST', { title: 'Creator-only exclusion', assignedUserId: b.id, dealIds: [dealId],
      dueDate: new Date(Date.now() + 86400000).toISOString() });
    expect(created.status, JSON.stringify(created.body)).toBe(403);
    const personal = await call(a, '/operations/tasks', 'POST', { title: 'Personal default', dealIds: [dealId], dueDate: new Date(Date.now() + 86400000).toISOString() });
    expect(personal.status, JSON.stringify(personal.body)).toBe(201);
    expect(personal.body.data).toMatchObject({ status: 'pending', assignedUserId: a.id });
    expect((await call(a, `/operations/tasks/${personal.body.data.id}`, 'PUT', { assignedUserId: b.id })).status).toBe(403);
    const { id } = await scope(() => prisma.task.create({ data: { tenantId, title: 'Creator-only exclusion', createdById: a.id, assignedUserId: b.id, dueDate: new Date() } }));
    expect((await call(a, `/operations/tasks?search=Creator-only`)).body.data).toEqual([]);
    expect((await call(b, `/operations/tasks?search=Creator-only`)).body.data.map((row: Row) => row.id)).toEqual([id]);
    expect((await call(a, `/operations/tasks/${id}`)).status).toBe(404);
    expect((await call(a, `/operations/tasks/${id}`, 'PUT', { title: 'Creator cannot edit hidden task' })).status).toBe(404);
    expect((await call(b, `/operations/tasks/${id}`, 'PUT', { title: 'Assigned agent can edit', status: 'in_progress' })).status).toBe(200);
  });

  it('uses shared Groups for managers, supports multiple Groups and gives a manager without Groups personal scope', async () => {
    const outsideTask = await scope(() => prisma.task.create({ data: { tenantId, title: 'Outside team', assignedUserId: outsider.id, createdById: manager.id, dueDate: new Date() } }));
    const soloTask = await scope(() => prisma.task.create({ data: { tenantId, title: 'Solo task', assignedUserId: solo.id, createdById: admin.id, dueDate: new Date() } }));
    for (const actor of [manager, head, solo]) {
      expect((await call(actor, `/operations/tasks/${outsideTask.id}`)).status).toBe(404);
      expect((await call(actor, `/operations/tasks/${outsideTask.id}`, 'PUT', { status: 'completed' })).status).toBe(404);
    }
    expect((await list(solo)).body.data).toEqual([]);
    expect((await call(solo, `/operations/tasks/${soloTask.id}`, 'PUT', { status: 'in_progress' })).status).toBe(200);
    expect((await list(head)).body.data.map((row: Row) => row.id).sort()).toEqual(rows.filter(row => !row.isArchived && [b.id, representative.id].includes(row.assignedUserId)).map(row => row.id).sort());
    expect((await call(head, `/operations/tasks/${ownRows(a)[0].id}`)).status).toBe(404);
    const options = await call(manager, '/operations/tasks/options?kind=user');
    expect(options.body.data.map((row: { id: string }) => row.id).sort()).toEqual([manager.id, a.id, b.id, representative.id].sort());
    expect((await call(manager, `/operations/tasks/${ownRows(a)[0].id}`, 'PUT', { assignedUserId: outsider.id })).status).toBe(403);
    for (const sortBy of ['archivedAt', 'name']) {
      const archived = await call(head, `/administration/archived-data?type=Task&sortBy=${sortBy}`);
      expect(archived.body.data.map((row: { id: string }) => row.id).sort()).toEqual(rows.filter(row => row.isArchived && [b.id, representative.id].includes(row.assignedUserId)).map(row => row.id).sort());
    }
    await scope(() => prisma.tenantGroupMember.deleteMany({ where: { tenantId, userId: head.id } }));
    expect((await call(head, `/operations/tasks/${ownRows(b)[0].id}`, 'PUT', { status: 'in_progress' })).status).toBe(404);
    expect((await list(head)).body.data).toEqual([]);
  });

  it('switches visibility and counts between two existing sessions after reassignment', async () => {
    const row = ownRows(a)[0];
    expect((await call(a, `/operations/tasks/${row.id}`)).status).toBe(200);
    expect((await call(b, `/operations/tasks/${row.id}`)).status).toBe(404);
    const result = await call(manager, `/operations/tasks/${row.id}`, 'PUT', { assignedUserId: b.id });
    expect(result.status, JSON.stringify(result.body)).toBe(200);
    expect(result.body.data.createdById).toBe(manager.id);
    expect((await call(a, `/operations/tasks/${row.id}`)).status).toBe(404);
    expect((await call(b, `/operations/tasks/${row.id}`)).status).toBe(200);
    expect((await list(a)).body.meta.total).toBe(ownRows(a).length - 1);
    expect((await list(b)).body.meta.total).toBe(ownRows(b).length + 1);
    expect((await call(a, `/crm/activities?taskId=${row.id}`)).status).toBe(404);
  });

  it('serializes a competing agent edit and manager reassignment and rejects edits after the assignment moves', async () => {
    const task = await scope(() => prisma.task.create({ data: { tenantId, title: 'Concurrent assignment', assignedUserId: a.id, createdById: manager.id, dueDate: new Date() } }));
    const version = task.updatedAt.toISOString();
    const results = await Promise.all([
      call(manager, `/operations/tasks/${task.id}`, 'PUT', { assignedUserId: b.id, expectedUpdatedAt: version }),
      call(a, `/operations/tasks/${task.id}`, 'PUT', { status: 'in_progress', expectedUpdatedAt: version }),
    ]);
    expect(results.filter(result => result.status === 200)).toHaveLength(1);
    expect(results.every(result => [200, 404, 409].includes(result.status))).toBe(true);
    const current = await scope(() => prisma.task.findUniqueOrThrow({ where: { id: task.id } }));
    if (current.assignedUserId !== b.id) expect((await call(manager, `/operations/tasks/${task.id}`, 'PUT', { assignedUserId: b.id })).status).toBe(200);
    expect((await call(a, `/operations/tasks/${task.id}`, 'PUT', { title: 'Stale agent' })).status).toBe(404);
    expect((await call(b, `/operations/tasks/${task.id}`, 'PUT', { status: 'completed' })).status).toBe(200);
  });

  it('rechecks current action grants for team Tasks while retaining independent completion permission', async () => {
    const task = await scope(() => prisma.task.create({ data: { tenantId, title: 'Revoked editing', assignedUserId: a.id, createdById: admin.id, dueDate: new Date() } }));
    const role = await scope(() => prisma.roleDefinition.findFirstOrThrow({ where: { tenantId, name: 'Sales Manager' } }));
    await scope(() => prisma.rolePermission.updateMany({ where: { tenantId, roleId: role.id, module: 'tasks' }, data: { canEdit: false } }));
    try {
      expect((await call(manager, `/operations/tasks/${task.id}`, 'PUT', { title: 'Denied' })).status).toBe(403);
      expect((await call(manager, `/operations/tasks/${task.id}/complete`, 'PATCH')).status).toBe(200);
      expect((await call(manager, '/operations/tasks/bulk', 'POST', { operation: 'reschedule', ids: [task.id], dueDate: new Date().toISOString() })).status).toBe(403);
    } finally {
      await scope(() => prisma.rolePermission.updateMany({ where: { tenantId, roleId: role.id, module: 'tasks' }, data: { canEdit: true } }));
    }
  });

  it('keeps related Deal read scope on assigned Task mutation responses', async () => {
    const stamp = Date.now();
    const role = await scope(() => prisma.roleDefinition.findFirstOrThrow({ where: { tenantId, name: 'Sales Agent' } }));
    const agent = await scope(async () => {
      const user = await prisma.user.create({ data: { tenantId, role: 'Sales Agent', firstName: 'Scoped', lastName: 'Agent', email: `scoped-task-${stamp}@camxian.com`, mustChangePassword: false, onboardingCompletedAt: new Date(), userRoles: { create: { roleId: role.id } } } });
      return { id: user.id, token: (await issueAuthSession(user)).token };
    });
    const task = await scope(() => prisma.task.create({ data: { tenantId, title: 'Task with private Deal', assignedUserId: agent.id, createdById: admin.id, dueDate: new Date(), dealLinks: { create: { dealId } } } }));
    await scope(() => prisma.rolePermission.updateMany({ where: { tenantId, roleId: role.id, module: 'deals' }, data: { canViewAll: false, canViewMy: true } }));
    try {
      for (const result of [await call(agent, `/operations/tasks/${task.id}`), await call(agent, `/operations/tasks/${task.id}`, 'PUT', { status: 'in_progress' })]) {
        expect(result.status, JSON.stringify(result.body)).toBe(200);
        expect(result.body.data).toMatchObject({ id: task.id, dealIds: [], deals: [], deal: null });
        expect(result.body.data.relatedRecords).toEqual([]);
      }
    } finally {
      await scope(() => prisma.rolePermission.updateMany({ where: { tenantId, roleId: role.id, module: 'deals' }, data: { canViewAll: true, canViewMy: false } }));
    }
  });
});
