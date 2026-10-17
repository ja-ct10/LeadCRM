import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Server } from 'node:http';
import { hashSync } from 'bcryptjs';
const mail = vi.hoisted(() => vi.fn().mockResolvedValue({ submitted: true }));
vi.mock('../../../shared/services/email.service', async importOriginal => ({
  ...await importOriginal<typeof import('../../../shared/services/email.service')>(), sendMail: mail,
}));
import prisma from '../../../config/database.config';
import app from '../../../app';

const database = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid/');
const disposable = ['localhost', '127.0.0.1'].includes(database.hostname) && /^\/leadcrm_forms_test_\d+$/.test(database.pathname);
const now = new Date('2030-04-01T12:00:00.000Z');
const boundary = new Date('2030-04-01T00:00:00.000Z');
let server: Server, base: string, tenantId: string, sequence = 0;
async function account(patch = {}) {
  return prisma.user.create({ data: { tenantId, email: `expiration-${++sequence}@camxian.com`, firstName: 'Expiration', lastName: 'Test', role: 'Client Admin',
    status: 'ACTIVE', passwordHash: hashSync('Previous1!', 4), mustChangePassword: false, passwordChangedAt: new Date('2030-01-01'), onboardingCompletedAt: new Date('2029-12-01'), ...patch } });
}
async function call(path: string, body?: unknown, token = '', bearer = false) {
  const res = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: {
    'Content-Type': 'application/json', ...(token ? bearer ? { Authorization: `Bearer ${token}` } : { Cookie: `leadcrm_token=${token}` } : {}),
  }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const cookie = res.headers.getSetCookie().find(value => value.startsWith('leadcrm_token='));
  return { status: res.status, body: await res.json(), token: cookie?.split(';')[0].slice('leadcrm_token='.length) ?? '' };
}
describe.skipIf(!disposable).sequential('password expiration on disposable native PostgreSQL', () => {
  beforeAll(async () => {
    tenantId = (await prisma.tenant.create({ data: { name: 'Password expiration', slug: 'password-expiration-tests', status: 'ACTIVE' } })).id;
    server = app.listen(0, '127.0.0.1');
    await new Promise<void>(resolve => server.once('listening', resolve));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1`;
  });
  beforeEach(() => { mail.mockClear(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(now); });
  afterEach(() => vi.useRealTimers());
  afterAll(async () => { if (server) await new Promise<void>(resolve => server.close(() => resolve())); await prisma.$disconnect(); });

  it('logs in with an expired password, blocks workspace APIs, then restores access after changing it', async () => {
    const user = await account();
    const login = await call('/auth/login', { email: user.email, password: 'Previous1!' });
    expect(login.status).toBe(200);
    expect(login.body.data.user).toMatchObject({ mustChangePassword: true, onboardingCompletedAt: '2029-12-01T00:00:00.000Z' });
    expect(login.body.data.user).not.toHaveProperty('passwordHash');
    for (const path of ['/crm/leads', '/administration/users', '/auth/profile/avatar/anything', '/auth/onboarding/status']) {
      expect(await call(path, undefined, login.token)).toMatchObject({ status: 403, body: { error: { code: 'PASSWORD_CHANGE_REQUIRED' } } });
    }
    expect((await call('/auth/me', undefined, login.token)).body.data.user.mustChangePassword).toBe(true);
    const reuse = await call('/auth/change-password', { currentPassword: 'Previous1!', password: 'Previous1!' }, login.token);
    expect(reuse.body, JSON.stringify(reuse)).toMatchObject({ error: { code: 'PASSWORD_REUSE' } });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).passwordChangedAt).toEqual(user.passwordChangedAt);
    const second = await call('/auth/login', { email: user.email, password: 'Previous1!' });
    const changed = await call('/auth/change-password', { currentPassword: 'Previous1!', password: 'Renewed2!' }, login.token);
    expect(changed).toMatchObject({ status: 200, body: { data: { user: { mustChangePassword: false, passwordChangedAt: now.toISOString(), onboardingCompletedAt: '2029-12-01T00:00:00.000Z' } } } });
    expect((await call('/crm/leads', undefined, login.token)).status).toBe(200);
    expect((await call('/auth/me', undefined, second.token)).status).toBe(401);
  });
  it.each([false, true])('restricts an existing session across the exact boundary (Bearer=%s)', async bearer => {
    vi.setSystemTime(new Date(boundary.getTime() - 1));
    const user = await account();
    const login = await call('/auth/login', { email: user.email, password: 'Previous1!' });
    expect(login.body.data.user.mustChangePassword).toBe(false);
    expect((await call('/crm/leads', undefined, login.token, bearer)).status).toBe(200);
    vi.setSystemTime(boundary);
    expect(await call('/crm/leads', undefined, login.token, bearer)).toMatchObject({ status: 403, body: { error: { code: 'PASSWORD_CHANGE_REQUIRED' } } });
    expect((await call('/auth/me', undefined, login.token, bearer)).body.data.user.mustChangePassword).toBe(true);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).mustChangePassword).toBe(false);
    expect((await call('/auth/logout', {}, login.token, bearer)).status).toBe(200);
  });
  it('email-only recovery preserves the timer; successful reset renews it and revokes all sessions', async () => {
    const user = await account();
    const login = await call('/auth/login', { email: user.email, password: 'Previous1!' });
    expect((await call('/auth/forgot-password', { email: user.email })).status).toBe(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).passwordChangedAt).toEqual(user.passwordChangedAt);
    const token = mail.mock.lastCall![0].html.match(/reset-password\?token=([a-f0-9]{64})/)[1];
    expect((await call('/auth/reset-password', { token, password: 'Recovered2!' })).status).toBe(200);
    expect(await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).toMatchObject({ mustChangePassword: false, passwordChangedAt: now, onboardingCompletedAt: user.onboardingCompletedAt });
    expect((await call('/auth/me', undefined, login.token)).status).toBe(401);
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
    const recovered = await call('/auth/login', { email: user.email, password: 'Recovered2!' });
    expect(recovered.body.data.user.mustChangePassword).toBe(false);
    expect((await call('/crm/leads', undefined, recovered.token)).status).toBe(200);
  });
});
