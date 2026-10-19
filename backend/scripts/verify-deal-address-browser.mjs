import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, createWriteStream, cpSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'node:net';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { notificationTestPostgres } from './notification-test-postgres.mjs';
import { createAcceptanceContext, setAcceptanceTheme } from './verify-browser-matrix.mjs';
const root = resolve(import.meta.dirname, '../..'), require = createRequire(import.meta.url);
const { qaEnvironment } = require('../../scripts/qa-environment.cjs');
const { browserEvidence } = require('../../scripts/qa-browser-evidence.cjs');
const output = resolve(process.env.LEADCRM_BROWSER_OUTPUT || resolve(root, 'data/outputs/system-audit/deal-address/browser'));
const suppliedDatabase = process.env.LEADCRM_QA_RUN === '1' ? process.env.DATABASE_URL : undefined;
const environment = qaEnvironment(root, suppliedDatabase ? { DATABASE_URL: suppliedDatabase, DIRECT_URL: suppliedDatabase } : {});
for (const name of Object.keys(process.env)) if (!(name in environment)) delete process.env[name];
Object.assign(process.env, environment);
require('../../scripts/qa-network-guard.cjs');
mkdirSync(output, { recursive: true });
let pg, prisma, api, frontend, browser, log, failure, currentPage, closing = false;
const checks = [], pageErrors = [], serverErrors = [];
const expectedChecks = 8;
const resultPath = resolve(output, 'results.json');
writeFileSync(resultPath, JSON.stringify({ status: 'RUNNING', success: false, cleanup: 'pending', checks, pageErrors }, null, 2));
const Module = require('node:module'), originalResolve = Module._resolveFilename;
try {
  const standalone = resolve(root, 'frontend/.next/standalone/frontend');
  assert.ok(existsSync(resolve(standalone, 'server.js')), 'Build the standalone frontend before running this harness.');
  // Match the deployment artifact: Next standalone excludes these static assets.
  cpSync(resolve(root, 'frontend/.next/static'), resolve(standalone, '.next/static'), { recursive: true });
  if (existsSync(resolve(root, 'frontend/public'))) cpSync(resolve(root, 'frontend/public'), resolve(standalone, 'public'), { recursive: true });
  if (!suppliedDatabase) {
    pg = await notificationTestPostgres();
    process.env.DATABASE_URL = await pg.database('leadcrm_address_browser_1');
    process.env.DIRECT_URL = process.env.DATABASE_URL;
  }
  const probe = createServer(); await new Promise(done => probe.listen(0, '127.0.0.1', done));
  const port = probe.address().port; await new Promise(done => probe.close(done));
  const base = `http://127.0.0.1:${port}`;
  Object.assign(process.env, { APP_URL: base, ALLOWED_ORIGINS: base });
  Module._resolveFilename = function(request, parent, isMain, options) { return request === '@leadcrm/shared' ? resolve(root, 'backend/dist/shared/src/index.js') : originalResolve.call(this, request, parent, isMain, options); };
  prisma = require('../dist/backend/src/config/database.config.js').default;
  const app = require('../dist/backend/src/app.js').default;
  const { tenantContext } = require('../dist/backend/src/core/tenant/tenant-context.js');
  const { issueAuthSession } = require('../dist/backend/src/core/auth/auth-session.js');
  const { chromium } = require('playwright');
  const tenant = await prisma.tenant.create({ data: { name: 'Workflow policy preview', slug: randomUUID(), status: 'ACTIVE', onboardingStep: 3, onboardingCompletedAt: new Date() } });
  const admin = await prisma.user.create({ data: { tenantId: tenant.id, firstName: 'Workflow', lastName: 'Preview', email: `${randomUUID()}@camxian.com`, role: 'Client Admin', status: 'ACTIVE', mustChangePassword: false, onboardingCompletedAt: new Date(), emailVerified: new Date() } });
  const agent = await prisma.user.create({ data: { tenantId: tenant.id, firstName: 'Sales', lastName: 'Agent', email: `${randomUUID()}@camxian.com`, role: 'Sales', status: 'ACTIVE', mustChangePassword: false, onboardingCompletedAt: new Date() } });
  const salesRole = await prisma.roleDefinition.create({ data: { tenantId: tenant.id, name: 'Sales' } });
  await prisma.rolePermission.createMany({ data: ['leads', 'contacts', 'deals', 'tasks', 'accounts', 'products'].map(module => ({ tenantId: tenant.id, roleId: salesRole.id, module, canView: true, canCreate: true, canEdit: true, canAssign: true })) });
  await prisma.userRole.create({ data: { tenantId: tenant.id, userId: agent.id, roleId: salesRole.id } });
  const { token } = await issueAuthSession(admin);
  const scope = work => tenantContext.run({ tenantId: tenant.id }, work);
  const account = await prisma.account.create({ data: { tenantId: tenant.id, name: 'Address Company', address: 'Company street\nMakati' } });
  const product = await prisma.productInterest.create({ data: { tenantId: tenant.id, name: 'Fixture Camera', category: 'Security', dealValue: 900 } });
  const pipeline = await prisma.pipeline.create({ data: { tenantId: tenant.id, name: 'Sales Pipeline' } });
  const stage = await prisma.stage.create({ data: { tenantId: tenant.id, pipelineId: pipeline.id, name: 'Lead', order: 0 } });
  const lead = await prisma.lead.create({ data: { tenantId: tenant.id, firstName: 'Address', lastName: 'Customer', address: 'Personal street\nPasig', assignedUserId: agent.id, accountId: account.id } });
  const contact = await prisma.contact.create({ data: { tenantId: tenant.id, firstName: 'Individual', lastName: 'Customer', address: 'Contact street\nQuezon City', assignedUserId: agent.id } });
  const seeded = await prisma.deal.create({ data: { tenantId: tenant.id, title: 'Linked address Deal', accountId: account.id, productInterestId: product.id, pipelineId: pipeline.id, stageId: stage.id,
    assignedUserId: agent.id, ownerId: admin.id, value: 900, productsNormalized: true, addressSource: { type: 'account', id: account.id } } });
  await prisma.leadDeal.create({ data: { tenantId: tenant.id, leadId: lead.id, dealId: seeded.id, addedById: admin.id } });
  api = app.listen(0, '127.0.0.1'); await new Promise(done => api.once('listening', done));
  log = createWriteStream(resolve(output, 'frontend.log'));
  frontend = spawn(process.execPath, [resolve(standalone, 'server.js')], { cwd: standalone, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NODE_ENV: 'production', PORT: String(port), HOSTNAME: '127.0.0.1', API_URL: 'https://leadcrm-build.example/api/v1' } });
  frontend.stdout.pipe(log); frontend.stderr.pipe(log);
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (frontend.exitCode !== null || frontend.signalCode !== null) throw new Error('Built frontend exited before becoming ready. See frontend.log.');
    try { if ((await fetch(base + '/login', { signal: AbortSignal.timeout(2000) })).ok) { ready = true; break; } } catch {}
    await new Promise(done => setTimeout(done, 500));
  }
  assert.ok(ready, 'Built frontend did not become ready. Build the frontend before running this harness.');
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await createAcceptanceContext(browser, { viewport: { width: 1440, height: 960 }, timezoneId: 'Asia/Manila' });
  await context.addCookies([{ name: 'leadcrm_token', value: token, url: base, httpOnly: true, sameSite: 'Lax' }]);
  await context.route('**/api/proxy/**', async route => {
    const request = route.request(), url = new URL(request.url());
    const local = `http://127.0.0.1:${api.address().port}/api/v1${url.pathname.replace('/api/proxy', '')}${url.search}`;
    const headers = { ...request.headers(), authorization: `Bearer ${token}` }; delete headers.host;
    if (url.pathname.endsWith('/events') || url.pathname.endsWith('/record-events')) return route.continue({ url: local, headers });
    try { await route.fulfill({ response: await context.request.fetch(local, { method: request.method(), headers, data: request.postDataBuffer() ?? undefined, maxRetries: request.method() === 'GET' ? 2 : 0 }) }); }
    catch (error) { if (!closing) { console.error(`Fixture proxy failed: ${request.method()} ${url.pathname}: ${String(error).split('\n')[0]}`); await route.abort().catch(() => {}); } }
  });
  const page = currentPage = await context.newPage(); page.setDefaultTimeout(30000); page.setDefaultNavigationTimeout(60000);
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto(`${base}/crm/deals/${seeded.id}`);
  await page.getByRole('tab', { name: /^Details/ }).click();
  await page.getByRole('button', { name: 'Edit Customer Address', exact: true }).waitFor();
  assert.match(await page.getByRole('button', { name: 'Edit Customer Address', exact: true }).innerText(), /Company street/);
  checks.push('Deal Details resolves the selected linked Company address without a stored override');
  await page.getByRole('button', { name: 'Edit Customer Address', exact: true }).click();
  await page.getByLabel('Customer Address', { exact: true }).selectOption(`lead:${lead.id}`);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: 'Edit Customer Address', exact: true }).waitFor();
  assert.deepEqual((await prisma.deal.findUniqueOrThrow({ where: { id: seeded.id } })).addressSource, { type: 'lead', id: lead.id });
  assert.equal((await prisma.deal.findUniqueOrThrow({ where: { id: seeded.id } })).address, null);
  await page.reload(); await page.getByRole('tab', { name: /^Details/ }).click();
  assert.match(await page.getByRole('button', { name: 'Edit Customer Address', exact: true }).innerText(), /Personal street/);
  checks.push('Choosing a linked address persists its reference across reload without copying text');
  await page.getByRole('button', { name: 'Edit Deal Address (override)', exact: true }).click();
  await page.getByLabel('Deal Address (override)', { exact: true }).fill('Installation site\nTaguig');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: 'Edit Deal Address (override)', exact: true }).waitFor();
  assert.equal((await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).address, 'Personal street\nPasig');
  assert.equal((await prisma.account.findUniqueOrThrow({ where: { id: account.id } })).address, 'Company street\nMakati');
  checks.push('An inline Deal override saves independently of Lead and Company addresses');
  for (const width of [320, 375, 480, 640, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    await page.getByRole('button', { name: 'Edit Customer Address', exact: true }).waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: resolve(output, `deal-details-${width}.png`), fullPage: true });
  }
  checks.push('Deal Details has no document overflow at all seven target and intermediate widths');
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto(`${base}/crm/deals`);
  await page.getByText('Linked address Deal', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'New Deal', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'New Deal', exact: true });
  await dialog.getByLabel('Associate Deal To', { exact: false }).selectOption('lead');
  await dialog.getByRole('combobox', { name: /Search leads/i }).click();
  await page.getByRole('option', { name: /Address Customer/ }).click();
  await dialog.getByLabel('Customer Address', { exact: true }).selectOption(`account:${account.id}`);
  assert.equal(await dialog.getByLabel('Deal Address (override)', { exact: true }).inputValue(), '');
  for (const width of [320, 375, 480, 640, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    await dialog.getByLabel('Customer Address', { exact: true }).scrollIntoViewIfNeeded();
    assert.ok(await dialog.getByLabel('Customer Address', { exact: true }).isVisible());
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: resolve(output, `deal-form-${width}.png`), fullPage: true });
  }
  checks.push('Create Deal shows linked address choices without filling the override at seven viewport widths');
  await dialog.getByLabel('Title', { exact: false }).fill('Browser linked address');
  await dialog.getByRole('button', { name: 'Product Interest', exact: true }).click();
  await page.getByRole('checkbox', { name: product.name, exact: true }).click();
  await page.getByRole('group', { name: /Product interests/i }).press('Escape');
  await dialog.getByRole('button', { name: 'Create Deal', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  const created = await prisma.deal.findMany({ where: { tenantId: tenant.id, title: 'Browser linked address' } });
  assert.equal(created.length, 1); assert.deepEqual(created[0].addressSource, { type: 'account', id: account.id }); assert.equal(created[0].address, null); assert.equal(created[0].assignedUserId, agent.id);
  checks.push('Browser product Deal creation saves the source reference and original owner without an address copy');
  await page.goto(`${base}/crm/contacts/${contact.id}`);
  await page.getByRole('tab', { name: /^Details/ }).click();
  await page.getByRole('button', { name: 'Create deal', exact: false }).click();
  await page.locator('form').getByText('Contact street', { exact: false }).waitFor();
  assert.equal(await page.getByLabel('Deal Address (override)', { exact: true }).inputValue(), '');
  checks.push('Creating a Deal from an individual Contact preselects its live address with a blank override');
  const qualified = await prisma.stage.create({ data: { tenantId: tenant.id, pipelineId: pipeline.id, name: 'Qualified', order: 1 } });
  const workflows = require('../dist/backend/src/modules/automation/workflows/workflows.service.js');
  const workflow = await scope(() => workflows.createWorkflow(tenant.id, admin.id, { name: 'Sales routing preview', trigger: 'deal.updated', isActive: false, actions: [{ type: 'move_deal_stage', config: { stageId: stage.id } }] }));
  await page.goto(`${base}/automation/workflows/${workflow.id}/edit`);
  await page.getByRole('button', { name: /Configure action:.*Move Deal Stage/ }).click();
  await page.getByLabel('Target stage', { exact: false }).waitFor();
  assert.equal(await page.getByLabel('Include a loss reason', { exact: true }).count(), 0);
  assert.equal(await page.getByRole('combobox', { name: 'Pipeline', exact: true }).count(), 0);
  await page.getByText('Sales Pipeline', { exact: true }).waitFor();
  await page.getByLabel('Target stage', { exact: false }).selectOption(qualified.id);
  await page.screenshot({ path: resolve(output, 'workflow-sales-stage-configuration.png'), fullPage: true });
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await page.getByText('Draft saved. This workflow is inactive.', { exact: true }).waitFor();
  const savedWorkflow = await prisma.workflow.findUniqueOrThrow({ where: { id: workflow.id } });
  assert.equal(savedWorkflow.draftDefinition.actions[0].config.stageId, qualified.id);
  checks.push('Workflow stage setup shows fixed Sales Pipeline, hides loss-reason controls and saves the selected stage');
  assert.deepEqual(pageErrors, []); assert.deepEqual(serverErrors, []); assert.equal(checks.length, expectedChecks);
} catch (error) {
  failure = error;
  if (currentPage && !currentPage.isClosed()) await currentPage.screenshot({ path: resolve(output, 'failure.png'), fullPage: true }).catch(() => {});
  throw error;
} finally {
  closing = true;
  const cleanupErrors = [];
  for (const close of [
    () => browser?.close(),
    async () => {
      if (!frontend || frontend.exitCode !== null || frontend.signalCode !== null) return;
      let timer;
      const exited = new Promise(done => frontend.once('exit', done)); frontend.kill();
      try { await Promise.race([exited, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Frontend shutdown timed out')), 10000); })]); }
      finally { clearTimeout(timer); }
    },
    async () => { if (api) { api.closeAllConnections(); await new Promise(done => api.close(done)); } },
    () => prisma?.$disconnect(),
    () => pg?.stop(),
  ]) { try { await close(); } catch (error) { cleanupErrors.push(String(error)); } }
  log?.end(); Module._resolveFilename = originalResolve;
  const success = !failure && !cleanupErrors.length && checks.length === expectedChecks && !pageErrors.length;
  const report = { status: success ? 'PASS' : 'FAIL', success, cleanup: cleanupErrors.length ? 'failed' : 'complete', checks, pageErrors, serverErrors,
    ...(failure ? { error: String(failure) } : {}), ...(cleanupErrors.length ? { cleanupErrors } : {}) };
  writeFileSync(resultPath, JSON.stringify(report, null, 2));
  if (cleanupErrors.length) throw new Error(`Browser harness cleanup failed: ${cleanupErrors.join('; ')}`);
  if (success) { assert.ok(browserEvidence(report, 0).complete); console.log(`${checks.length} browser journeys passed; cleanup complete`); }
}
