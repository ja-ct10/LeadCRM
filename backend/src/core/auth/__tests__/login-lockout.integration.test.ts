import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { PrismaClient } from '@prisma/client';
import type { Server } from 'node:http';
import { hashSync } from 'bcryptjs';
import { replayCrmMigrations } from '../../../tests/replay-crm-migrations';
import { loginIdentityKey, loginIpKey, LOGIN_LOCKOUT_COOKIE } from '../login-attempt.service';
import * as cryptoHelpers from '../../../shared/helpers/crypto';
import { hashResetToken } from '../password-reset.service';
import { dispatchTenantNotifications } from '../../../modules/notifications/notification-events.service';
import { notificationAccess } from '../../../modules/notifications/notification-access';
import { deliverNotification } from '../../../modules/notifications/notifications.service';
import { installTenantScoping } from '../../tenant/tenant-prisma';
import { installProductProjections } from '../../tenant/product-projections';
import { installCrmRecordAccess } from '../../../modules/crm/access/crm-record-access.service';
import { loginIpIdentity } from '../../../api/middleware/login-ip-rate-limit.middleware';

const holder = vi.hoisted(() => ({ client: null as PrismaClient | null }));
vi.mock('../../../config/database.config', () => ({ default: new Proxy({}, { get: (_target, property) => {
  const value = (holder.client as any)[property]; return typeof value === 'function' ? value.bind(holder.client) : value;
} }) }));
const mail = vi.hoisted(() => vi.fn().mockResolvedValue({ submitted: true, messageId: 'disposable-provider' }));
vi.mock('../../../shared/services/email.service', async original => ({ ...await original<typeof import('../../../shared/services/email.service')>(), sendMail: mail }));
let pg: PGlite | undefined, socket: PGLiteSocketServer | undefined, db: PrismaClient, other: PrismaClient, server: Server, base: string, tenantId: string;
const email = 'login-lockout@camxian.com', password = 'NormalLogin2026!';
let uid = '', network = 1;
async function call(path: string, body?: unknown, cookie = '', ip = `192.0.2.${network}`) {
  const res = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: {
    'Content-Type': 'application/json', 'X-Forwarded-For': ip, ...(cookie ? { Cookie: cookie } : {}),
  }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: res.status, body: await res.json(), headers: res.headers, cookies: res.headers.getSetCookie() };
}
const login = (secret = 'incorrect', address = email, cookie = '', ip?: string) => call('/auth/login', { email: address, password: secret }, cookie, ip);
async function failures(count = 5, address = email) { for (let i = 0; i < count; i++) expect((await login('incorrect', address)).status).toBe(401); }
async function state(address = email) { return db.loginAttemptState.findUniqueOrThrow({ where: { identityKey: loginIdentityKey(address) } }); }
async function startServer() {
  server = (await import('../../../app')).default.listen(0, '127.0.0.1');
  await new Promise<void>(done => server.once('listening', done));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1`;
}
beforeAll(async () => {
  vi.stubEnv('JWT_SECRET', 'disposable-lockout-signing-key'); vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('LOGIN_IDENTITY_SECRET', 'stable-disposable-login-identity-key'); vi.stubEnv('APP_URL', 'https://lead-crm.tech');
  const native = process.env.LOGIN_LOCKOUT_POSTGRES_URL;
  if (native) {
    const url = new URL(native);
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) || !url.pathname.startsWith('/leadcrm_login_lockout_')) throw new Error('Disposable local database required');
    vi.stubEnv('LOGIN_LOCKOUT_TEST_DATABASE_URL', native);
  } else {
    pg = await PGlite.create();
    await replayCrmMigrations(pg, '20261102000000');
    await pg.exec(`COMMENT ON TABLE "MailboxThreadAssociation" IS 'canonical-crm-relations-api-verified-v1'`);
    await replayCrmMigrations(pg, '20261112000000', '20261102000000');
    await pg.exec(`COMMENT ON TABLE "Lead" IS 'lead-form-contract-api-verified-v1'`);
    await replayCrmMigrations(pg, undefined, '20261112000000');
    socket = new PGLiteSocketServer({ db: pg, host: '127.0.0.1', port: 0, maxConnections: 8 }); await socket.start();
    vi.stubEnv('LOGIN_LOCKOUT_TEST_DATABASE_URL', `postgresql://postgres:postgres@${socket.getServerConn()}/postgres?connection_limit=1`);
  }
  db = new PrismaClient({ datasources: { db: { url: process.env.LOGIN_LOCKOUT_TEST_DATABASE_URL! } } }); holder.client = db;
  installProductProjections(db); installTenantScoping(db); installCrmRecordAccess(db);
  other = new PrismaClient({ datasources: { db: { url: process.env.LOGIN_LOCKOUT_TEST_DATABASE_URL! } } });
  tenantId = (await db.tenant.create({ data: { name: 'Disposable login lockout', slug: `lockout-${Date.now()}`, status: 'ACTIVE', onboardingStep: 3, onboardingCompletedAt: new Date() } })).id;
  uid = (await db.user.create({ data: { tenantId, email, firstName: 'Lockout', lastName: 'Test', role: 'Client Admin', passwordHash: hashSync(password, 12), mustChangePassword: false, onboardingCompletedAt: new Date() } })).id;
  await startServer();
}, 90_000);
beforeEach(async () => { vi.restoreAllMocks(); network += 1; await db.user.updateMany({ data: { securityLockedAt: null } }); await db.user.update({ where: { id: uid }, data: { status: 'ACTIVE', mustChangePassword: false } }); await db.loginAttemptState.deleteMany(); await db.loginIpRateLimit.deleteMany(); await db.session.deleteMany(); });
afterAll(async () => { if (server) await new Promise<void>(done => server.close(() => done())); await other?.$disconnect(); await db?.$disconnect(); await socket?.stop(); await pg?.close(); vi.unstubAllEnvs(); });

describe.sequential('durable sixth-attempt login lockout', () => {
  it('fails closed for a weak dedicated identity key without creating a session', async () => {
    vi.stubEnv('LOGIN_IDENTITY_SECRET', 'weak');
    try { expect((await login(password)).status).toBe(503); expect(await db.session.count()).toBe(0); }
    finally { vi.stubEnv('LOGIN_IDENTITY_SECRET', 'stable-disposable-login-identity-key'); }
  });
  it('returns five ordinary failures, rejects a correct sixth password before verification, and issues no session', async () => {
    const compare = vi.spyOn(cryptoHelpers, 'comparePassword');
    for (let attempt = 1; attempt <= 5; attempt++) {
      const denied = await login();
      expect(denied.status).toBe(401); expect(denied.body.error).toBe('Invalid email or password.');
      expect(denied.cookies).toEqual([]);
      expect(await state()).toMatchObject({ failedAttempts: attempt, lockedUntil: null });
    }
    expect(compare).toHaveBeenCalledTimes(5);
    const sixth = await login(password);
    expect(sixth.status).toBe(429); expect(sixth.body.error.code).toBe('AUTH_LOGIN_LOCKED');
    expect(Date.parse(sixth.body.error.retryAt) - Date.parse(sixth.body.error.serverNow)).toBe(300_000);
    expect(sixth.headers.get('retry-after')).toBe('300'); expect(sixth.headers.get('cache-control')).toBe('no-store');
    expect(compare).toHaveBeenCalledTimes(5); expect(await db.session.count()).toBe(0);
    expect(sixth.cookies.every(cookie => cookie.startsWith(`${LOGIN_LOCKOUT_COOKIE}=`) && /HttpOnly/i.test(cookie))).toBe(true);
    expect(JSON.stringify(sixth.body)).not.toMatch(/passwordHash|token|tenantId|userId/);
  });
  it('preserves expiry for subsequent correct/wrong requests, across IPs and without any cookies', async () => {
    await failures(); const locked = await login(password); const until = locked.body.error.retryAt;
    for (const [secret, ip] of [[password, '198.51.100.10'], ['incorrect', '198.51.100.11']]) {
      const denied = await login(secret, email, '', ip); expect(denied.status).toBe(429); expect(denied.body.error.retryAt).toBe(until);
    }
    expect(await db.session.count()).toBe(0);
  });
  it('activates the sixth gate even for an empty password, while malformed earlier submissions do not count', async () => {
    expect((await call('/auth/login', { email, password: '' })).status).toBe(400);
    expect((await state()).failedAttempts).toBe(0);
    await failures(); expect((await call('/auth/login', { email, password: '' })).status).toBe(429);
    expect(await db.session.count()).toBe(0);
  });
  it('restores only with a signed proof and validates the submitted identity without an unrestricted lookup', async () => {
    await failures(); const locked = await login(); const proof = locked.cookies[0].split(';')[0];
    expect((await call('/auth/login-lockout', { email })).body.data.locked).toBe(false);
    expect((await call('/auth/login-lockout', { email }, proof + 'tampered')).body.data.locked).toBe(false);
    expect((await call('/auth/login-lockout', {}, proof)).body.data).toMatchObject({ locked: true, retryAt: locked.body.error.retryAt });
    expect((await call('/auth/login-lockout', { email: 'other@camxian.com' }, proof)).body.data.locked).toBe(false);
    expect((await call('/auth/login-lockout', { email: ` ${email.toUpperCase()} ` }, proof)).body.data.locked).toBe(true);
  });
  it('survives HTTP service restart and a new database client', async () => {
    await failures(); const locked = await login();
    await new Promise<void>(done => server.close(() => done())); await db.$disconnect(); await startServer();
    expect((await other.loginAttemptState.findUniqueOrThrow({ where: { identityKey: loginIdentityKey(email) } })).lockedUntil?.toISOString()).toBe(locked.body.error.retryAt);
    expect((await login(password)).status).toBe(429); expect(await db.session.count()).toBe(0);
  });
  it.each([1, 4])('resets after a successful login following %i failures and retains session restoration', async count => {
    await failures(count); const success = await login(password); expect(success.status).toBe(200);
    expect((await state()).failedAttempts).toBe(0);
    const cookie = success.cookies.find(c => c.startsWith('leadcrm_token='))!.split(';')[0];
    expect((await call('/auth/me', undefined, cookie)).status).toBe(200);
    expect((await login()).status).toBe(401); expect((await state()).failedAttempts).toBe(1);
  });
  it('resets expired state before a new failure or normal successful authentication', async () => {
    await failures(); await login();
    await db.loginAttemptState.update({ where: { identityKey: loginIdentityKey(email) }, data: { lockedUntil: new Date(Date.now() - 1000) } });
    expect((await login()).status).toBe(401); expect(await state()).toMatchObject({ failedAttempts: 1, lockedUntil: null });
    expect((await login(password)).status).toBe(200); expect((await state()).failedAttempts).toBe(0);
  });
  it('uses the same count/error policy for unknown, case-varied and whitespace-varied identities', async () => {
    const address = 'missing@camxian.com';
    for (let i = 0; i < 5; i++) {
      const denied = await login('incorrect', i % 2 ? ` ${address.toUpperCase()} ` : address);
      expect(denied.status).toBe(401); expect(denied.body.error).toBe('Invalid email or password.');
    }
    expect((await login(password, address)).body.error.code).toBe('AUTH_LOGIN_LOCKED');
    expect((await state(address)).failedAttempts).toBe(5); expect(await db.session.count()).toBe(0);
    expect(JSON.stringify(await state(address))).not.toContain(address);
  });
  it('atomically accepts only five failures when twenty requests race', async () => {
    const results = await Promise.all(Array.from({ length: 20 }, () => login()));
    const outcomes = JSON.stringify(results.map(result => ({ status: result.status, code: result.body.error?.code ?? result.body.error?.message ?? result.body.error })));
    expect(results.filter(r => r.status === 401), outcomes).toHaveLength(5); expect(results.filter(r => r.status === 429), outcomes).toHaveLength(15);
    expect(new Set(results.filter(r => r.status === 429).map(r => r.body.error.retryAt)).size).toBe(1);
    expect(await db.session.count()).toBe(0); expect((await state()).failedAttempts).toBe(5);
  }, 30_000);
  it.skipIf(!process.env.LOGIN_LOCKOUT_POSTGRES_URL)('holds the fifth failure lock until a concurrent correct sixth request is rejected', async () => {
    await failures(4);
    let entered!: () => void, release!: () => void;
    const waiting = new Promise<void>(done => { entered = done; }); const gate = new Promise<void>(done => { release = done; });
    vi.spyOn(cryptoHelpers, 'comparePassword').mockImplementationOnce(async () => { entered(); await gate; return false; });
    const fifth = login(); await waiting; const sixth = login(password); release();
    expect((await fifth).status).toBe(401); expect((await sixth).status).toBe(429); expect(await db.session.count()).toBe(0);
  });
  it('keeps password recovery/reset independent without removing an active lockout', async () => {
    await failures(); const locked = await login();
    expect((await call('/auth/forgot-password', { email })).status).toBe(200); expect(mail).toHaveBeenCalled();
    const token = 'disposable-recovery-secret';
    await db.passwordResetToken.create({ data: { email, userId: uid, token: hashResetToken(token), expires: new Date(Date.now() + 60_000) } });
    const changed = 'ChangedLogin2026!'; expect((await call('/auth/reset-password', { token, password: changed })).status).toBe(200);
    const denied = await login(changed); expect(denied.status).toBe(429); expect(denied.body.error.retryAt).toBe(locked.body.error.retryAt);
    await db.user.update({ where: { id: uid }, data: { passwordHash: hashSync(password, 12) } });
  }, 30_000);
  it('retains deterministic login for duplicate emails, with one shared cooldown', async () => {
    const second = await db.tenant.create({ data: { name: 'Duplicate', slug: `duplicate-${Date.now()}` } });
    await db.user.create({ data: { tenantId: second.id, email, firstName: 'Duplicate', lastName: 'Test', role: 'Client Admin', passwordHash: hashSync('DuplicateLogin2026!', 12), mustChangePassword: false, onboardingCompletedAt: new Date() } });
    expect((await login('DuplicateLogin2026!')).body.data.user.tenantId).toBe(second.id);
    await failures(); expect((await login(password)).status).toBe(429); expect((await login('DuplicateLogin2026!')).status).toBe(429);
  }, 30_000);
  it.each(['Client Admin', 'Sales Agent', 'Other Staff'])('preserves normal %s authentication', async role => {
    const address = `${role.replaceAll(' ', '-').toLowerCase()}@camxian.com`;
    await db.roleDefinition.upsert({ where: { tenantId_name: { tenantId, name: role } }, update: {}, create: { tenantId, name: role } });
    await db.user.create({ data: { tenantId, email: address, firstName: 'Role', lastName: 'Test', role, passwordHash: hashSync(password, 4), mustChangePassword: false, onboardingCompletedAt: new Date() } });
    expect((await login(password, address)).status).toBe(200);
  });
  it('enforces a shared one-minute IP budget across identities and proxy-spoofed prefixes', async () => {
    for (let i = 0; i < 60; i++) expect((await call('/auth/login', { email: 'invalid', password: 'x' }, '', `203.0.113.${i}, 198.51.100.55`)).status).toBe(400);
    const denied = await call('/auth/login', { email, password }, '', '203.0.113.254, 198.51.100.55');
    expect(denied.status).toBe(429); expect(denied.body.error.code).toBe('AUTH_LOGIN_RATE_LIMITED');
    expect(Number(denied.headers.get('retry-after'))).toBeLessThanOrEqual(60);
    await db.loginIpRateLimit.update({ where: { identityKey: loginIpKey('198.51.100.55') }, data: { windowEndsAt: new Date(Date.now() - 1) } });
    expect((await login(password, email, '', '198.51.100.55')).status).toBe(200);
  });
  it('groups equivalent IPv6 forms and mapped IPv4 addresses', () => {
    expect(loginIpIdentity('2001:db8:1:2::1')).toBe(loginIpIdentity('2001:0db8:0001:0002:9999::4'));
    expect(loginIpIdentity('::ffff:192.0.2.1')).toBe('192.0.2.1');
  });
  it('logs one repeated-denial event per cooldown without storing credentials or raw email', async () => {
    const events = vi.spyOn(console, 'info').mockImplementation(() => {});
    await failures(); await login(); for (let i = 0; i < 3; i++) await login(password);
    expect(events.mock.calls.filter(([, detail]) => detail.event === 'login_rejected_during_lockout')).toHaveLength(1);
    expect(JSON.stringify(events.mock.calls)).not.toMatch(/NormalLogin2026|incorrect|login-lockout@|passwordHash|token/);
  }, 30_000);
});

describe.sequential('security escalation, idle sessions and admin unlock', () => {
  async function escalate() {
    for (let cycle = 1; cycle <= 3; cycle++) {
      await failures(); const result = await login(password);
      expect((await state()).lockoutCycles).toBe(cycle);
      if (cycle < 3) {
        expect(result.status).toBe(429);
        await db.loginAttemptState.update({ where: { identityKey: loginIdentityKey(email) }, data: { lockedUntil: new Date(Date.now() - 1) } });
      } else { expect(result.status).toBe(423); expect(result.body.error.code).toBe('AUTH_ACCOUNT_LOCKED'); expect(result.body.error.retryAt).toBeUndefined(); }
    }
  }
  async function admin() {
    const role = await db.roleDefinition.upsert({ where: { tenantId_name: { tenantId, name: 'Client Admin' } }, update: {}, create: { tenantId, name: 'Client Admin' } });
    await db.rolePermission.upsert({ where: { roleId_module: { roleId: role.id, module: 'users' } }, update: { canView: true, canActivate: true }, create: { tenantId, roleId: role.id, module: 'users', canView: true, canActivate: true } });
    const user = await db.user.upsert({ where: { tenantId_email: { tenantId, email: 'unlock-admin@camxian.com' } }, update: {}, create: { tenantId, email: 'unlock-admin@camxian.com', firstName: 'Admin', lastName: 'Unlock', role: 'Client Admin', mustChangePassword: false, passwordHash: hashSync(password, 4), onboardingCompletedAt: new Date(), userRoles: { create: { roleId: role.id } } } });
    const result = await login(password, user.email);
    expect(result.status).toBe(200);
    return result.cookies.find(cookie => cookie.startsWith('leadcrm_token='))!;
  }
  async function finalLockGate() {
    await db.loginAttemptState.upsert({ where: { identityKey: loginIdentityKey(email) },
      create: { identityKey: loginIdentityKey(email), failedAttempts: 5, lockoutCycles: 2 },
      update: { failedAttempts: 5, lockoutCycles: 2, lockedUntil: null } });
  }
  it('queues one administrative Account Locked alert per permanent transition and preserves its replay identity', async () => {
    const cookie = await admin(); await finalLockGate();
    const adminUser = await db.user.findFirstOrThrow({ where: { tenantId, email: 'unlock-admin@camxian.com' } });
    const before = await db.notificationEvent.count({ where: { tenantId, entityId: uid, payload: { path: ['securityEvent'], equals: 'account_locked' } } });
    expect((await login(password)).status).toBe(423);
    const target = await db.user.findUniqueOrThrow({ where: { id: uid } });
    const event = await db.notificationEvent.findFirstOrThrow({ where: { tenantId, entityId: uid,
      payload: { path: ['securityLockedAt'], equals: target.securityLockedAt!.toISOString() } } });
    expect(event).toMatchObject({ type: 'user_status_changed', entityType: 'User', admins: true,
      payload: { securityEvent: 'account_locked', securityLockedAt: target.securityLockedAt!.toISOString() } });
    const audit = await db.auditLog.findFirstOrThrow({ where: { tenantId, entityId: uid, action: 'ACCOUNT_SECURITY_LOCKED' }, orderBy: { createdAt: 'desc' } });
    expect(event.eventKey).toBe('account-security-locked:' + audit.id);
    expect((await login(password)).status).toBe(423);
    expect(await db.notificationEvent.count({ where: { tenantId, entityId: uid, payload: { path: ['securityEvent'], equals: 'account_locked' } } })).toBe(before + 1);
    const now = new Date(Date.now() + 100);
    await dispatchTenantNotifications(tenantId, now, 100); await dispatchTenantNotifications(tenantId, now, 100);
    const notices = await db.notification.findMany({ where: { tenantId, eventKey: event.eventKey } });
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({ userId: adminUser.id, title: 'Account Locked',
      body: "Lockout Test's account was locked after repeated failed login attempts. Review User Management." });
    expect((await call('/notifications/' + notices[0].id + '/destination', undefined, cookie)).body.destination).toBe('/settings?tab=users');
    await db.notification.deleteMany({ where: { id: notices[0].id } });
    await db.notificationEvent.update({ where: { id: event.id }, data: { processedAt: null } }); await dispatchTenantNotifications(tenantId, now, 100);
    expect(await db.notification.count({ where: { tenantId, eventKey: event.eventKey } })).toBe(0);
    expect(await db.notificationDelivery.findFirst({ where: { tenantId, eventKey: event.eventKey, userId: adminUser.id } })).toMatchObject({ outcome: 'deleted' });
  });
  it('suppresses unlocked incidents during projection and during the final locked delivery transaction', async () => {
    const cookie = await admin(); await finalLockGate(); expect((await login(password)).status).toBe(423);
    const adminUser = await db.user.findFirstOrThrow({ where: { tenantId, email: 'unlock-admin@camxian.com' } });
    const target = await db.user.findUniqueOrThrow({ where: { id: uid } });
    const event = await db.notificationEvent.findFirstOrThrow({ where: { tenantId, entityId: uid,
      payload: { path: ['securityLockedAt'], equals: target.securityLockedAt!.toISOString() } } });
    expect((await call('/administration/users/' + uid + '/unlock', {}, cookie)).status).toBe(200);
    await deliverNotification({ tenantId, userId: adminUser.id, type: 'user_status_changed', title: 'Account Locked',
      entityType: 'User', entityId: uid, eventKey: event.eventKey, securityLockedAt: target.securityLockedAt!.toISOString() });
    await dispatchTenantNotifications(tenantId, new Date(Date.now() + 100), 100);
    expect(await db.notification.count({ where: { tenantId, eventKey: event.eventKey } })).toBe(0);
    expect(await db.notificationDelivery.findFirst({ where: { tenantId, eventKey: event.eventKey, userId: adminUser.id } })).toMatchObject({ outcome: 'ineligible' });
  });
  it('rolls back the permanent transition if its transactional notification cannot be queued', async () => {
    await finalLockGate();
    const audits = await db.auditLog.count({ where: { tenantId, entityId: uid, action: 'ACCOUNT_SECURITY_LOCKED' } });
    // Reject new lock alerts only in this disposable fixture, retaining earlier rows.
    await db.$executeRawUnsafe(`ALTER TABLE "NotificationEvent" ADD CONSTRAINT fixture_reject_lock_alert CHECK (payload->>'securityEvent' IS DISTINCT FROM 'account_locked') NOT VALID`);
    try { expect((await login(password)).status).toBe(500); }
    finally { await db.$executeRawUnsafe('ALTER TABLE "NotificationEvent" DROP CONSTRAINT fixture_reject_lock_alert'); }
    expect((await db.user.findUniqueOrThrow({ where: { id: uid } })).securityLockedAt).toBeNull();
    expect(await state()).toMatchObject({ failedAttempts: 5, lockoutCycles: 2 });
    expect(await db.auditLog.count({ where: { tenantId, entityId: uid, action: 'ACCOUNT_SECURITY_LOCKED' } })).toBe(audits);
  });
  it('locks on cycle three, persists indefinitely, revokes sessions and survives password reset', async () => {
    const cookie = (await login(password)).cookies.find(cookie => cookie.startsWith('leadcrm_token='))!;
    await escalate();
    expect(await db.user.findUniqueOrThrow({ where: { id: uid } })).toMatchObject({ status: 'ACTIVE', securityLockedAt: expect.any(Date) });
    expect((await state()).lockedUntil).toBeNull();
    await db.user.update({ where: { id: uid }, data: { securityLockedAt: new Date('2000-01-01') } });
    expect((await login(password)).status).toBe(423);
    expect([401,423]).toContain((await call('/auth/me', undefined, cookie)).status);
    const token = 'full-lock-recovery';
    await db.passwordResetToken.create({ data: { email, userId: uid, token: hashResetToken(token), expires: new Date(Date.now() + 60000) } });
    expect((await call('/auth/reset-password', { token, password: 'Replacement2026!' })).status).toBe(200);
    expect((await login('Replacement2026!')).status).toBe(423);
    await db.user.update({ where: { id: uid }, data: { passwordHash: hashSync(password, 12) } });
  }, 60000);
  it('allows only authorized admin unlock and preserves deactivation and other account locks', async () => {
    const cookie = await admin(); await escalate();
    const duplicate = await db.user.findFirst({ where: { email, id: { not: uid } } });
    await db.user.update({ where: { id: uid }, data: { status: 'INACTIVE' } });
    expect((await call('/administration/users/' + uid + '/unlock', {})).status).toBe(401);
    expect((await call('/administration/users/' + uid + '/unlock', {}, cookie)).status).toBe(200);
    expect(await state()).toMatchObject({ failedAttempts: 0, lockoutCycles: 0, lockedUntil: null });
    expect(await db.user.findUniqueOrThrow({ where: { id: uid } })).toMatchObject({ securityLockedAt: null, status: 'INACTIVE' });
    if (duplicate) expect((await db.user.findUniqueOrThrow({ where: { id: duplicate.id } })).securityLockedAt).not.toBeNull();
    expect(await db.auditLog.count({ where: { entityId: uid, action: 'ACCOUNT_SECURITY_UNLOCKED' } })).toBeGreaterThan(0);
    await db.user.update({ where: { id: uid }, data: { status: 'ACTIVE' } });
  }, 60000);
  it('resets cycles only after an allowed successful login', async () => {
    await failures(); await login();
    await db.loginAttemptState.update({ where: { identityKey: loginIdentityKey(email) }, data: { lockedUntil: new Date(Date.now() - 1) } });
    expect((await login()).status).toBe(401); expect((await state()).lockoutCycles).toBe(1);
    expect((await login(password)).status).toBe(200); expect((await state()).lockoutCycles).toBe(0);
  }, 30000);
  it('denies authenticated staff unlock even with activation permission and rejects foreign-tenant targets', async () => {
    const cookie = await admin();
    const role = await db.roleDefinition.create({ data: { tenantId, name: 'Unlock operator', permissions: { create: { module: 'users', canView: true, canActivate: true } } } });
    const staff = await db.user.create({ data: { tenantId, email: 'unlock-staff@camxian.com', firstName: 'Staff', lastName: 'Unlock', role: role.name,
      passwordHash: hashSync(password, 4), mustChangePassword: false, onboardingCompletedAt: new Date(), userRoles: { create: { roleId: role.id } } } });
    const signedIn = await login(password, staff.email);
    expect(signedIn.status).toBe(200);
    const staffCookie = signedIn.cookies.find(value => value.startsWith('leadcrm_token='))!;
    expect((await call('/administration/users/' + uid + '/unlock', {}, staffCookie)).status).toBe(403);
    const foreign = await db.user.findFirstOrThrow({ where: { tenantId: { not: tenantId } } });
    expect((await call('/administration/users/' + foreign.id + '/unlock', {}, cookie)).status).toBe(404);
  });
  it('applies the same full-lock response to unknown identities', async () => {
    const unknown = 'unknown-escalation@camxian.com';
    await db.loginAttemptState.create({ data: { identityKey: loginIdentityKey(unknown), failedAttempts: 5, lockoutCycles: 2 } });
    expect((await login('x', unknown)).body.error.code).toBe('AUTH_ACCOUNT_LOCKED');
    expect((await login(password, unknown)).status).toBe(423);
  });
  it('rejects an idle API session before updating activity, while passive reads do not renew it', async () => {
    const result = await login(password), cookie = result.cookies.find(cookie => cookie.startsWith('leadcrm_token='))!;
    await db.session.updateMany({ where: { userId: uid }, data: { lastActiveAt: new Date(Date.now() - 30 * 60000) } });
    expect((await call('/auth/activity', { lastActiveAt: new Date().toISOString() }, cookie)).body.error.code).toBe('SESSION_IDLE_EXPIRED');
    expect((await db.session.findFirstOrThrow({ where: { userId: uid } })).revokedAt).not.toBeNull();
  });
});

describe.sequential('password reminders, authorized CSV and Product metadata', () => {
  async function manager() {
    const role = await db.roleDefinition.findUniqueOrThrow({ where: { tenantId_name: { tenantId, name: 'Client Admin' } } });
    for (const module of ['leads','contacts','accounts','deals','products']) await db.rolePermission.upsert({ where: { roleId_module: { roleId: role.id, module } }, update: { canView: true, canCreate: true, canEdit: true }, create: { tenantId, roleId: role.id, module, canView: true, canCreate: true, canEdit: true } });
    const result = await login(password, 'unlock-admin@camxian.com'); expect(result.status).toBe(200);
    return result.cookies.find(cookie => cookie.startsWith('leadcrm_token='))!;
  }
  it('delivers exactly once in day 89, ignores stale cycles and links only to self', async () => {
    const now = new Date(), changed = new Date(+now - 89 * 86400000);
    const role = await db.roleDefinition.upsert({ where: { tenantId_name: { tenantId, name: 'Client Admin' } }, update: {},
      create: { tenantId, name: 'Client Admin', isSystemRole: true } });
    await db.userRole.createMany({ data: [{ tenantId, userId: uid, roleId: role.id }], skipDuplicates: true });
    expect((await notificationAccess(tenantId, uid)).admin).toBe(true);
    await db.notificationEvent.updateMany({ where: { tenantId }, data: { processedAt: now } });
    await db.user.update({ where: { id: uid }, data: { passwordChangedAt: new Date(+now - 88 * 86400000), mustChangePassword: false } });
    expect((await dispatchTenantNotifications(tenantId, now)).claimed).toBe(0);
    await db.userPreference.upsert({ where: { tenantId_userId_module_key: { tenantId, userId: uid, module: 'notifications', key: 'channels' } }, update: { value: { inAppGeneral: false, leadAssignmentEmail: false, dailyPipelineBriefing: false, urgentHotLeadSms: false } }, create: { tenantId, userId: uid, module: 'notifications', key: 'channels', value: { inAppGeneral: false, leadAssignmentEmail: false, dailyPipelineBriefing: false, urgentHotLeadSms: false } } });
    await db.user.update({ where: { id: uid }, data: { passwordChangedAt: changed } });
    expect((await dispatchTenantNotifications(tenantId, now)).failed).toBe(0);
    const notices = await db.notification.findMany({ where: { tenantId, userId: uid, type: 'password_expiring_soon' } });
    expect(notices).toHaveLength(1); expect(notices[0]).toMatchObject({ title: 'Password Expiring Soon', body: 'Your password will expire tomorrow. Please change your password to avoid losing access.' });
    expect(await db.notification.count({ where: { tenantId, type: 'password_expiring_soon', entityId: uid, userId: { not: uid } } })).toBe(0);
    expect(await (await notificationAccess(tenantId, uid)).resolve('PasswordSecurity', uid)).toMatchObject({ destination: '/settings?tab=profile&changePassword=1' });
    expect(await (await notificationAccess(tenantId, uid)).resolve('PasswordSecurity', 'another-user')).toBeNull();
    await db.notification.deleteMany({ where: { tenantId, userId: uid, type: 'password_expiring_soon' } });
    await db.notificationEvent.updateMany({ where: { tenantId, eventKey: notices[0].eventKey! }, data: { processedAt: null } });
    await dispatchTenantNotifications(tenantId, now); expect(await db.notification.count({ where: { tenantId, userId: uid, type: 'password_expiring_soon' } })).toBe(0);
    await db.user.update({ where: { id: uid }, data: { passwordChangedAt: new Date(+now - 89 * 86400000 + 1000) } });
    await dispatchTenantNotifications(tenantId, now); expect(await db.notification.count({ where: { tenantId, userId: uid, type: 'password_expiring_soon' } })).toBe(0);
    await dispatchTenantNotifications(tenantId, new Date(+now + 1000)); expect(await db.notification.count({ where: { tenantId, userId: uid, type: 'password_expiring_soon' } })).toBe(1);
    await db.user.update({ where: { id: uid }, data: { passwordChangedAt: new Date(+now - 91 * 86400000) } });
    await dispatchTenantNotifications(tenantId, now); expect(await db.notification.count({ where: { tenantId, userId: uid, type: 'password_expiring_soon' } })).toBe(1);
    await db.user.update({ where: { id: uid }, data: { passwordChangedAt: now } });
  }, 60000);
  it('exports all 220 matching rows for each module with scope, tenant and RBAC protection', async () => {
    const cookie = await manager();
    const pipeline = await db.pipeline.create({ data: { tenantId, name: 'Export Pipeline' } });
    const stage = await db.stage.create({ data: { tenantId, pipelineId: pipeline.id, name: 'Export Stage', order: 0 } });
    const owner = await db.user.findUniqueOrThrow({ where: { tenantId_email: { tenantId, email: 'unlock-admin@camxian.com' } } });
    await db.lead.createMany({ data: Array.from({ length: 220 }, (_, i) => ({ tenantId, firstName: 'Export Needle', lastName: String(i), status: 'Hot', assignedUserId: owner.id })) });
    await db.contact.createMany({ data: Array.from({ length: 220 }, (_, i) => ({ tenantId, firstName: 'Export Needle', lastName: String(i), status: 'HOT', assignedUserId: owner.id })) });
    await db.account.createMany({ data: Array.from({ length: 220 }, (_, i) => ({ tenantId, name: 'Export Needle ' + i, industry: 'IT' })) });
    await db.deal.createMany({ data: Array.from({ length: 220 }, (_, i) => ({ tenantId, title: 'Export Needle ' + i, pipelineId: pipeline.id, stageId: stage.id, ownerId: owner.id, assignedUserId: owner.id, priority: 'HIGH', value: 123 })) });
    await db.lead.create({ data: { tenantId, firstName: 'Export Needle Other', lastName: '', assignedUserId: uid } });
    const foreign = await db.tenant.create({ data: { name: 'Export Foreign', slug: 'export-foreign' } });
    await db.lead.create({ data: { tenantId: foreign.id, firstName: 'Export Needle Foreign', lastName: '' } });
    for (const module of ['leads','contacts','accounts','deals']) {
      const query = new URLSearchParams({ search: 'Export Needle', page: '2', limit: '1' });
      if (module === 'leads' || module === 'contacts') { query.set('filter[scope]', 'equals:my'); query.set('filter[assignedUserId]', 'in:' + owner.id); }
      if (module === 'accounts') query.set('filter[industry]', 'in:IT');
      if (module === 'deals') { query.delete('search'); query.set('pipelineId', pipeline.id); query.set('view', JSON.stringify({ search: 'Export Needle', my: true, filters: { owner: [owner.id], priority: ['High'], status: ['Open'] } })); }
      const res = await fetch(base + '/crm/' + module + '/export?' + query, { headers: { Cookie: cookie, 'X-Forwarded-For': '192.0.2.200' } });
      const text = await res.text(); expect(res.status, text).toBe(200); expect(text.split('\r\n')).toHaveLength(221);
      expect(text).not.toMatch(/tenantId|passwordHash|securityLockedAt|Foreign|Needle Other/);
      expect(res.headers.get('content-type')).toContain('text/csv'); expect(res.headers.get('content-disposition')).toMatch(new RegExp(module + '-[0-9]{4}-[0-9]{2}-[0-9]{2}\\.csv'));
      const emptyQuery = new URLSearchParams(query);
      if (module === 'deals') emptyQuery.set('view', JSON.stringify({ search: 'NoMatchingExportRecord', my: false, filters: {} }));
      else emptyQuery.set('search', 'NoMatchingExportRecord');
      const empty = await fetch(base + '/crm/' + module + '/export?' + emptyQuery, { headers: { Cookie: cookie } });
      expect(empty.status).toBe(200); expect((await empty.text()).split('\r\n')).toHaveLength(1);
      expect((await call('/crm/' + module + '/export')).status).toBe(401);
    }
    const noGrants = await login(password, email); const deniedCookie = noGrants.cookies.find(cookie => cookie.startsWith('leadcrm_token='))!;
    await db.user.update({ where: { id: uid }, data: { role: 'Sales Staff' } });
    const role = await db.roleDefinition.upsert({ where: { tenantId_name: { tenantId, name: 'Sales Staff' } }, update: {}, create: { tenantId, name: 'Sales Staff' } });
    await db.userRole.create({ data: { tenantId, userId: uid, roleId: role.id } });
    for (const module of ['leads', 'contacts', 'accounts', 'deals']) expect((await call('/crm/' + module + '/export', undefined, deniedCookie)).status).toBe(403);
    await db.user.update({ where: { id: uid }, data: { role: 'Client Admin' } });
  }, 90000);
  it('requires category, persists description and value, and leaves existing Deal snapshots intact', async () => {
    const cookie = await manager(), endpoint = '/administration/product-interests';
    expect((await call(endpoint, { name: 'QA Product', dealValue: 25000 }, cookie)).status).toBe(400);
    const created = await call(endpoint, { name: 'QA Product', category: 'Security', description: 'A product description', dealValue: 25000 }, cookie);
    expect(created.status).toBe(200); const product = created.body.data.find((row: any) => row.name === 'QA Product');
    expect(product).toMatchObject({ category: 'Security', description: 'A product description', dealValue: 25000 });
    const owner = await db.user.findUniqueOrThrow({ where: { tenantId_email: { tenantId, email: 'unlock-admin@camxian.com' } } });
    const stage = await db.stage.findFirstOrThrow({ where: { tenantId } });
    const deal = await db.deal.create({ data: { tenantId, title: 'Product snapshot', ownerId: owner.id, pipelineId: stage.pipelineId, stageId: stage.id, productInterestId: product.id, productsNormalized: true, value: 25000, currency: 'PHP' } });
    const update = await fetch(base + endpoint + '/' + product.id, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify({ category: 'New Inline Category', description: 'Updated description', dealValue: 30000 }) });
    expect(update.status, await update.text()).toBe(200);
    expect((await call(endpoint + '/' + product.id, undefined, cookie)).body.data).toMatchObject({ category: 'New Inline Category', description: 'Updated description', dealValue: 30000 });
    expect((await call(endpoint, undefined, cookie)).body.meta.categories).toContain('New Inline Category');
    expect(await db.deal.findUniqueOrThrow({ where: { id: deal.id } })).toMatchObject({ productInterestId: product.id, value: 25000, currency: 'PHP' });
  }, 30000);
});
