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
    socket = new PGLiteSocketServer({ db: pg, host: '127.0.0.1', port: 0 }); await socket.start();
    vi.stubEnv('LOGIN_LOCKOUT_TEST_DATABASE_URL', `postgresql://postgres:postgres@${socket.getServerConn()}/postgres?connection_limit=1`);
  }
  db = new PrismaClient({ datasources: { db: { url: process.env.LOGIN_LOCKOUT_TEST_DATABASE_URL! } } }); holder.client = db;
  other = new PrismaClient({ datasources: { db: { url: process.env.LOGIN_LOCKOUT_TEST_DATABASE_URL! } } });
  tenantId = (await db.tenant.create({ data: { name: 'Disposable login lockout', slug: `lockout-${Date.now()}`, status: 'ACTIVE' } })).id;
  uid = (await db.user.create({ data: { tenantId, email, firstName: 'Lockout', lastName: 'Test', role: 'Client Admin', passwordHash: hashSync(password, 12), mustChangePassword: false, onboardingCompletedAt: new Date() } })).id;
  await startServer();
}, 90_000);
beforeEach(async () => { vi.restoreAllMocks(); network += 1; await db.loginAttemptState.deleteMany(); await db.loginIpRateLimit.deleteMany(); await db.session.deleteMany(); });
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
    expect(results.filter(r => r.status === 401)).toHaveLength(5); expect(results.filter(r => r.status === 429)).toHaveLength(15);
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
