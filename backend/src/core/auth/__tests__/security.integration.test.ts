import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer, type Server } from 'node:http';
import { randomBytes } from 'node:crypto';
import { TOTP, Secret } from 'otpauth';

vi.mock('../../../config/database.config', () => ({ default: new PrismaClient({ datasources: { db: { url: process.env.SECURITY_TEST_DATABASE_URL! } } }) }));
let pg: PGlite, socket: PGLiteSocketServer, db: PrismaClient, http: Server, url: string;
let cookie = '', otherCookie = '', secret = '', enrollmentCode = '', recovery: string[] = [], userId = '', tenantId = '';
const initialPassword = 'Temporary1!';
const newPassword = ' Camxian2026! ';
const email = 'security@camxian.com';
const totp = () => new TOTP({ secret: Secret.fromBase32(secret), digits: 6, period: 30, algorithm: 'SHA1' }).generate();
async function call(path: string, body?: unknown, auth = cookie) {
  const response = await fetch(`${url}${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(auth ? { Cookie: auth } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: response.headers.get('content-type')?.includes('json') ? await response.json() : null,
    cookies: response.headers.getSetCookie().map(value => value.split(';')[0]) };
}
async function login(password = newPassword) { return call('/auth/login', { email, password }, ''); }
async function allowNewTotp() { await db.user.update({ where: { id: userId }, data: { mfaLastCounter: null } }); }

beforeAll(async () => {
  process.env.JWT_SECRET = 'disposable-security-test-signing-key';
  process.env.MFA_ENCRYPTION_KEY = randomBytes(32).toString('hex');
  pg = await PGlite.create();
  await pg.exec(readFileSync(resolve(__dirname, '../../../tests/security-baseline.sql'), 'utf8'));
  // Preserve populated unrelated data and verify permission cleanup, not just empty DDL.
  await pg.exec(`INSERT INTO "Tenant" (id,name,slug,"updatedAt",domain) VALUES ('migration-tenant','Migration','migration',NOW(),'company.example');
    INSERT INTO "RoleDefinition" (id,"tenantId",name,"updatedAt") VALUES ('migration-role','migration-tenant','Sales',NOW());
    INSERT INTO "RolePermission" (id,"tenantId","roleId",module) VALUES ('retired','migration-tenant','migration-role','billing'),('retained','migration-tenant','migration-role','contacts');
    INSERT INTO "User" (id,"tenantId",email,"firstName","lastName",role,"updatedAt") VALUES ('migration-user','migration-tenant','migration@camxian.com','Migration','User','Sales',NOW());
    INSERT INTO "Invoice" (id,"tenantId","invoiceNumber",amount,"totalAmount",frequency,"startDate","updatedAt") VALUES ('retired-invoice','migration-tenant','OLD-001',100,100,'Monthly',NOW(),NOW());
    INSERT INTO "Activity" (id,"tenantId","createdById",type,title,"invoiceId") VALUES ('keep-activity','migration-tenant','migration-user','note','Historical record','retired-invoice');`);
  for (const name of ['20261007000000_add_mfa', '20261008000000_remove_retired_billing_domains']) {
    await pg.exec(readFileSync(resolve(__dirname, '../../../../prisma/migrations', name, 'migration.sql'), 'utf8'));
  }
  socket = new PGLiteSocketServer({ db: pg, host: '127.0.0.1', port: 0 });
  await socket.start();
  process.env.SECURITY_TEST_DATABASE_URL = `postgresql://postgres:postgres@${socket.getServerConn()}/postgres?connection_limit=1`;
  db = (await import('../../../config/database.config')).default;
  const { hashPassword } = await import('../../../shared/helpers/crypto');
  const tenant = await db.tenant.create({ data: { name: 'Security test', slug: 'security-test', status: 'ACTIVE', onboardingStep: 3, onboardingCompletedAt: new Date() } });
  tenantId = tenant.id;
  const user = await db.user.create({ data: { tenantId, email, firstName: 'Security', lastName: 'Test', role: 'Client Admin', passwordHash: await hashPassword(initialPassword), mustChangePassword: false } });
  userId = user.id;
  http = createServer((await import('../../../app')).default);
  await new Promise<void>(resolve => http.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${(http.address() as { port: number }).port}/api/v1`;
}, 60_000);
afterAll(async () => { if (http) await new Promise<void>(resolve => http.close(() => resolve())); await db?.$disconnect(); await socket?.stop(); await pg?.close(); });

describe.sequential('security flows on migrated PostgreSQL', () => {
  it('drops retired structures and permissions while preserving company domain and CRM permission data', async () => {
    expect((await pg.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN ('PricingPlan','PlanFeature','Invoice','Subscription','PaymentMethod','PaymentTransaction','StripeWebhookEvent','TenantDomain','TenantDomainSettings')`)).rows).toHaveLength(0);
    expect(await db.rolePermission.findMany({ where: { roleId: 'migration-role' } })).toMatchObject([{ module: 'contacts' }]);
    expect(await db.tenant.findUnique({ where: { id: 'migration-tenant' } })).toHaveProperty('domain', 'company.example');
    expect(await db.activity.findUnique({ where: { id: 'keep-activity' } })).toHaveProperty('title', 'Historical record');
  });
  it('logs in without MFA and keeps the active session while changing password', async () => {
    const first = await login(initialPassword); cookie = first.cookies.find(c => c.startsWith('leadcrm_token='))!;
    otherCookie = (await login(initialPassword)).cookies.find(c => c.startsWith('leadcrm_token='))!;
    const result = await call('/auth/change-password', { currentPassword: initialPassword, password: newPassword });
    expect(result.status).toBe(200);
    expect((await call('/auth/me')).status).toBe(200);
    expect((await call('/auth/me', undefined, otherCookie)).status).toBe(401);
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).passwordChangedAt).toBeInstanceOf(Date);
  });
  it.each(['Ab1!', 'camxian2026!', 'CAMXIAN2026!', 'CamxianPassword!', 'Camxian2026'])('rejects invalid password %s without changing the database', async password => {
    const before = await db.user.findUniqueOrThrow({ where: { id: userId } });
    expect((await call('/auth/change-password', { currentPassword: newPassword, password })).status).toBe(400);
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).passwordHash).toBe(before.passwordHash);
  });
  it('rejects wrong current password and password reuse', async () => {
    expect((await call('/auth/change-password', { currentPassword: 'wrong', password: 'Another2026!' })).status).toBe(400);
    expect((await call('/auth/change-password', { currentPassword: newPassword, password: newPassword })).status).toBe(400);
  });
  it('requires reauthentication, encrypts pending setup, and rejects invalid codes', async () => {
    expect((await call('/auth/mfa/setup', { currentPassword: 'wrong' })).status).toBe(400);
    const setup = await call('/auth/mfa/setup', { currentPassword: newPassword });
    expect(setup.status).toBe(200); secret = setup.body.data.secret;
    expect(setup.body.data.qrCode).toMatch(/^data:image\/png;base64,/);
    const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.mfaEnabled).toBe(false); expect(user.mfaPendingSecretEncrypted).not.toContain(secret);
    expect((await call('/auth/mfa/enable', { code: 'abcdef' })).status).toBe(400);
    expect((await call('/auth/mfa/enable', { code: '000000' === totp() ? '111111' : '000000' })).status).toBe(400);
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).mfaEnabled).toBe(false);
  });
  it('enables only after valid TOTP and returns recovery codes once', async () => {
    enrollmentCode = totp();
    const enabled = await call('/auth/mfa/enable', { code: enrollmentCode });
    expect(enabled.status).toBe(200); recovery = enabled.body.data.recoveryCodes;
    expect(recovery).toHaveLength(8);
    const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.mfaSecretEncrypted).not.toContain(secret); expect(user.mfaPendingSecretEncrypted).toBeNull();
    const saved = await db.mfaRecoveryCode.findMany({ where: { userId } });
    expect(saved.every(row => /^[a-f0-9]{64}$/.test(row.codeHash) && !recovery.includes(row.codeHash))).toBe(true);
    const me = await call('/auth/me'); expect(JSON.stringify(me.body)).not.toMatch(/mfaSecret|mfaPending|passwordHash/);
    expect((await call('/auth/mfa/status')).body.data).toMatchObject({ enabled: true, recoveryCodesRemaining: 8 });
  });
  it('issues only an HttpOnly challenge after password and rejects the challenge as a CRM session', async () => {
    const result = await login();
    expect(result.body.data).toEqual({ mfaRequired: true });
    expect(result.cookies).toContain('leadcrm_token=');
    const challenge = result.cookies.find(c => c.startsWith('leadcrm_mfa_challenge='))!;
    expect((await call('/auth/me', undefined, challenge)).status).toBe(401);
    // The enrollment TOTP was already consumed.
    expect((await call('/auth/mfa/verify', { code: enrollmentCode }, challenge)).status).toBe(400);
    const verified = await call('/auth/mfa/verify', { code: recovery[0] }, challenge);
    expect(verified.status).toBe(200); cookie = verified.cookies.find(c => c.startsWith('leadcrm_token='))!;
    expect((await call('/auth/mfa/verify', { code: recovery[1] }, challenge)).status).toBe(401);
    expect((await call('/auth/mfa/status')).body.data.recoveryCodesRemaining).toBe(7);
    const second = (await login()).cookies.find(c => c.startsWith('leadcrm_mfa_challenge='))!;
    expect((await call('/auth/mfa/verify', { code: recovery[0] }, second)).status).toBe(400);
  });
  it('rejects expired challenges and caps database-backed attempts', async () => {
    const challenge = (await login()).cookies.find(c => c.startsWith('leadcrm_mfa_challenge='))!;
    await db.mfaChallenge.updateMany({ where: { userId }, data: { attempts: 5 } });
    expect((await call('/auth/mfa/verify', { code: recovery[1] }, challenge)).status).toBe(401);
    await db.mfaChallenge.updateMany({ where: { userId }, data: { attempts: 0, expiresAt: new Date(0) } });
    expect((await call('/auth/mfa/verify', { code: recovery[1] }, challenge)).status).toBe(401);
  });
  it('accepts a fresh TOTP for login and consumes the challenge', async () => {
    await allowNewTotp();
    const challenge = (await login()).cookies.find(c => c.startsWith('leadcrm_mfa_challenge='))!;
    const result = await call('/auth/mfa/verify', { code: totp() }, challenge);
    expect(result.status).toBe(200);
    expect(result.body.data.user.id).toBe(userId);
    expect((await call('/auth/mfa/verify', { code: totp() }, challenge)).status).toBe(401);
  });
  it('requires both factors to regenerate and invalidates old codes', async () => {
    await allowNewTotp();
    expect((await call('/auth/mfa/recovery-codes/regenerate', { currentPassword: 'wrong', code: totp() })).status).toBe(400);
    const result = await call('/auth/mfa/recovery-codes/regenerate', { currentPassword: newPassword, code: totp() });
    expect(result.status).toBe(200);
    const challenge = (await login()).cookies.find(c => c.startsWith('leadcrm_mfa_challenge='))!;
    expect((await call('/auth/mfa/verify', { code: recovery[1] }, challenge)).status).toBe(400);
    recovery = result.body.data.recoveryCodes;
  });
  it('disables with password and recovery code, removes secrets, and records safe audits', async () => {
    // Use a fresh account-scoped rate window for this independent management assertion.
    const { mfaRateLimiter } = await import('../../../api/middleware/rate-limit.middleware');
    mfaRateLimiter.resetKey(userId);
    expect((await call('/auth/mfa/disable', { currentPassword: 'wrong', code: recovery[0] })).status).toBe(400);
    expect((await call('/auth/mfa/disable', { currentPassword: newPassword, code: recovery[0] })).status).toBe(200);
    const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.mfaEnabled).toBe(false); expect(user.mfaSecretEncrypted).toBeNull();
    expect(await db.mfaRecoveryCode.count({ where: { userId } })).toBe(0);
    expect((await login()).body.data.user.id).toBe(userId);
    const events = await db.auditLog.findMany({ where: { userId } });
    expect(events.map(event => event.action)).toEqual(expect.arrayContaining(['PASSWORD_CHANGED', 'MFA_SETUP_STARTED', 'MFA_ENABLED', 'MFA_RECOVERY_CODE_USED', 'MFA_RECOVERY_CODES_REGENERATED', 'MFA_DISABLED']));
    const serialized = JSON.stringify(events); for (const value of [secret, newPassword, ...recovery]) expect(serialized).not.toContain(value);
  });
});
