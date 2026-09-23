import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import prisma from '../../../config/database.config';
import { environmentContext } from '../environment-context';
import { issueAuthSession } from '../../auth/auth-session';
import { readAuthUser } from '../../auth/auth-user';
import app from '../../../app';
import { hash } from 'bcryptjs';

const url = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid/');
const disposable = ['localhost', '127.0.0.1'].includes(url.hostname) && /^\/leadcrm_environment_test_\d+$/.test(url.pathname);
describe.skipIf(!disposable)('environment isolation on PostgreSQL and authenticated HTTP', () => {
  let server: Server;
  let base: string;
  let tenantId: string;
  let otherTenantId: string;
  let admin: any, staff: any, custom: any, operator: any;
  let live: any, sandbox: any;
  const tokens = new Map<string, string>();
  const scope = <T>(environment: 'SANDBOX' | 'PRODUCTION', work: () => T) => environmentContext.run({ tenantId, environment }, async () => await work());
  async function call(user: any, path: string, method = 'GET', body?: unknown, environment?: string) {
    const response = await fetch(base + path, { method, headers: {
      'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${tokens.get(user.id)}` } : {}),
      ...(environment ? { 'X-CRM-Environment': environment } : {}),
    }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json() };
  }
  beforeAll(async () => {
    // Legacy account status must never choose the dataset or require a paid account.
    const tenant = await prisma.tenant.create({ data: { name: 'Environment fixture', slug: `environment-${Date.now()}`, status: 'SANDBOX', onboardingStep: 3, onboardingCompletedAt: new Date() } });
    tenantId = tenant.id;
    otherTenantId = (await prisma.tenant.create({ data: { name: 'Other', slug: `other-env-${Date.now()}` } })).id;
    const createUser = async (role: string) => prisma.user.create({ data: { tenantId, role, email: `${role.replace(/ /g, '-')}@camxian.com`, firstName: role, lastName: 'Test', mustChangePassword: false, emailVerified: new Date() } });
    admin = await createUser('Client Admin'); staff = await createUser('User'); custom = await createUser('Sales Agent'); operator = await createUser('System Admin');
    for (const user of [staff, custom]) {
      const role = await prisma.roleDefinition.create({ data: { tenantId, name: user.role, permissions: { create: { tenantId, module: 'contacts', canView: true, canCreate: true, canEdit: true, canDelete: false } } } });
      await prisma.userRole.create({ data: { tenantId, userId: user.id, roleId: role.id } });
    }
    for (const user of [admin, staff, custom, operator]) tokens.set(user.id, (await issueAuthSession(user)).token);
    live = await scope('PRODUCTION', () => prisma.lead.create({ data: { tenantId, firstName: 'Live', lastName: 'Lead', productInterest: [] } }));
    sandbox = await scope('SANDBOX', () => prisma.lead.create({ data: { tenantId, firstName: 'Sandbox', lastName: 'Lead', productInterest: [] } }));
    await prisma.lead.create({ data: { tenantId: otherTenantId, firstName: 'Other', lastName: 'Tenant', productInterest: [] } });
    server = app.listen(0);
    await new Promise<void>(resolve => server.once('listening', resolve));
    base = `http://127.0.0.1:${(server.address() as any).port}/api/v1`;
  }, 30000);
  afterAll(async () => { if (server) await new Promise<void>(resolve => server.close(() => resolve())); await prisma.$disconnect(); });

  it('defaults all tenant roles to Sandbox; keeps System Admin outside the context', async () => {
    for (const user of [admin, staff, custom]) expect((await readAuthUser(user.id, tenantId)).activeEnvironment).toBe('SANDBOX');
    expect((await readAuthUser(operator.id, tenantId)).activeEnvironment).toBeNull();
    expect((await call(operator, '/auth/environment', 'PATCH', { environment: 'PRODUCTION' })).status).toBe(403);
    expect((await call(operator, '/admin/tenants')).status).toBe(200);
  });
  it('requires authentication and strict values, rejecting supplied tenant IDs', async () => {
    expect((await call(null, '/auth/environment', 'PATCH', { environment: 'SANDBOX' })).status).toBe(401);
    for (const body of [{ environment: 'live' }, { environment: 'PRODUCTION', tenantId: otherTenantId }])
      expect((await call(admin, '/auth/environment', 'PATCH', body)).status).toBe(400);
  });
  it('scopes list, unique, aggregates, update and delete operations, including transactions', async () => {
    await scope('SANDBOX', async () => {
      expect((await prisma.lead.findMany()).map(row => row.id)).toEqual([sandbox.id]);
      expect(await prisma.lead.findUnique({ where: { id: live.id } })).toBeNull();
      expect(await prisma.lead.count()).toBe(1);
      expect((await prisma.lead.aggregate({ _count: true }))._count).toBe(1);
      expect((await prisma.lead.groupBy({ by: ['environment'], _count: true })).map(row => row.environment)).toEqual(['SANDBOX']);
      expect((await prisma.lead.updateMany({ where: { id: live.id }, data: { firstName: 'Wrong' } })).count).toBe(0);
      expect((await prisma.lead.deleteMany({ where: { id: live.id } })).count).toBe(0);
      await expect(prisma.lead.update({ where: { id: live.id }, data: { firstName: 'Wrong' } })).rejects.toThrow();
      await prisma.$transaction(async tx => expect(await tx.lead.count()).toBe(1));
      expect(await prisma.$transaction([prisma.lead.count(), prisma.lead.count()])).toEqual([1, 1]);
    });
  });
  it('persists only the requesting user and retains permissions across logout/login sessions', async () => {
    for (const user of [admin, staff, custom]) {
      expect((await call(user, '/auth/environment', 'PATCH', { environment: 'PRODUCTION' })).status).toBe(200);
      expect((await readAuthUser(user.id, tenantId)).role).toBe(user.role);
      const fresh = await issueAuthSession(user);
      expect(fresh.user.activeEnvironment).toBe('PRODUCTION');
      const list = await call(user, '/crm/leads');
      expect(list.status).toBe(200);
      expect(list.body.data.map((row: any) => row.id)).toEqual([live.id]);
      if (user !== admin) expect((await call(user, '/administration/roles')).status).toBe(403);
      expect((await call(user, '/auth/environment', 'PATCH', { environment: 'SANDBOX' })).status).toBe(200);
    }
    await call(admin, '/auth/environment', 'PATCH', { environment: 'PRODUCTION' });
    expect((await readAuthUser(staff.id, tenantId)).activeEnvironment).toBe('SANDBOX');
    expect((await call(admin, '/crm/leads', 'POST', { firstName: 'Stale', lastName: 'Tab' }, 'SANDBOX')).status).toBe(409);
    expect((await call(staff, `/crm/leads/${sandbox.id}/archive`, 'PATCH')).status).toBe(403);
  });
  it('creates records in the active environment through HTTP', async () => {
    for (const [user, environment] of [[admin, 'PRODUCTION'], [staff, 'SANDBOX']] as const) {
      const response = await call(user, '/crm/leads', 'POST', { firstName: 'Created', lastName: environment });
      expect(response.status, JSON.stringify(response.body)).toBe(201);
      expect((await prisma.lead.findUniqueOrThrow({ where: { id: response.body.data.id } })).environment).toBe(environment);
    }
  });
  it('rejects cross-environment relationships and keeps nested reads scoped', async () => {
    const account = await scope('PRODUCTION', () => prisma.account.create({ data: { tenantId, name: 'Live account', tags: [], productInterests: [], activeProducts: [] } }));
    await scope('SANDBOX', async () => {
      await expect(prisma.lead.update({ where: { id: sandbox.id }, data: { accountId: account.id } })).rejects.toThrow();
      await expect(prisma.lead.update({ where: { id: sandbox.id }, data: { account: { connect: { id: account.id } } } })).rejects.toThrow();
      const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, include: { leads: true, _count: { select: { leads: true } } } });
      expect(tenant.leads.every(row => row.environment === 'SANDBOX')).toBe(true);
      expect(tenant._count.leads).toBe(tenant.leads.length);
      const pipeline = await prisma.pipeline.create({ data: { tenantId, name: 'Nested', stages: { create: { tenantId, name: 'New', order: 1, requiredFields: [] } } }, include: { stages: true } });
      expect(pipeline.stages[0].environment).toBe('SANDBOX');
      await expect(prisma.lead.update({ where: { id: sandbox.id }, data: { environment: 'PRODUCTION' } })).rejects.toThrow();
    });
    // SQL trigger protection remains effective outside the middleware too.
    await expect(prisma.lead.update({ where: { id: sandbox.id }, data: { accountId: account.id } })).rejects.toThrow();
    await expect(prisma.lead.update({ where: { id: sandbox.id }, data: { environment: 'PRODUCTION' } })).rejects.toThrow();
  });
  it('isolates concurrent request contexts and scoped deletion', async () => {
    const [sandboxRows, liveRows] = await Promise.all([
      scope('SANDBOX', async () => { await Promise.resolve(); return prisma.lead.findMany(); }),
      scope('PRODUCTION', async () => { await Promise.resolve(); return prisma.lead.findMany(); }),
    ]);
    expect(sandboxRows.every(row => row.environment === 'SANDBOX' && row.tenantId === tenantId)).toBe(true);
    expect(liveRows.every(row => row.environment === 'PRODUCTION' && row.tenantId === tenantId)).toBe(true);
    await scope('SANDBOX', async () => {
      const temporary = await prisma.lead.create({ data: { tenantId: otherTenantId, environment: 'PRODUCTION', firstName: 'Temporary', lastName: 'Scoped', productInterest: [] } });
      expect(temporary.tenantId).toBe(tenantId);
      expect(temporary.environment).toBe('SANDBOX');
      await prisma.lead.delete({ where: { id: temporary.id } });
    });
    expect(await prisma.lead.findUnique({ where: { id: live.id } })).not.toBeNull();
  });
  it('scopes child-only tables through parents and rejects reparenting', async () => {
    const audience = await scope('PRODUCTION', async () => prisma.targetAudience.create({ data: { tenantId, name: 'Live audience', conditions: { create: { field: 'status', operator: 'equals', value: 'HOT' } } }, include: { conditions: true } }));
    const condition = audience.conditions[0];
    await scope('SANDBOX', async () => {
      expect(await prisma.targetAudienceCondition.findUnique({ where: { id: condition.id } })).toBeNull();
      expect((await prisma.targetAudienceCondition.deleteMany({ where: { id: condition.id } })).count).toBe(0);
      await expect(prisma.targetAudienceCondition.create({ data: { targetAudienceId: audience.id, field: 'status', operator: 'equals', value: 'WARM' } })).rejects.toThrow();
    });
    const sandboxAudience = await scope('SANDBOX', async () => prisma.targetAudience.create({ data: { tenantId, name: 'Sandbox audience' } }));
    await expect(prisma.targetAudienceCondition.update({ where: { id: condition.id }, data: { targetAudienceId: sandboxAudience.id } })).rejects.toThrow();
    const batch = await scope('PRODUCTION', async () => prisma.leadImport.create({ data: { tenantId, fileName: 'fixture.csv', createdById: admin.id } }));
    await scope('PRODUCTION', async () => {
      await prisma.leadImportResult.createMany({ data: [{ importId: batch.id, leadId: live.id, rowNumber: 1, status: 'imported' }] });
    });
    await expect(prisma.leadImportResult.create({ data: { importId: batch.id, leadId: sandbox.id, rowNumber: 2, status: 'imported' } })).rejects.toThrow();
    await scope('SANDBOX', async () => {
      expect(await prisma.leadImportResult.count({ where: { importId: batch.id } })).toBe(0);
    });
  });
  it('allows Client Admin CRUD in both datasets with a legacy Sandbox account and no plan', async () => {
    const records: Record<string, string> = {};
    for (const environment of ['SANDBOX', 'PRODUCTION'] as const) {
      expect((await call(admin, '/auth/environment', 'PATCH', { environment })).status).toBe(200);
      const refreshed = await call(admin, '/auth/me');
      expect(refreshed.body.data.user.activeEnvironment).toBe(environment);
      expect(refreshed.body.data.user.tenantStatus).toBe('SANDBOX');
      for (const path of ['/crm/leads', '/crm/contacts', '/crm/accounts', '/crm/deals', '/automation/workflows', '/operations/tasks', '/marketing/campaigns', '/billing/invoices']) {
        const result = await call(admin, path);
        expect(result.status, `${path}: ${JSON.stringify(result.body)}`).toBe(200);
      }
      const created = await call(admin, '/crm/leads', 'POST', { firstName: 'Independent', lastName: environment });
      expect(created.status, JSON.stringify(created.body)).toBe(201);
      records[environment] = created.body.data.id;
      expect((await call(admin, `/crm/leads/${records[environment]}`, 'PUT', { firstName: 'Updated' })).status).toBe(200);
    }
    expect((await call(admin, `/crm/leads/${records.SANDBOX}`)).status).toBe(404);
    await call(admin, '/auth/environment', 'PATCH', { environment: 'SANDBOX' });
    expect((await call(admin, `/crm/leads/${records.PRODUCTION}`)).status).toBe(404);
    expect((await call(admin, `/crm/leads/${records.SANDBOX}`)).body.data.firstName).toBe('Updated');
    expect((await call(admin, `/crm/leads/${records.SANDBOX}/archive`, 'PATCH')).status).toBe(200);
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: records.PRODUCTION } })).status).not.toBe('Archived');
  });
  it('preserves the selected environment through password login, logout and login again', async () => {
    const password = 'Disposable-Environment-Only-42!';
    await prisma.user.update({ where: { id: admin.id }, data: { passwordHash: await hash(password, 4) } });
    const login = async () => {
      const response = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: admin.email, password }) });
      expect(response.status).toBe(200);
      const cookie = response.headers.get('set-cookie')!;
      tokens.set(admin.id, decodeURIComponent(cookie.match(/leadcrm_token=([^;]+)/)![1]));
      return (await response.json()).data.user;
    };
    expect((await login()).activeEnvironment).toBe('SANDBOX');
    await call(admin, '/auth/environment', 'PATCH', { environment: 'PRODUCTION' });
    expect((await call(admin, '/auth/logout', 'POST')).status).toBe(200);
    expect((await call(admin, '/auth/me')).status).toBe(401);
    expect((await login()).activeEnvironment).toBe('PRODUCTION');
    expect((await call(admin, '/auth/me')).body.data.user.activeEnvironment).toBe('PRODUCTION');
    await call(admin, '/auth/environment', 'PATCH', { environment: 'SANDBOX' });
  });
});
