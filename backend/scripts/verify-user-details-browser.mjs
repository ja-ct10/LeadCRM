// Built frontend + authenticated API against a fresh migration-replayed database.
// Email is mocked at the provider boundary; no existing database or provider is used.
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, createWriteStream } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { replayCrmMigrations } from './replay-crm-migrations.mjs';
import { acceptancePort, setAcceptanceTheme, createAcceptanceContext } from './verify-browser-matrix.mjs';

const root = resolve(import.meta.dirname, '../..');
const output = process.env.LEADCRM_BROWSER_OUTPUT || resolve(tmpdir(), 'leadcrm-user-details', randomUUID());
mkdirSync(output, { recursive: true });
const checks = [], pageErrors = [], updates = [];
const record = label => { checks.push({ label, passed: true }); console.log('PASS', label); };
let pg, socket, prisma, api, frontend, browser, page;
try {
  pg = await PGlite.create();
  await replayCrmMigrations(pg);
  socket = new PGLiteSocketServer({ db: pg, host: '127.0.0.1', port: 0 });
  await socket.start();
  const port = Number(process.env.USER_DETAILS_BROWSER_PORT || await acceptancePort()), base = `http://localhost:${port}`;
  Object.assign(process.env, { NODE_ENV: 'test', DATABASE_URL: `postgresql://postgres:postgres@${socket.getServerConn()}/leadcrm_user_details_browser?connection_limit=1&statement_cache_size=0`,
    JWT_SECRET: randomBytes(32).toString('hex'), ENCRYPTION_KEY: randomBytes(32).toString('hex'), APP_URL: base, CORS_ORIGIN: base, ALLOWED_ORIGINS: base });
  process.env.DIRECT_URL = process.env.DATABASE_URL;
  for (const key of Object.keys(process.env)) if (/^(BREVO|TEXTBEE|SMTP|GMAIL|GOOGLE_CLIENT|GOOGLE_REFRESH)/.test(key)) delete process.env[key];
  const require = createRequire(import.meta.url), Module = require('node:module'), originalResolve = Module._resolveFilename;
  Module._resolveFilename = function (request, parent, isMain, options) {
    return request === '@leadcrm/shared' ? resolve(root, 'backend/dist/shared/src/index.js') : originalResolve.call(this, request, parent, isMain, options);
  };
  const mail = require('../dist/backend/src/shared/services/email.service.js');
  let providerSubmissions = 0;
  mail.sendMail = async () => { providerSubmissions++; return { submitted: true, messageId: 'fixture-only' }; };
  prisma = require('../dist/backend/src/config/database.config.js').default;
  const app = require('../dist/backend/src/app.js').default;
  const { issueAuthSession } = require('../dist/backend/src/core/auth/auth-session.js');
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const tenant = await prisma.tenant.create({ data: { name: 'User Details Acceptance', slug: randomUUID(), status: 'ACTIVE', onboardingStep: 3, onboardingCompletedAt: new Date() } });
  const admin = await prisma.user.create({ data: { tenantId: tenant.id, firstName: 'Browser', lastName: 'Admin', email: 'browser-admin@camxian.com', role: 'Client Admin', status: 'ACTIVE', mustChangePassword: false, onboardingCompletedAt: new Date() } });
  const role = await prisma.roleDefinition.create({ data: { tenantId: tenant.id, name: 'Sales', permissions: { create: ['leads', 'contacts', 'accounts', 'deals', 'tasks'].map(module => ({ module, canView: true })) } } });
  const longRole = await prisma.roleDefinition.create({ data: { tenantId: tenant.id, name: 'Regional Sales Representative for Enterprise Accounts and Customer Relationships' } });
  const staff = await prisma.user.create({ data: { tenantId: tenant.id, firstName: 'Nicolette', lastName: 'Cuison', email: 'nicolette.cuison@camxian.com', role: 'Sales', status: 'ACTIVE', userRoles: { create: { roleId: role.id } } } });
  const replacement = await prisma.user.create({ data: { tenantId: tenant.id, firstName: 'Replacement', lastName: 'Agent', email: 'replacement@camxian.com', role: 'Sales', status: 'ACTIVE', userRoles: { create: { roleId: role.id } } } });
  const long = await prisma.user.create({ data: { tenantId: tenant.id, firstName: 'Alexandria'.repeat(7), lastName: 'Longlastname'.repeat(5),
    email: `${'long.address.'.repeat(4)}staff@workspace.example`, role: longRole.name, status: 'ACTIVE', userRoles: { create: { roleId: longRole.id } } } });
  const group = await prisma.tenantGroup.create({ data: { tenantId: tenant.id, name: 'Sales 1' } });
  const longGroup = await prisma.tenantGroup.create({ data: { tenantId: tenant.id, name: 'Enterprise account management and international customer success team' } });
  await prisma.tenantGroupMember.create({ data: { tenantId: tenant.id, userId: long.id, groupId: longGroup.id } });
  const task = await prisma.task.create({ data: { tenantId: tenant.id, title: 'Acceptance unfinished task', assignedUserId: staff.id, status: 'pending', dueDate: new Date(Date.now() + 86400000) } });
  const token = (await issueAuthSession(admin)).token;
  api = app.listen(0, '127.0.0.1'); await new Promise(done => api.once('listening', done));
  const apiBase = `http://127.0.0.1:${api.address().port}/api/v1`;
  const log = createWriteStream(resolve(output, 'frontend.log'));
  frontend = spawn(process.execPath, [resolve(root, 'node_modules/next/dist/bin/next'), 'start', '-p', String(port), '-H', '127.0.0.1'], {
    cwd: resolve(root, 'frontend'), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'production', API_URL: 'https://leadcrm-build.example/api/v1' },
  });
  frontend.stdout.pipe(log); frontend.stderr.pipe(log);
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { if ((await fetch(base + '/login')).ok) { ready = true; break; } } catch {}
    await new Promise(done => setTimeout(done, 500));
  }
  assert.ok(ready, 'Built frontend started');
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await createAcceptanceContext(browser, { viewport: { width: 1440, height: 900 }, timezoneId: 'Asia/Manila' });
  await context.addCookies([{ name: 'leadcrm_token', value: token, url: base, httpOnly: true, sameSite: 'Lax' }]);
  page = await context.newPage(); page.setDefaultTimeout(20000); page.on('pageerror', error => pageErrors.push(error.message));
  await page.route('**/api/proxy/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname.replace('/api/proxy', '');
    const headers = { ...request.headers(), authorization: `Bearer ${token}` };
    if (path.endsWith('/events') || path === '/crm/record-events') return route.continue({ url: apiBase + path + url.search, headers });
    if (request.method() === 'PUT' && path === `/administration/users/${staff.id}`) updates.push(request.postDataJSON());
    const response = await page.request.fetch(apiBase + path + url.search, { method: request.method(), headers, data: request.postDataBuffer() ?? undefined });
    await route.fulfill({ response });
  });
  await page.goto(base + '/settings?tab=users', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'View Nicolette Cuison' }).click();
  const panel = page.getByRole('dialog', { name: 'User Details' }); await panel.waitFor();
  assert.equal(await panel.getByRole('tablist').count(), 0);
  assert.equal(await panel.getByRole('tab').count(), 0);
  assert.equal(await panel.getByRole('button', { name: 'Edit User', exact: true }).count(), 0);
  assert.equal(await panel.getByRole('button', { name: 'Approve registered email' }).count(), 0);
  assert.equal(await panel.getByRole('button', { name: 'Edit Email' }).count(), 0);
  assert.equal(await panel.getByRole('button', { name: 'Edit Status' }).count(), 0);
  record('Existing details have two sections, no tabs, no full edit form and read-only Email/Status');
  for (const [field, value] of [['First Name', 'Nicolette Updated'], ['Phone', '9171234567'], ['Job Title', 'Sales Agent']]) {
    await panel.getByRole('button', { name: `Edit ${field}`, exact: true }).click();
    await panel.getByLabel(field, { exact: true }).fill(value);
    await panel.getByRole('button', { name: 'Save', exact: true }).click();
    await panel.getByRole('button', { name: `Edit ${field}`, exact: true }).waitFor();
  }
  assert.deepEqual(updates, [{ firstName: 'Nicolette Updated' }, { phone: '+639171234567' }, { jobTitle: 'Sales Agent' }]);
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: staff.id } })).phone, '+639171234567');
  record('Individual saves send only the changed field, persist normalized values and keep details open');
  await panel.getByRole('button', { name: 'Edit Groups' }).click();
  await panel.getByRole('checkbox', { name: 'Sales 1', exact: true }).check();
  await panel.getByRole('button', { name: 'Save', exact: true }).click();
  await panel.getByRole('button', { name: 'Edit Groups' }).waitFor();
  assert.deepEqual(updates.at(-1), { groupIds: [group.id] });
  assert.equal(await prisma.tenantGroupMember.count({ where: { userId: staff.id, groupId: group.id } }), 1);
  record('Inline Groups persist the existing workflow memberships');
  await panel.getByRole('button', { name: 'Edit Last Name' }).click();
  await panel.getByRole('textbox', { name: 'Last Name' }).fill('Discarded');
  await panel.getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: staff.id } })).lastName, 'Cuison');
  await panel.getByRole('button', { name: 'Close drawer' }).click();
  await page.getByRole('button', { name: 'View Nicolette Updated Cuison' }).waitFor();
  record('Cancel discards its draft and the table immediately reflects saved values');
  await page.getByRole('button', { name: `View ${long.firstName} ${long.lastName}` }).click();
  for (const theme of ['Light', 'Dark']) {
    await setAcceptanceTheme(page, theme);
    for (const width of [320, 375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(300);
      assert.equal(await panel.evaluate(element => element.scrollWidth > element.clientWidth + 1), false, `${theme} ${width} drawer overflow`);
      for (const name of ['User actions', 'Close drawer', 'Send Password Reset']) {
        const control = panel.getByRole('button', { name, exact: true });
        assert.ok(await control.isVisible());
        assert.ok(await control.evaluate(element => { const rect = element.getBoundingClientRect(); return rect.left >= 0 && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1; }), `${name} stays visible`);
      }
      await panel.getByRole('button', { name: 'Edit Phone' }).click();
      const phone = panel.getByLabel('Phone', { exact: true });
      assert.ok(await phone.evaluate(element => { const rect = element.getBoundingClientRect(); return rect.width >= 90 && rect.right <= innerWidth; }));
      await panel.getByRole('button', { name: 'Cancel', exact: true }).click();
      await panel.getByRole('button', { name: 'Edit Groups' }).click();
      const groups = panel.getByRole('group', { name: 'Groups' });
      assert.equal(await groups.evaluate(element => element.scrollWidth > element.clientWidth + 1), false);
      await panel.getByRole('button', { name: 'Cancel', exact: true }).click();
      await panel.getByRole('button', { name: 'User actions' }).click();
      const menu = page.getByRole('menu', { name: 'Row actions menu' });
      assert.ok(await menu.evaluate(element => { const rect = element.getBoundingClientRect(); return rect.left >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight; }));
      assert.equal(await menu.locator('[role=menuitem] svg').count(), 2);
      await page.screenshot({ path: resolve(output, `details-${theme}-${width}.png`) });
      await page.keyboard.press('Escape');
      await menu.waitFor({ state: 'hidden' }); assert.ok(await panel.isVisible());
      record(`Long identity/email/role/groups, editors, footer and owned menu fit ${theme} ${width}px`);
    }
  }
  await setAcceptanceTheme(page, 'Light'); await page.setViewportSize({ width: 1440, height: 900 });
  await panel.getByRole('button', { name: 'Close drawer' }).click();
  const row = page.getByRole('row').filter({ hasText: 'Nicolette Updated Cuison' });
  await row.getByRole('button', { name: 'Row actions' }).click();
  const rowMenu = page.getByRole('menu');
  assert.equal(await rowMenu.locator('[role=menuitem] svg').count(), 4);
  await rowMenu.getByRole('menuitem', { name: 'Edit', exact: true }).click();
  await panel.getByRole('button', { name: 'Edit First Name' }).waitFor();
  record('Table View/Edit open one inline experience and every row action has an icon');
  await panel.getByRole('button', { name: 'User actions' }).click();
  await page.getByRole('menuitem', { name: 'Deactivate', exact: true }).click();
  const reassign = page.getByRole('alertdialog', { name: 'Reassign Records and Tasks' });
  await reassign.waitFor();
  assert.ok(await reassign.getByRole('button', { name: 'Continue' }).isDisabled());
  await reassign.getByRole('combobox', { name: /Assigned Agent/ }).selectOption(replacement.id);
  await reassign.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('alertdialog', { name: 'Deactivate this user?' }).getByRole('button', { name: 'Deactivate', exact: true }).click();
  await panel.getByText('Inactive', { exact: true }).waitFor();
  assert.equal((await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).assignedUserId, replacement.id);
  assert.equal(await panel.getByRole('button', { name: 'Edit Groups' }).count(), 0);
  record('Header Deactivate reuses required replacement, confirmation and persisted task transfer');
  await panel.getByRole('button', { name: 'User actions' }).click();
  await page.getByRole('menuitem', { name: 'Activate', exact: true }).click();
  await page.getByRole('alertdialog', { name: 'Activate this user?' }).getByRole('button', { name: 'Activate', exact: true }).click();
  await panel.getByText('Active', { exact: true }).waitFor();
  record('Inactive header Activate reuses existing confirmation and updates open details');
  await panel.getByRole('button', { name: 'User actions' }).click(); await page.getByRole('menuitem', { name: 'Archive', exact: true }).click();
  await page.getByRole('alertdialog', { name: 'Archive User?' }).getByRole('button', { name: 'Archive', exact: true }).click();
  await page.getByRole('alertdialog').waitFor({ state: 'hidden' });
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: staff.id } })).status, 'INACTIVE');
  record('Header Archive reuses the parent confirmation and existing archive API');
  await panel.getByRole('button', { name: 'Close drawer' }).click();
  // The exiting drawer retains its focus trap until it unmounts.
  await panel.waitFor({ state: 'hidden' });
  // Recent success toasts can cover this corner; use the button's keyboard entry point.
  await page.getByRole('button', { name: 'New User', exact: true }).press('Enter');
  const create = page.getByRole('dialog', { name: 'New User' });
  await create.waitFor();
  await create.getByLabel('First Name', { exact: false }).fill('Created'); await create.getByLabel('Last Name', { exact: false }).fill('Staff');
  await create.getByLabel('Email', { exact: false }).fill('created.staff@gmail.com'); await create.getByLabel('Phone', { exact: false }).fill('9171234567');
  await create.getByLabel('Role', { exact: false }).selectOption('Sales'); await create.getByRole('button', { name: 'Create User', exact: true }).click();
  await create.waitFor({ state: 'hidden' }); await page.getByRole('button', { name: 'View Created Staff' }).waitFor();
  const created = await prisma.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: 'created.staff@gmail.com' } });
  assert.ok(created.mustChangePassword);
  assert.equal(await prisma.auditLog.count({ where: { tenantId: tenant.id, entityId: created.id, action: 'user.staff_approved' } }), 1);
  assert.equal(providerSubmissions, 1);
  record('New User remains a form and automatically approves external staff; welcome email is mocked');
  assert.deepEqual(pageErrors, []);
  writeFileSync(resolve(output, 'results.json'), JSON.stringify({ status: 'PASS', checks, pageErrors }, null, 2));
  console.log(`User Details browser acceptance passed: ${checks.length} checks. Output: ${output}`);
} catch (error) {
  if (page) {
    await page.screenshot({ path: resolve(output, 'failure.png') }).catch(() => {});
    writeFileSync(resolve(output, 'failure.txt'), await page.locator('body').innerText().catch(() => ''));
  }
  writeFileSync(resolve(output, 'results.json'), JSON.stringify({ status: 'FAIL', checks, pageErrors, error: String(error) }, null, 2));
  throw error;
} finally {
  // Finish intercepted refresh requests before disposing their API request context.
  await page?.unrouteAll({ behavior: 'wait' });
  await browser?.close(); frontend?.kill();
  if (api) { api.closeAllConnections(); await new Promise(done => api.close(done)); }
  await prisma?.$disconnect(); await socket?.stop(); await pg?.close();
}
