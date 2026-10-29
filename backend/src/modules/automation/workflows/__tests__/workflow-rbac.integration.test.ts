import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { EMPTY_PERMISSION_FLAGS, PERMISSION_ACTIONS, ROLE_TEMPLATES, type PermissionFlags } from '@leadcrm/shared';
import app from '../../../../app';
import prisma from '../../../../config/database.config';
import { issueAuthSession } from '../../../../core/auth/auth-session';
import { tenantContext } from '../../../../core/tenant/tenant-context';
import { fireWorkflowTrigger } from '../workflow.engine';

const url = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid/');
const disposable = ['localhost', '127.0.0.1'].includes(url.hostname) && /^\/leadcrm_workflow_test_\d+$/.test(url.pathname);
describe.skipIf(!disposable)('Workflow capability separation with authenticated HTTP and SQL', () => {
  let server: Server, base: string, tenantId: string;
  let manager: { id: string; token: string; roleId: string }, associate: typeof manager;
  const row = (module: string, grants: Partial<PermissionFlags> = {}) => ({ module, ...EMPTY_PERMISSION_FLAGS, ...grants });
  const draft = () => ({ name: `Workflow ${randomUUID()}`, trigger: 'lead.created', isActive: false,
    actions: [{ type: 'update_field', config: { field: 'address', value: 'Workflow action completed' } }] });
  async function actor(name: string, workflowGrants: PermissionFlags) {
    const role = await prisma.roleDefinition.create({ data: { tenantId, name, permissions: { create: [
      row('workflows', workflowGrants), row('leads', { canView: true, canViewAll: true, canEdit: true }),
    ] } } });
    const user = await prisma.user.create({ data: { tenantId, role: name, firstName: name, lastName: 'QA',
      email: `${randomUUID()}@camxian.com`, mustChangePassword: false, onboardingCompletedAt: new Date(),
      userRoles: { create: { roleId: role.id } } } });
    return { id: user.id, roleId: role.id, token: (await issueAuthSession(user)).token };
  }
  async function call(path: string, user = associate, method = 'GET', body?: unknown) {
    const response = await fetch(base + path, { method, headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json() };
  }
  async function create(active = true) {
    const saved = await call('/automation/workflows', manager, 'POST', draft());
    expect(saved.status, JSON.stringify(saved.body)).toBe(201);
    if (!active) return saved.body.data;
    const activated = await call(`/automation/workflows/${saved.body.data.id}/toggle`, manager, 'PATCH', { isActive: true });
    expect(activated.status, JSON.stringify(activated.body)).toBe(200);
    return activated.body.data;
  }
  beforeAll(async () => {
    server = app.listen(0, '127.0.0.1'); await new Promise<void>(done => server.once('listening', done));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1`;
  });
  beforeEach(async () => {
    tenantId = (await prisma.tenant.create({ data: { name: 'Workflow RBAC', slug: randomUUID(), onboardingStep: 3, onboardingCompletedAt: new Date() } })).id;
    manager = await actor('Sales Admin', ROLE_TEMPLATES.find(template => template.key === 'sales-admin')!.permissions.workflows);
    associate = await actor('Sales Associate', ROLE_TEMPLATES.find(template => template.key === 'sales-associate')!.permissions.workflows);
  });
  afterAll(async () => { server.closeAllConnections(); await new Promise<void>(done => server.close(() => done())); await prisma.$disconnect(); });

  it('lets Sales Admin configure and activate, and Sales Associate view, check and read actual execution history', async () => {
    const workflow = await create(false);
    const edited = await call(`/automation/workflows/${workflow.id}`, manager, 'PUT', { description: 'Configured by Sales Admin' });
    expect(edited.status, JSON.stringify(edited.body)).toBe(200);
    expect((await call(`/automation/workflows/${workflow.id}/toggle`, manager, 'PATCH', { isActive: true })).status).toBe(200);
    expect((await call('/automation/workflows')).body.data.map((record: { id: string }) => record.id)).toContain(workflow.id);
    expect((await call(`/automation/workflows/${workflow.id}`)).status).toBe(200);
    const sample = await prisma.lead.create({ data: { tenantId, firstName: 'Workflow', lastName: 'Customer', address: 'Original', assignedUserId: associate.id } });
    const check = await call(`/automation/workflows/${workflow.id}/test`, associate, 'POST', { entityId: sample.id });
    expect(check.status, JSON.stringify(check.body)).toBe(200); expect(check.body.data.valid).toBe(true);
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: sample.id } })).address).toBe('Original');
    expect(await prisma.workflowExecutionRun.count({ where: { tenantId } })).toBe(0);
    await tenantContext.run({ tenantId }, () => fireWorkflowTrigger({ tenantId, triggerType: 'lead.created', entityType: 'lead', entityId: sample.id, actorId: associate.id, eventId: randomUUID(), context: {} }));
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: sample.id } })).address).toBe('Workflow action completed');
    const runs = await call(`/automation/workflows/${workflow.id}/executions`);
    expect(runs.status, JSON.stringify(runs.body)).toBe(200); expect(runs.body.data[0].status).toBe('completed');
    expect((await call(`/automation/workflows/${workflow.id}/executions/${runs.body.data[0].id}`)).status).toBe(200);
  });

  it('denies every management route and state payload to the default Sales Associate without modifying the workflow', async () => {
    const workflow = await create();
    const prefix = `/automation/workflows/${workflow.id}`;
    const revision = { draft: draft(), expectedVersion: workflow.version, expectedDraftRevision: workflow.draftRevision };
    for (const [method, path, body] of [
      ['POST', '/automation/workflows', draft()], ['PUT', prefix, { name: 'Forbidden' }],
      ['PUT', prefix, { isActive: false }], ['PUT', prefix, { isActive: true }],
      ['PUT', prefix, { name: 'Forbidden', isActive: false }], ['PUT', `${prefix}/draft`, revision],
      ['POST', `${prefix}/publish`, revision], ['POST', `${prefix}/duplicate`, {}],
      ['POST', `${prefix}/versions/1/restore`, revision], ['PATCH', `${prefix}/archive`, {}],
      ['PATCH', `${prefix}/toggle`, { isActive: false }], ['PATCH', `${prefix}/toggle`, { isActive: true }],
    ] as const) expect((await call(path, associate, method, body)).status, `${method} ${path}`).toBe(403);
    expect((await prisma.workflow.findUniqueOrThrow({ where: { id: workflow.id } }))).toMatchObject({ isActive: true, isArchived: false, name: workflow.name });
    await call(`${prefix}/toggle`, manager, 'PATCH', { isActive: false });
    expect((await call(`${prefix}/toggle`, associate, 'PATCH', { isActive: true })).status).toBe(403);
    expect((await prisma.workflow.findUniqueOrThrow({ where: { id: workflow.id } })).status).toBe('PAUSED');
  });

  it('persists configurable grants, applies them to existing sessions, preserves unrelated modules and separates pause/resume from activation', async () => {
    await prisma.rolePermission.create({ data: { tenantId, roleId: manager.roleId, ...row('roles', { canView: true, canEdit: true }) } });
    const workflow = await create(), inactive = await create(false);
    const unrelated = await prisma.rolePermission.findUniqueOrThrow({ where: { roleId_module: { roleId: associate.roleId, module: 'leads' } } });
    const detail = await call(`/administration/roles/${associate.roleId}`, manager);
    expect(detail.status).toBe(200);
    const permissions = detail.body.data.permissions.map((permission: PermissionFlags & { module: string }) => row(permission.module,
      Object.fromEntries(PERMISSION_ACTIONS.map(flag => [flag, permission[flag] === true]))));
    const workflowRow = permissions.find((permission: { module: string }) => permission.module === 'workflows');
    workflowRow.canPause = true;
    expect((await call(`/administration/roles/${associate.roleId}`, manager, 'PUT', { permissions })).status).toBe(200);
    expect((await call(`/administration/roles/${associate.roleId}`, manager)).body.data.permissions.find((permission: { module: string }) => permission.module === 'workflows').canPause).toBe(true);
    expect((await call(`/administration/users/${associate.id}/permissions`)).body.data.workflows.canPause).toBe(true);
    expect((await call(`/automation/workflows/${workflow.id}/toggle`, associate, 'PATCH', { isActive: false })).status).toBe(200);
    expect((await call(`/automation/workflows/${workflow.id}/toggle`, associate, 'PATCH', { isActive: true })).status).toBe(200);
    expect((await prisma.workflow.findUniqueOrThrow({ where: { id: workflow.id } })).activatedById).toBe(manager.id);
    expect((await call(`/automation/workflows/${inactive.id}/toggle`, associate, 'PATCH', { isActive: true })).status).toBe(403);
    expect((await call(`/automation/workflows/${workflow.id}`, associate, 'PUT', { name: 'Forbidden', isActive: false })).status).toBe(403);
    workflowRow.canPause = false; workflowRow.canExecute = false; workflowRow.canViewRuns = false;
    expect((await call(`/administration/roles/${associate.roleId}`, manager, 'PUT', { permissions })).status).toBe(200);
    expect((await call(`/automation/workflows/${workflow.id}/toggle`, associate, 'PATCH', { isActive: false })).status).toBe(403);
    expect((await call(`/automation/workflows/${workflow.id}/test`, associate, 'POST', { entityId: randomUUID() })).status).toBe(403);
    expect((await call(`/automation/workflows/${workflow.id}/executions`)).status).toBe(403);
    expect((await call(`/automation/workflows/${workflow.id}`)).body.data).not.toHaveProperty('totalRuns');
    expect(await prisma.rolePermission.findUniqueOrThrow({ where: { id: unrelated.id } })).toEqual(unrelated);
    expect((await call(`/administration/roles/${associate.roleId}`, associate, 'PUT', { permissions })).status).toBe(403);
  });

  it('does not treat activation as pause authority and retains deleted workflows and their history', async () => {
    await prisma.rolePermission.update({ where: { roleId_module: { roleId: associate.roleId, module: 'workflows' } }, data: { canActivate: true } });
    const workflow = await create(false);
    expect((await call(`/automation/workflows/${workflow.id}/toggle`, associate, 'PATCH', { isActive: true })).status).toBe(200);
    for (const method of ['PATCH', 'PUT']) {
      expect((await call(`/automation/workflows/${workflow.id}${method === 'PATCH' ? '/toggle' : ''}`, associate, method, { isActive: false })).status).toBe(403);
    }
    expect((await call(`/automation/workflows/${workflow.id}/archive`, manager, 'PATCH')).status).toBe(200);
    expect(await prisma.workflow.findUniqueOrThrow({ where: { id: workflow.id } })).toMatchObject({ isActive: false, isArchived: true });
    expect(await prisma.workflowPublication.count({ where: { workflowId: workflow.id } })).toBeGreaterThan(0);
  });

  it('retains action permissions for checks and tenant boundaries for shared workflow access', async () => {
    const workflow = await create();
    const sample = await prisma.lead.create({ data: { tenantId, firstName: 'Permission', lastName: 'Customer' } });
    await prisma.rolePermission.update({ where: { roleId_module: { roleId: associate.roleId, module: 'leads' } }, data: { canEdit: false } });
    expect((await call(`/automation/workflows/${workflow.id}/test`, associate, 'POST', { entityId: sample.id })).status).toBe(403);
    const foreignTenant = await prisma.tenant.create({ data: { name: 'Foreign', slug: randomUUID() } });
    const foreign = await prisma.workflow.create({ data: { tenantId: foreignTenant.id, name: 'Foreign workflow', trigger: 'lead.created', actions: [] } });
    expect((await call(`/automation/workflows/${foreign.id}`)).status).toBe(404);
    expect((await call(`/automation/workflows/${foreign.id}/executions`)).status).toBe(404);
    expect((await call(`/automation/workflows/${foreign.id}/toggle`, manager, 'PATCH', { isActive: true })).status).toBe(404);
    expect((await call(`/automation/workflows/${foreign.id}/test`, associate, 'POST', { entityId: sample.id })).status).toBe(404);
  });
});
