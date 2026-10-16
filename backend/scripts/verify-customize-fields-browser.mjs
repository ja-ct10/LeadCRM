import { acceptanceGateway, createAcceptanceContext, responsiveMatrix } from './verify-browser-matrix.mjs';
// Real UI + authenticated HTTP + disposable SQL. No configured database or providers.
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, createWriteStream } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { replayCrmMigrations } from './replay-crm-migrations.mjs';

const root = resolve(import.meta.dirname, '../..');
const output = process.env.LEADCRM_BROWSER_OUTPUT || (process.env.CUSTOM_FIELDS_OUTPUT || resolve(tmpdir(), 'leadcrm-customize-fields'));
mkdirSync(output, { recursive: true });
const db = await PGlite.create(); await replayCrmMigrations(db);
const socket = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 0 }); await socket.start();
const gateway = await acceptanceGateway(output), base = gateway.base;
Object.assign(process.env, { NODE_ENV: 'test', DATABASE_URL: `postgresql://postgres:postgres@${socket.getServerConn()}/leadcrm_customize_fields_browser?connection_limit=1&statement_cache_size=0`, JWT_SECRET: randomBytes(32).toString('hex'), ENCRYPTION_KEY: randomBytes(32).toString('hex'), APP_URL: base, CORS_ORIGIN: base, BREVO_API_KEY: '' });
const require = createRequire(import.meta.url), Module = require('node:module'), originalResolve = Module._resolveFilename;
Module._resolveFilename = function(request, parent, isMain, options) { return request === '@leadcrm/shared' ? resolve(root, 'backend/dist/shared/src/index.js') : originalResolve.call(this, request, parent, isMain, options); };
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const prisma = require('../dist/backend/src/config/database.config.js').default;
const app = require('../dist/backend/src/app.js').default;
const { issueAuthSession } = require('../dist/backend/src/core/auth/auth-session.js');
let api, frontend, browser, page;
const checks = [], errors = [];
try {
  const tenant = await prisma.tenant.create({ data: { name: 'Field Layout Acceptance', slug: randomUUID(), onboardingStep: 3, onboardingCompletedAt: new Date() } });
  const admin = await prisma.user.create({ data: { tenantId: tenant.id, firstName: 'Field', lastName: 'Tester', email: 'fields-preview@camxian.com', role: 'Client Admin', status: 'ACTIVE', mustChangePassword: false, onboardingCompletedAt: new Date() } });
  const { token } = await issueAuthSession(admin);
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
  frontend = spawn(process.execPath, [resolve(root, 'node_modules/next/dist/bin/next'), 'start', '-p', new URL(gateway.internalBase).port, '-H', '127.0.0.1'], { cwd: resolve(root, 'frontend'), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NODE_ENV: 'development', LEADCRM_QA_BUILD_ASSETS: '1', API_URL: apiBase, NEXT_PUBLIC_USE_MOCK_AUTH: 'false', NEXT_PUBLIC_USE_MOCK_DATA: 'false' } });
  frontend.stdout.pipe(log); frontend.stderr.pipe(log);
  for (let attempt = 0; attempt < 120; attempt++) { try { if ((await fetch(gateway.internalBase + '/login')).ok) break; } catch {} await new Promise(done => setTimeout(done, 500)); }
  await gateway.start();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await createAcceptanceContext(browser, { ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } });
  await context.addCookies([{ name: 'leadcrm_token', value: token, url: base, httpOnly: true, sameSite: 'Lax' }]);
  page = await context.newPage(); page.setDefaultTimeout(30000); page.setDefaultNavigationTimeout(120000); page.on('pageerror', error => errors.push(error.message));
  const settings = async () => { await page.goto(base + '/settings?tab=custom-fields'); await page.getByRole('heading', { name: 'Customize Fields', exact: true }).waitFor(); await page.getByRole('button', { name: 'Edit Age', exact: true }).waitFor(); };
  await settings();
  assert.equal((await call('/administration/closing-requirements')).find(field => field.id === ageId).technicalAlias, 'age');
  assert.deepEqual(await prisma.customFieldValue.findUniqueOrThrow({ where: { id: savedValue.id } }), savedValue);
  checks.push('Legacy Age backfill preserves canonical ID and stored row');
  for (const width of [320, 375, 390, 430, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 }); await page.waitForTimeout(250);
    const title = await page.getByRole('heading', { name: 'Customize Fields', exact: true }).boundingBox();
    const gear = await page.getByRole('button', { name: 'Manage Field Groups', exact: true }).boundingBox();
    const plus = await page.getByRole('button', { name: 'Add Field', exact: true }).boundingBox();
    assert.ok(title.height <= 32 && title.x + title.width <= gear.x + 1, `Title at ${width}`);
    assert.ok(gear.x + gear.width <= plus.x + 1 && gear.width >= 44 && plus.width >= 44, `Actions at ${width}`);
    assert.ok(Math.abs(gear.y - plus.y) <= 1 && Math.abs(title.y + title.height / 2 - gear.y - gear.height / 2) < 6, `Horizontal alignment at ${width}`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Page overflow at ${width}`);
    assert.equal(await page.getByRole('button', { name: 'Add Field', exact: true }).locator('span').isVisible(), width >= 640);
    await page.screenshot({ path: resolve(output, `fields-${width}.png`) });
    await page.getByRole('button', { name: 'Manage Field Groups', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Manage Fields Groups', exact: true }); await dialog.waitFor(); await page.waitForTimeout(300);
    const bounds = await dialog.boundingBox(); assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1 && bounds.y >= 0 && bounds.y + bounds.height <= 901, `Dialog bounds at ${width}`);
    assert.equal(await dialog.getByLabel('Move fields to', { exact: true }).count(), 0);
    assert.ok(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1), `Dialog overflow at ${width}`);
    await page.screenshot({ path: resolve(output, `groups-${width}.png`) });
    await dialog.getByRole('button', { name: 'Close dialog', exact: true }).click();
    checks.push(`Responsive header/table/modal ${width}px`);
  }
  await page.goto(base + '/settings?tab=appearance'); await page.getByRole('button', { name: 'Select Dark theme', exact: true }).click();
  await settings();
  for (const width of [320, 375, 390, 430, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 }); await page.waitForTimeout(200);
    await page.screenshot({ path: resolve(output, `fields-dark-${width}.png`) });
    await page.getByRole('button', { name: 'Manage Field Groups', exact: true }).click();
    const darkDialog = page.getByRole('dialog', { name: 'Manage Fields Groups', exact: true }); await page.waitForTimeout(300);
    const color = await darkDialog.evaluate(node => getComputedStyle(node).backgroundColor); assert.notEqual(color, 'rgb(255, 255, 255)');
    assert.ok(await darkDialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1));
    await page.screenshot({ path: resolve(output, `groups-dark-${width}.png`) }); await darkDialog.getByRole('button', { name: 'Close dialog', exact: true }).click();
    checks.push(`Dark mode fields/modal ${width}px`);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  const search = page.getByRole('textbox', { name: 'Search fields', exact: true });
  for (const term of ['Age', 'customFieldValues.age', `customFieldValues.${ageId}`, 'Basic Information']) { await search.fill(term); assert.ok(await page.getByRole('button', { name: 'Edit Age', exact: true }).isVisible()); assert.ok(await page.getByRole('button', { name: 'Reorder Age', exact: true }).isDisabled()); }
  await search.fill(''); checks.push('Label, alias, legacy key and group search; sorting disabled while filtered');
  let before = await call('/administration/closing-requirements/layout/leads');
  const ageHandle = page.getByRole('button', { name: 'Reorder Age', exact: true }); await ageHandle.focus();
  const reordered = page.waitForResponse(response => response.url().includes('/layout/leads') && response.request().method() === 'PATCH');
  await page.keyboard.press('Space'); await page.waitForTimeout(150); await page.keyboard.press('ArrowUp'); await page.waitForTimeout(200); await page.keyboard.press('Space'); assert.equal((await reordered).status(), 200);
  let after = await call('/administration/closing-requirements/layout/leads');
  assert.notDeepEqual(after.fields.map(field => field.technicalKey), before.fields.map(field => field.technicalKey));
  await page.reload(); await page.getByRole('button', { name: 'Edit Age', exact: true }).waitFor(); checks.push('Keyboard field reorder persists after reload');
  before = await call('/administration/closing-requirements/layout/leads');
  await ageHandle.focus(); await page.keyboard.press('Space'); await page.waitForTimeout(150); await page.keyboard.press('ArrowUp'); await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  assert.deepEqual((await call('/administration/closing-requirements/layout/leads')).fields, before.fields); checks.push('Escape cancels sorting without persistence');
  const failingLayout = '**/api/proxy/administration/closing-requirements/layout/leads';
  await page.route(failingLayout, route => route.request().method() === 'PATCH' ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Acceptance save failure' }) }) : route.continue());
  await ageHandle.focus(); await page.keyboard.press('Space'); await page.waitForTimeout(150); await page.keyboard.press('ArrowUp'); await page.waitForTimeout(200); await page.keyboard.press('Space');
  await page.getByText('Acceptance save failure', { exact: true }).waitFor(); await page.getByRole('button', { name: 'Reorder Age', exact: true }).waitFor();
  await page.waitForFunction(expected => [...document.querySelectorAll('button[aria-label^="Reorder "]')].map(node => node.getAttribute('aria-label')).join('|') === expected, before.fields.map(field => `Reorder ${field.label}`).join('|'));
  assert.deepEqual((await call('/administration/closing-requirements/layout/leads')).fields, before.fields); await page.unroute(failingLayout); checks.push('Failed reorder restores saved order and shows an error');
  async function pointerDrag(from, to, touch = false) {
    await from.click({ trial: true }); // The failed-save refetch must release disabled handles.
    await from.scrollIntoViewIfNeeded(); const source = await from.boundingBox(), destination = await to.boundingBox();
    const x = source.x + source.width / 2, y = source.y + source.height / 2, targetY = destination.y + destination.height / 2;
    let writes = 0;
    const countWrite = request => { if (request.url().includes('/layout/leads') && request.method() === 'PATCH') writes++; };
    page.on('request', countWrite);
    const response = page.waitForResponse(response => response.url().includes('/layout/leads') && response.request().method() === 'PATCH');
    if (touch) {
      const session = await context.newCDPSession(page);
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
      for (let step = 1; step <= 10; step++) { await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + (targetY - y) * step / 10, id: 1 }] }); await page.waitForTimeout(30); }
      await page.screenshot({ path: resolve(output, 'touch-drag.png') }); await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await session.detach();
    } else {
      await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 1, y + 7); await page.waitForTimeout(100); await page.mouse.move(x, targetY, { steps: 12 }); await page.waitForTimeout(150);
      await page.screenshot({ path: resolve(output, 'mouse-drag.png') }); await page.mouse.up();
    }
    assert.equal((await response).status(), 200); await page.waitForTimeout(250); page.off('request', countWrite); assert.equal(writes, 1);
  }
  await pointerDrag(page.getByRole('button', { name: 'Reorder Age', exact: true }), page.getByRole('button', { name: 'Reorder Phone', exact: true })); checks.push('Mouse field drag saves one atomic reorder');
  await page.setViewportSize({ width: 375, height: 900 }); await page.waitForTimeout(250);
  await pointerDrag(page.getByRole('button', { name: 'Reorder First Name', exact: true }), page.getByRole('button', { name: 'Reorder Last Name', exact: true }), true); checks.push('Touch field drag saves one atomic reorder');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: 'Edit Age', exact: true }).click();
  await page.getByLabel('Display label', { exact: true }).fill('Customer Age');
  assert.equal(await page.getByLabel('Module', { exact: true }).last().isDisabled(), true);
  assert.equal(await page.getByLabel('Technical Variable Key', { exact: true }).inputValue(), 'customFieldValues.age');
  assert.equal(await page.getByLabel('Technical Variable Key', { exact: true }).evaluate(input => input.readOnly), true);
  await page.getByRole('button', { name: 'Save field', exact: true }).click(); await page.getByRole('button', { name: 'Edit Customer Age', exact: true }).waitFor();
  assert.equal((await call('/administration/closing-requirements')).find(field => field.id === ageId).technicalAlias, 'age'); checks.push('Field rename retains alias and canonical ID');
  await page.getByRole('button', { name: 'Add Field', exact: true }).click();
  assert.equal(await page.getByLabel('Module', { exact: true }).last().inputValue(), '');
  await page.getByRole('button', { name: 'Save field', exact: true }).click();
  await page.getByText('Module name is required.', { exact: true }).waitFor();
  await page.getByLabel('Module', { exact: true }).last().selectOption('leads');
  await page.getByLabel('Display label', { exact: true }).fill('Favorite Number');
  assert.equal(await page.getByLabel('Technical Variable Key', { exact: true }).inputValue(), 'customFieldValues.favorite-number');
  for await (const { theme, width } of responsiveMatrix(page)) {
    const controls = ['Module', 'Display label', 'Type', 'Technical Variable Key', 'Group'];
    let previousY = -1;
    for (const label of controls) {
      const input = label === 'Type' ? page.getByRole('combobox', { name: /^Type/ }) : page.getByLabel(label, { exact: true }).last();
      const box = await input.boundingBox();
      assert.ok(box && box.x >= 0 && box.x + box.width <= width + 1 && box.y > previousY, `${label} fits and retains order at ${width}/${theme}`);
      previousY = box.y;
    }
    await page.screenshot({ path: resolve(output, `add-field-${theme}-${width}.png`) });
    checks.push(`Add Field module/key layout ${width}/${theme}`);
  }
  await page.getByRole('combobox', { name: /^Type/ }).selectOption('Number'); await page.getByRole('button', { name: 'Save field', exact: true }).click(); await page.getByRole('button', { name: 'Edit Favorite Number', exact: true }).waitFor();
  const favorite = (await call('/administration/closing-requirements')).find(field => field.name === 'Favorite Number'); assert.equal(favorite.technicalAlias, 'favorite-number'); checks.push('Browser field creation stores a readable alias');
  await page.getByRole('button', { name: 'Manage Field Groups', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Manage Fields Groups', exact: true });
  const groupHandle = dialog.getByRole('button', { name: 'Reorder Additional Information group', exact: true }); await groupHandle.focus();
  const groupResponse = page.waitForResponse(response => response.url().includes('/layout/leads') && response.request().method() === 'PATCH');
  await page.keyboard.press('Space'); await page.waitForTimeout(150); await page.keyboard.press('ArrowUp'); await page.waitForTimeout(200); await page.keyboard.press('Space'); assert.equal((await groupResponse).status(), 200);
  after = await call('/administration/closing-requirements/layout/leads'); assert.ok(after.layout.groups.find(group => group.label === 'Additional Information').order < after.layout.groups.find(group => group.label === 'Organization').order); checks.push('Keyboard group reorder persists');
  await pointerDrag(dialog.getByRole('button', { name: 'Reorder Additional Information group', exact: true }), dialog.getByRole('button', { name: 'Reorder Status & Interest group', exact: true })); checks.push('Mouse group drag saves one atomic reorder');
  await page.setViewportSize({ width: 375, height: 900 }); await page.waitForTimeout(250);
  await pointerDrag(dialog.getByRole('button', { name: 'Reorder Assigned Agent group', exact: true }), dialog.getByRole('button', { name: 'Reorder Organization group', exact: true }), true); checks.push('Touch group drag saves one atomic reorder');
  await page.setViewportSize({ width: 1440, height: 900 }); await page.waitForTimeout(250);
  await dialog.getByRole('button', { name: 'Rename Basic Information', exact: true }).click(); await dialog.getByLabel('Group label: Basic Information', { exact: true }).fill('Customer Information'); await dialog.getByRole('button', { name: 'Save', exact: true }).click(); await dialog.getByRole('button', { name: 'Rename Customer Information', exact: true }).waitFor(); checks.push('Group rename preserves assignments');
  await dialog.getByLabel('Add a new group name', { exact: true }).fill('Empty acceptance'); await dialog.getByRole('button', { name: 'Add', exact: true }).click(); await dialog.getByRole('button', { name: 'Delete Empty acceptance group', exact: true }).click();
  let confirmation = page.getByRole('dialog', { name: 'Delete field group', exact: true });
  await confirmation.waitFor();
  await page.waitForFunction(() => document.querySelector('[role="dialog"][aria-label="Delete field group"]')?.contains(document.activeElement));
  assert.equal(await confirmation.getByLabel('Move fields to', { exact: true }).count(), 0);
  await page.keyboard.press('Escape'); await confirmation.waitFor({ state: 'hidden' }); assert.ok(await dialog.getByRole('button', { name: 'Delete Empty acceptance group', exact: true }).isVisible());
  await dialog.getByRole('button', { name: 'Delete Empty acceptance group', exact: true }).click(); confirmation = page.getByRole('dialog', { name: 'Delete field group', exact: true });
  await confirmation.getByRole('button', { name: 'Delete group', exact: true }).click(); await confirmation.waitFor({ state: 'hidden' }); checks.push('Empty group deletion requires confirmation and supports Escape cancellation');
  assert.equal(await dialog.getByRole('button', { name: 'Delete Customer Information group', exact: true }).count(), 0, 'Native field groups cannot be deleted');
  await dialog.getByLabel('Add a new group name', { exact: true }).fill('Populated acceptance'); await dialog.getByRole('button', { name: 'Add', exact: true }).click();
  await dialog.getByRole('button', { name: 'Delete Populated acceptance group', exact: true }).waitFor();
  await page.waitForFunction(() => { const input = document.querySelector('[role="dialog"][aria-label="Manage Fields Groups"] input'); return input && !input.disabled && input.value === ''; });
  await dialog.getByRole('button', { name: 'Close dialog', exact: true }).click(); await dialog.waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Edit Customer Age', exact: true }).click();
  await page.getByLabel('Group', { exact: true }).last().selectOption({ label: 'Populated acceptance' });
  await page.getByRole('button', { name: 'Save field', exact: true }).click(); await page.getByRole('button', { name: 'Edit Customer Age', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Manage Field Groups', exact: true }).click();
  await dialog.getByRole('button', { name: 'Delete Populated acceptance group', exact: true }).click(); confirmation = page.getByRole('dialog', { name: 'Delete field group', exact: true }); assert.ok(await confirmation.getByRole('button', { name: 'Delete group', exact: true }).isDisabled());
  await page.setViewportSize({ width: 320, height: 900 }); await page.waitForTimeout(300); assert.ok(await confirmation.evaluate(node => node.scrollWidth <= node.clientWidth + 1)); await page.screenshot({ path: resolve(output, 'delete-confirmation-320.png') });
  await confirmation.getByLabel('Move fields to', { exact: true }).selectOption('leads:section:3'); await confirmation.getByRole('button', { name: 'Delete group', exact: true }).click(); await confirmation.waitFor({ state: 'hidden' }); await page.setViewportSize({ width: 1440, height: 900 });
  assert.equal((await call(`/crm/leads/${lead.id}/custom-fields`)).values[ageId], 37); checks.push('Populated group moves atomically without changing saved values');
  for (const module of ['contacts', 'accounts', 'deals', 'leads']) { await dialog.getByRole('combobox', { name: 'Field groups module', exact: true }).selectOption(module); await dialog.getByText(new RegExp(`fields in ${module[0].toUpperCase() + module.slice(1)}$`)).waitFor(); assert.equal(await page.getByRole('combobox', { name: 'Module', exact: true }).inputValue(), module); }
  await dialog.getByRole('button', { name: 'Close dialog', exact: true }).click(); checks.push('Modal module selection stays synchronized');
  await page.goto(base + `/crm/leads/${lead.id}`); await page.getByRole('tab', { name: /^Details/ }).click();
  for (const [label, value] of [['Customer Age', '38'], ['Favorite Number', '7']]) {
    await page.getByRole('button', { name: `Edit ${label}`, exact: true }).click();
    const input = page.getByLabel(label, { exact: true }); await input.fill(value);
    await input.locator('xpath=ancestor::dd').getByRole('button', { name: 'Save', exact: true }).click();
    await page.getByRole('button', { name: `Edit ${label}`, exact: true }).waitFor();
  }
  assert.equal((await call(`/crm/leads/${lead.id}/custom-fields`)).values[ageId], 38);
  await page.reload(); await page.getByRole('tab', { name: /^Details/ }).click();
  assert.equal((await page.getByRole('button', { name: 'Edit Customer Age', exact: true }).innerText()).trim(), '38');
  await page.screenshot({ path: resolve(output, 'crm-saved-values.png') }); checks.push('Actual CRM inline editor saves and reloads retained values after field/group changes');
  assert.equal(errors.length, 0, errors.join('\n'));
  writeFileSync(resolve(output, 'report.json'), JSON.stringify({ checks, pageErrors: errors, database: 'disposable', providerSends: 0 }, null, 2));
  console.log(JSON.stringify({ passed: checks.length, pageErrors: errors.length, output }));
} catch (error) {
  if (page) await page.screenshot({ path: resolve(output, 'failure.png') }).catch(() => {});
  writeFileSync(resolve(output, 'report.json'), JSON.stringify({ checks, pageErrors: errors, failure: String(error) }, null, 2)); throw error;
} finally {
  await browser?.close(); if (frontend) frontend.kill(); if (api) { api.closeAllConnections(); await new Promise(done => api.close(done)); }
  await gateway.close();
  await prisma.$disconnect(); await socket.stop(); await db.close();
}
