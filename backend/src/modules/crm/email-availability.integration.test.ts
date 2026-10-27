import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { replayCrmMigrations } from '../../tests/replay-crm-migrations';
import { EMAIL_AVAILABILITY_MESSAGES } from '@leadcrm/shared';

vi.mock('../../config/database.config', () => ({ default: new PrismaClient({ datasources: { db: { url: process.env.EMAIL_AVAILABILITY_TEST_URL! } } }) }));
vi.mock('../../core/auth/welcome-credentials.service', () => ({ sendWelcomeCredentials: vi.fn().mockResolvedValue(true) }));
let pg: PGlite, socket: PGLiteSocketServer, db: PrismaClient, server: Server, base: string;
let tenantId: string, admin: string, creator: string, userCreator: string, denied: string, noAssign: string;
const check = (module: string, email: string) => `/crm/email-availability?${new URLSearchParams({ module, email })}`;
const userCheck = (email: string) => `/administration/users/email-availability?${new URLSearchParams({ email })}`;
async function call(path: string, method = 'GET', body?: unknown, token = admin) {
  const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.json(), cache: response.headers.get('cache-control') };
}

beforeAll(async () => {
  process.env.JWT_SECRET = 'disposable-email-availability-signing-key';
  pg = await PGlite.create(); await replayCrmMigrations(pg);
  socket = new PGLiteSocketServer({ db: pg, host: '127.0.0.1', port: 0 }); await socket.start();
  process.env.EMAIL_AVAILABILITY_TEST_URL = `postgresql://postgres:postgres@${socket.getServerConn()}/postgres?connection_limit=1`;
  db = (await import('../../config/database.config')).default;
  const { issueAuthSession } = await import('../../core/auth/auth-session');
  tenantId = (await db.tenant.create({ data: { name: 'Email checks', slug: randomUUID(), onboardingStep: 3, onboardingCompletedAt: new Date() } })).id;
  const foreign = await db.tenant.create({ data: { name: 'Other tenant', slug: randomUUID() } });
  await db.user.create({ data: { tenantId: foreign.id, email: 'foreign@camxian.com', firstName: 'Other', lastName: 'Staff', role: 'Client Admin' } });
  for (const status of ['ACTIVE', 'INACTIVE', 'PENDING'] as const) await db.user.create({ data: { tenantId, email: `${status.toLowerCase()}@camxian.com`, firstName: status, lastName: 'Staff', role: 'Sales', status } });
  const createActor = async (role: string, grant: 'all' | 'crm' | 'noAssign' | 'none' | 'admin') => {
    const user = await db.user.create({ data: { tenantId, role, email: `${grant}@camxian.com`, firstName: grant, lastName: 'Actor', mustChangePassword: false, onboardingCompletedAt: new Date() } });
    if (grant !== 'admin') {
      const definition = await db.roleDefinition.create({ data: { tenantId, name: role } });
      await db.userRole.create({ data: { tenantId, userId: user.id, roleId: definition.id } });
      if (grant !== 'none') await db.rolePermission.createMany({ data: [
        ...(grant === 'crm' ? ['leads', 'contacts'] : ['leads', 'contacts', 'users']).map(module => ({ tenantId, roleId: definition.id, module, canView: true, canCreate: true })),
        ...(grant === 'all' ? [{ tenantId, roleId: definition.id, module: 'roles', canView: true, canAssign: true }] : []),
      ] });
    }
    return (await issueAuthSession(user)).token;
  };
  admin = await createActor('Client Admin', 'admin'); creator = await createActor('CRM creator', 'crm'); userCreator = await createActor('Creator', 'all');
  denied = await createActor('Denied', 'none'); noAssign = await createActor('User creator', 'noAssign');
  server = (await import('../../app')).default.listen(0, '127.0.0.1');
  await new Promise<void>(done => server.once('listening', done));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1`;
}, 60000);
afterAll(async () => {
  if (server) await new Promise<void>(done => server.close(() => done()));
  if (db) await db.$disconnect(); if (socket) await socket.stop(); if (pg) await pg.close();
});

it.each(['leads', 'contacts'] as const)('%s availability is permission-scoped, private, and independent of user-directory access', async module => {
  expect((await call(check(module, 'new@example.test'), 'GET', undefined, '')).status).toBe(401);
  expect((await call(check(module, 'new@example.test'), 'GET', undefined, denied)).status).toBe(403);
  const result = await call(check(module, 'new@example.test'), 'GET', undefined, creator);
  expect(result.status).toBe(200); expect(result.body).toEqual({ success: true, data: { available: true } }); expect(result.cache).toBe('no-store');
  expect((await call('/administration/users', 'GET', undefined, creator)).status).toBe(403);
  expect((await call(check(module, 'foreign@camxian.com'))).body.data).toEqual({ available: true });
  expect((await call(check(module, 'unregistered@camxian.com'))).body.data).toEqual({ available: true });
});

it.each(['ACTIVE', 'INACTIVE', 'PENDING'])('rejects a registered %s user case-insensitively without exposing identities', async status => {
  for (const module of ['leads', 'contacts']) {
    const result = await call(check(module, ` ${status}@CAMXIAN.COM `));
    expect(result.status).toBe(200); expect(result.body).toEqual({ success: true, data: { available: false, reason: 'STAFF_EMAIL_NOT_ALLOWED' } });
  }
  expect((await call(userCheck(`${status}@CAMXIAN.COM`))).body.data).toEqual({ available: false, reason: 'EMAIL_IN_USE' });
});

it('requires user creation and role assignment and retains external-email authorization', async () => {
  for (const token of ['', denied, noAssign]) expect((await call(userCheck('new@camxian.com'), 'GET', undefined, token)).status).toBe(token ? 403 : 401);
  expect((await call(userCheck('new@camxian.com'), 'GET', undefined, userCreator)).body.data).toEqual({ available: true });
  expect((await call(userCheck('external@gmail.com'), 'GET', undefined, userCreator)).body.data).toEqual({ available: false, reason: 'EXTERNAL_STAFF_EMAIL_NOT_ALLOWED' });
  expect((await call(userCheck('external@gmail.com'))).body.data).toEqual({ available: true });
});

it('rejects malformed requests rather than declaring them available', async () => {
  for (const path of [check('accounts', 'new@example.test'), check('leads', 'bad'), userCheck('*@gmail.com'), '/crm/email-availability?module=leads&email=a@b.test&email=c@d.test']) expect((await call(path)).status).toBe(400);
});

it.each(['leads', 'contacts'] as const)('%s creation rejects staff without a preflight and rolls back linked writes', async module => {
  const before = await db.account.count({ where: { tenantId } });
  const result = await call(`/crm/${module}`, 'POST', { requestId: randomUUID(), firstName: 'Customer', lastName: 'Test', email: 'ACTIVE@CAMXIAN.COM', newAccount: { requestId: randomUUID(), name: 'Must not persist' } });
  expect(result.status).toBe(400); expect(result.body.error).toEqual({ code: 'STAFF_EMAIL_NOT_ALLOWED', message: EMAIL_AVAILABILITY_MESSAGES.STAFF_EMAIL_NOT_ALLOWED });
  expect(await db.account.count({ where: { tenantId } })).toBe(before);
});

it.each(['leads', 'contacts'] as const)('%s preserves customer duplicates and successful retries', async module => {
  const email = `${module}-customer@example.test`;
  const draft = { requestId: randomUUID(), firstName: 'Customer', lastName: 'Test', email };
  expect((await call(`/crm/${module}`, 'POST', draft)).status).toBe(201);
  expect((await call(check(module, email))).body.data).toEqual({ available: true });
  expect((await call(`/crm/${module}`, 'POST', { ...draft, requestId: randomUUID() })).status).toBe(201);
  const retry = await call(`/crm/${module}`, 'POST', draft);
  expect([200, 201]).toContain(retry.status);
  // A committed request remains replayable even if a staff user is provisioned later.
  await db.user.create({ data: { tenantId, email, firstName: 'Later', lastName: 'Staff', role: 'Sales' } });
  expect([200, 201]).toContain((await call(`/crm/${module}`, 'POST', draft)).status);
});

it('preserves server and database uniqueness when creating users directly', async () => {
  const draft = { firstName: 'New', lastName: 'Staff', email: 'new-staff@camxian.com', phone: '9171234567', role: 'Creator' };
  expect((await call('/administration/users', 'POST', draft)).status).toBe(201);
  expect((await call('/administration/users', 'POST', { ...draft, email: draft.email.toUpperCase() })).status).toBe(409);
  const existing = await db.user.findFirstOrThrow({ where: { tenantId, email: draft.email } });
  await expect(db.user.create({ data: { tenantId, email: draft.email, firstName: 'Duplicate', lastName: 'Staff', role: 'Creator' } })).rejects.toMatchObject({ code: 'P2002' });
  const count = await pg.query<{ count: number }>('SELECT count(*)::int AS count FROM "User" WHERE "tenantId"=$1 AND email=$2', [tenantId, existing.email]);
  expect(count.rows[0].count).toBe(1);
});
