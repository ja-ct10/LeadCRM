import { acceptancePort, createAcceptanceContext, setAcceptanceTheme } from './verify-browser-matrix.mjs';
// Real UI + authenticated HTTP + disposable SQL. No configured database or providers.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, createWriteStream } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';

const root = resolve(import.meta.dirname, '../..');
const output = process.env.LEADCRM_BROWSER_OUTPUT || (process.env.CUSTOM_FIELDS_OUTPUT || resolve(tmpdir(), 'leadcrm-custom-fields-inline'));
mkdirSync(output, { recursive: true });
const database = new URL(process.env.DATABASE_URL);
assert.equal(database.hostname, '127.0.0.1'); assert.equal(database.pathname, '/leadcrm_forms_test_2');
const base = `http://localhost:${await acceptancePort()}`;
Object.assign(process.env, { NODE_ENV: 'test', JWT_SECRET: randomBytes(32).toString('hex'), ENCRYPTION_KEY: randomBytes(32).toString('hex'), APP_URL: base, ALLOWED_ORIGINS: base, BREVO_API_KEY: '' });
const require = createRequire(import.meta.url), Module = require('node:module'), originalResolve = Module._resolveFilename;
Module._resolveFilename = function(request, parent, isMain, options) { return request === '@leadcrm/shared' ? resolve(root, 'backend/dist/shared/src/index.js') : originalResolve.call(this, request, parent, isMain, options); };
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const prisma = require('../dist/backend/src/config/database.config.js').default;
const app = require('../dist/backend/src/app.js').default;
const { issueAuthSession } = require('../dist/backend/src/core/auth/auth-session.js');
let api, frontend, browser, page;
const checks = [], errors = [];
const runtimeLog = createWriteStream(resolve(output, 'backend.log'));
console.log = (...args) => runtimeLog.write(args.map(value => typeof value === 'string' ? value : JSON.stringify(value)).join(' ') + '\n');
try {
  const tenant = await prisma.tenant.create({ data: { name: 'Field Layout Acceptance', slug: randomUUID(), onboardingStep: 3, onboardingCompletedAt: new Date() } });
  const admin = await prisma.user.create({ data: { tenantId: tenant.id, firstName: 'Field', lastName: 'Tester', email: 'fields-preview@camxian.com', role: 'Client Admin', status: 'ACTIVE', mustChangePassword: false, onboardingCompletedAt: new Date() } });
  const { token } = await issueAuthSession(admin);
  const { DEFAULT_CLOSING_FIELDS } = require('@leadcrm/shared');
  await prisma.closingFieldDefinition.createMany({ data: DEFAULT_CLOSING_FIELDS.map(field => ({ tenantId: tenant.id, id: field.id,
    definition: { ...field, required: ['confirmation-type', 'confirmation-date'].includes(field.id) } })) });
  const ageId = '2857e8ec-456d-4503-b955-46db45560974';
  await prisma.closingFieldDefinition.create({ data: { tenantId: tenant.id, id: ageId, definition: { id: ageId, name: 'Age', type: 'Number', module: 'leads', group: 'Basic Information', groupId: 'leads:section:0', active: true, required: false, visibleInForm: true, visibleInDetails: true, order: 100, description: '', options: [], version: 1 } } });
  const lead = await prisma.lead.create({ data: { tenantId: tenant.id, firstName: 'Alias', lastName: 'Acceptance', email: 'alias@example.test' } });
  const savedValue = await prisma.customFieldValue.create({ data: { tenantId: tenant.id, fieldId: ageId, module: 'leads', leadId: lead.id, value: 37 } });
  api = app.listen(0, '127.0.0.1'); await new Promise(done => api.once('listening', done));
  const apiBase = `http://127.0.0.1:${api.address().port}/api/v1`;
  async function call(path, method = 'GET', body) {
    const response = await fetch(apiBase + path, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const result = await response.json(); assert.ok(response.ok, JSON.stringify(result)); return result.data;
  }
  const log = createWriteStream(resolve(output, 'frontend.log'));
  frontend = spawn(process.execPath, [resolve(root, 'node_modules/next/dist/bin/next'), 'start', '-p', new URL(base).port, '-H', '127.0.0.1'], { cwd: resolve(root, 'frontend'), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NODE_ENV: 'production', API_URL: 'https://leadcrm-build.example/api/v1', NEXT_PUBLIC_USE_MOCK_AUTH: 'false', NEXT_PUBLIC_USE_MOCK_DATA: 'false' } });
  frontend.stdout.pipe(log); frontend.stderr.pipe(log);
  for (let attempt = 0; attempt < 120; attempt++) { try { if ((await fetch(base + '/login')).ok) break; } catch {} await new Promise(done => setTimeout(done, 500)); }
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await createAcceptanceContext(browser, { viewport: { width: 1440, height: 900 }, hasTouch: true });
  await context.addCookies([{ name: 'leadcrm_token', value: token, url: base, httpOnly: true, sameSite: 'Lax' }]);
  page = await context.newPage(); page.setDefaultTimeout(30000); page.setDefaultNavigationTimeout(120000); page.on('pageerror', error => errors.push(error.message));
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
  // The coordinator supplies a private disposable mount; uploads exercise the
  // actual byte validation, storage service and authenticated record boundary.
  const modules = ['leads', 'contacts', 'accounts', 'deals'];
  const fields = {}, records = { leads: lead.id };
  const titles = { leads: 'Alias Acceptance', contacts: 'Contact Acceptance', accounts: 'Account Acceptance', deals: 'Inline Acceptance' };
  const links = { leads: 'leadId', contacts: 'contactId', accounts: 'accountId', deals: 'dealId' };
  const { tenantContext } = require('../dist/backend/src/core/tenant/tenant-context.js');
  const { salesTransaction, salesPipeline } = require('../dist/backend/src/modules/crm/leads/lead-automation.service.js');
  const pipeline = await tenantContext.run({ tenantId: tenant.id }, () => salesTransaction(tx => salesPipeline(tx, tenant.id)));
  const stage = await prisma.stage.findFirstOrThrow({ where: { tenantId: tenant.id, pipelineId: pipeline.pipeline.id, name: 'Lead' } });
  const product = await prisma.productInterest.create({ data: { tenantId: tenant.id, name: 'Inline Test Product', dealValue: 100 } });
  records.contacts = (await call('/crm/contacts', 'POST', { requestId: randomUUID(), firstName: 'Contact', lastName: 'Acceptance', email: 'contact@example.test' })).id;
  records.accounts = (await call('/crm/accounts', 'POST', { name: titles.accounts })).id;
  records.deals = (await call('/crm/deals/batch', 'POST', { title: titles.deals, pipelineId: pipeline.pipeline.id, stageId: stage.id, productInterestIds: [product.id], idempotencyKey: randomUUID() })).deals[0].id;
  for (const module of modules) {
    fields[module] = {};
    const layout = await call(`/crm/${module}/field-layout`);
    for (const type of ['Text', 'Long Text', 'Number', 'Date', 'Dropdown', 'File Upload']) {
      const name = `Test ${type}`, group = type === 'Date' ? layout.layout.groups[2] : layout.layout.groups[0];
      fields[module][type] = await call('/administration/closing-requirements', 'POST', { module, group: group.label, groupId: group.id, name, type, required: false, options: type === 'Dropdown' ? ['Gold', 'Silver'] : [] });
    }
  }
  const writes = [];
  page.on('request', request => { if (request.method() === 'PUT' && /\/api\/proxy\/crm\/(leads|contacts|accounts|deals)\/[^/]+$/.test(request.url())) writes.push(request.postDataJSON()); });
  async function details(module) {
    await page.goto(base + `/crm/${module}/${records[module]}`);
    await page.getByRole('tab', { name: /^Details/ }).click();
    await page.getByRole('button', { name: 'Edit Test Text', exact: true }).waitFor();
  }
  async function edit(label, raw, type = 'Text', scope = page) {
    await scope.getByRole('button', { name: `Edit ${label}`, exact: true }).click();
    const control = scope.getByLabel(label, { exact: true });
    if (type === 'Dropdown') await control.selectOption(raw); else await control.fill(raw);
    const row = control.locator('xpath=ancestor::dd');
    const [response] = await Promise.all([
      page.waitForResponse(response => response.request().method() === 'PUT' && /\/crm\/(leads|contacts|accounts|deals)\/[^/]+$/.test(new URL(response.url()).pathname)),
      row.getByRole('button', { name: 'Save', exact: true }).click(),
    ]);
    assert.equal(response.status(), 200, await response.text());
    await scope.getByRole('button', { name: `Edit ${label}`, exact: true }).waitFor();
  }
  const expected = { Text: 'Saved text', 'Long Text': 'First line\nSecond line', Number: 0, Date: '2026-10-11', Dropdown: 'Gold' };
  for (const module of modules) {
    await details(module);
    assert.equal(await page.getByRole('button', { name: 'Edit custom fields', exact: true }).count(), 0);
    for (const type of Object.keys(fields[module])) {
      const field = fields[module][type], button = page.getByRole('button', { name: `Edit ${field.name}`, exact: true });
      assert.equal(await button.count(), 1); assert.equal((await button.innerText()).trim(), '—');
      const groupName = await button.locator('xpath=ancestor::section').getByRole('button', { name: field.group, exact: true }).innerText();
      assert.ok(groupName.toLowerCase().includes(field.group.toLowerCase()));
    }
    const closing = module === 'deals' ? page.locator(`#closing-requirements-${records.deals}`) : null;
    const closingBefore = closing ? await closing.innerText() : null;
    if (closing) await closing.screenshot({ path: resolve(output, 'closing-before.png') });
    await page.getByRole('button', { name: 'Edit Test Number', exact: true }).click();
    assert.equal(await page.getByLabel('Test Number', { exact: true }).inputValue(), '');
    await page.getByLabel('Test Number', { exact: true }).fill('7');
    await page.getByLabel('Test Number', { exact: true }).locator('xpath=ancestor::dd').getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal((await call(`/crm/${module}/${records[module]}/custom-fields`)).values[fields[module].Number.id], undefined);
    for (const [type, value] of Object.entries(expected)) await edit(fields[module][type].name, String(value), type);
    // A rejected signature leaves the draft open. A valid upload uses the existing record Files route.
    await page.getByRole('button', { name: 'Edit Test File Upload', exact: true }).click();
    let control = page.getByLabel('Test File Upload', { exact: true }), row = control.locator('xpath=ancestor::dd');
    await control.setInputFiles({ name: 'bad.pdf', mimeType: 'application/pdf', buffer: Buffer.from('invalid') });
    await row.getByRole('alert').waitFor(); assert.match(await row.getByRole('alert').innerText(), /contents do not match/);
    await control.setInputFiles({ name: 'valid.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-fixture') });
    await row.getByText('valid.pdf', { exact: true }).waitFor();
    let saved = page.waitForResponse(response => response.request().method() === 'PUT' && response.url().endsWith(`/crm/${module}/${records[module]}`));
    await row.getByRole('button', { name: 'Save', exact: true }).click(); assert.equal((await saved).status(), 200);
    await page.getByRole('button', { name: 'Edit Test File Upload', exact: true }).waitFor();
    const state = await call(`/crm/${module}/${records[module]}/custom-fields`);
    for (const [type, value] of Object.entries(expected)) assert.equal(state.values[fields[module][type].id], value);
    const fileId = state.values[fields[module]['File Upload'].id];
    assert.equal(state.files.find(file => file.id === fileId).name, 'valid.pdf');
    const file = await prisma.recordFile.findUniqueOrThrow({ where: { id: fileId } }); assert.equal(file[links[module]], records[module]);
    assert.equal(file.tenantId, tenant.id);
    await page.getByRole('button', { name: 'Edit Test File Upload', exact: true }).click();
    control = page.getByLabel('Test File Upload', { exact: true }); row = control.locator('xpath=ancestor::dd');
    await row.getByRole('button', { name: 'Clear', exact: true }).click(); await row.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal((await call(`/crm/${module}/${records[module]}/custom-fields`)).values[fields[module]['File Upload'].id], fileId);
    assert.equal(await prisma.recordFile.count({ where: { id: fileId } }), 1);
    await edit('Test Number', '', 'Number'); assert.equal((await call(`/crm/${module}/${records[module]}/custom-fields`)).values[fields[module].Number.id], null);
    assert.equal((await call(`/crm/${module}/${records[module]}/custom-fields`)).values[fields[module].Date.id], '2026-10-11');
    if (closing) { assert.equal(await closing.innerText(), closingBefore); await closing.screenshot({ path: resolve(output, 'closing-after-ordinary-edit.png') }); }
    await page.screenshot({ path: resolve(output, `${module}-full-page.png`) });
    await page.reload(); await page.getByRole('tab', { name: /^Details/ }).click();
    assert.equal((await page.getByRole('button', { name: 'Edit Test Number', exact: true }).innerText()).trim(), '—');
    assert.equal((await page.getByRole('button', { name: 'Edit Test Long Text', exact: true }).innerText()).trim(), expected['Long Text']);
    checks.push(`${module}: blank definition rows, configured groups, six controls, cancel, scalar/file partial saves, null clearing and reload`);
    // Open the actual list/pipeline drawer for the same record.
    await page.goto(base + `/crm/${module}`);
    if (module === 'deals') await page.getByRole('heading', { name: titles.deals, exact: true, level: 4 }).click();
    else await page.getByText(module === 'contacts' ? 'Contact' : titles[module], { exact: true }).first().click();
    const panel = page.getByRole('dialog', { name: `${module === 'leads' ? 'Lead' : module === 'contacts' ? 'Contact' : module === 'accounts' ? 'Account' : 'Deal'} details`, exact: true });
    await panel.getByRole('tab', { name: /^Details/ }).click(); await panel.getByRole('button', { name: 'Edit Test Text', exact: true }).waitFor();
    assert.equal((await panel.getByRole('button', { name: 'Edit Test Text', exact: true }).innerText()).trim(), 'Saved text');
    await edit('Test Text', 'Drawer saved', 'Text', panel);
    assert.equal((await call(`/crm/${module}/${records[module]}/custom-fields`)).values[fields[module].Text.id], 'Drawer saved');
    await panel.screenshot({ path: resolve(output, `${module}-side-panel.png`) });
    checks.push(`${module}: actual drawer displays full-page values and persists the same inline edit`);
    process.stdout.write(`${module}: full page and drawer verified\n`);
    if (module === 'leads') {
      for (const width of [320, 375, 390, 430, 768, 1024, 1440, 1920]) {
        await page.setViewportSize({ width, height: 900 }); await panel.getByRole('button', { name: 'Edit Test Text', exact: true }).click();
        const input = panel.getByLabel('Test Text', { exact: true }); await input.fill('A responsive draft');
        const dd = input.locator('xpath=ancestor::dd');
        assert.ok(await panel.evaluate(node => node.scrollWidth <= node.clientWidth + 1), `Panel overflow ${width}`);
        for (const target of [input, dd.getByRole('button', { name: 'Save', exact: true }), dd.getByRole('button', { name: 'Cancel', exact: true })]) {
          const box = await target.boundingBox(); assert.ok(box.x >= 0 && box.x + box.width <= width + 1, `Control bounds ${width}`);
        }
        await page.screenshot({ path: resolve(output, `inline-panel-${width}.png`) }); await input.press('Escape');
        if (width === 320) {
          const touch = await panel.getByRole('button', { name: 'Edit Test Text', exact: true }).boundingBox();
          await page.touchscreen.tap(touch.x + touch.width / 2, touch.y + touch.height / 2);
          await panel.getByLabel('Test Text', { exact: true }).waitFor();
          await panel.getByLabel('Test Text', { exact: true }).press('Escape');
          checks.push('Touch activation and keyboard Escape cancel in the 320px drawer');
        }
        checks.push(`Inline drawer controls and no horizontal overflow at ${width}px`);
      }
    }
    await panel.getByRole('button', { name: 'Close record', exact: true }).click(); await page.setViewportSize({ width: 1440, height: 900 });
  }
  assert.ok(writes.every(write => Object.keys(write).length === 1 && Object.keys(write.customFieldValues).length === 1));
  checks.push('Every browser ordinary-field write contains exactly one canonical ID and no stale whole object');
  await details('leads'); await edit('Age', '38', 'Number');
  assert.equal((await prisma.customFieldValue.findUniqueOrThrow({ where: { id: savedValue.id } })).value, 38);
  assert.equal(await prisma.customFieldValue.count({ where: { tenantId: tenant.id, leadId: lead.id, fieldId: ageId } }), 1);
  const age = (await call('/crm/leads/custom-fields')).find(field => field.id === ageId); assert.equal(age.technicalAlias, 'age');
  checks.push('Existing Age UUID, alias, stored value identity and unique row preserved');
  // Settings mutations become visible through the existing record refresh, without an empty value write.
  const favorite = await call('/administration/closing-requirements', 'POST', { module: 'leads', group: 'Basic Information', name: 'Favorite Number', type: 'Number', required: false });
  await edit('Test Number', '1', 'Number');
  await page.getByRole('button', { name: 'Edit Favorite Number', exact: true }).waitFor();
  assert.equal((await page.getByRole('button', { name: 'Edit Favorite Number', exact: true }).innerText()).trim(), '—');
  assert.equal((await call(`/crm/leads/${lead.id}/custom-fields`)).values[favorite.id], undefined);
  await call(`/administration/closing-requirements/${favorite.id}`, 'PATCH', { name: 'Favorite Number renamed', groupId: 'leads:section:3' });
  await edit('Test Number', '2', 'Number');
  const moved = page.getByRole('button', { name: 'Edit Favorite Number renamed', exact: true }); await moved.waitFor();
  assert.equal(await moved.count(), 1);
  assert.ok(await moved.locator('xpath=ancestor::section').getByRole('button', { name: 'Additional Information', exact: true }).isVisible());
  await call(`/administration/closing-requirements/${favorite.id}`, 'PATCH', { visibleInDetails: false });
  await edit('Test Number', '3', 'Number'); await moved.waitFor({ state: 'hidden' });
  assert.equal((await call(`/crm/leads/${lead.id}/custom-fields`)).values[favorite.id], undefined);
  checks.push('New blank field, label/group move and Details hiding refresh with no duplicate or empty value write');
  await edit('First Name', 'System', 'Text');
  assert.equal((await call(`/crm/leads/${lead.id}`)).firstName, 'System');
  checks.push('Existing native First Name inline save remains functional');
  // Transient read errors retain both the loaded value and the open draft.
  await page.getByRole('button', { name: 'Edit Test Text', exact: true }).click(); await page.getByLabel('Test Text', { exact: true }).fill('Retry draft');
  await page.route(`**/api/proxy/crm/leads/${lead.id}/custom-fields`, route => route.fulfill({ status: 503, json: { error: 'Refresh unavailable' } }));
  await call(`/crm/leads/${lead.id}`, 'PUT', { firstName: 'System refreshed' });
  await page.getByRole('button', { name: 'Retry custom fields', exact: true }).waitFor();
  assert.equal(await page.getByLabel('Test Text', { exact: true }).inputValue(), 'Retry draft');
  await page.unroute(`**/api/proxy/crm/leads/${lead.id}/custom-fields`); await page.getByRole('button', { name: 'Retry custom fields', exact: true }).click();
  assert.equal(await page.getByLabel('Test Text', { exact: true }).inputValue(), 'Retry draft');
  await page.getByLabel('Test Text', { exact: true }).press('Escape'); checks.push('Transient refresh/retry retains loaded rows and unrelated draft');
  // New required definitions do not prevent viewing existing records.
  const required = await call('/administration/closing-requirements', 'POST', { module: 'leads', group: 'Basic Information', name: 'Required blank', type: 'Text', required: true });
  await details('leads'); await page.getByRole('button', { name: 'Edit Required blank', exact: true }).click();
  const requiredRow = page.getByLabel('Required blank', { exact: true }).locator('xpath=ancestor::dd');
  const beforeRequired = writes.length; await requiredRow.getByRole('button', { name: 'Save', exact: true }).click(); await requiredRow.getByRole('alert').waitFor();
  assert.match(await requiredRow.getByRole('alert').innerText(), /required/); assert.equal(writes.length, beforeRequired);
  await page.getByLabel('Required blank', { exact: true }).fill('Supplied');
  const requiredSave = page.waitForResponse(response => response.request().method() === 'PUT' && response.url().endsWith(`/crm/leads/${lead.id}`));
  await requiredRow.getByRole('button', { name: 'Save', exact: true }).click(); assert.equal((await requiredSave).status(), 200);
  assert.equal((await call(`/crm/leads/${lead.id}/custom-fields`)).values[required.id], 'Supplied'); checks.push('Newly required blank remains viewable; invalid empty draft stays inline; valid save persists');
  // Specialized evidence editor still works after ordinary Deal changes.
  const qualified = await prisma.stage.findFirstOrThrow({ where: { tenantId: tenant.id, pipelineId: pipeline.pipeline.id, name: 'Qualified' } });
  await call(`/crm/deals/${records.deals}/stage`, 'PATCH', { stageId: qualified.id });
  await details('deals'); const closing = page.locator(`#closing-requirements-${records.deals}`);
  assert.equal(await closing.getByRole('progressbar', { name: 'Required fields completed' }).getAttribute('aria-valuenow'), '0');
  await closing.getByRole('button', { name: 'Edit Confirmation Type', exact: true }).click();
  await closing.getByLabel(/^Confirmation Type/).selectOption('Approved Quotation');
  const closingSaved = page.waitForResponse(response => response.request().method() === 'PATCH' && response.url().endsWith('/closing-requirements'));
  await closing.getByRole('button', { name: 'Save', exact: true }).click(); assert.equal((await closingSaved).status(), 200);
  await page.waitForFunction(id => document.getElementById(`closing-requirements-${id}`)?.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow') === '1', records.deals);
  checks.push('Specialized Closed Won Edit, progress and evidence PATCH still work after ordinary inline changes');
  for (const width of [320, 375, 390, 430, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 }); await details('leads');
    await setAcceptanceTheme(page, 'Light');
    await page.getByRole('button', { name: 'Edit Test Long Text', exact: true }).click();
    assert.ok(await page.locator('[data-record-scroll]').evaluate(node => node.scrollWidth <= node.clientWidth + 1), `Full page overflow ${width}`);
    await page.screenshot({ path: resolve(output, `inline-page-${width}.png`) }); checks.push(`Full-page inline controls and no horizontal overflow at ${width}px`);
    await page.getByLabel('Test Long Text', { exact: true }).press('Escape');
    for (const type of ['Number', 'Date', 'Dropdown', 'File Upload']) {
      const label = `Test ${type}`; await page.getByRole('button', { name: `Edit ${label}`, exact: true }).click();
      const control = page.getByLabel(label, { exact: true }), row = control.locator('xpath=ancestor::dd');
      assert.ok(await page.locator('[data-record-scroll]').evaluate(node => node.scrollWidth <= node.clientWidth + 1), `${type} overflow ${width}`);
      const bounds = await row.getByRole('button', { name: 'Save', exact: true }).boundingBox();
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1);
      await row.getByRole('button', { name: 'Cancel', exact: true }).click();
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 }); await page.goto(base + '/settings?tab=appearance'); await page.getByRole('button', { name: 'Select Dark theme', exact: true }).click();
  for (const width of [320, 375, 390, 430, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 }); await details('leads'); await page.getByRole('button', { name: 'Edit Test Text', exact: true }).click();
    await setAcceptanceTheme(page, 'Dark');
    assert.ok(await page.locator('[data-record-scroll]').evaluate(node => node.scrollWidth <= node.clientWidth + 1));
    await page.screenshot({ path: resolve(output, `inline-dark-${width}.png`) }); checks.push(`Dark mode inline editor at ${width}px`);
  }
  assert.equal(errors.length, 0, errors.join('\n'));
  writeFileSync(resolve(output, 'report.json'), JSON.stringify({ checks, pageErrors: errors, database: 'disposable', privateStorage: 'isolated local mount; actual upload service and SQL', providerSends: 0 }, null, 2));
  process.stdout.write(JSON.stringify({ passed: checks.length, pageErrors: errors.length, output }) + '\n');
} catch (error) {
  if (page) await page.screenshot({ path: resolve(output, 'failure.png') }).catch(() => {});
  writeFileSync(resolve(output, 'report.json'), JSON.stringify({ checks, pageErrors: errors, failure: String(error) }, null, 2)); throw error;
} finally {
  await browser?.close(); if (frontend) frontend.kill(); if (api) { api.closeAllConnections(); await new Promise(done => api.close(done)); }
  await prisma.$disconnect();
}
