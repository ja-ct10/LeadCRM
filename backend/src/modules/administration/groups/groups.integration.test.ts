import { afterAll, beforeAll, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import prisma from '../../../config/database.config';
import { tenantContext } from '../../../core/tenant/tenant-context';
import { issueAuthSession } from '../../../core/auth/auth-session';
import app from '../../../app';
import { ensureSalesGroup } from './sales-group';
import { deleteEmptyGroup } from './groups.repository';
import { assignRoleToUser } from '../roles/roles.repository';

const url = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid/');
const disposable = ['localhost', '127.0.0.1'].includes(url.hostname) && /^\/leadcrm_(?:polish_test|campaign_test_\d+)$/.test(url.pathname);
let server: Server, base: string, tenantId: string, token: string, deniedToken: string, userId: string, foreignUserId: string;
// The native harness uses four connections; the PGlite fixture serializes through one.
const nativeConcurrency = disposable && url.searchParams.get('connection_limit') !== '1';
let beforeMemberInsert: (() => Promise<void>) | undefined;
let failAuditForGroup: string | undefined;
let beforeHeadWrite: (() => Promise<void>) | undefined;
const scoped = <T>(work: () => T) => tenantContext.run({ tenantId }, work);
async function request(path: string, method = 'GET', body?: unknown, auth = token) {
  const response = await fetch(base + path, { method, headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, body: await response.json() };
}
beforeAll(async () => {
  if (!disposable) return;
  prisma.$use(async (params, next) => {
    if (params.model === 'TenantGroupMember' && params.action === 'createMany') await beforeMemberInsert?.();
    if (params.model === 'TenantGroupMember' && params.action === 'updateMany' && params.args.data.isHead === false) await beforeHeadWrite?.();
    if (params.model === 'AuditLog' && params.action === 'createMany' &&
      params.args.data.some((row: { entityId: string }) => row.entityId === failAuditForGroup)) throw new Error('Injected audit write failure');
    if (params.model === 'AuditLog' && params.action === 'create' && params.args.data.entityId === failAuditForGroup && failAuditForGroup) throw new Error('Injected audit write failure');
    return next(params);
  });
  tenantId = (await prisma.tenant.create({ data: { name: 'Groups tests', slug: randomUUID(), onboardingStep: 3, onboardingCompletedAt: new Date() } })).id;
  const other = await prisma.tenant.create({ data: { name: 'Other tenant', slug: randomUUID() } });
  const user = await prisma.user.create({ data: { tenantId, email: `${randomUUID()}@camxian.com`, firstName: 'Julie', lastName: 'Tiron', role: 'Client Admin', mustChangePassword: false, emailVerified: new Date(), onboardingCompletedAt: new Date() } });
  userId = user.id; token = (await issueAuthSession(user)).token;
  const denied = await prisma.user.create({ data: { tenantId, email: `${randomUUID()}@camxian.com`, firstName: 'Denied', lastName: 'User', role: 'Sales', mustChangePassword: false, emailVerified: new Date(), onboardingCompletedAt: new Date() } });
  deniedToken = (await issueAuthSession(denied)).token;
  foreignUserId = (await prisma.user.create({ data: { tenantId: other.id, email: `${randomUUID()}@camxian.com`, firstName: 'Other', lastName: 'User', role: 'Sales' } })).id;
  server = app.listen(0); await new Promise<void>(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1/administration/groups`;
}, 30000);
afterAll(async () => { if (server) await new Promise<void>(resolve => server.close(() => resolve())); await prisma.$disconnect(); });

it.skipIf(!disposable)('validates blank names on create/update, trims, permits zero members and deletes an empty group', async () => {
  for (const name of ['', '   ', '\t\n']) expect((await request('', 'POST', { name })).status).toBe(400);
  const created = await request('', 'POST', { name: ' Support ' }); expect(created.status).toBe(201); expect(created.body.data.name).toBe('Support'); expect(created.body.data.members).toEqual([]);
  const id = created.body.data.id;
  expect((await request(`/${id}`, 'PUT', { name: '  ' })).status).toBe(400);
  const updated = await request(`/${id}`, 'PUT', { name: ' Customer Support ' }); expect(updated.body.data.name).toBe('Customer Support');
  expect((await request(`/${id}`, 'DELETE')).status).toBe(200);
  expect(await scoped(() => prisma.tenantGroup.findFirst({ where: { id, tenantId } }))).toBeNull();
});
it.skipIf(!disposable)('rejects nonempty deletion from actual rows, keeps members unique, removes then permits deletion', async () => {
  const id = (await request('', 'POST', { name: 'Sales' })).body.data.id;
  expect((await request(`/${id}/members`, 'POST', { userId })).status).toBe(200);
  expect((await request(`/${id}/members`, 'POST', { userId })).status).toBe(200);
  expect(await scoped(() => prisma.tenantGroupMember.count({ where: { groupId: id, tenantId } }))).toBe(1);
  const denied = await request(`/${id}`, 'DELETE'); expect(denied.status).toBe(409); expect(denied.body.error).toBe('Remove all members from this group before deleting it.');
  const rows = (await request('')).body.data; expect(rows.find((group: { id: string }) => group.id === id).members[0].user).toMatchObject({ firstName: 'Julie', lastName: 'Tiron', role: 'Client Admin' });
  expect((await request(`/${id}/members/${userId}`, 'DELETE')).status).toBe(200);
  expect((await request(`/${id}`, 'DELETE')).status).toBe(200);
});
it.skipIf(!disposable)('preserves RBAC and tenant isolation for group and membership mutations', async () => {
  expect((await request('', 'GET', undefined, deniedToken)).status).toBe(403);
  const id = (await request('', 'POST', { name: 'Scoped group' })).body.data.id;
  expect((await request(`/${id}/members`, 'POST', { userId: foreignUserId })).status).toBe(404);
  expect((await request(`/${id}`, 'DELETE', undefined, deniedToken)).status).toBe(403);
  expect((await request('', 'POST', { name: 'Denied' }, deniedToken)).status).toBe(403);
  const otherTenant = (await prisma.user.findUniqueOrThrow({ where: { id: foreignUserId } })).tenantId;
  const foreignGroup = await tenantContext.run({ tenantId: otherTenant }, () => prisma.tenantGroup.create({ data: { name: 'Private', tenantId: otherTenant } }));
  expect((await request(`/${foreignGroup.id}`, 'DELETE')).status).toBe(404);
  expect((await request(`/${foreignGroup.id}/members`, 'POST', { userId })).status).toBe(404);
});

it.skipIf(!disposable)('allows group viewers to view group members but reserves membership changes for Client Admin', async () => {
  const id = (await request('', 'POST', { name: 'Read only group' })).body.data.id;
  expect((await request(`/${id}/members`, 'POST', { userId })).status).toBe(200);

  const viewerRole = await scoped(() => prisma.roleDefinition.create({ data: { tenantId, name: 'Group Viewer', crmAssignmentRestricted: true } }));
  await scoped(() => prisma.rolePermission.create({ data: { tenantId, roleId: viewerRole.id, module: 'groups', canView: true } }));
  const staff = await prisma.user.findFirstOrThrow({ where: { tenantId, role: 'Sales' } });
  await scoped(() => assignRoleToUser(staff.id, viewerRole.id, tenantId));
  const visible = await request('', 'GET', undefined, deniedToken);
  expect(visible.status, JSON.stringify(visible.body)).toBe(200);
  expect(visible.body.data.find((group: { id: string }) => group.id === id).members[0].user)
    .toMatchObject({ firstName: 'Julie', lastName: 'Tiron', role: 'Client Admin' });
  expect((await request(`/${id}/members`, 'POST', { userId }, deniedToken)).status).toBe(403);
  expect((await request(`/${id}/members/${userId}`, 'DELETE', undefined, deniedToken)).status).toBe(403);
  expect((await request(`/${id}/members/${userId}`, 'DELETE')).status).toBe(200);
  expect((await request(`/${id}`, 'DELETE')).status).toBe(200);
});

it.skipIf(!disposable)('provisions a stable protected Sales group, retains memberships and routes independently of its editable name', async () => {
  const group = await scoped(() => prisma.$transaction(tx => ensureSalesGroup(tx, tenantId), { isolationLevel: 'Serializable' }));
  expect((await request('')).body.data.find((row: { id: string }) => row.id === group.id)).toMatchObject({ isDefault: true });
  expect((await request(`/${group.id}`, 'DELETE')).status).toBe(409);
  expect(await scoped(() => deleteEmptyGroup(group.id, tenantId))).toMatchObject({ count: 0 });
  expect((await request(`/${group.id}/members`, 'POST', { userId })).status).toBe(200);
  expect((await request(`/${group.id}`, 'PUT', { name: 'Revenue', systemKey: null })).status).toBe(400);
  expect((await request(`/${group.id}`, 'PUT', { name: 'Revenue' })).body.data).toMatchObject({ id: group.id, name: 'Revenue', isDefault: true });
  const provisioned = await scoped(() => prisma.$transaction(tx => ensureSalesGroup(tx, tenantId)));
  expect(provisioned).toMatchObject({ id: group.id, name: 'Revenue', systemKey: 'SALES' });
  expect(await prisma.tenantGroupMember.count({ where: { groupId: group.id, tenantId } })).toBe(1);
});

const memberCount = (groupId: string) => scoped(() => prisma.tenantGroupMember.count({ where: { groupId, tenantId } }));
const auditCount = (groupId: string) => scoped(() => prisma.auditLog.count({ where: { tenantId, entityId: groupId, action: 'group.member_added' } }));
const revision = () => prisma.dashboardRevision.findUniqueOrThrow({ where: { tenantId } });
const newMember = (status = 'ACTIVE') => prisma.user.create({ data: {
  tenantId, status, email: `${randomUUID()}@camxian.com`, firstName: 'Batch', lastName: randomUUID(), role: 'Sales',
} });

it.skipIf(!disposable)('commits one-member and three-member batches with complete responses, audits and access revisions', async () => {
  const id = (await request('', 'POST', { name: 'Atomic additions' })).body.data.id;
  const people = await Promise.all([newMember(), newMember(), newMember(), newMember()]);
  const before = await revision();
  const single = await request(`/${id}/members`, 'POST', { userIds: [people[0].id] });
  expect(single.status, JSON.stringify(single.body)).toBe(200);
  expect(single.body.data.members).toHaveLength(1);
  const added = await request(`/${id}/members`, 'POST', { userIds: people.slice(1).map(person => person.id) });
  expect(added.status, JSON.stringify(added.body)).toBe(200);
  expect(added.body.data.members).toHaveLength(4);
  for (const person of people) expect(added.body.data.members).toContainEqual(expect.objectContaining({ userId: person.id, user: expect.objectContaining({ email: person.email, role: person.role }) }));
  expect(await memberCount(id)).toBe(4);
  expect(await auditCount(id)).toBe(4);
  expect((await revision()).access).toBe(before.access + 4n);
  expect((await request('')).body.data.find((row: { id: string }) => row.id === id)).toEqual(added.body.data);
  const replay = await request(`/${id}/members`, 'POST', { userId: people[0].id });
  expect(replay.status).toBe(200); expect(replay.body.data.members).toHaveLength(4);
  expect(await memberCount(id)).toBe(4); expect(await auditCount(id)).toBe(4);
  expect((await revision()).access).toBe(before.access + 4n);
});

it.skipIf(!disposable)('rejects malformed or duplicate selections and existing members without partially adding others', async () => {
  const id = (await request('', 'POST', { name: 'Duplicate selection' })).body.data.id;
  const people = await Promise.all([newMember(), newMember()]);
  for (const body of [{ userIds: [] }, { userIds: ['invalid'] }, { userIds: [people[0].id, people[0].id] },
    { userId: people[0].id, userIds: [people[1].id] }, {}]) {
    expect((await request(`/${id}/members`, 'POST', body)).status).toBe(400);
    expect(await memberCount(id)).toBe(0);
  }
  expect((await request(`/${id}/members`, 'POST', { userId: people[0].id })).status).toBe(200);
  const before = await revision();
  const conflict = await request(`/${id}/members`, 'POST', { userIds: people.map(person => person.id) });
  expect(conflict.status).toBe(409);
  expect(conflict.body.error).toBe('One or more selected users are already members of this group.');
  expect(await memberCount(id)).toBe(1); expect(await auditCount(id)).toBe(1);
  expect((await revision()).access).toBe(before.access);
});

it.skipIf(!disposable)('rolls back mixed batches with foreign, inactive or missing users and enforces Client Admin authorization', async () => {
  const id = (await request('', 'POST', { name: 'Invalid batch' })).body.data.id;
  const eligible = await newMember(), inactive = await newMember('INACTIVE');
  const before = await revision();
  for (const invalid of [foreignUserId, inactive.id, randomUUID()]) {
    const failed = await request(`/${id}/members`, 'POST', { userIds: [eligible.id, invalid] });
    expect(failed.status).toBe(404);
    expect(await memberCount(id)).toBe(0); expect(await auditCount(id)).toBe(0);
    expect((await revision()).access).toBe(before.access);
  }
  expect((await request(`/${id}/members`, 'POST', { userIds: [eligible.id] }, deniedToken)).status).toBe(403);
  expect(await memberCount(id)).toBe(0);
});

it.skipIf(!disposable)('rolls back inserted memberships and revisions when their audit write fails', async () => {
  const id = (await request('', 'POST', { name: 'Audit rollback' })).body.data.id;
  const people = await Promise.all([newMember(), newMember()]);
  const before = await revision();
  failAuditForGroup = id;
  try {
    expect((await request(`/${id}/members`, 'POST', { userIds: people.map(person => person.id) })).status).toBe(500);
  } finally { failAuditForGroup = undefined; }
  expect(await memberCount(id)).toBe(0); expect(await auditCount(id)).toBe(0);
  expect((await revision()).access).toBe(before.access);
});

it.skipIf(!nativeConcurrency)('rejects a genuine native PostgreSQL serialization conflict with no partial batch', async () => {
  const id = (await request('', 'POST', { name: 'Concurrent revision' })).body.data.id;
  const people = await Promise.all([newMember(), newMember()]);
  const before = await revision();
  let locked!: () => void, release!: () => void;
  const ready = new Promise<void>(resolve => { locked = resolve; });
  const barrier = new Promise<void>(resolve => { release = resolve; });
  const competing = scoped(() => prisma.$transaction(async tx => {
    await tx.dashboardRevision.update({ where: { tenantId }, data: { access: { increment: 1 } } });
    locked(); await barrier;
  }));
  await ready;
  beforeMemberInsert = async () => { release(); await competing; };
  try {
    const failed = await request(`/${id}/members`, 'POST', { userIds: people.map(person => person.id) });
    expect(failed.status, JSON.stringify(failed.body)).toBe(409);
    expect(failed.body.error).toBe('This group changed while saving. Refresh the group and try again.');
  } finally { beforeMemberInsert = undefined; release(); await competing; }
  expect(await memberCount(id)).toBe(0); expect(await auditCount(id)).toBe(0);
  expect((await revision()).access).toBe(before.access + 1n);
});

it.skipIf(!nativeConcurrency)('protects concurrent duplicate batches and never saves the losing batch partially', async () => {
  const id = (await request('', 'POST', { name: 'Concurrent batches' })).body.data.id;
  const people = await Promise.all([newMember(), newMember(), newMember()]);
  const results = await Promise.all([
    request(`/${id}/members`, 'POST', { userIds: [people[0].id, people[1].id] }),
    request(`/${id}/members`, 'POST', { userIds: [people[0].id, people[2].id] }),
  ]);
  expect(results.map(result => result.status).sort()).toEqual([200, 409]);
  expect(await memberCount(id)).toBe(2); expect(await auditCount(id)).toBe(2);
});

it.skipIf(!nativeConcurrency)('protects concurrent Group deletion without orphaning or partially adding memberships', async () => {
  const id = (await request('', 'POST', { name: 'Concurrent deletion' })).body.data.id;
  const people = await Promise.all([newMember(), newMember()]);
  beforeMemberInsert = async () => { expect(await scoped(() => deleteEmptyGroup(id, tenantId))).toMatchObject({ count: 1 }); };
  try {
    expect((await request(`/${id}/members`, 'POST', { userIds: people.map(person => person.id) })).status).toBe(409);
  } finally { beforeMemberInsert = undefined; }
  expect(await memberCount(id)).toBe(0); expect(await auditCount(id)).toBe(0);
  expect(await scoped(() => prisma.tenantGroup.findFirst({ where: { id, tenantId } }))).toBeNull();
});

async function headCandidate(role = 'Sales Manager', status: 'ACTIVE' | 'INACTIVE' | 'PENDING' = 'ACTIVE', linked = true) {
  return scoped(async () => {
    const definition = await prisma.roleDefinition.upsert({ where: { tenantId_name: { tenantId, name: role } }, create: { tenantId, name: role }, update: {} });
    return prisma.user.create({ data: { tenantId, firstName: 'Head', lastName: randomUUID(), role, status, email: `${randomUUID()}@camxian.com`,
      ...(linked ? { userRoles: { create: { tenantId, roleId: definition.id } } } : {}) } });
  });
}
async function headFixture() {
  const id = (await request('', 'POST', { name: `Head ${randomUUID()}` })).body.data.id as string;
  const first = await headCandidate(), second = await headCandidate('Head of Sales');
  expect((await request(`/${id}/members`, 'POST', { userIds: [first.id, second.id] })).status).toBe(200);
  return { id, first, second };
}
const headRows = (id: string) => scoped(() => prisma.tenantGroupMember.findMany({ where: { tenantId, groupId: id, isHead: true }, select: { userId: true } }));
const assignHead = (id: string, selectedUserId: string | null, auth = token) => request(`/${id}/head`, 'PATCH', { userId: selectedUserId }, auth);

it.skipIf(!disposable)('persists and replaces one Group Head with transactional audit, full reads and unchanged memberships or roles', async () => {
  const { id, first, second } = await headFixture();
  const { resolveCrmActor, taskReadWhere } = await import('../../crm/access/crm-record-access.service');
  const beforeActor = await scoped(() => resolveCrmActor(prisma, { tenantId, userId: first.id }));
  const beforeMembers = await memberCount(id), before = await revision();
  const saved = await assignHead(id, first.id);
  expect(saved.status, JSON.stringify(saved.body)).toBe(200);
  expect(saved.body.data.members.find((row: { userId: string }) => row.userId === first.id)).toMatchObject({ isHead: true, user: { status: 'ACTIVE', avatarUrl: null, role: 'Sales Manager' } });
  expect(saved.body.data.members.every((row: { canBeHead: boolean; user: object }) => row.canBeHead && !('userRoles' in row.user))).toBe(true);
  expect(await headRows(id)).toEqual([{ userId: first.id }]);
  const afterActor = await scoped(() => resolveCrmActor(prisma, { tenantId, userId: first.id }));
  expect(afterActor.permissions).toEqual(beforeActor.permissions);
  expect(taskReadWhere(afterActor)).toEqual(taskReadWhere(beforeActor));
  expect((await request('')).body.data.find((row: { id: string }) => row.id === id)).toEqual(saved.body.data);
  const changed = await assignHead(id, second.id);
  expect(changed.status).toBe(200);
  expect(await headRows(id)).toEqual([{ userId: second.id }]);
  expect(await memberCount(id)).toBe(beforeMembers);
  expect((await prisma.user.findUniqueOrThrow({ where: { id: first.id } })).role).toBe('Sales Manager');
  const logs = await scoped(() => prisma.auditLog.findMany({ where: { tenantId, entityId: id, action: 'group.head_changed' }, orderBy: { createdAt: 'asc' } }));
  expect(logs.map(log => log.changeset)).toEqual([
    { before: { userId: null }, after: { userId: first.id } }, { before: { userId: first.id }, after: { userId: second.id } },
  ]);
  const afterChange = await revision();
  expect(afterChange.access > before.access).toBe(true);
  expect((await assignHead(id, second.id)).status).toBe(200);
  expect((await revision()).access).toBe(afterChange.access);
  expect((await assignHead(id, null)).status).toBe(200);
  expect(await headRows(id)).toEqual([]); expect(await memberCount(id)).toBe(beforeMembers);
  expect((await request('')).body.data.find((row: { id: string }) => row.id === id).members.every((row: { isHead: boolean }) => !row.isHead)).toBe(true);
});

it.skipIf(!disposable)('rejects inactive, pending, ordinary, unlinked and secondary-only manager identities without replacing the Head', async () => {
  const { id, first } = await headFixture();
  expect((await assignHead(id, first.id)).status).toBe(200);
  const invalid = [await headCandidate('Sales Manager', 'INACTIVE'), await headCandidate('Sales Manager', 'PENDING'),
    await headCandidate('Sales Agent'), await headCandidate('Sales Representative'), await headCandidate('Sales Manager', 'ACTIVE', false)];
  const managerRole = await scoped(() => prisma.roleDefinition.findUniqueOrThrow({ where: { tenantId_name: { tenantId, name: 'Sales Manager' } } }));
  await scoped(() => prisma.userRole.create({ data: { tenantId, userId: invalid[2].id, roleId: managerRole.id } }));
  for (const person of invalid) {
    await scoped(() => prisma.tenantGroupMember.create({ data: { tenantId, groupId: id, userId: person.id } }));
    const failed = await assignHead(id, person.id);
    expect(failed.status, JSON.stringify(failed.body)).toBe(400);
    expect(failed.body.error).toContain('primary role');
    const current = (await request('')).body.data.find((row: { id: string }) => row.id === id);
    expect(current.members.find((row: { userId: string }) => row.userId === person.id).canBeHead).toBe(false);
    expect(await headRows(id)).toEqual([{ userId: first.id }]);
  }
  for (const body of [{}, { userId: 'bad' }, { userId: null, role: 'Client Admin' }]) expect((await request(`/${id}/head`, 'PATCH', body)).status).toBe(400);
});

it.skipIf(!disposable)('enforces Client Admin and tenant/membership boundaries even for staff with groups.edit', async () => {
  const { id, first } = await headFixture();
  const staff = await headCandidate('Group Head Editor');
  const viewerRole = await scoped(() => prisma.roleDefinition.findUniqueOrThrow({ where: { tenantId_name: { tenantId, name: staff.role } } }));
  await scoped(() => prisma.rolePermission.create({ data: { tenantId, roleId: viewerRole.id, module: 'groups', canView: true, canEdit: true } }));
  const ready = await prisma.user.update({ where: { id: staff.id }, data: { mustChangePassword: false, onboardingCompletedAt: new Date(), emailVerified: new Date() } });
  const editorToken = (await issueAuthSession(ready)).token;
  const denied = await assignHead(id, first.id, editorToken);
  expect(denied.status).toBe(403); expect(denied.body.error).toContain('Only Client Admin');
  expect((await assignHead(id, null, editorToken)).status).toBe(403);
  const outsider = await headCandidate();
  for (const invalidId of [outsider.id, foreignUserId, randomUUID()]) expect((await assignHead(id, invalidId)).status).toBe(404);
  const foreignTenantId = (await prisma.user.findUniqueOrThrow({ where: { id: foreignUserId } })).tenantId;
  const foreignGroup = await tenantContext.run({ tenantId: foreignTenantId }, () => prisma.tenantGroup.create({ data: { tenantId: foreignTenantId, name: 'Private heads' } }));
  expect((await assignHead(foreignGroup.id, first.id)).status).toBe(404);
  expect(await headRows(id)).toEqual([]);
});

it.skipIf(!disposable)('clears heads through membership removal, User Groups replacement, deactivation and role changes without restoring them', async () => {
  const { id, first, second } = await headFixture();
  expect((await assignHead(id, first.id)).status).toBe(200);
  expect((await request(`/${id}/members/${first.id}`, 'DELETE')).status).toBe(200);
  expect(await headRows(id)).toEqual([]);
  expect((await request(`/${id}/members`, 'POST', { userId: first.id })).status).toBe(200);
  expect((await assignHead(id, first.id)).status).toBe(200);
  const { replaceUserGroups } = await import('../users/user-groups');
  await scoped(() => prisma.$transaction(tx => replaceUserGroups(tx, tenantId, first.id, []), { isolationLevel: 'Serializable' }));
  expect(await headRows(id)).toEqual([]);
  expect((await assignHead(id, second.id)).status).toBe(200);
  await scoped(() => prisma.user.update({ where: { id: second.id, tenantId }, data: { status: 'INACTIVE' } }));
  expect(await headRows(id)).toEqual([]); expect(await memberCount(id)).toBe(1);
  await scoped(() => prisma.user.update({ where: { id: second.id, tenantId }, data: { status: 'ACTIVE' } }));
  expect(await headRows(id)).toEqual([]);
  expect((await assignHead(id, second.id)).status).toBe(200);
  await scoped(() => prisma.user.update({ where: { id: second.id, tenantId }, data: { role: 'Sales Representative' } }));
  expect(await headRows(id)).toEqual([]); expect(await memberCount(id)).toBe(1);
});

it.skipIf(!disposable)('rolls back the new designation and revision if its audit cannot persist', async () => {
  const { id, first, second } = await headFixture();
  expect((await assignHead(id, first.id)).status).toBe(200);
  const before = await revision(); failAuditForGroup = id;
  try { expect((await assignHead(id, second.id)).status).toBe(500); }
  finally { failAuditForGroup = undefined; }
  expect(await headRows(id)).toEqual([{ userId: first.id }]);
  expect((await revision()).access).toBe(before.access);
});

it.skipIf(!nativeConcurrency)('serializes simultaneous assignments without saving two Heads', async () => {
  const { id, first, second } = await headFixture();
  const results = await Promise.all([assignHead(id, first.id), assignHead(id, second.id)]);
  expect(results.map(result => result.status).sort()).toEqual([200, 409]);
  expect(await headRows(id)).toHaveLength(1); expect(await memberCount(id)).toBe(2);
});

it.skipIf(!nativeConcurrency)('rejects a member removed after assignment validation without a partial designation', async () => {
  const { id, first } = await headFixture();
  beforeHeadWrite = async () => { await scoped(() => prisma.tenantGroupMember.deleteMany({ where: { tenantId, groupId: id, userId: first.id } })); };
  try { const failed = await assignHead(id, first.id); expect(failed.status, JSON.stringify(failed.body)).toBe(409); }
  finally { beforeHeadWrite = undefined; }
  expect(await headRows(id)).toEqual([]); expect(await memberCount(id)).toBe(1);
});

it.skipIf(!nativeConcurrency)('coordinates assignment with a concurrent account deactivation', async () => {
  const { id, first } = await headFixture();
  let entered!: () => void, release!: () => void;
  const ready = new Promise<void>(resolve => { entered = resolve; });
  const barrier = new Promise<void>(resolve => { release = resolve; });
  beforeHeadWrite = async () => { entered(); await barrier; };
  const assigning = assignHead(id, first.id); await ready;
  const deactivating = scoped(() => prisma.user.update({ where: { id: first.id, tenantId }, data: { status: 'INACTIVE' } }));
  const pendingDeactivation = Promise.resolve(deactivating);
  try {
    release(); expect((await assigning).status).toBe(200); await pendingDeactivation;
  } finally { beforeHeadWrite = undefined; release(); }
  expect(await headRows(id)).toEqual([]); expect(await memberCount(id)).toBe(2);
});
