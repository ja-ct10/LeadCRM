// Built-app acceptance using an owned disposable PostgreSQL cluster and local API.
import { acceptancePort, createAcceptanceContext } from './verify-browser-matrix.mjs';
import { notificationTestPostgres } from './notification-test-postgres.mjs';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, createWriteStream } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const root = resolve(import.meta.dirname, '../..');
const output = resolve(process.env.LEADCRM_BROWSER_OUTPUT || resolve(root, 'data/outputs/notification-verification/settings-records'));
mkdirSync(output, { recursive: true });
const pg = await notificationTestPostgres();
let api, frontend, browser, page, rejectRead = false, closing = false;
const checks = [], errors = [], reads = [];
const pass = label => { checks.push(label); console.log('PASS', label); };
async function eventually(predicate) {
  for (let attempt = 0; attempt < 120; attempt++) {
    if (await predicate()) return;
    await new Promise(done => setTimeout(done, 250));
  }
  throw Error('Condition did not settle');
}
let prisma;
try {
  const base = `http://localhost:${await acceptancePort()}`;
  const database = await pg.database('leadcrm_settings_notifications_1');
  Object.assign(process.env, { NODE_ENV: 'test', DATABASE_URL: database, DIRECT_URL: database,
    JWT_SECRET: randomBytes(32).toString('hex'), ENCRYPTION_KEY: randomBytes(32).toString('hex'), APP_URL: base,
    CORS_ORIGIN: base, ALLOWED_ORIGINS: base, BREVO_API_KEY: '', RESEND_API_KEY: '', NOTIFICATION_WORKER_ENABLED: 'false' });
  const require = createRequire(import.meta.url), Module = require('node:module'), originalResolve = Module._resolveFilename;
  Module._resolveFilename = function(request, parent, isMain, options) {
    return request === '@leadcrm/shared' ? resolve(root, 'backend/dist/shared/src/index.js') : originalResolve.call(this, request, parent, isMain, options);
  };
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
  prisma = require('../dist/backend/src/config/database.config.js').default;
  const app = require('../dist/backend/src/app.js').default;
  const { issueAuthSession } = require('../dist/backend/src/core/auth/auth-session.js');
  const tenant = await prisma.tenant.create({ data: { name: 'Settings Notifications', slug: randomUUID(), onboardingStep: 3, onboardingCompletedAt: new Date() } });
  const adminRole = await prisma.roleDefinition.create({ data: { tenantId: tenant.id, name: 'Client Admin', isSystemRole: true } });
  const admin = await prisma.user.create({ data: { tenantId: tenant.id, firstName: 'Settings', lastName: 'Admin', email: randomUUID() + '@camxian.com',
    role: 'Client Admin', mustChangePassword: false, onboardingCompletedAt: new Date(), userRoles: { create: { roleId: adminRole.id } } } });
  const roles = await Promise.all(['First', 'Other'].map(name => prisma.roleDefinition.create({ data: { tenantId: tenant.id, name: `${name} Settings Role` } })));
  const users = await Promise.all(roles.map((role, index) => prisma.user.create({ data: { tenantId: tenant.id, firstName: index ? 'Other' : 'First', lastName: 'Settings User',
    email: randomUUID() + '@camxian.com', role: role.name, mustChangePassword: false, onboardingCompletedAt: new Date(), userRoles: { create: { roleId: role.id } } } })));
  const modules = [
    { entityType: 'User', tab: 'users', ids: users.map(user => user.id), open: 'View First Settings User', close: 'Close drawer' },
    { entityType: 'RoleDefinition', tab: 'roles', ids: roles.map(role => role.id), open: 'View First Settings Role', close: 'Close role details' },
  ];
  for (const module of modules) await prisma.notification.createMany({ data: [0, 0, 1].map(index => ({
    tenantId: tenant.id, userId: admin.id, type: module.entityType === 'User' ? 'user_status_changed' : 'role_permissions_changed',
    title: 'Unread Settings record', entityType: module.entityType, entityId: module.ids[index],
  })) });
  const otherRecipient = await prisma.notification.create({ data: { tenantId: tenant.id, userId: users[1].id,
    type: 'user_created', title: 'Other recipient', entityType: 'User', entityId: users[0].id } });
  const token = (await issueAuthSession(admin)).token;
  api = app.listen(0, '127.0.0.1'); await new Promise(done => api.once('listening', done));
  const log = createWriteStream(resolve(output, 'frontend.log'));
  frontend = spawn(process.execPath, [resolve(root, 'node_modules/next/dist/bin/next'), 'start', '-p', new URL(base).port, '-H', '127.0.0.1'], {
    cwd: resolve(root, 'frontend'), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'production', API_URL: 'https://leadcrm-build.example/api/v1' },
  });
  frontend.stdout.pipe(log); frontend.stderr.pipe(log);
  await eventually(async () => { try { return (await fetch(base + '/login')).ok; } catch { return false; } });
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await createAcceptanceContext(browser, { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await context.addCookies([{ name: 'leadcrm_token', value: token, url: base, httpOnly: true, sameSite: 'Lax' }]);
  page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/proxy/**', async route => {
    const request = route.request(), url = new URL(request.url());
    const body = request.method() === 'PATCH' && url.pathname.endsWith('/notifications/read-all') ? request.postDataJSON() : null;
    if (body?.record) {
      reads.push(body.record);
      if (rejectRead) { await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, error: { message: 'Acceptance read failure' } }) }); return; }
    }
    try {
      const localUrl = `http://127.0.0.1:${api.address().port}/api/v1${url.pathname.replace('/api/proxy', '')}${url.search}`;
      if (url.pathname.endsWith('/auth/access-events') || url.pathname.endsWith('/crm/record-events')) {
        await route.fulfill({ status: 200, contentType: 'text/event-stream', body: ': acceptance\n\n' }); return;
      }
      const response = await page.request.fetch(localUrl, { method: request.method(), headers: { ...request.headers(), authorization: `Bearer ${token}` }, data: request.postDataBuffer() ?? undefined });
      await route.fulfill({ response });
    } catch (error) { if (!closing && !String(error).includes('closed')) errors.push(String(error)); await route.abort().catch(() => {}); }
  });
  for (const module of modules) {
    const where = { tenantId: tenant.id, userId: admin.id, entityType: module.entityType };
    const unread = () => prisma.notification.count({ where: { ...where, entityId: module.ids[0], isRead: false } });
    const dots = () => page.locator(`[role="status"][aria-label="Unread ${module.entityType === 'RoleDefinition' ? 'Role' : module.entityType} notifications"]`);
    const navigate = () => page.goto(base + '/settings?tab=' + module.tab);
    await navigate(); await eventually(async () => await dots().count() === 2);
    assert.equal(await unread(), 2); pass(`${module.entityType}: directory load preserves unread notifications`);
    rejectRead = true;
    await page.getByRole('button', { name: module.open, exact: true }).click();
    await page.getByRole('button', { name: module.close, exact: true }).waitFor();
    await page.getByText('Failed to update notifications', { exact: true }).waitFor();
    assert.equal(await unread(), 2);
    await page.getByRole('button', { name: module.close, exact: true }).click();
    await eventually(async () => await dots().count() === 2);
    assert.equal(reads.filter(record => record.entityType === module.entityType).length, 1);
    pass(`${module.entityType}: failed read keeps its dot and database state`);
    rejectRead = false;
    await page.getByRole('button', { name: module.open, exact: true }).click();
    await page.getByRole('button', { name: module.close, exact: true }).waitFor();
    await eventually(async () => await unread() === 0 && await dots().count() === 1);
    assert.equal(await prisma.notification.count({ where: { ...where, entityId: module.ids[1], isRead: false } }), 1);
    assert.equal((await prisma.notification.findUniqueOrThrow({ where: { id: otherRecipient.id } })).isRead, false);
    pass(`${module.entityType}: successful panel open clears only its record and preserves other recipients`);
    await page.screenshot({ path: resolve(output, module.tab + '-details.png') });
    await page.getByRole('button', { name: module.close, exact: true }).click();
    await page.getByRole('button', { name: module.close, exact: true }).waitFor({ state: 'hidden' });
    const previousReads = reads.length;
    await page.getByRole('button', { name: module.open, exact: true }).click();
    await page.getByRole('button', { name: module.close, exact: true }).waitFor();
    await page.getByRole('button', { name: module.close, exact: true }).click();
    assert.equal(reads.length, previousReads);
    await page.goto(base + '/settings?tab=profile'); await navigate(); await page.reload();
    await eventually(async () => await dots().count() === 1);
    assert.equal(await unread(), 0); assert.equal(reads.length, previousReads);
    pass(`${module.entityType}: close, reopen, navigation and reload preserve read state without duplicate writes`);
  }
  assert.deepEqual(errors, []);
  writeFileSync(resolve(output, 'results.json'), JSON.stringify({ checks, reads, errors }, null, 2));
  console.log(`Settings notification acceptance passed: ${checks.length} checks.`);
} catch (error) {
  await page?.screenshot({ path: resolve(output, 'failure.png') }).catch(() => {});
  writeFileSync(resolve(output, 'results.json'), JSON.stringify({ checks, errors, error: String(error) }, null, 2));
  throw error;
} finally {
  closing = true; await browser?.close(); frontend?.kill();
  if (api) { api.closeAllConnections(); await new Promise(done => api.close(done)); }
  await prisma?.$disconnect(); pg.stop();
}
