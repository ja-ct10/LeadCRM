// Matching production build, real browser, authenticated APIs and disposable SQL only.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, createWriteStream } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { notificationTestPostgres } from './notification-test-postgres.mjs';
import { acceptanceGateway, createAcceptanceContext } from './verify-browser-matrix.mjs';

const root = resolve(import.meta.dirname, '../..');
const output = resolve(root, 'data/outputs/workflow-rbac-fields/browser');
mkdirSync(output, { recursive: true });
const pg = await notificationTestPostgres();
let gateway, api, frontend, browser, prisma, page, log;
const checks = [], errors = [];
try {
  gateway = await acceptanceGateway(output);
  const url = await pg.database('leadcrm_workflow_test_92');
  Object.assign(process.env, { NODE_ENV: 'test', DATABASE_URL: url, DIRECT_URL: url, JWT_SECRET: randomBytes(32).toString('hex'),
    ENCRYPTION_KEY: randomBytes(32).toString('hex'), APP_URL: gateway.base, CORS_ORIGIN: gateway.base, BREVO_API_KEY: '', BREVO_SMS_SENDER: '' });
  const require = createRequire(import.meta.url), Module = require('node:module'), originalResolve = Module._resolveFilename;
  Module._resolveFilename = function(request, parent, isMain, options) { return request === '@leadcrm/shared' ? resolve(root, 'backend/dist/shared/src/index.js') : originalResolve.call(this, request, parent, isMain, options); };
  const { chromium } = require('playwright');
  const { ROLE_TEMPLATES } = require('../dist/shared/src/index.js');
  prisma = require('../dist/backend/src/config/database.config.js').default;
  const app = require('../dist/backend/src/app.js').default;
  const { issueAuthSession } = require('../dist/backend/src/core/auth/auth-session.js');
  const { tenantContext } = require('../dist/backend/src/core/tenant/tenant-context.js');
  const { fireWorkflowTrigger } = require('../dist/backend/src/modules/automation/workflows/workflow.engine.js');
  const tenant = await prisma.tenant.create({ data: { name: 'RBAC Browser QA', slug: randomUUID(), onboardingStep: 3, onboardingCompletedAt: new Date() } });
  const identity = async (name, template) => {
    const role = template && await prisma.roleDefinition.create({ data: { tenantId: tenant.id, name, permissions: {
      create: Object.entries(template.permissions).map(([module, flags]) => ({ module, ...flags })),
    } } });
    const user = await prisma.user.create({ data: { tenantId: tenant.id, role: name, firstName: name, lastName: 'QA', email: `${randomUUID()}@camxian.com`,
      mustChangePassword: false, onboardingCompletedAt: new Date(), ...(role ? { userRoles: { create: { roleId: role.id } } } : {}) } });
    return { id: user.id, roleId: role?.id, token: (await issueAuthSession(user)).token };
  };
  const admin = await identity('Client Admin');
  const manager = await identity('Sales Admin', ROLE_TEMPLATES.find(template => template.key === 'sales-admin'));
  const associate = await identity('Sales Associate', ROLE_TEMPLATES.find(template => template.key === 'sales-associate'));
  const lead = await prisma.lead.create({ data: { tenantId: tenant.id, firstName: 'Browser', lastName: 'Customer', email: 'browser-customer@example.test', assignedUserId: associate.id } });
  api = app.listen(0, '127.0.0.1'); await new Promise(done => api.once('listening', done));
  const apiBase = `http://127.0.0.1:${api.address().port}/api/v1`;
  const call = async (path, actor = admin, method = 'GET', body) => {
    const response = await fetch(apiBase + path, { method, headers: { Authorization: `Bearer ${actor.token}`, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const result = await response.json(); assert.ok(response.ok, JSON.stringify(result)); return result.data;
  };
  const workflow = await call('/automation/workflows', manager, 'POST', { name: 'Shared workflow browser QA', trigger: 'lead.created', isActive: true,
    actions: [{ type: 'update_field', config: { field: 'address', value: 'Approved automated action' } }] });
  await tenantContext.run({ tenantId: tenant.id }, () => fireWorkflowTrigger({ tenantId: tenant.id, entityType: 'lead', entityId: lead.id,
    triggerType: 'lead.created', actorId: associate.id, eventId: randomUUID(), context: {} }));
  log = createWriteStream(resolve(output, 'frontend.log'));
  frontend = spawn(process.execPath, [resolve(root, 'node_modules/next/dist/bin/next'), 'start', '-p', new URL(gateway.internalBase).port, '-H', '127.0.0.1'], {
    cwd: resolve(root, 'frontend'), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NODE_ENV: 'development', LEADCRM_QA_BUILD_ASSETS: '1',
      API_URL: apiBase, NEXT_PUBLIC_USE_MOCK_AUTH: 'false', NEXT_PUBLIC_USE_MOCK_DATA: 'false' },
  });
  frontend.stdout.pipe(log); frontend.stderr.pipe(log);
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    try { if ((await fetch(gateway.internalBase + '/login')).ok) { ready = true; break; } } catch {}
    await new Promise(done => setTimeout(done, 500));
  }
  assert.ok(ready, 'Frontend must start from the matching production build');
  await gateway.start();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await createAcceptanceContext(browser, { ignoreHTTPSErrors: true, viewport: { width: 1920, height: 1080 } });
  await context.addCookies([{ name: 'leadcrm_token', value: admin.token, url: gateway.base, httpOnly: true, sameSite: 'Lax' }]);
  page = await context.newPage(); page.setDefaultTimeout(30000); page.setDefaultNavigationTimeout(90000);
  page.on('pageerror', error => errors.push(error.message));
  const editRole = async () => {
    await page.goto(gateway.base + '/settings?tab=roles');
    await page.getByRole('button', { name: 'Actions for Sales Associate', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Edit Permissions', exact: true }).click();
    await page.getByRole('heading', { name: 'Edit Role', exact: true }).waitFor();
  };
  await editRole();
  assert.equal(await page.getByRole('checkbox', { name: 'Manage Pipeline Stages', exact: true }).count(), 0);
  assert.equal(await page.getByRole('checkbox', { name: 'Pause / Resume Workflows', exact: true }).isChecked(), false);
  assert.equal(await page.getByRole('checkbox', { name: 'Execute / Run Check Workflows', exact: true }).isChecked(), true);
  await page.screenshot({ path: resolve(output, 'roles-permissions.png'), fullPage: true });
  await page.getByRole('row').filter({ has: page.getByText('Deals', { exact: true }) }).first().screenshot({ path: resolve(output, 'deals-permissions-row.png') });
  checks.push('Retired pipeline grant absent; independent Workflow grants match the saved Sales Associate role');
  await page.getByText('Pause / Resume Workflows', { exact: true }).click();
  assert.equal(await page.getByRole('checkbox', { name: 'Pause / Resume Workflows', exact: true }).isChecked(), true);
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await page.getByRole('button', { name: 'Actions for Sales Associate', exact: true }).waitFor();
  assert.equal((await call(`/administration/roles/${associate.roleId}`)).permissions.find(row => row.module === 'workflows').canPause, true);
  await editRole();
  assert.equal(await page.getByRole('checkbox', { name: 'Pause / Resume Workflows', exact: true }).isChecked(), true);
  await page.getByText('Pause / Resume Workflows', { exact: true }).click();
  assert.equal(await page.getByRole('checkbox', { name: 'Pause / Resume Workflows', exact: true }).isChecked(), false);
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await page.getByRole('button', { name: 'Actions for Sales Associate', exact: true }).waitFor();
  checks.push('Role permission grant and removal persist through browser save and reload');
  await page.goto(gateway.base + '/settings?tab=custom-fields');
  await page.getByRole('button', { name: 'Add Field', exact: true }).click();
  await page.getByLabel('Module', { exact: true }).last().selectOption('leads');
  await page.getByLabel('Display label', { exact: true }).fill('Browser Acceptance Note');
  await page.getByRole('button', { name: 'Save field', exact: true }).click();
  await page.getByRole('button', { name: 'Edit Browser Acceptance Note', exact: true }).waitFor();
  const field = (await call('/administration/closing-requirements')).find(field => field.name === 'Browser Acceptance Note');
  assert.ok(field?.id); checks.push('Customize Fields creates a persisted Lead field through the actual UI');
  await page.goto(gateway.base + `/crm/leads/${lead.id}`);
  await page.getByRole('tab', { name: /^Details/ }).click();
  await page.getByRole('button', { name: 'Edit Browser Acceptance Note', exact: true }).click();
  const input = page.getByLabel('Browser Acceptance Note', { exact: true }); await input.fill('Saved through the shared CRM field editor');
  await input.locator('xpath=ancestor::dd').getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: 'Edit Browser Acceptance Note', exact: true }).waitFor();
  await page.reload(); await page.getByRole('tab', { name: /^Details/ }).click();
  assert.equal((await page.getByRole('button', { name: 'Edit Browser Acceptance Note', exact: true }).innerText()).trim(), 'Saved through the shared CRM field editor');
  assert.equal((await call(`/crm/leads/${lead.id}/custom-fields`)).values[field.id], 'Saved through the shared CRM field editor');
  await page.screenshot({ path: resolve(output, 'custom-field-record.png'), fullPage: true });
  checks.push('Configured field appears in CRM Details, saves a value and retains it after a real page reload');
  const associateContext = await createAcceptanceContext(browser, { ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } });
  await associateContext.addCookies([{ name: 'leadcrm_token', value: associate.token, url: gateway.base, httpOnly: true, sameSite: 'Lax' }]);
  const operator = await associateContext.newPage(); operator.setDefaultTimeout(30000); operator.on('pageerror', error => errors.push(error.message));
  page = operator;
  await operator.goto(gateway.base + '/automation/workflows');
  await operator.getByRole('grid').waitFor();
  assert.equal(await operator.getByRole('button', { name: /Create Workflow/i }).count(), 0);
  assert.equal(await operator.getByRole('button', { name: 'Pause workflow', exact: true }).count(), 0);
  await operator.getByText(workflow.name, { exact: true }).click();
  await operator.getByText('completed', { exact: true }).first().waitFor();
  await operator.getByRole('button', { name: 'Workflow actions', exact: true }).click();
  assert.equal(await operator.getByRole('menuitem', { name: /^(Edit|Pause|Resume|Archive)$/ }).count(), 0);
  checks.push('Sales Associate views shared workflow and real execution history without management controls');
  await operator.getByRole('menuitem', { name: 'View definition', exact: true }).click();
  await operator.getByRole('button', { name: 'Test draft', exact: true }).click();
  await operator.getByRole('dialog', { name: 'Test saved draft', exact: true }).getByRole('combobox').selectOption(lead.id);
  const beforeCheck = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id }, select: { address: true } });
  const runCount = await prisma.workflowExecutionRun.count({ where: { workflowId: workflow.id } });
  await operator.getByRole('button', { name: 'Run check', exact: true }).click();
  await operator.getByRole('heading', { name: 'Configuration is valid', exact: true }).waitFor();
  assert.deepEqual(await prisma.lead.findUniqueOrThrow({ where: { id: lead.id }, select: { address: true } }), beforeCheck);
  assert.equal(await prisma.workflowExecutionRun.count({ where: { workflowId: workflow.id } }), runCount);
  assert.equal(await operator.getByRole('button', { name: 'Save draft', exact: true }).count(), 0);
  assert.equal(await operator.getByRole('button', { name: 'Publish workflow', exact: true }).count(), 0);
  await operator.screenshot({ path: resolve(output, 'associate-workflow-check.png'), fullPage: true });
  checks.push('Sales Associate runs a saved workflow dry-run check without editing or activation grants');
  assert.equal(errors.length, 0, errors.join('\n'));
  writeFileSync(resolve(output, 'report.json'), JSON.stringify({ checks, pageErrors: errors, database: 'disposable', providerSends: 0 }, null, 2));
  console.log(JSON.stringify({ passed: checks.length, pageErrors: errors.length, output }));
} catch (error) {
  await page?.screenshot({ path: resolve(output, 'failure.png'), fullPage: true }).catch(() => {});
  writeFileSync(resolve(output, 'report.json'), JSON.stringify({ checks, pageErrors: errors, failure: String(error) }, null, 2));
  throw error;
} finally {
  await browser?.close();
  if (frontend && frontend.exitCode === null && frontend.signalCode === null) { const closed = new Promise(done => frontend.once('exit', done)); frontend.kill(); await closed; }
  log?.end();
  if (api) { api.closeAllConnections(); await new Promise(done => api.close(done)); }
  await gateway?.close(); await prisma?.$disconnect(); await pg.stop();
}
