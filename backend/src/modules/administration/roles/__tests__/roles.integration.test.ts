import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { PERMISSION_MODULES } from '@leadcrm/shared';
import prisma from '../../../../config/database.config';
import { issueAuthSession } from '../../../../core/auth/auth-session';
import app from '../../../../app';
import * as repo from '../roles.repository';
const url = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid/');
const disposable = ['localhost', '127.0.0.1'].includes(url.hostname) && /^\/leadcrm_(?:polish_test|environment_test_\d+)$/.test(url.pathname);
describe.skipIf(!disposable)('custom roles: authenticated HTTP and database persistence', () => {
  let server: Server, base: string, tenantId: string, otherTenantId: string, token: string, readerToken: string, otherToken: string;
  const password = 'Role-Test-Password-123!';
  const email = `roles-admin-${Date.now()}@camxian.com`;
  const permissions = ['contacts', 'accounts', 'deals'].map(module => ({ module, canView: true, canCreate: true, canEdit: true, canDelete: false, canArchive: true }));
  async function call(path: string, method = 'GET', body?: unknown, bearer = token) {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json(), token: response.headers.get('set-cookie')?.match(/leadcrm_token=([^;]+)/)?.[1] };
  }
  async function expectAssignedCount(roleId: string, count: number) {
    const list = await call('/administration/roles');
    const detail = await call(`/administration/roles/${roleId}`);
    expect(list.status).toBe(200); expect(detail.status).toBe(200);
    expect(list.body.data.find((role: { id: string }) => role.id === roleId)?.userCount).toBe(count);
    expect(detail.body.data.userCount).toBe(count);
    return detail.body.data;
  }
  async function assignedUser(primary: string, roleIds: string[], status: 'ACTIVE' | 'INACTIVE' | 'PENDING' = 'ACTIVE', scope = tenantId) {
    return prisma.user.create({ data: {
      tenantId: scope, role: primary, status, email: `count-${randomUUID()}@camxian.com`, firstName: 'Count', lastName: 'Fixture',
      mustChangePassword: false, onboardingCompletedAt: new Date(), userRoles: { create: roleIds.map(roleId => ({ roleId })) },
    } });
  }
  beforeAll(async () => {
    const tenant = await prisma.tenant.create({ data: { name: 'Role test', slug: `roles-${Date.now()}`, onboardingStep: 3, onboardingCompletedAt: new Date() } });
    tenantId = tenant.id;
    otherTenantId = (await prisma.tenant.create({ data: { name: 'Other role test', slug: `roles-other-${Date.now()}`, onboardingStep: 3, onboardingCompletedAt: new Date() } })).id;
    const admin = await prisma.user.create({ data: { tenantId, role: 'Client Admin', email, firstName: 'Role', lastName: 'Admin', mustChangePassword: false, onboardingCompletedAt: new Date(), passwordHash: await bcrypt.hash(password, 10) } });
    token = (await issueAuthSession(admin)).token;
    readerToken = (await issueAuthSession(await prisma.user.create({ data: { tenantId, role: 'Reader', email: `roles-reader-${Date.now()}@camxian.com`, firstName: 'Role', lastName: 'Reader', mustChangePassword: false, onboardingCompletedAt: new Date() } }))).token;
    otherToken = (await issueAuthSession(await prisma.user.create({ data: { tenantId: otherTenantId, role: 'Client Admin', email: `roles-other-${Date.now()}@camxian.com`, firstName: 'Other', lastName: 'Admin', mustChangePassword: false, onboardingCompletedAt: new Date() } }))).token;
    server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
  });
  afterAll(async () => { if (server) await new Promise<void>(resolve => server.close(() => resolve())); await prisma.$disconnect(); });
  it('returns the canonical module registry', async () => {
    expect((await call('/administration/permissions')).body.data).toEqual(PERMISSION_MODULES);
  });
  it('counts distinct persisted assignments across roles and statuses, then follows removal, reassignment and rename', async () => {
    const primary = (await call('/administration/roles', 'POST', { name: 'Count primary', permissions: [permissions[0]] })).body.data;
    const secondary = (await call('/administration/roles', 'POST', { name: 'Count secondary', permissions: [permissions[2]] })).body.data;
    const staff = await assignedUser(primary.name, [primary.id, secondary.id]);
    await assignedUser(primary.name, [primary.id], 'INACTIVE');
    await assignedUser(primary.name, [primary.id], 'PENDING');
    await assignedUser(primary.name, []); // A matching label is not an assignment.
    const otherRole = (await call('/administration/roles', 'POST', { name: primary.name, permissions: [] }, otherToken)).body.data;
    await assignedUser(otherRole.name, [otherRole.id], 'ACTIVE', otherTenantId);
    const initialPermissions = await repo.findUserEffectivePermissions(staff.id, tenantId);
    expect(initialPermissions).toMatchObject({ contacts: { canView: true }, deals: { canView: true } });
    await expectAssignedCount(primary.id, 3); await expectAssignedCount(secondary.id, 1);
    expect((await call(`/administration/roles/${primary.id}`, 'GET', undefined, otherToken)).status).toBe(404);

    for (let attempt = 0; attempt < 2; attempt++) {
      expect((await call('/administration/roles/assign', 'POST', { userId: staff.id, roleId: primary.id })).status).toBe(200);
    }
    expect(await prisma.userRole.count({ where: { userId: staff.id, roleId: primary.id, tenantId } })).toBe(1);
    await expectAssignedCount(primary.id, 3); await expectAssignedCount(secondary.id, 1);
    expect(await repo.findUserEffectivePermissions(staff.id, tenantId)).toEqual(initialPermissions);

    expect((await call('/administration/roles/unassign', 'DELETE', { userId: staff.id, roleId: secondary.id })).status).toBe(200);
    await expectAssignedCount(primary.id, 3); await expectAssignedCount(secondary.id, 0);
    expect((await call(`/administration/users/${staff.id}`, 'PUT', { role: secondary.name })).status).toBe(200);
    await expectAssignedCount(primary.id, 2); await expectAssignedCount(secondary.id, 1);
    const assignments = await prisma.userRole.findMany({ where: { userId: staff.id, tenantId } });
    const permissionsBeforeRename = await repo.findUserEffectivePermissions(staff.id, tenantId);
    expect((await call(`/administration/roles/${secondary.id}`, 'PUT', { name: 'Count renamed secondary' })).status).toBe(200);
    const renamed = await expectAssignedCount(secondary.id, 1);
    expect(renamed.name).toBe('Count renamed secondary');
    expect(await prisma.userRole.findMany({ where: { userId: staff.id, tenantId } })).toEqual(assignments);
    expect(await repo.findUserEffectivePermissions(staff.id, tenantId)).toEqual(permissionsBeforeRename);
    await expectAssignedCount(secondary.id, 1);
  });

  it('returns persisted system-role counts without changing Client Admin permissions or edit protection', async () => {
    const role = await prisma.roleDefinition.create({ data: { tenantId, name: 'Client Admin', isSystemRole: true } });
    const admin = await assignedUser(role.name, [role.id]);
    await assignedUser(role.name, [role.id]);
    const grants = await repo.findUserEffectivePermissions(admin.id, tenantId);
    expect(grants.roles).toMatchObject({ canView: true, canEdit: true, canAssign: true });
    await expectAssignedCount(role.id, 2);
    expect((await call(`/administration/roles/${role.id}`, 'PUT', { name: 'Changed admin' })).status).toBe(403);
    await expectAssignedCount(role.id, 2);
    expect(await repo.findUserEffectivePermissions(admin.id, tenantId)).toEqual(grants);
  });

  it('counts all assignments beyond the limited role-detail user preview', async () => {
    const role = (await call('/administration/roles', 'POST', { name: 'Count beyond preview', permissions: [] })).body.data;
    const ids = Array.from({ length: 51 }, () => randomUUID());
    await prisma.user.createMany({ data: ids.map(id => ({ id, tenantId, role: role.name, email: `count-${id}@camxian.com`, firstName: 'Preview', lastName: 'Fixture' })) });
    await prisma.userRole.createMany({ data: ids.map(userId => ({ tenantId, userId, roleId: role.id })) });
    const detail = await expectAssignedCount(role.id, 51);
    expect(detail.assignedUsers).toHaveLength(50);
    expect(new Set(detail.assignedUsers.map((user: { id: string }) => user.id)).size).toBe(50);
  });
  it('creates RoleDefinition and RolePermission rows, returns them, reloads, and survives logout/login and a new session', async () => {
    const created = await call('/administration/roles', 'POST', { name: ' Sales Assistant ', description: 'Persisted', permissions });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ success: true, data: { name: 'Sales Assistant', description: 'Persisted', tenantId, userCount: 0, isSystemRole: false } });
    const id = created.body.data.id;
    expect(created.body.data.createdAt).toBeTruthy();
    const row = await prisma.roleDefinition.findUniqueOrThrow({ where: { id }, include: { permissions: true } });
    expect(row.name).toBe('Sales Assistant'); expect(row.permissions).toHaveLength(3);
    for (const permission of permissions) {
      expect(row.permissions).toContainEqual(expect.objectContaining({ ...permission, tenantId, roleId: id }));
      expect(created.body.data.permissions).toContainEqual(expect.objectContaining(permission));
    }
    expect((await call('/administration/roles')).body.data).toContainEqual(created.body.data);
    expect((await call('/auth/logout', 'POST', {})).status).toBe(200);
    const login = await call('/auth/login', 'POST', { email, password }, '');
    expect(login.status).toBe(200); token = login.token!;
    expect((await call(`/administration/roles/${id}`)).body.data).toMatchObject(created.body.data);
    const secondSession = await issueAuthSession(await prisma.user.findUniqueOrThrow({ where: { tenantId_email: { tenantId, email } } }));
    expect((await call('/administration/roles', 'GET', undefined, secondSession.token)).body.data).toContainEqual(created.body.data);
    const updated = await call(`/administration/roles/${id}`, 'PUT', { permissions: [permissions[0]] });
    expect(updated.body.data.permissions).toHaveLength(1);
    expect(await prisma.rolePermission.count({ where: { roleId: id } })).toBe(1);
    expect((await call(`/administration/roles/${id}`, 'GET', undefined, otherToken)).status).toBe(404);
    expect((await call(`/administration/roles/${id}`, 'PUT', { name: 'Stolen' }, otherToken)).status).toBe(404);
  });
  it('allows zero permissions, rejects invalid names/modules/flags and browser tenant IDs without writes', async () => {
    expect((await call('/administration/roles', 'POST', { name: 'No access', permissions: [] })).status).toBe(201);
    for (const payload of [{ name: ' ' }, { name: '' }, { name: 'Invalid module', permissions: [{ ...permissions[0], module: 'p2' }] }, { name: 'Invalid action', permissions: [{ ...permissions[0], module: 'dashboard' }] }, { name: 'Duplicate module', permissions: [permissions[0], permissions[0]] }, { name: 'Spoof', tenantId: otherTenantId }]) {
      expect((await call('/administration/roles', 'POST', payload)).status).toBe(400);
    }
    expect(await prisma.roleDefinition.count({ where: { tenantId, name: { in: ['Invalid module', 'Invalid action', 'Duplicate module', 'Spoof'] } } })).toBe(0);
  });
  it('rejects duplicates with a friendly conflict, including archived names and concurrent writes; uniqueness is tenant scoped', async () => {
    const duplicate = await call('/administration/roles', 'POST', { name: 'Sales Assistant', permissions });
    expect(duplicate.status).toBe(409); expect(JSON.stringify(duplicate.body)).toContain('A role with this name already exists.');
    expect(await prisma.roleDefinition.count({ where: { tenantId, name: 'Sales Assistant' } })).toBe(1);
    expect((await call('/administration/roles', 'POST', { name: 'Sales Assistant', permissions }, otherToken)).status).toBe(201);
    const archived = await prisma.roleDefinition.create({ data: { tenantId, name: 'Archived role', isArchived: true } });
    expect((await call('/administration/roles', 'POST', { name: archived.name })).status).toBe(409);
    const race = await Promise.all([call('/administration/roles', 'POST', { name: 'Concurrent', permissions }), call('/administration/roles', 'POST', { name: 'Concurrent', permissions })]);
    expect(race.map(result => result.status).sort()).toEqual([201, 409]);
  });
  it('enforces authentication/authorization and propagates server errors', async () => {
    expect((await call('/administration/roles', 'POST', { name: 'Anonymous' }, '')).status).toBe(401);
    expect((await call('/administration/roles', 'POST', { name: 'Forbidden' }, readerToken)).status).toBe(403);
    const failure = vi.spyOn(repo, 'createRole').mockRejectedValueOnce(new Error('Simulated unavailable database'));
    try { expect((await call('/administration/roles', 'POST', { name: 'Failure' })).status).toBe(500); }
    finally { failure.mockRestore(); }
    expect(await prisma.roleDefinition.count({ where: { tenantId, name: { in: ['Anonymous', 'Forbidden', 'Failure'] } } })).toBe(0);
  });
  it('rolls back the RoleDefinition after a simulated RolePermission write failure', async () => {
    const transaction = prisma.$transaction.bind(prisma);
    const failure = vi.spyOn(prisma, '$transaction').mockImplementationOnce((async (work: (tx: any) => Promise<unknown>) => transaction(async tx => {
      const write = vi.spyOn(tx.rolePermission, 'createMany').mockRejectedValueOnce(new Error('Simulated permission write failure'));
      try { return await work(tx); } finally { write.mockRestore(); }
    })) as never);
    try { await expect(repo.createRole(tenantId, { name: 'Rollback' }, [permissions[0]])).rejects.toThrow('Simulated permission write failure'); }
    finally { failure.mockRestore(); }
    expect(await prisma.roleDefinition.count({ where: { tenantId, name: 'Rollback' } })).toBe(0);
    expect(await prisma.rolePermission.count({ where: { tenantId, role: { name: 'Rollback' } } })).toBe(0);
  });
  it('rolls back a role rename, staff role label and permission replacement on an update failure', async () => {
    const created = await call('/administration/roles', 'POST', { name: 'Atomic rename', permissions: [permissions[0]] });
    const roleId = created.body.data.id;
    const staff = await prisma.user.create({ data: { tenantId, role: 'Atomic rename', email: `atomic-${Date.now()}@camxian.com`, firstName: 'Atomic', lastName: 'Staff', mustChangePassword: false, onboardingCompletedAt: new Date() } });
    await prisma.userRole.create({ data: { tenantId, userId: staff.id, roleId } });
    const transaction = prisma.$transaction.bind(prisma);
    const failure = vi.spyOn(prisma, '$transaction').mockImplementationOnce((async (work: (tx: any) => Promise<unknown>, options: any) => transaction(async tx => {
      const write = vi.spyOn(tx.rolePermission, 'upsert').mockRejectedValueOnce(new Error('Simulated permission update failure'));
      try { return await work(tx); } finally { write.mockRestore(); }
    }, options)) as never);
    try { await expect(repo.updateRoleAndPermissions(roleId, tenantId, { name: 'Renamed after failure' }, [permissions[1]])).rejects.toThrow('Simulated permission update failure'); }
    finally { failure.mockRestore(); }
    expect((await prisma.roleDefinition.findUniqueOrThrow({ where: { id: roleId } })).name).toBe('Atomic rename');
    expect((await prisma.user.findUniqueOrThrow({ where: { id: staff.id } })).role).toBe('Atomic rename');
    expect((await prisma.rolePermission.findMany({ where: { tenantId, roleId } })).map(permission => permission.module)).toEqual([permissions[0].module]);
  });
});
