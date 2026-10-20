// Local acceptance: two real authenticated browsers, native disposable PostgreSQL.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { createWriteStream, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { notificationTestPostgres } from './notification-test-postgres.mjs';
import { acceptancePort, createAcceptanceContext } from './verify-browser-matrix.mjs';

const root = resolve(import.meta.dirname, '../..'), require = createRequire(import.meta.url);
const output = resolve(root, 'data/outputs/workflow-policy-tests/realtime-browser'); mkdirSync(output, { recursive: true });
const { qaEnvironment } = require('../../scripts/qa-environment.cjs');
const postgresBin = process.env.POSTGRES_TEST_BIN;
const environment = qaEnvironment(root);
for (const key of Object.keys(process.env)) if (!(key in environment)) delete process.env[key];
Object.assign(process.env, environment, postgresBin ? { POSTGRES_TEST_BIN: postgresBin } : {});
require('../../scripts/qa-network-guard.cjs');
const { chromium } = require('playwright');
const Module = require('node:module'), originalResolve = Module._resolveFilename;
let pg, prisma, api, frontend, browser, stopWorker, closing = false;
const checks = [], pageErrors = [], navigations = [], timings = [];
const log = createWriteStream(resolve(output, 'frontend.log'));
const record = label => { checks.push(label); console.log('PASS', label); };
const until = async (check, label, timeout = 10000) => {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await check()) return; await new Promise(done => setTimeout(done, 50)); }
  throw new Error(label);
};
let failure;
try {
  pg = await notificationTestPostgres();
  process.env.DATABASE_URL = await pg.database('leadcrm_workflow_browser_10');
  process.env.DIRECT_URL = process.env.DATABASE_URL;
  const base = `http://127.0.0.1:${await acceptancePort()}`;
  Object.assign(process.env, { APP_URL: base, ALLOWED_ORIGINS: base });
  Module._resolveFilename = function(request, parent, isMain, options) {
    return request === '@leadcrm/shared' ? resolve(root, 'backend/dist/shared/src/index.js') : originalResolve.call(this, request, parent, isMain, options);
  };
  prisma = require('../dist/backend/src/config/database.config.js').default;
  const app = require('../dist/backend/src/app.js').default;
  const { tenantContext } = require('../dist/backend/src/core/tenant/tenant-context.js');
  const { issueAuthSession } = require('../dist/backend/src/core/auth/auth-session.js');
  const workflows = require('../dist/backend/src/modules/automation/workflows/workflows.service.js');
  const { startWorkflowScheduler } = require('../dist/backend/src/modules/automation/workflows/workflow-queue.js');
  const tenant = await prisma.tenant.create({ data: { name: 'Realtime browser fixture', slug: randomUUID(), onboardingStep: 3, onboardingCompletedAt: new Date() } });
  const users = [];
  for (const name of ['Editor', 'Observer']) users.push(await prisma.user.create({ data: {
    tenantId: tenant.id, firstName: name, lastName: 'Fixture', email: `${randomUUID()}@camxian.com`,
    role: 'Client Admin', status: 'ACTIVE', mustChangePassword: false, onboardingCompletedAt: new Date(), emailVerified: new Date(),
  } }));
  const scope = work => tenantContext.run({ tenantId: tenant.id }, work);
  const pipeline = await prisma.pipeline.create({ data: { tenantId: tenant.id, name: 'Sales Pipeline' } });
  const stages = [];
  for (const [order, name] of ['Lead', 'Contacted', 'Qualified', 'Cancelled'].entries()) stages.push(await prisma.stage.create({
    data: { tenantId: tenant.id, pipelineId: pipeline.id, name, order, isDefault: order === 0, isLost: order === 3 },
  }));
  const deal = await prisma.deal.create({ data: { tenantId: tenant.id, pipelineId: pipeline.id, stageId: stages[0].id,
    title: 'Realtime workflow opportunity', value: 1000, priority: 'LOW', assignedUserId: users[0].id } });
  await scope(() => workflows.createWorkflow(tenant.id, users[0].id, { name: 'Priority routes opportunity', trigger: 'deal.updated', isActive: true,
    conditions: { operator: 'AND', conditions: [{ field: 'deal.priority', operator: 'equals', value: 'HIGH' }] },
    actions: [{ type: 'move_deal_stage', config: { stageId: stages[3].id } }],
  }));
  api = app.listen(0, '127.0.0.1'); await new Promise(done => api.once('listening', done));
  stopWorker = startWorkflowScheduler();
  frontend = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'start', '-p', new URL(base).port, '-H', '127.0.0.1'], {
    cwd: resolve(root, 'frontend'), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'production', API_URL: 'https://leadcrm-build.example/api/v1' },
  });
  frontend.stdout.pipe(log); frontend.stderr.pipe(log);
  await until(async () => { try { return (await fetch(base + '/login')).ok; } catch { return false; } }, 'Frontend did not start', 60000);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const pages = [];
  for (const user of users) {
    const { token } = await issueAuthSession(user);
    const context = await createAcceptanceContext(browser, { viewport: { width: 1440, height: 960 }, timezoneId: 'Asia/Manila' });
    await context.addCookies([{ name: 'leadcrm_token', value: token, url: base, httpOnly: true, sameSite: 'Lax' }]);
    await context.route('**/api/proxy/**', async route => {
      const request = route.request(), url = new URL(request.url());
      const local = `http://127.0.0.1:${api.address().port}/api/v1${url.pathname.replace('/api/proxy', '')}${url.search}`;
      const headers = { ...request.headers(), authorization: `Bearer ${token}` }; delete headers.host;
      if (url.pathname.endsWith('/events') || url.pathname.endsWith('/record-events')) return route.continue({ url: local, headers });
      try { await route.fulfill({ response: await context.request.fetch(local, { method: request.method(), headers, data: request.postDataBuffer() ?? undefined }) }); }
      catch (error) { if (!closing) pageErrors.push(String(error).split('\n')[0]); await route.abort().catch(() => {}); }
    });
    const page = await context.newPage(); page.setDefaultTimeout(15000); page.setDefaultNavigationTimeout(60000);
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('framenavigated', frame => { if (frame === page.mainFrame()) navigations.push({ user: user.id, url: frame.url() }); });
    await page.goto(base + '/crm/deals'); await page.getByRole('region', { name: 'Deal pipeline' }).waitFor();
    await page.getByText(deal.title, { exact: true }).waitFor(); pages.push(page);
  }
  const column = (page, name) => page.getByRole('region', { name: 'Deal pipeline' }).getByRole('heading', { name, exact: true }).locator('xpath=ancestor::div[4]');
  const cardIn = (page, name) => column(page, name).locator(`[data-deal-id="${deal.id}"]`);
  assert.equal(await cardIn(pages[0], 'Lead').count(), 1); assert.equal(await cardIn(pages[1], 'Lead').count(), 1);
  record('Two distinct authenticated users see the initial Deal');
  // Real keyboard drag follows the same service used by pointer drag.
  const drag = pages[0].getByRole('button', { name: `Drag ${deal.title}`, exact: true });
  await drag.focus(); await pages[0].keyboard.press('Space');
  await until(async () => await drag.getAttribute('aria-pressed') === 'true', 'Drag did not activate');
  await pages[0].evaluate(() => new Promise(done => setTimeout(done, 0)));
  await pages[0].keyboard.press('ArrowRight');
  await until(async () => await cardIn(pages[0], 'Contacted').count() === 1, 'Drag did not preview Contacted');
  await pages[0].keyboard.press('Space');
  await until(async () => (await prisma.deal.findUniqueOrThrow({ where: { id: deal.id } })).stageId === stages[1].id, 'Manual drag was not saved');
  await until(async () => await cardIn(pages[1], 'Contacted').count() === 1, 'Observer missed manual drag');
  record('Manual drag persists and automatically synchronizes to the other user');
  const navigationCount = navigations.length;
  const before = (await prisma.dashboardRevision.findUniqueOrThrow({ where: { tenantId: tenant.id } })).content;
  const started = Date.now();
  const result = await pages[0].evaluate(async id => {
    const response = await fetch('/api/proxy/crm/deals/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ priority: 'HIGH' }) });
    return { status: response.status, body: await response.json() };
  }, deal.id);
  assert.equal(result.status, 200, JSON.stringify(result));
  await until(async () => (await prisma.deal.findUniqueOrThrow({ where: { id: deal.id } })).stageId === stages[3].id, 'Workflow did not promptly save its configured stage', 5000);
  timings.push({ databaseMs: Date.now() - started }); record('Field edit triggers the real workflow and saves its stage within five seconds');
  for (const [index, page] of pages.entries()) {
    await until(async () => await cardIn(page, 'Cancelled').count() === 1 && await cardIn(page, 'Contacted').count() === 0, 'Kanban did not reconcile for user ' + index, 10000);
    assert.equal(await column(page, 'Contacted').getByText('0', { exact: true }).count(), 1);
    assert.equal(await column(page, 'Cancelled').getByText('1', { exact: true }).count(), 1);
    assert.equal(await page.getByText('Total Open Value', { exact: true }).count(), 0);
    assert.equal(await page.getByText('Active Open Deals', { exact: true }).count(), 0);
    await page.screenshot({ path: resolve(output, `user-${index + 1}.png`), fullPage: true });
  }
  timings.push({ bothKanbansMs: Date.now() - started });
  record('Both Kanbans move automatically with correct stage counts and no retired KPI summary');
  assert.equal(navigations.length, navigationCount); record('Neither user reloads or navigates during the workflow change');
  assert.equal(await prisma.dealStageHistory.count({ where: { tenantId: tenant.id, dealId: deal.id, newStageId: stages[3].id } }), 1);
  assert.ok((await prisma.dashboardRevision.findUniqueOrThrow({ where: { tenantId: tenant.id } })).content > before);
  record('One workflow transition is recorded and the existing committed content revision advances');
  assert.deepEqual(pageErrors, []); record('No browser or fixture transport errors');
} catch (error) { failure = error; console.error(error); }
finally {
  closing = true;
  await browser?.close(); await stopWorker?.();
  if (frontend && frontend.exitCode === null) { const exited = new Promise(done => frontend.once('exit', done)); frontend.kill(); await exited; }
  api?.closeAllConnections(); if (api) await new Promise(done => api.close(done));
  await prisma?.$disconnect(); pg?.stop(); log.end(); Module._resolveFilename = originalResolve;
  writeFileSync(resolve(output, 'results.json'), JSON.stringify({ success: !failure, checks, timings, pageErrors, error: failure?.stack, cleanup: 'complete' }, null, 2));
}
if (failure) process.exitCode = 1;
