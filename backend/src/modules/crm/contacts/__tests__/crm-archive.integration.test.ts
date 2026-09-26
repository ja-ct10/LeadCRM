import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';

// Always use an isolated in-memory PostgreSQL database, never DATABASE_URL.
vi.mock('../../../../config/database.config', async () => {
  const { installEnvironmentScoping } = await import('../../../../core/environment/environment-prisma');
  const client = new PrismaClient({ datasources: { db: { url: process.env.CRM_ARCHIVE_TEST_DATABASE_URL! } } });
  installEnvironmentScoping(client);
  return { default: client };
});

let pg: PGlite, socket: PGLiteSocketServer, db: PrismaClient, server: Server;
let base: string, tenantId: string, otherTenantId: string, adminCookie: string, viewerCookie: string;
const legacyId = randomUUID();
const modules = ['leads', 'contacts', 'accounts'] as const;
type Module = typeof modules[number];
const delegate = (module: Module) => module === 'leads' ? db.lead : module === 'contacts' ? db.contact : db.account;

async function call(path: string, method = 'GET', cookie = adminCookie, body?: unknown) {
  const response = await fetch(`${base}/crm/${path}`, {
    method, headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: await response.json() };
}
async function create(module: Module, tenant = tenantId, environment: 'PRODUCTION' | 'SANDBOX' = 'PRODUCTION') {
  if (module === 'leads') return db.lead.create({ data: { tenantId: tenant, environment, firstName: 'Archived', lastName: 'Lead', status: 'Qualified', productInterest: [] } });
  if (module === 'contacts') return db.contact.create({ data: { tenantId: tenant, environment, firstName: 'Archived', lastName: 'Contact', status: 'HOT', activeProducts: [], productInterests: [] } });
  return db.account.create({ data: { tenantId: tenant, environment, name: 'Archived Account', tags: [], productInterests: [], activeProducts: [] } });
}

beforeAll(async () => {
  process.env.JWT_SECRET = 'isolated-crm-archive-test-signing-key';
  pg = await PGlite.create();
  await pg.exec(readFileSync(resolve(__dirname, '../../../../tests/security-baseline.sql'), 'utf8'));
  await pg.exec(`INSERT INTO "Tenant" (id,name,slug,"updatedAt") VALUES ('legacy-tenant','Legacy','legacy',NOW());
    INSERT INTO "Lead" (id,"tenantId","firstName","lastName",status,"updatedAt") VALUES ('${legacyId}','legacy-tenant','Legacy','Archive','Archived',NOW());`);
  for (const migration of ['20261007000000_add_mfa', '20261008000000_remove_retired_billing_domains', '20261009000000_lead_archive_state']) {
    await pg.exec(readFileSync(resolve(__dirname, '../../../../../prisma/migrations', migration, 'migration.sql'), 'utf8'));
  }
  socket = new PGLiteSocketServer({ db: pg, host: '127.0.0.1', port: 0 });
  await socket.start();
  process.env.CRM_ARCHIVE_TEST_DATABASE_URL = `postgresql://postgres:postgres@${socket.getServerConn()}/postgres?connection_limit=1`;
  db = (await import('../../../../config/database.config')).default;
  const tenant = await db.tenant.create({ data: { name: 'Archive test', slug: 'archive-test', status: 'ACTIVE', onboardingStep: 3, onboardingCompletedAt: new Date() } });
  tenantId = tenant.id;
  otherTenantId = (await db.tenant.create({ data: { name: 'Other tenant', slug: 'other-archive-test' } })).id;
  const admin = await db.user.create({ data: { tenantId, email: 'archive@camxian.com', firstName: 'Archive', lastName: 'Admin', role: 'Client Admin', activeEnvironment: 'PRODUCTION', mustChangePassword: false } });
  const viewer = await db.user.create({ data: { tenantId, email: 'viewer@camxian.com', firstName: 'Read', lastName: 'Only', role: 'Archive Viewer', activeEnvironment: 'PRODUCTION', mustChangePassword: false } });
  const role = await db.roleDefinition.create({ data: { tenantId, name: 'Archive Viewer', permissions: { create: ['contacts', 'organizations'].map(module => ({ tenantId, module, canView: true, canEdit: false, canDelete: false })) } } });
  await db.userRole.create({ data: { tenantId, userId: viewer.id, roleId: role.id } });
  const { issueAuthSession } = await import('../../../../core/auth/auth-session');
  adminCookie = `leadcrm_token=${(await issueAuthSession(admin)).token}`;
  viewerCookie = `leadcrm_token=${(await issueAuthSession(viewer)).token}`;
  server = (await import('../../../../app')).default.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1`;
}, 60_000);
afterAll(async () => {
  if (server) await new Promise<void>(resolve => server.close(() => resolve()));
  await db?.$disconnect(); await socket?.stop(); await pg?.close();
});

describe.sequential('CRM archive and restore through authenticated HTTP and PostgreSQL', () => {
  it('migrates legacy archived leads without deleting or changing their status', async () => {
    expect(await db.lead.findUniqueOrThrow({ where: { id: legacyId } })).toMatchObject({ status: 'Archived', isArchived: true });
    const { restoreContact } = await import('../contacts.repository');
    await restoreContact(legacyId, 'legacy-tenant');
    expect(await db.lead.findUniqueOrThrow({ where: { id: legacyId } })).toMatchObject({ status: 'Inquiry', isArchived: false });
  });
  it.each(modules)('%s persists archive, excludes active lists/counts, and restores without deleting relationships', async module => {
    const row = await create(module);
    const before = await call(module);
    const response = await call(`${module}/${row.id}/archive`, 'PATCH');
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    const archived = await (delegate(module) as any).findUniqueOrThrow({ where: { id: row.id } });
    expect(archived.isArchived).toBe(true);
    expect(archived.deletedAt).toBeInstanceOf(Date);
    if ('status' in row) expect(archived.status).toBe(row.status);
    expect((await call(`${module}/${row.id}/archive`, 'PATCH')).status).toBe(404);
    const active = await call(module);
    expect(active.body.data.some((item: any) => item.id === row.id)).toBe(false);
    expect(active.body.meta.total).toBe(before.body.meta.total - 1);
    expect((await call(`${module}?archived=true`)).body.data.some((item: any) => item.id === row.id)).toBe(true);
    // A fresh authenticated read observes persisted state, not frontend memory.
    expect((await call(`${module}/${row.id}/restore`, 'PATCH')).status).toBe(200);
    const restored = await (delegate(module) as any).findUniqueOrThrow({ where: { id: row.id } });
    expect(restored).toMatchObject({ isArchived: false, deletedAt: null, deletedBy: null });
    if ('status' in row) expect(restored.status).toBe(row.status);
    expect((await call(module)).body.data.some((item: any) => item.id === row.id)).toBe(true);
    expect((await call(`${module}?archived=true`)).body.data.some((item: any) => item.id === row.id)).toBe(false);
    expect((await call(`${module}/${row.id}/restore`, 'PATCH')).status).toBe(404);
    expect(await db.auditLog.count({ where: { entityId: row.id } })).toBe(2);
  });
  it.each(modules)('%s rejects cross-tenant and cross-environment archive and restore', async module => {
    for (const row of [await create(module, otherTenantId), await create(module, tenantId, 'SANDBOX')]) {
      expect((await call(`${module}/${row.id}/archive`, 'PATCH')).status).toBe(404);
      await (delegate(module) as any).update({ where: { id: row.id }, data: { isArchived: true } });
      expect((await call(`${module}/${row.id}/restore`, 'PATCH')).status).toBe(404);
      expect(await (delegate(module) as any).findUniqueOrThrow({ where: { id: row.id } })).toHaveProperty('isArchived', true);
      expect((await call(`${module}?archived=true`)).body.data.some((item: any) => item.id === row.id)).toBe(false);
    }
  });
  it.each(modules)('%s requires authentication, permissions, valid IDs and existing records', async module => {
    const row = await create(module);
    for (const action of ['archive', 'restore']) {
      expect((await call(`${module}/${row.id}/${action}`, 'PATCH', '')).status).toBe(401);
      expect((await call(`${module}/${row.id}/${action}`, 'PATCH', viewerCookie)).status).toBe(403);
      expect((await call(`${module}/invalid/${action}`, 'PATCH')).status).toBe(400);
      expect((await call(`${module}/${randomUUID()}/${action}`, 'PATCH')).status).toBe(404);
    }
    expect(await (delegate(module) as any).findUniqueOrThrow({ where: { id: row.id } })).toHaveProperty('isArchived', false);
  });
  it('does not allow a status filter to expose archived leads', async () => {
    const row = await create('leads');
    await call(`leads/${row.id}/archive`, 'PATCH');
    expect((await call('leads?filter[status]=in:Qualified')).body.data.some((item: any) => item.id === row.id)).toBe(false);
  });
  it('preserves account links and related records throughout archive and restore', async () => {
    const account = await create('accounts');
    const lead = await create('leads');
    const contact = await create('contacts');
    await db.lead.update({ where: { id: lead.id }, data: { accountId: account.id, contactId: contact.id } });
    await db.contact.update({ where: { id: contact.id }, data: { accountId: account.id } });
    for (const action of ['archive', 'restore']) {
      for (const [module, id] of [['accounts', account.id], ['contacts', contact.id], ['leads', lead.id]]) {
        expect((await call(`${module}/${id}/${action}`, 'PATCH')).status).toBe(200);
      }
      expect(await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).toMatchObject({ accountId: account.id, contactId: contact.id });
      expect(await db.contact.findUniqueOrThrow({ where: { id: contact.id } })).toHaveProperty('accountId', account.id);
      expect(await db.account.findUnique({ where: { id: account.id } })).not.toBeNull();
    }
  });
});
