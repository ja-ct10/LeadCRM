import { acceptancePort, acceptanceWidths, createAcceptanceContext, setAcceptanceTheme } from './verify-browser-matrix.mjs';
// Production frontend + real HTTP/auth/SQL against a disposable in-memory database.
// Requires compiled backend/frontend and an installed Playwright package.
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, createWriteStream } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { replayCrmMigrations } from './replay-crm-migrations.mjs';
import { verifyTableControls } from './verify-table-controls.mjs';
import { verifySearchHighlighting } from './verify-search-highlighting.mjs';

const root = resolve(import.meta.dirname, '../..');
const output = process.env.LEADCRM_BROWSER_OUTPUT || (resolve(root, '.tmp/leads-table-browser'));
mkdirSync(output, { recursive: true });
writeFileSync(resolve(output, 'results.json'), JSON.stringify({ status: 'running', checks: [], errors: [] }));
const db = await PGlite.create();
await replayCrmMigrations(db);
const socket = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 0 });
await socket.start();
const base = `http://localhost:${await acceptancePort()}`;
Object.assign(process.env, {
  NODE_ENV: 'test', DATABASE_URL: `postgresql://postgres:postgres@${socket.getServerConn()}/leadcrm_polish_test?connection_limit=1&statement_cache_size=0`,
  JWT_SECRET: randomBytes(32).toString('hex'), ENCRYPTION_KEY: randomBytes(32).toString('hex'), APP_URL: base, CORS_ORIGIN: base, ALLOWED_ORIGINS: base,
});
process.env.DIRECT_URL = process.env.DATABASE_URL;
const require = createRequire(import.meta.url), Module = require('node:module');
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function(request, parent, isMain, options) {
  return request === '@leadcrm/shared' ? resolve(root, 'backend/dist/shared/src/index.js') : originalResolve.call(this, request, parent, isMain, options);
};
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || process.argv[2] || 'playwright');
const prisma = require('../dist/backend/src/config/database.config.js').default;
const app = require('../dist/backend/src/app.js').default;
const { issueAuthSession } = require('../dist/backend/src/core/auth/auth-session.js');
const checks = [], errors = [];
let api, frontend, browser, failurePage, closing = false;
try {
  const tenant = await prisma.tenant.create({ data: { name: 'Table Acceptance', slug: randomUUID(), onboardingStep: 3, onboardingCompletedAt: new Date() } });
  const foreignTenant = await prisma.tenant.create({ data: { name: 'Other Tenant', slug: randomUUID() } });
  const admin = await prisma.user.create({ data: { tenantId: tenant.id, firstName: 'Table', lastName: 'Tester', email: 'table-tester@camxian.com', role: 'Client Admin', status: 'ACTIVE', mustChangePassword: false, onboardingCompletedAt: new Date() } });
  const { token } = await issueAuthSession(admin);
  const account = await prisma.account.create({ data: { tenantId: tenant.id, name: 'Canonical Account' } });
  await prisma.productInterest.create({ data: { tenantId: tenant.id, name: 'Real Product', dealValue: 100 } });
  const lead = await prisma.lead.create({ data: { tenantId: tenant.id, firstName: 'Josh', lastName: 'Tiron', phone: '+639171234567', email: 'josh@example.test', accountId: account.id, status: 'Warm', productsNormalized: true, createdAt: new Date(Date.now() + 60000) } });
  for (let index = 1; index <= 31; index++) await prisma.lead.create({ data: {
    tenantId: tenant.id, firstName: 'Josh', lastName: `Tiron${String(index).padStart(2, '0')}`, email: `josh${index}@example.test`, status: 'Warm', productsNormalized: true,
  } });
  await prisma.lead.create({ data: { tenantId: foreignTenant.id, firstName: 'Josh', lastName: 'Tiron Foreign', email: 'foreign@example.test' } });
  const pipeline = await prisma.pipeline.create({ data: { tenantId: tenant.id, name: 'Search Acceptance' } });
  const stage = await prisma.stage.create({ data: { tenantId: tenant.id, pipelineId: pipeline.id, name: 'Inquiry', order: 0, requiredFields: [] } });
  for (let index = 1; index <= 3; index++) {
    const common = { tenantId: tenant.id };
    await prisma.account.create({ data: { ...common, name: `Search Target Account ${index}`,  } });
    await prisma.contact.create({ data: { ...common, firstName: 'Search Target', lastName: `Person ${index}`, productsNormalized: true } });
    await prisma.deal.create({ data: { ...common, title: `Search Target Deal ${index}`, pipelineId: pipeline.id, stageId: stage.id, accountId: account.id, productsNormalized: true, productInterests: [], tags: [] } });
    await prisma.task.create({ data: { ...common, title: `Search Target Task ${index}`, assignedUserId: admin.id, dueDate: new Date(), createdById: admin.id } });
    await prisma.workflow.create({ data: { ...common, name: `Search Target Workflow ${index}`, trigger: 'lead.created', actions: [] } });
    await prisma.campaign.create({ data: { ...common, name: `Search Target Campaign ${index}`, type: 'EMAIL' } });
    await prisma.template.create({ data: { ...common, name: `Search Target Template ${index}`, type: 'Email', content: '<p>Test only</p>' } });
    await prisma.activity.create({ data: { ...common, title: `Search Target Activity ${index}`, type: 'note', leadId: lead.id, createdById: admin.id } });
    await prisma.user.create({ data: { ...common, firstName: 'Search Target', lastName: `User ${index}`, role: 'Sales', status: 'ACTIVE', email: `search-user-${index}@camxian.com`, mustChangePassword: false, onboardingCompletedAt: new Date() } });
  }
  const denied = await prisma.user.create({ data: { tenantId: tenant.id, firstName: 'Restricted', lastName: 'Tester', email: 'restricted-tester@camxian.com', role: 'Viewer', status: 'ACTIVE', mustChangePassword: false, onboardingCompletedAt: new Date() } });
  const deniedToken = (await issueAuthSession(denied)).token;
  const oldColumns = ['firstName', 'lastName', 'email', 'phone', 'companyName', 'status', 'assignedUserId'].map((id, order) => ({ id, order, visible: true, width: 180 }));
  oldColumns.push({ id: 'emailCount', visible: true, order: 79, width: 180 });
  oldColumns.push({ id: 'name', visible: true, order: 80, width: 240 });
  await prisma.userPreference.create({ data: { tenantId: tenant.id, userId: admin.id, module: 'leads', key: 'columns', value: { columns: oldColumns } } });
  api = app.listen(0, '127.0.0.1');
  await new Promise(done => api.once('listening', done));
  const apiBase = `http://127.0.0.1:${api.address().port}/api/v1`;
  const call = async (path, method = 'GET', body, auth = token) => {
    const response = await fetch(apiBase + path, { method, headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json() };
  };
  const record = label => { checks.push(label); console.log('PASS', label); };
  const until = async (predicate, message) => { for (let count = 0; count < 120; count++) { if (await predicate()) return; await new Promise(done => setTimeout(done, 150)); } throw new Error(message); };
  const result = await call('/crm/leads?search=Josh%20Tiron&sort=name:asc&limit=5&page=2');
  assert.equal(result.status, 200);
  assert.equal(result.body.meta.total, 32);
  assert.deepEqual(result.body.data.map(row => row.lastName), ['Tiron05', 'Tiron06', 'Tiron07', 'Tiron08', 'Tiron09']);
  assert.ok(result.body.data.every(row => row.tenantId === tenant.id));
  record('Full-name search and deterministic Name sort precede pagination and retain tenant isolation');
  const descending = await call('/crm/leads?search=Josh%20Tiron&sort=name:desc&limit=5&page=2');
  assert.deepEqual(descending.body.data.map(row => row.lastName), ['Tiron26', 'Tiron25', 'Tiron24', 'Tiron23', 'Tiron22']);
  assert.equal((await call('/crm/leads?search=Josh%200917')).body.meta.total, 1);
  const endpoints = ['/crm/contacts', '/crm/accounts', '/crm/deals', '/operations/tasks', '/automation/workflows', '/marketing/campaigns', '/marketing/templates', '/administration/users', '/crm/activities'];
  for (const endpoint of endpoints) {
    const response = await call(`${endpoint}?search=%20Search%20%20Target%20&limit=1&page=2${endpoint === '/crm/activities' ? `&leadId=${lead.id}` : ''}`);
    assert.equal(response.status, 200, endpoint + ' ' + JSON.stringify(response.body));
    assert.equal(response.body.meta.total, 3, endpoint + ' must count matches before paging');
    assert.equal(response.body.data.length, 1, endpoint + ' must return the requested page');
  }
  assert.equal((await call('/crm/deals?search=Canonical%20Account')).body.meta.total, 3);
  assert.equal((await call('/crm/activities?search=Table%20Target&leadId=' + lead.id)).body.meta.total, 3);
  assert.equal((await call('/crm/leads?search=Josh', 'GET', undefined, deniedToken)).status, 403);
  assert.equal((await call('/preferences/columns/accounts', 'PUT', { columns: [{ id: 'name', visible: false, order: 0 }] })).status, 400);
  record('Nine module searches count before paging, match split terms/related labels and preserve denied-role access and required organization identity validation');
  const preference = (await call('/preferences/columns/leads')).body.data.columns;
  assert.equal(preference[0].id, 'name'); assert.equal(preference[0].visible, true);
  assert.ok(!preference.some(column => column.id === 'emailCount'));
  assert.ok(preference.every((column, order) => column.order === order));
  record('Legacy preference retirement, fixed Name, widths and sequential order resolve through real HTTP');

  const log = createWriteStream(resolve(output, 'frontend.log'));
  frontend = spawn(process.execPath, [resolve(root, 'node_modules/next/dist/bin/next'), 'start', '-p', new URL(base).port, '-H', '127.0.0.1'], {
    cwd: resolve(root, 'frontend'), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NODE_ENV: 'production', API_URL: 'https://leadcrm-build.example/api/v1' },
  });
  frontend.stdout.pipe(log); frontend.stderr.pipe(log);
  await until(async () => { try { return (await fetch(base + '/login')).ok; } catch { return false; } }, 'Frontend did not start');
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await createAcceptanceContext(browser, { viewport: { width: 1440, height: 900 } });
  // Stream responses cannot be buffered by route.fulfill. Pause background SSE
  // in this manual-refresh runner so request counts have one explicit owner.
  await context.addInitScript(() => { Object.defineProperty(window, 'EventSource', { value: undefined, configurable: true }); });
  await context.addCookies([{ name: 'leadcrm_token', value: token, url: base, httpOnly: true, sameSite: 'Lax' }]);
  const page = await context.newPage(); page.setDefaultTimeout(20000); page.setDefaultNavigationTimeout(120000);
  failurePage = page;
  page.on('pageerror', error => errors.push(error.message));
  const failures = { preference: 0, reset: 0, create: 0 };
  const reads = [];
  const control = { failPath: '', holdPath: '', holdGate: null, release: null, pending: 0 };
  page.on('request', request => { const url = new URL(request.url()); if (url.pathname.startsWith('/api/proxy/')) reads.push({ path: url.pathname.replace('/api/proxy', ''), method: request.method(), query: url.search }); });
  await page.route('**/api/proxy/**', async route => {
    const request = route.request(), url = new URL(request.url());
    const path = url.pathname.replace('/api/proxy', '');
    if (path.endsWith('/events') || path === '/crm/record-events') return route.continue({ url: apiBase + path + url.search, headers: { ...request.headers(), authorization: `Bearer ${token}` } });
    if (request.method() === (control.failMethod ?? 'GET') && path === control.failPath) { control.failPath = ''; control.failMethod = 'GET'; await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Refresh unavailable. Please retry.' }) }); return; }
    if (request.method() === 'GET' && path === control.holdPath) {
      control.pending++;
      control.holdGate ??= new Promise(resolve => { control.release = resolve; });
      await control.holdGate;
      control.pending--;
      if (!control.pending) { control.holdPath = ''; control.holdGate = null; }
    }
    const kind = path === '/preferences/columns/leads' && request.method() === 'PUT' ? 'preference'
      : path === '/preferences/columns/leads' && request.method() === 'DELETE' ? 'reset'
      : path === '/crm/leads' && request.method() === 'POST' ? 'create' : undefined;
    if (kind && failures[kind] > 0) {
      failures[kind]--; await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Acceptance request failed. Please retry.' }) }); return;
    }
    try {
      const response = await page.request.fetch(apiBase + path + url.search, { method: request.method(), headers: { ...request.headers(), authorization: `Bearer ${token}` }, data: request.postDataBuffer() ?? undefined, maxRetries: request.method() === 'GET' ? 2 : 0 });
      await route.fulfill({ response });
    } catch (error) { if (!closing) errors.push(String(error).split('\n')[0]); await route.abort().catch(() => {}); }
  });
  const navigate = path => page.goto(base + path);
  const drawer = () => page.getByRole('dialog', { name: 'Manage Columns - leads' });
  const toolbarSettings = () => page.getByRole('toolbar', { name: 'Module controls' }).getByRole('button', { name: 'Table settings', exact: true });
  const openColumns = async () => {
    await toolbarSettings().click();
    await page.getByRole('menuitem', { name: 'Manage Columns', exact: true }).click();
  };
  await navigate('/crm/leads?view=kanban');
  await page.getByRole('button', { name: 'Josh Tiron', exact: true }).waitFor();
  assert.equal(new URL(page.url()).searchParams.get('view'), null);
  assert.equal((await page.getByRole('columnheader').allTextContents()).filter(Boolean)[0], 'Name');
  assert.equal(await page.getByRole('columnheader', { name: 'Name', exact: true }).evaluate(element => getComputedStyle(element).position), 'sticky');
  record('Obsolete view URLs normalize to Table; canonical combined Name is first and pinned');
  await openColumns();
  assert.equal(await drawer().getByRole('switch', { name: 'Toggle Name visibility' }).isDisabled(), false);
  assert.equal(await drawer().getByRole('button', { name: 'Drag to reorder Name' }).isDisabled(), true);
  await drawer().getByRole('switch', { name: 'Toggle First Name visibility' }).click();
  await page.keyboard.press('Escape');
  assert.equal(await drawer().getByRole('switch', { name: 'Toggle Name visibility' }).getAttribute('aria-checked'), 'true');
  assert.equal(await drawer().getByRole('switch', { name: 'Toggle First Name visibility' }).getAttribute('aria-checked'), 'false');
  await drawer().getByRole('switch', { name: 'Toggle First Name visibility' }).click();
  await page.keyboard.press('Tab');
  assert.equal(await page.getByRole('alertdialog').getByRole('button', { name: 'Switch Columns' }).evaluate(element => document.activeElement === element), true);
  await page.keyboard.press('Enter');
  failures.preference = 1;
  await drawer().getByRole('button', { name: 'Save', exact: true }).click();
  await drawer().getByRole('button', { name: 'Retry', exact: true }).waitFor();
  assert.equal(await drawer().getByRole('switch', { name: 'Toggle First Name visibility' }).getAttribute('aria-checked'), 'true');
  await drawer().getByRole('button', { name: 'Retry', exact: true }).click();
  await drawer().getByRole('button', { name: 'Saved', exact: true }).waitFor();
  await drawer().getByRole('button', { name: 'Close drawer' }).click();
  assert.equal(await toolbarSettings().evaluate(element => document.activeElement === element), true);
  await page.reload(); await page.getByRole('columnheader', { name: 'First Name', exact: true }).waitFor();
  assert.equal(await page.getByRole('columnheader', { name: 'Name', exact: true }).count(), 0);
  await openColumns(); await drawer().getByRole('switch', { name: 'Toggle Last Name visibility' }).click();
  await drawer().getByRole('switch', { name: 'Toggle Name visibility' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.equal(await drawer().getByRole('switch', { name: 'Toggle Last Name visibility' }).getAttribute('aria-checked'), 'true');
  await drawer().getByRole('switch', { name: 'Toggle Name visibility' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Switch Columns' }).click();
  await drawer().getByRole('button', { name: 'Save', exact: true }).click();
  await drawer().getByRole('button', { name: 'Saved', exact: true }).waitFor();
  await drawer().getByRole('button', { name: 'Close drawer' }).click();
  await page.reload(); await page.getByRole('button', { name: 'Josh Tiron', exact: true }).waitFor();
  record('Failed column saves preserve drafts; retry persists hideable First Name through reload; focus restores');

  const nameHeader = page.getByRole('columnheader', { name: 'Name', exact: true });
  const box = await nameHeader.boundingBox();
  const expectedWidth = Math.round(box.width + 75);
  await page.mouse.move(box.x + box.width - 2, box.y + 15); await page.mouse.down();
  await page.mouse.move(box.x + box.width + 73, box.y + 15); await page.mouse.up();
  await until(async () => (await call('/preferences/columns/leads')).body.data.columns.find(column => column.id === 'name').width === expectedWidth, 'Width was not persisted');
  assert.equal(await nameHeader.getAttribute('aria-sort'), null, 'Resizing must not sort the header');
  await page.reload(); await page.getByRole('button', { name: 'Josh Tiron', exact: true }).waitFor();
  assert.equal(Math.round((await page.getByRole('columnheader', { name: 'Name', exact: true }).boundingBox()).width), expectedWidth);
  const pinned = page.getByRole('columnheader', { name: 'Name', exact: true });
  const beforeScroll = await pinned.boundingBox();
  await pinned.evaluate(element => { element.closest('table').parentElement.scrollLeft = 400; });
  assert.ok(Math.abs((await pinned.boundingBox()).x - beforeScroll.x) <= 1, 'Pinned Name moved during horizontal scrolling');
  await pinned.evaluate(element => { element.closest('table').parentElement.scrollLeft = 0; });
  record('Resize end persists the final width through validation and browser reload');
  await openColumns(); failures.reset = 1;
  await drawer().getByRole('button', { name: 'Reset to Default' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Reset', exact: true }).click();
  await drawer().getByText('Unable to reset columns. Please try again.', { exact: true }).waitFor();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  await drawer().getByRole('button', { name: 'Reset to Default' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Reset', exact: true }).click();
  await until(async () => !await prisma.userPreference.findFirst({ where: { userId: admin.id, module: 'leads', key: 'columns' } }), 'Reset did not remove preference');
  await drawer().getByRole('button', { name: 'Close drawer' }).click();
  assert.equal(await page.getByRole('columnheader', { name: 'First Name', exact: true }).count(), 0);
  assert.equal(await page.getByRole('columnheader', { name: 'Last Name', exact: true }).count(), 0);
  record('Failed reset has a retryable error; confirmed reset restores shared defaults');
  await page.getByRole('textbox', { name: 'Search leads...' }).fill(' Josh   Tiron17 ');
  await page.getByRole('button', { name: 'Josh Tiron17', exact: true }).waitFor();
  await until(async () => await page.locator('tbody tr').count() === 1, 'Search did not filter list');
  record('Browser full-name search handles whitespace and finds split persisted names');
  await page.getByRole('textbox', { name: 'Search leads...' }).fill('');
  await page.getByRole('button', { name: 'Create Lead', exact: true }).click();
  await page.getByText('Create New', { exact: true }).click();
  const form = page.locator('form').last();
  await form.getByLabel('First Name *', { exact: true }).fill('Retry');
  await form.getByLabel('Last Name *', { exact: true }).fill('Preserved');
  await form.getByLabel('Email *', { exact: true }).fill('retry-preserved@example.test');
  failures.create = 1;
  await form.getByRole('button', { name: 'Create Lead', exact: true }).click();
  await form.getByRole('alert').waitFor();
  assert.equal(await form.getByLabel('First Name *', { exact: true }).inputValue(), 'Retry');
  assert.equal(await form.getByLabel('Last Name *', { exact: true }).inputValue(), 'Preserved');
  await form.getByRole('button', { name: 'Create Lead', exact: true }).click();
  await page.getByRole('button', { name: 'Retry Preserved', exact: true }).waitFor();
  assert.ok(await prisma.lead.findFirst({ where: { tenantId: tenant.id, email: 'retry-preserved@example.test' } }));
  record('Failed create preserves form values; successful retry persists once and refreshes the list');
  for (const close of await page.locator('[data-sonner-toast] [data-close-button]').all()) await close.click().catch(() => {});
  await until(async () => await page.locator('[data-sonner-toast]').count() === 0, 'Toasts did not close');
  await page.screenshot({ path: resolve(output, 'leads-table-1440.png') });
  for (const dark of [false, true]) for (const width of acceptanceWidths) {
    await page.setViewportSize({ width, height: 900 });
    await setAcceptanceTheme(page, dark ? 'Dark' : 'Light');
    await openColumns();
    const bounds = await drawer().boundingBox(); assert.ok(bounds.x >= -1 && bounds.x + bounds.width <= width + 1);
    assert.equal(await drawer().evaluate(element => element.closest('[data-theme-container]').classList.contains('dark')), dark);
    await drawer().getByRole('textbox', { name: 'Search columns' }).fill(' First Name ');
    assert.equal(await drawer().getByRole('switch', { name: 'Toggle First Name visibility' }).count(), 1);
    await page.screenshot({ path: resolve(output, `drawer-${width}-${dark ? 'dark' : 'light'}.png`) });
    await page.keyboard.press('Escape');
  }
  record('All eight Light/Dark viewport layouts, trimmed column search and keyboard Escape work');
  if (!process.argv.includes('--search-table-only')) await verifyTableControls({ page, base, prisma, tenant, foreignTenant, admin, deniedToken, call, until, record, reads, control, output });
  await verifySearchHighlighting({ page, prisma, tenant, foreignTenant, admin, call, until, record, control, output });
  assert.deepEqual(errors, []);
  writeFileSync(resolve(output, 'results.json'), JSON.stringify({ status: 'passed', environment: 'Local production build + disposable PGlite SQL; background SSE paused to isolate manual refresh', checks, errors }, null, 2));
} catch (error) {
  if (failurePage) {
    await failurePage.screenshot({ path: resolve(output, 'failure.png') }).catch(() => {});
    writeFileSync(resolve(output, 'failure.txt'), await failurePage.locator('body').innerText().catch(() => ''));
  }
  writeFileSync(resolve(output, 'results.json'), JSON.stringify({ status: 'failed', checks, errors, failure: error.stack || String(error), url: failurePage?.url() }, null, 2));
  throw error;
} finally {
  closing = true;
  await browser?.close(); frontend?.kill();
  if (api) { api.closeAllConnections(); await new Promise(done => api.close(done)); }
  await prisma.$disconnect(); await socket.stop(); await db.close();
}
