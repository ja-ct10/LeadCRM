import { acceptancePort, createAcceptanceContext, setAcceptanceTheme } from './verify-browser-matrix.mjs';
// Disposable PostgreSQL and local application only. Screenshots stay outside Git.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { randomUUID, randomBytes } from 'node:crypto';
import { mkdirSync, createWriteStream, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
const root = resolve(import.meta.dirname, '../..');
const output = process.env.LEADCRM_BROWSER_OUTPUT || (resolve(tmpdir(), `leadcrm-tasks-browser-${Date.now()}`));
mkdirSync(output, { recursive: true });
const database = new URL(process.env.DATABASE_URL);
assert.equal(database.hostname, '127.0.0.1');
assert.equal(database.pathname, '/leadcrm_forms_test_2');
const base = `http://localhost:${await acceptancePort()}`;
Object.assign(process.env, { NODE_ENV: 'test',
  JWT_SECRET: randomBytes(32).toString('hex'), ENCRYPTION_KEY: randomBytes(32).toString('hex'), APP_URL: base, ALLOWED_ORIGINS: base });
process.env.DIRECT_URL = process.env.DATABASE_URL;
const require = createRequire(import.meta.url), Module = require('node:module'), originalResolve = Module._resolveFilename;
Module._resolveFilename = function(request, parent, isMain, options) {
  return request === '@leadcrm/shared' ? resolve(root, 'backend/dist/shared/src/index.js') : originalResolve.call(this, request, parent, isMain, options);
};
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const prisma = require('../dist/backend/src/config/database.config.js').default;
const app = require('../dist/backend/src/app.js').default;
const { issueAuthSession } = require('../dist/backend/src/core/auth/auth-session.js');
const checks = [], errors = [];
let api, frontend, browser, page;
const originalLog = console.log, runtimeLog = createWriteStream(resolve(output, 'backend.log'));
console.log = console.error = (...args) => runtimeLog.write(args.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ') + '\n');
try {
  const tenantId = (await prisma.tenant.create({ data: { name: 'Tasks Browser QA', slug: randomUUID(), onboardingStep: 3, onboardingCompletedAt: new Date() } })).id;
  const admin = await prisma.user.create({ data: { tenantId, firstName: 'Tasks', lastName: 'Admin', email: 'tasks-browser@camxian.com', role: 'Client Admin', mustChangePassword: false, onboardingCompletedAt: new Date() } });
  const { token } = await issueAuthSession(admin);
  const role = await prisma.roleDefinition.create({ data: { tenantId, name: 'Tasks QA staff', permissions: { create: { module: 'tasks', canView: true } } } });
  const staff = await prisma.user.create({ data: { tenantId, firstName: 'Tasks', lastName: 'Staff', email: 'tasks-staff@camxian.com', role: role.name, userRoles: { create: { roleId: role.id } } } });
  const account = await prisma.account.create({ data: { tenantId, name: 'Tasks QA Account',  } });
  const contact = await prisma.contact.create({ data: { tenantId, firstName: 'Tasks', lastName: 'Contact', assignedUserId: admin.id } });
  const lead = await prisma.lead.create({ data: { tenantId, firstName: 'Tasks', lastName: 'Lead', assignedUserId: admin.id, contactId: contact.id, convertedAt: new Date() } });
  const pipeline = await prisma.pipeline.create({ data: { tenantId, name: 'Tasks QA Pipeline' } });
  const stage = await prisma.stage.create({ data: { tenantId, pipelineId: pipeline.id, name: 'Lead', order: 0 } });
  const deals = [];
  for (const title of ['Tasks QA Deal', 'Tasks QA Extra Deal']) deals.push(await prisma.deal.create({ data: { tenantId, title, accountId: account.id,
    assignedUserId: admin.id, pipelineId: pipeline.id, stageId: stage.id, leadDeals: { create: { leadId: lead.id } }, contactDeals: { create: { contactId: contact.id } } } }));
  api = app.listen(0, '127.0.0.1'); await new Promise(done => api.once('listening', done));
  const apiBase = `http://127.0.0.1:${api.address().port}/api/v1`;
  async function call(path, method = 'GET', body) {
    const response = await fetch(apiBase + path, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    assert.ok(response.ok, `${method} ${path} ${response.status} ${await response.clone().text()}`); return response.json();
  }
  for (let i = 0; i < 12; i++) await call('/operations/tasks', 'POST', { requestId: randomUUID(), title: `Browser QA Task ${String(i).padStart(2, '0')}`, assignedUserId: staff.id, dueDate: new Date(Date.now() + 86400000).toISOString(), dealIds: deals.map(x => x.id) });
  const log = createWriteStream(resolve(output, 'frontend.log'));
  frontend = spawn(process.execPath, [resolve(root, 'node_modules/next/dist/bin/next'), 'start', '-p', new URL(base).port, '-H', '127.0.0.1'], {
    cwd: resolve(root, 'frontend'), windowsHide: true, stdio: ['ignore','pipe','pipe'],
    env: { ...process.env, NODE_ENV: 'production', API_URL: 'https://leadcrm-build.example/api/v1', NEXT_PUBLIC_USE_MOCK_AUTH: 'false', NEXT_PUBLIC_USE_MOCK_DATA: 'false' },
  });
  frontend.stdout.pipe(log); frontend.stderr.pipe(log);
  let ready = false;
  for (let i = 0; i < 100; i++) { try { if ((await fetch(base + '/login')).ok) { ready = true; break; } } catch {} await new Promise(done => setTimeout(done, 500)); }
  assert.ok(ready, 'Local frontend did not start');
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await createAcceptanceContext(browser);
  await context.addInitScript(() => localStorage.setItem('app_theme', matchMedia('(prefers-color-scheme: dark)').matches ? 'Dark' : 'Light'));
  await context.addCookies([{ name: 'leadcrm_token', value: token, url: base, httpOnly: true, sameSite: 'Lax' }]);
  page = await context.newPage(); page.setDefaultTimeout(30000); page.setDefaultNavigationTimeout(120000);
  await page.route('**/api/proxy/**', async route => {
    const request = route.request(), url = new URL(request.url());
    const local = `${apiBase}${url.pathname.replace('/api/proxy', '')}${url.search}`;
    const headers = { ...request.headers(), authorization: `Bearer ${token}` };
    if (url.pathname.endsWith('/events') || url.pathname.endsWith('/record-events')) return route.continue({ url: local, headers });
    try {
      await route.fulfill({ response: await page.request.fetch(local, { method: request.method(), headers, data: request.postDataBuffer() ?? undefined,
        maxRetries: ['GET', 'HEAD'].includes(request.method()) ? 2 : 0 }) });
    } catch (error) {
      if (page.isClosed() || request.failure()?.errorText === 'net::ERR_ABORTED') return;
      errors.push(`${request.method()} ${url.pathname}: ${String(error).split('\n')[0]}`);
      await route.abort('failed').catch(() => {});
    }
  });
  page.on('pageerror', error => errors.push(error.message));
  async function capture(name) {
    await page.waitForFunction(() => [...document.querySelectorAll('[role="dialog"]')].every(dialog => {
      const box = dialog.getBoundingClientRect();
      return box.left >= -1 && box.right <= innerWidth + 1;
    }));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, name + ' horizontal overflow');
    await page.screenshot({ path: resolve(output, name + '.png'), fullPage: true });
  }
  const records = { leads: lead, contacts: contact, accounts: account, deals: deals[0] };
  for (const theme of process.env.TASK_BROWSER_PHASE === 'management' ? [] : ['light','dark']) {
    await page.emulateMedia({ colorScheme: theme });
    for (const width of [320,375,390,430,768,1024,1440,1920]) {
      await page.setViewportSize({ width, height: 900 });
      for (const [module, record] of Object.entries(records)) {
        await page.goto(`${base}/crm/${module}/${record.id}`, { waitUntil: 'domcontentloaded' });
        await setAcceptanceTheme(page, theme === 'dark' ? 'Dark' : 'Light');
        await page.getByRole('tab', { name: /^Activity/ }).click();
        const refresh = page.getByRole('button', { name: 'Refresh tasks', exact: true });
        await refresh.waitFor();
        await page.getByText('12 tasks · 12 active', { exact: true }).waitFor();
        assert.equal(await page.getByRole('button', { name: 'Add task', exact: true }).count(), module === 'deals' ? 1 : 0);
        await refresh.click();
        await page.getByText('12 tasks · 12 active', { exact: true }).waitFor();
        await page.getByRole('button', { name: 'Next', exact: true }).first().click();
        await page.getByText('Page 2', { exact: true }).waitFor();
        await page.getByRole('button', { name: 'Previous', exact: true }).first().click();
        await page.getByRole('button', { name: /Browser QA Task/ }).first().click();
        const editor = page.getByRole('dialog').filter({ has: page.getByText('Associated Deals (2)', { exact: true }) });
        await editor.waitFor();
        assert.equal(await editor.getByRole('button', { name: 'Save changes', exact: true }).count(), module === 'deals' ? 1 : 0);
        assert.equal(await editor.getByRole('button', { name: 'Archive', exact: true }).count(), module === 'deals' ? 1 : 0);
        assert.equal(await editor.getByRole('button', { name: /Associate task to deal/ }).isEnabled(), module === 'deals');
        for (const kind of ['lead','contact','account']) assert.equal(await editor.getByText(`Associate task to ${kind}`, { exact: true }).count(), 0);
        await capture(`${module}-${theme}-${width}`);
        assert.equal(await editor.getByRole('button', { name: 'Close', exact: true }).count(), 0);
        assert.equal(await editor.locator('footer').count(), 0);
        await editor.getByRole('button', { name: 'Close record', exact: true }).click();
        await page.getByText('Task Created', { exact: true }).first().waitFor();
        checks.push(`${module} ${theme} ${width}: count, refresh, pagination, details policy, history, overflow`);
      }
      await page.goto(`${base}/crm/deals/${deals[0].id}`);
      await page.getByRole('button', { name: 'Add task', exact: true }).click();
      await page.getByText('Associated Deals (1)', { exact: true }).waitFor();
      const selector = page.getByRole('button', { name: /Associate task to deal/ });
      await selector.press('ArrowDown');
      const picker = page.getByRole('dialog', { name: 'Select deal', exact: true });
      await picker.getByLabel('Tasks QA Deal', { exact: true }).waitFor();
      assert.equal(await picker.getByLabel('Tasks QA Deal', { exact: true }).isChecked(), true);
      await picker.getByLabel('Tasks QA Deal', { exact: true }).click();
      assert.equal(await picker.getByLabel('Tasks QA Deal', { exact: true }).isChecked(), true, 'Originating Deal stays selected');
      await picker.getByLabel('Tasks QA Extra Deal', { exact: true }).check();
      await picker.getByPlaceholder('Search for deal').press('Escape');
      await page.getByText('Associated Deals (2)', { exact: true }).waitFor();
      await capture(`create-${theme}-${width}`);
      await page.getByRole('button', { name: 'Close', exact: true }).last().click();
      checks.push(`Create ${theme} ${width}: Deal preselection, origin retained, multi-Deal, keyboard picker`);
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto(`${base}/crm/deals/${deals[0].id}`);
  await page.getByRole('button', { name: 'Add task', exact: true }).click();
  await page.getByRole('dialog').getByRole('textbox', { name: /^Title/ }).fill('Deal-created canonical Task');
  await page.getByRole('button', { name: /^Assigned Agent/ }).click();
  await page.getByRole('dialog', { name: 'Select owner', exact: true }).getByLabel('Tasks Staff', { exact: true }).check();
  await page.getByLabel('Search owner', { exact: true }).press('Escape');
  const dealSaved = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/operations/tasks'));
  await page.getByRole('button', { name: 'Create task', exact: true }).click();
  assert.equal((await dealSaved).status(), 201);
  await page.getByRole('button', { name: /Deal-created canonical Task/ }).click();
  let details = page.getByRole('dialog').filter({ has: page.getByText('Associated Deals (1)', { exact: true }) });
  await details.getByRole('combobox', { name: /^Status/ }).selectOption('completed');
  const completed = page.waitForResponse(response => response.request().method() === 'PUT' && /\/operations\/tasks\//.test(response.url()));
  await details.getByRole('button', { name: 'Save changes', exact: true }).click();
  assert.equal((await completed).status(), 200);
  const dealTask = await prisma.task.findFirstOrThrow({ where: { tenantId, title: 'Deal-created canonical Task' } });
  assert.equal(dealTask.status, 'completed'); assert.equal(dealTask.completedById, admin.id);
  checks.push('Deal Details: canonical creation and authorized completion persist');
  await page.goto(base + '/operations/taskboard');
  await page.getByRole('button', { name: 'Create Task', exact: true }).click();
  await page.getByRole('dialog').getByRole('textbox', { name: /^Title/ }).fill('Browser-created canonical Task');
  await page.getByRole('button', { name: /^Assigned Agent/ }).click();
  await page.getByRole('dialog', { name: 'Select owner', exact: true }).getByLabel('Tasks Staff', { exact: true }).check();
  await page.getByLabel('Search owner', { exact: true }).press('Escape');
  await page.getByRole('button', { name: 'Create task', exact: true }).last().click();
  await page.getByText('Select at least one Deal to associate with this task.', { exact: true }).waitFor();
  await page.getByRole('button', { name: /Associate task to deal/ }).click();
  await page.getByRole('dialog', { name: 'Select deal', exact: true }).getByLabel('Tasks QA Deal', { exact: true }).check();
  await page.getByRole('dialog', { name: 'Select deal', exact: true }).getByLabel('Tasks QA Extra Deal', { exact: true }).check();
  await page.getByPlaceholder('Search for deal').press('Escape');
  const saved = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/operations/tasks'));
  await page.getByRole('button', { name: 'Create task', exact: true }).last().click();
  assert.equal((await saved).status(), 201);
  const task = await prisma.task.findFirstOrThrow({ where: { tenantId, title: 'Browser-created canonical Task' }, include: { dealLinks: true, leadLinks: true, contactLinks: true, accountLinks: true } });
  assert.deepEqual(new Set(task.dealLinks.map(row => row.dealId)), new Set(deals.map(row => row.id)));
  assert.equal(task.leadLinks.length + task.contactLinks.length + task.accountLinks.length, 0);
  checks.push('Standalone Tasks: required Deal validation and canonical multi-Deal creation persistence');
  assert.deepEqual(errors, []);
  writeFileSync(resolve(output, 'results.json'), JSON.stringify({ checks, errors }, null, 2));
  originalLog(`Tasks browser: ${checks.length} checks passed; evidence: ${output}`);
} catch (error) {
  if (page) {
    await page.screenshot({ path: resolve(output, 'failure.png'), fullPage: true }).catch(() => {});
    writeFileSync(resolve(output, 'failure-dom.txt'), await page.locator('body').innerText().catch(() => 'Page unavailable'));
  }
  writeFileSync(resolve(output, 'results.json'), JSON.stringify({ checks, errors, failure: error.stack }, null, 2));
  originalLog(`Tasks browser failed; evidence: ${output}`); throw error;
} finally {
  await browser?.close(); frontend?.kill(); if (api) { api.closeAllConnections(); await new Promise(done => api.close(done)); }
  await prisma.$disconnect(); runtimeLog.end();
}
