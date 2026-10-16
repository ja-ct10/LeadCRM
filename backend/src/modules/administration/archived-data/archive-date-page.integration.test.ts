import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import prisma from '../../../config/database.config';
import { issueAuthSession } from '../../../core/auth/auth-session';
import { tenantContext } from '../../../core/tenant/tenant-context';
import app from '../../../app';
import { MAX_ACTIVE_PRODUCTS } from '@leadcrm/shared';
const url = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid/');
describe.skipIf(url.hostname !== '127.0.0.1' || url.pathname !== '/leadcrm_polish_test')('database-paged archive through authenticated HTTP', () => {
  let tenantId: string, adminId: string, adminToken: string, staffToken: string, base: string, server: Server;
  const scope = <T>(work: () => T) => tenantContext.run({ tenantId }, work);
  const taskIds: string[] = [];
  let roleId: string, leadId: string, unknownDateTask: string, productId: string;
  async function read(query = '', token = adminToken) {
    const response = await fetch(`${base}/administration/archived-data${query}`, { headers: { Authorization: `Bearer ${token}` } });
    return { status: response.status, body: await response.json() };
  }
  beforeAll(async () => {
    tenantId = (await prisma.tenant.create({ data: { name: 'Archive polish', slug: randomUUID(), status: 'ACTIVE' } })).id;
    const admin = await prisma.user.create({ data: { tenantId, email: `${randomUUID()}@camxian.com`, firstName: 'Admin', lastName: 'Archive', role: 'Client Admin', mustChangePassword: false, onboardingCompletedAt: new Date() } });
    adminId = admin.id; adminToken = (await issueAuthSession(admin)).token;
    const role = await scope(() => prisma.roleDefinition.create({ data: { tenantId, name: 'Archive task reader' } }));
    await scope(() => prisma.rolePermission.createMany({ data: ['archived_data', 'tasks'].map(module => ({ tenantId, roleId: role.id, module, canView: true })) }));
    const staff = await prisma.user.create({ data: { tenantId, email: `${randomUUID()}@camxian.com`, firstName: 'Staff', lastName: 'Archive', role: role.name, mustChangePassword: false, onboardingCompletedAt: new Date() } });
    await scope(() => prisma.userRole.create({ data: { tenantId, roleId: role.id, userId: staff.id } })); staffToken = (await issueAuthSession(staff)).token;
    for (let index = 0; index < 30; index++) {
      const task = await scope(() => prisma.task.create({ data: { tenantId, assignedUserId: adminId, title: `Archived ${index}`, dueDate: new Date('2026-01-01'), isArchived: true } }));
      taskIds.push(task.id);
      await prisma.auditLog.create({ data: { tenantId, userId: adminId, action: 'task.archived', entityType: 'Task', entityId: task.id, createdAt: new Date(Date.UTC(2026, 0, index + 1)) } });
    }
    unknownDateTask = (await scope(() => prisma.task.create({ data: { tenantId, assignedUserId: adminId, title: 'Archived without audit', dueDate: new Date('2026-01-01'), isArchived: true } }))).id;
    roleId = (await scope(() => prisma.roleDefinition.create({ data: { tenantId, name: 'Retired role', isArchived: true } }))).id;
    await prisma.auditLog.create({ data: { tenantId, userId: adminId, action: 'role.archived', entityType: 'RoleDefinition', entityId: roleId, createdAt: new Date('2026-02-01') } });
    leadId = (await scope(() => prisma.lead.create({ data: { tenantId, firstName: 'Literal', lastName: '100%_match', isArchived: true, deletedAt: new Date('2026-02-02') } }))).id;
    productId = (await scope(() => prisma.productInterest.create({ data: { tenantId, name: 'Archived Product 100%_match', dealValue: 5000.25, active: false, updatedAt: new Date('2026-02-01T12:00:00Z') } }))).id;
    await scope(() => prisma.productInterest.create({ data: { tenantId, name: 'Active Product', dealValue: 123 } }));
    server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1`;
  }, 30000);
  afterAll(async () => { if (server) await new Promise<void>(resolve => server.close(() => resolve())); await prisma.$disconnect(); });
  it('orders supported types together, excludes deleted roles, and returns stable distinct pages', async () => {
    const first = await read('?limit=5'); const second = await read('?limit=5&page=2');
    expect(first.status).toBe(200); expect(first.body.meta).toMatchObject({ total: 33, hasMore: true });
    expect(first.body.data.map((row: { id: string }) => row.id)).toEqual([leadId, productId, taskIds[29], taskIds[28], taskIds[27]]);
    expect(second.body.data.map((row: { id: string }) => row.id)).toEqual(taskIds.slice(22, 27).reverse());
    const oldest = await read('?sortOrder=asc&limit=5');
    expect(oldest.body.data.map((row: { id: string }) => row.id)).toEqual(taskIds.slice(0, 5));
    const last = await read('?limit=50');
    expect(last.body.data.at(-1)).toMatchObject({ id: unknownDateTask, archivedAt: null });
  });
  it('matches literal search terms consistently and preserves type permission boundaries', async () => {
    const match = await read('?search=Literal%20100%25_match'); expect(match.status).toBe(200);
    expect(match.body.meta.total).toBe(1); expect(match.body.data[0].id).toBe(leadId);
    const staff = await read('?limit=50', staffToken); expect(staff.status).toBe(200);
    expect(staff.body.meta.total).toBe(31); expect(staff.body.data.every((row: { type: string; canRestore: boolean }) => row.type === 'Task' && !row.canRestore)).toBe(true);
    expect((await read('?type=Role', staffToken)).status).toBe(400);
    expect((await read('?type=Product', staffToken)).status).toBe(403);
  });

  it('returns identical Product details and literal search results across sorting paths', async () => {
    await scope(() => prisma.productInterest.create({ data: { tenantId, name: 'Archived Product 100XXmatch', dealValue: 1, active: false } }));
    for (const sortBy of ['name', 'archivedAt']) {
      const result = await read(`?type=Product&sortBy=${sortBy}&search=product%20100%25_match`);
      expect(result.status).toBe(200);
      expect(result.body.meta.total).toBe(1);
      expect(result.body.data).toEqual([{ id: productId, type: 'Product', name: 'Archived Product 100%_match', detail: '₱5,000.25', archivedAt: '2026-02-01T12:00:00.000Z', canRestore: true }]);
    }
  });

  async function catalog(activeCount = 0) {
    const tenant = await prisma.tenant.create({ data: { name: 'Concurrent Product recovery', slug: randomUUID(), status: 'ACTIVE' } });
    const user = await prisma.user.create({ data: { tenantId: tenant.id, email: `${randomUUID()}@camxian.com`, firstName: 'Product', lastName: 'Admin', role: 'Client Admin', mustChangePassword: false, onboardingCompletedAt: new Date() } });
    const token = (await issueAuthSession(user)).token;
    if (activeCount) await prisma.productInterest.createMany({ data: Array.from({ length: activeCount }, (_, index) => ({ tenantId: tenant.id, name: `Active ${index}`, dealValue: 0 })) });
    const request = async (path: string, method = 'PATCH', body?: unknown) => {
      const response = await fetch(`${base}/administration/${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      return { status: response.status, body: await response.json() };
    };
    const archived = (name: string) => prisma.productInterest.create({ data: { tenantId: tenant.id, name, dealValue: 5000, active: false } });
    return { tenantId: tenant.id, request, archived };
  }

  it('commits only one of two competing case-insensitive duplicate restores', async () => {
    const actor = await catalog();
    const products = await Promise.all([actor.archived('CCTV Surveillance System'), actor.archived('cctv surveillance system')]);
    const results = await Promise.all(products.map(product => actor.request(`archived-data/Product/${product.id}/restore`)));
    expect(results.map(result => result.status).sort()).toEqual([200, 409]);
    const conflict = results.find(result => result.status === 409)!;
    expect(conflict.body.error.message ?? conflict.body.error).toBe('An active product with this name already exists.');
    expect(await prisma.productInterest.count({ where: { tenantId: actor.tenantId, active: true } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { tenantId: actor.tenantId, action: 'product.restored' } })).toBe(1);
  });

  it('restores a concurrently requested Product only once with one audit record', async () => {
    const actor = await catalog();
    const product = await actor.archived('One restore identity');
    const results = await Promise.all([actor.request(`archived-data/Product/${product.id}/restore`), actor.request(`archived-data/Product/${product.id}/restore`)]);
    expect(results.map(result => result.status).sort()).toEqual([200, 404]);
    expect(await prisma.auditLog.count({ where: { tenantId: actor.tenantId, entityId: product.id, action: 'product.restored' } })).toBe(1);
  });

  it.each(['restore', 'create'])('keeps the 100-product ceiling when restore competes with %s', async competingAction => {
    const actor = await catalog(MAX_ACTIVE_PRODUCTS - 1);
    const first = await actor.archived('First recovered Product');
    const second = await actor.archived('Second recovered Product');
    const results = await Promise.all([
      actor.request(`archived-data/Product/${first.id}/restore`),
      competingAction === 'restore' ? actor.request(`archived-data/Product/${second.id}/restore`) : actor.request('product-interests', 'POST', { name: 'Created competitor', dealValue: 100 }),
    ]);
    expect(results.map(result => result.status).sort()).toEqual([200, 400]);
    expect(await prisma.productInterest.count({ where: { tenantId: actor.tenantId, active: true } })).toBe(MAX_ACTIVE_PRODUCTS);
    expect(await prisma.productInterest.count({ where: { tenantId: actor.tenantId, active: false } })).toBe(competingAction === 'restore' ? 1 : results[0].status === 200 ? 1 : 2);
  });
});
