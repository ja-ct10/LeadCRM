import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
vi.mock('../../../core/auth/welcome-credentials.service', () => ({ sendWelcomeCredentials: vi.fn().mockResolvedValue(false) }));
import prisma from '../../../config/database.config';
import { tenantContext } from '../../../core/tenant/tenant-context';
import { issueAuthSession } from '../../../core/auth/auth-session';
import app from '../../../app';
import { sendWelcomeCredentials } from '../../../core/auth/welcome-credentials.service';
const url = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid/');
const disposable = url.hostname === '127.0.0.1' && url.pathname === '/leadcrm_polish_test';
describe.skipIf(!disposable)('User/Group HTTP synchronization and permissions', () => {
  let server: Server, base: string, tenantId: string, adminId: string, userId: string, adminToken: string, staffToken: string, groupId: string, foreignGroupId: string;
  const scope = <T>(work: () => T) => tenantContext.run({ tenantId }, work);
  async function request(path: string, method = 'GET', body?: unknown, token = adminToken) {
    const response = await fetch(base + path, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json() };
  }
  beforeAll(async () => {
    const tenant = await prisma.tenant.create({ data: { name: 'Polish test', slug: randomUUID(), status: 'ACTIVE' } }); tenantId = tenant.id;
    const other = await prisma.tenant.create({ data: { name: 'Other', slug: randomUUID(), status: 'ACTIVE' } });
    const admin = await prisma.user.create({ data: { tenantId, email: `${randomUUID()}@camxian.com`, firstName: 'Admin', lastName: 'Test', role: 'Client Admin', mustChangePassword: false, onboardingCompletedAt: new Date() } });
    const staff = await prisma.user.create({ data: { tenantId, email: `${randomUUID()}@camxian.com`, firstName: 'Staff', lastName: 'Test', role: 'Sales', mustChangePassword: false, onboardingCompletedAt: new Date() } });
    adminId = admin.id; userId = staff.id; adminToken = (await issueAuthSession(admin)).token; staffToken = (await issueAuthSession(staff)).token;
    groupId = (await scope(() => prisma.tenantGroup.create({ data: { tenantId, name: 'Sales' } }))).id;
    foreignGroupId = (await tenantContext.run({ tenantId: other.id }, () => prisma.tenantGroup.create({ data: { tenantId: other.id, name: 'Sales' } }))).id;
    await scope(() => prisma.roleDefinition.create({ data: { tenantId, name: 'Sales' } }));
    await scope(() => prisma.roleDefinition.create({ data: { tenantId, name: 'Client Admin', isSystemRole: true } }));
    // A current custom role grants user editing, but cannot grant group membership.
    const role = await scope(() => prisma.roleDefinition.findFirstOrThrow({ where: { tenantId, name: 'Sales' } }));
    await scope(() => prisma.rolePermission.createMany({ data: ['users', 'workflows', 'leads', 'deals', 'tasks'].map(module => ({ roleId: role.id, tenantId, module, canView: true, canEdit: true, canCreate: true })) }));
    await scope(() => prisma.userRole.create({ data: { tenantId, userId, roleId: role.id } }));
    server = app.listen(0); await new Promise<void>(resolve => server.once('listening', resolve));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1`;
  }, 30000);
  afterAll(async () => { if (server) await new Promise<void>(resolve => server.close(() => resolve())); await prisma.$disconnect(); });
  it('admin updates membership once and User, self Profile, Group and Workflow APIs agree', async () => {
    const result = await request(`/administration/users/${userId}`, 'PUT', { groupIds: [groupId] });
    expect(result.status).toBe(200); expect(result.body.data.groups).toEqual([{ id: groupId, name: 'Sales' }]);
    expect(result.body.data).not.toHaveProperty('department'); expect(result.body.data).not.toHaveProperty('groupMemberships');
    expect((await request('/auth/me', 'GET', undefined, staffToken)).body.data.user.groups).toEqual([{ id: groupId, name: 'Sales' }]);
    const group = (await request('/administration/groups')).body.data.find((row: { id: string }) => row.id === groupId);
    expect(group.members.map((member: { userId: string }) => member.userId)).toContain(userId);
    const options = await request('/automation/workflow-options');
    expect(options.status).toBe(200);
    expect(options.body.data.groups.find((row: { id: string }) => row.id === groupId).members.map((member: { id: string }) => member.id)).toContain(userId);
    expect((await request(`/administration/users/${userId}`, 'PUT', { groupIds: [groupId] })).status).toBe(200);
    expect(await scope(() => prisma.tenantGroupMember.count({ where: { tenantId, userId } }))).toBe(1);
  });
  it('rejects foreign groups and self-granted memberships without losing existing membership', async () => {
    expect((await request('/administration/groups', 'GET', undefined, staffToken)).status).toBe(403);
    expect((await request(`/administration/users/${userId}`, 'PUT', { groupIds: [foreignGroupId] })).status).toBe(400);
    expect((await request(`/administration/users/${userId}`, 'PUT', { groupIds: [] }, staffToken)).status).toBe(403);
    expect((await request('/auth/profile', 'PATCH', { groupIds: [groupId] }, staffToken)).status).toBe(400);
    expect(await scope(() => prisma.tenantGroupMember.count({ where: { tenantId, userId, groupId } }))).toBe(1);
  });
  it('supports activation and membership in one transaction and broadcasts persisted access revisions', async () => {
    await scope(() => prisma.user.update({ where: { id: userId, tenantId }, data: { status: 'INACTIVE' } }));
    const before = await prisma.dashboardRevision.findUniqueOrThrow({ where: { tenantId } });
    expect((await request(`/administration/users/${userId}`, 'PUT', { status: 'ACTIVE', groupIds: [] })).status).toBe(200);
    expect(await scope(() => prisma.tenantGroupMember.count({ where: { tenantId, userId } }))).toBe(0);
    const after = await prisma.dashboardRevision.findUniqueOrThrow({ where: { tenantId } });
    expect(after.access > before.access).toBe(true);
  });
  it('creates a user and group membership atomically through the existing provisioning API', async () => {
    const response = await request('/administration/users', 'POST', { firstName: 'New', lastName: 'Agent', email: `${randomUUID()}@camxian.com`, phone: '9123456789', role: 'Sales', groupIds: [groupId] });
    expect(response.status).toBe(201); expect(response.body.data.groups).toEqual([{ id: groupId, name: 'Sales' }]);
    expect(response.body.data.setupEmailSent).toBe(false); expect(response.body.data).not.toHaveProperty('passwordHash');
  });
  const newUser = (role = 'Client Admin') => ({ firstName: 'New', lastName: 'Administrator', email: `${randomUUID()}@camxian.com`, phone: '9123456789', role });
  it('creates another Client Admin with canonical membership and onboarding requirements in the same tenant', async () => {
    const input = newUser();
    const response = await request('/administration/users', 'POST', { ...input, groupIds: [groupId] });
    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({ tenantId, role: 'Client Admin', groups: [{ id: groupId, name: 'Sales' }] });
    expect(response.body.data).not.toHaveProperty('passwordHash');
    const saved = await scope(() => prisma.user.findFirstOrThrow({ where: { tenantId, email: input.email }, include: { userRoles: { include: { role: true } } } }));
    expect(saved).toMatchObject({ mustChangePassword: true, onboardingCompletedAt: null });
    expect(saved.userRoles).toHaveLength(1);
    expect(saved.userRoles[0]).toMatchObject({ tenantId, role: { name: 'Client Admin', isSystemRole: true } });
    expect(await scope(() => prisma.auditLog.count({ where: { tenantId, entityId: saved.id, userId: adminId, action: 'user.created' } }))).toBe(1);
    expect((await request(`/administration/users/${saved.id}`, 'PUT', { role: 'Sales' })).status).toBe(403);
    expect((await request(`/administration/users/${userId}`, 'PUT', { role: 'Client Admin' })).status).toBe(403);
  });
  it('allows delegated custom-role creation but rejects crafted Client Admin requests even with roles.assign', async () => {
    const role = await scope(() => prisma.roleDefinition.findFirstOrThrow({ where: { tenantId, name: 'Sales' } }));
    await scope(() => prisma.rolePermission.create({ data: { tenantId, roleId: role.id, module: 'roles', canView: true, canAssign: true } }));
    try {
      const created = await request('/administration/users', 'POST', newUser('Sales'), staffToken);
      expect(created.status, JSON.stringify(created.body)).toBe(201);
      const denied = newUser();
      expect((await request('/administration/users', 'POST', denied, staffToken)).status).toBe(403);
      expect(await scope(() => prisma.user.count({ where: { tenantId, email: denied.email } }))).toBe(0);
    } finally { await scope(() => prisma.rolePermission.deleteMany({ where: { tenantId, roleId: role.id, module: 'roles' } })); }
    expect((await request('/administration/users', 'POST', newUser('Sales'), staffToken)).status).toBe(403);
  });
  it('rolls back the new administrator, membership and audits when a group belongs to another tenant', async () => {
    const input = newUser(), deliveries = vi.mocked(sendWelcomeCredentials).mock.calls.length;
    const membershipCount = await scope(() => prisma.userRole.count({ where: { tenantId } }));
    expect((await request('/administration/users', 'POST', { ...input, groupIds: [foreignGroupId] })).status).toBe(400);
    expect(await scope(() => prisma.user.count({ where: { tenantId, email: input.email } }))).toBe(0);
    expect(await scope(() => prisma.userRole.count({ where: { tenantId } }))).toBe(membershipCount);
    expect(await scope(() => prisma.auditLog.count({ where: { tenantId, action: 'user.created', changeset: { path: ['after', 'email'], equals: input.email } } }))).toBe(0);
    expect(vi.mocked(sendWelcomeCredentials).mock.calls).toHaveLength(deliveries);
  });
  it('requires the active canonical system role and rejects a historical custom row bearing the admin name', async () => {
    const role = await scope(() => prisma.roleDefinition.findFirstOrThrow({ where: { tenantId, name: 'Client Admin' } }));
    try {
      for (const data of [{ isArchived: true, isSystemRole: true }, { isArchived: false, isSystemRole: false }]) {
        await scope(() => prisma.roleDefinition.update({ where: { id: role.id }, data }));
        const input = newUser();
        expect((await request('/administration/users', 'POST', input)).status).toBe(400);
        expect(await scope(() => prisma.user.count({ where: { tenantId, email: input.email } }))).toBe(0);
      }
    } finally { await scope(() => prisma.roleDefinition.update({ where: { id: role.id }, data: { isArchived: false, isSystemRole: true } })); }
  });
});
