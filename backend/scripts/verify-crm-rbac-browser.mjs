import { acceptancePort, createAcceptanceContext } from './verify-browser-matrix.mjs';
// Invoked only by the disposable PostgreSQL runner. No configured tenant/database.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, createWriteStream, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
const url = new URL(process.env.DATABASE_URL);
assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.pathname, '/leadcrm_forms_test_2');
const root = resolve(import.meta.dirname, '../..');
const output = process.env.LEADCRM_BROWSER_OUTPUT || (resolve(tmpdir(), `leadcrm-rbac-browser-${Date.now()}`));
mkdirSync(output, { recursive: true });
const require = createRequire(import.meta.url), Module = require('node:module'), originalResolve = Module._resolveFilename;
Module._resolveFilename = function(request, parent, isMain, options) {
  return request === '@leadcrm/shared' ? resolve(root, 'backend/dist/shared/src/index.js') : originalResolve.call(this, request, parent, isMain, options);
};
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const prisma = require('../dist/backend/src/config/database.config.js').default;
const app = require('../dist/backend/src/app.js').default;
const { issueAuthSession } = require('../dist/backend/src/core/auth/auth-session.js');
const { EMPTY_PERMISSION_FLAGS } = require('@leadcrm/shared');
const checks = [], errors = [];
const runtimeLog = createWriteStream(resolve(output, 'backend.log'));
const originalLog = console.log;
console.error = (...args) => runtimeLog.write(args.map(value => typeof value === 'string' ? value : JSON.stringify(value)).join(' ') + '\n');
console.log = (...args) => runtimeLog.write(args.map(value => typeof value === 'string' ? value : JSON.stringify(value)).join(' ') + '\n');
const port = await acceptancePort(), base = `http://localhost:${port}`;
let api, frontend, browser, failurePage;
try {
  const tenant = await prisma.tenant.create({ data: { name: 'CRM RBAC Browser QA', slug: randomUUID(), onboardingStep: 3, onboardingCompletedAt: new Date() } });
  async function person(name, roleName) {
    let role = await prisma.roleDefinition.findFirst({ where: { tenantId: tenant.id, name: roleName } });
    if (!role) role = await prisma.roleDefinition.create({ data: { tenantId: tenant.id, name: roleName, crmAssignmentRestricted: roleName === 'Sales Agent', permissions: { create:
      ['leads','contacts','accounts','deals','tasks','products','archived_data'].map(module => ({ module, ...EMPTY_PERMISSION_FLAGS, canView: true, canCreate: true, canEdit: true, canArchive: true, canRestore: true })) } } });
    const user = await prisma.user.create({ data: { tenantId: tenant.id, role: roleName, email: `${name}@camxian.com`, firstName: name, lastName: 'QA', mustChangePassword: false,
      onboardingCompletedAt: new Date(), userRoles: { create: { roleId: role.id } } } });
    return { ...user, token: (await issueAuthSession(user)).token };
  }
  const a = await person('AgentA', 'Sales Agent'), b = await person('AgentB', 'Sales Agent'), admin = await person('Admin', 'Client Admin');
  const pipeline = await prisma.pipeline.create({ data: { tenantId: tenant.id, name: 'Sales Pipeline' } });
  const stage = await prisma.stage.create({ data: { tenantId: tenant.id, pipelineId: pipeline.id, name: 'Lead', order: 0 } });
  const product = await prisma.productInterest.create({ data: { tenantId: tenant.id, name: 'QA Product', dealValue: 100 } });
  const records = {};
  for (const [module, delegate] of Object.entries({ leads: 'lead', contacts: 'contact', accounts: 'account', deals: 'deal' })) {
    records[module] = {};
    for (const [kind, assignedUserId] of Object.entries({ own: a.id, other: b.id, unassigned: null })) records[module][kind] = await prisma[delegate].create({ data: {
      tenantId: tenant.id, ...(module === 'accounts' ? {} : { assignedUserId }), ...(module === 'accounts' ? { name: `QA ${kind} Account` } : module === 'deals' ? {
        title: `QA ${kind} Deal`, ownerId: a.id, pipelineId: pipeline.id, stageId: stage.id, productInterestId: product.id, value: 100, productsNormalized: true,
      } : { firstName: 'QA', lastName: `${kind} ${module}`, email: `${kind}-${module}@example.test` }),
    } });
  }
  api = app.listen(0, '127.0.0.1'); await new Promise(done => api.once('listening', done));
  const apiBase = `http://127.0.0.1:${api.address().port}/api/v1`;
  const log = createWriteStream(resolve(output, 'frontend.log'));
  frontend = spawn(process.execPath, [resolve(root, 'node_modules/next/dist/bin/next'), 'start', '-p', String(port), '-H', '127.0.0.1'], {
    cwd: resolve(root, 'frontend'), windowsHide: true, stdio: ['ignore','pipe','pipe'],
    env: { ...process.env, NODE_ENV: 'development', LEADCRM_QA_BUILD_ASSETS: '1', API_URL: apiBase, NEXT_PUBLIC_USE_MOCK_AUTH: 'false', NEXT_PUBLIC_USE_MOCK_DATA: 'false' },
  });
  frontend.stdout.pipe(log); frontend.stderr.pipe(log);
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    try { if ((await fetch(`${base}/login`)).ok) { ready = true; break; } } catch {}
    await new Promise(done => setTimeout(done, 500));
  }
  assert.ok(ready, 'Next dev server did not become ready');
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await createAcceptanceContext(browser, { viewport: { width: 1440, height: 900 } });

  await context.addCookies([{ name: 'leadcrm_token', value: a.token, url: base, httpOnly: true, sameSite: 'Lax' }]);
  const page = await context.newPage(); page.setDefaultTimeout(30000); page.setDefaultNavigationTimeout(120000);
  failurePage = page;
  page.on('pageerror', error => errors.push(error.message));
  const widths = [320,375,390,430,768,1024,1440,1920];
  async function capture(name, width) {
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1), false, `${name} ${width} document overflow`);
    await page.screenshot({ path: resolve(output, `${name}-${width}.png`), fullPage: true });
  }
  for (const module of Object.keys(records)) {
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${base}/crm/${module}/${records[module].other.id}`);
      await page.getByRole('tab', { name: /^Details/ }).click();
      await page.getByText(module === 'accounts' ? /^Account Name\s*\*?$/ : 'Assigned Agent', { exact: true }).first().waitFor();
      await page.waitForFunction(() => !document.querySelector('[aria-label="Loading lead"], [aria-label="Loading contact"], [aria-label="Loading account"], [aria-label="Loading deal"]'));
      const editors = await page.getByRole('button', { name: /^Edit (First name|Account name|Deal title|Title|Assigned Agent)$/i }).count();
      if (module === 'accounts') {
        assert.ok(editors > 0, `Accounts module Edit permission allows editing at ${width}px`);
        assert.equal(await page.getByText('Assigned Agent', { exact: true }).count(), 0);
      } else assert.equal(editors, 0, `${module} ${width} unauthorized editor`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      assert.equal(overflow, false, `${module} ${width} document overflow`);
      await page.screenshot({ path: resolve(output, `${module}-readonly-${width}.png`), fullPage: true });
      checks.push(`${module}: ${module === 'accounts' ? 'editable with module permission' : 'readable and read-only'} at ${width}px`);
    }
  }
  for (const module of Object.keys(records)) for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${base}/crm/${module}/${records[module].own.id}`);
    await page.getByRole('tab', { name: /^Details/ }).click();
    const edit = page.getByRole('button', { name: /^Edit (First name|Account name|Deal title|Title)$/i }).first();
    await edit.waitFor();
    assert.equal(await page.getByRole('button', { name: 'Edit Assigned Agent', exact: true }).count(), 0, 'Sales cannot reassign even an owned record');
    await edit.click(); await page.getByRole('button', { name: 'Save', exact: true }).first().waitFor();
    await capture(`${module}-owned-editor`, width);
    checks.push(`${module}: owned inline editor and locked assignment at ${width}px`);
  }
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 }); await page.goto(`${base}/crm/pipeline`);
    for (const kind of ['own', 'other', 'unassigned']) await page.getByText(`QA ${kind} Deal`, { exact: true }).first().waitFor();
    await page.getByRole('button', { name: 'Drag QA own Deal', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: /^Drag QA (other|unassigned) Deal$/ }).count(), 0);
    await capture('kanban-assignment-controls', width);
    checks.push(`Kanban: all assignment categories visible and unowned dragging blocked at ${width}px`);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const module of Object.keys(records)) {
    await page.goto(`${base}/crm/${module}`);
    for (const kind of ['own','other','unassigned']) await page.getByText(module === 'contacts' ? `${kind} contacts` : module === 'accounts' ? `QA ${kind} Account` : module === 'deals' ? `QA ${kind} Deal` : `QA ${kind} ${module}`, { exact: true }).first().waitFor();
    checks.push(`${module}: default All includes other and unassigned records`);
  }
  const leadId = records.leads.own.id;
  await page.goto(`${base}/crm/leads/${leadId}`); await page.getByRole('tab', { name: /^Details/ }).click();
  await page.getByRole('button', { name: 'Edit First Name', exact: true }).click();
  const input = page.getByLabel(/^First name$/i); await input.fill('Stale browser update');
  const reassignment = await fetch(`${apiBase}/crm/leads/${leadId}`, { method: 'PUT', headers: { Authorization: `Bearer ${admin.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ assignedUserId: b.id }) });
  assert.equal(reassignment.status, 200);
  const denied = page.waitForResponse(response => response.request().method() === 'PUT' && response.url().endsWith(`/crm/leads/${leadId}`));
  await input.locator('xpath=ancestor::dd').getByRole('button', { name: 'Save', exact: true }).click();
  assert.equal((await denied).status(), 403);
  await page.getByText('Access Denied', { exact: true }).first().waitFor();
  await page.getByRole('button', { name: /^Edit First Name$/i }).waitFor({ state: 'detached' });
  assert.equal((await prisma.lead.findUniqueOrThrow({ where: { id: leadId } })).firstName, 'QA');
  checks.push('Stale browser save returns 403, preserves values, refreshes to read-only');
  await context.addCookies([{ name: 'leadcrm_token', value: admin.token, url: base, httpOnly: true, sameSite: 'Lax' }]);
  for (const [tab, heading] of [['users', 'Team Management'], ['roles', 'Roles & Permissions']]) for (const width of widths) {
    await page.setViewportSize({ width, height: 900 }); await page.goto(`${base}/settings?tab=${tab}`);
    await page.getByRole('heading', { name: heading, exact: true }).waitFor();
    await page.getByText('Sales Agent', { exact: true }).first().waitFor();
    await capture(`settings-${tab}`, width);
    checks.push(`${heading}: preserved layout at ${width}px`);
  }
  assert.deepEqual(errors, []);
  writeFileSync(resolve(output, 'results.json'), JSON.stringify({ checks, errors }, null, 2));
  originalLog(`Browser RBAC: ${checks.length} checks passed; evidence: ${output}`);
} catch (error) {
  if (failurePage) {
    await failurePage.screenshot({ path: resolve(output, 'failure.png') }).catch(() => {});
    writeFileSync(resolve(output, 'failure.txt'), await failurePage.locator('body').innerText().catch(() => ''));
  }
  writeFileSync(resolve(output, 'results.json'), JSON.stringify({ checks, errors, failure: error.message }, null, 2));
  originalLog(`Browser RBAC failed; evidence: ${output}`); throw error;
} finally {
  await browser?.close(); frontend?.kill(); if (api) { api.closeAllConnections(); await new Promise(done => api.close(done)); } await prisma.$disconnect(); runtimeLog.end();
}
