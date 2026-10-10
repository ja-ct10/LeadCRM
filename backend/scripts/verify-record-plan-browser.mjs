// Real production UI + authenticated Express API against a fresh, migration-replayed
// in-memory database. No existing tenant, provider, or deployment is contacted.
// Build first; set PLAYWRIGHT_MODULE to an installed Playwright package.
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, createWriteStream } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { replayCrmMigrations } from './replay-crm-migrations.mjs';

const root = resolve(import.meta.dirname, '../..');
const runName = process.env.RECORD_PLAN_BROWSER_RUN_NAME || '';
assert.ok(!runName || /^[a-z0-9_-]+$/.test(runName));
const output = resolve(root, '.tmp/record-plan-browser', runName);
mkdirSync(output, { recursive: true });
const apiLog = createWriteStream(resolve(output, 'api.log'));
const originalError = console.error.bind(console);
console.error = (...args) => { apiLog.write(args.map(value => typeof value === 'string' ? value : JSON.stringify(value)).join(' ') + '\n'); originalError(...args); };
const db = await PGlite.create();
await replayCrmMigrations(db);
const socket = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 0 });
await socket.start();
const port = Number(process.env.RECORD_PLAN_BROWSER_PORT || 3033);
const base = `http://localhost:${port}`;
Object.assign(process.env, { NODE_ENV: 'test', DATABASE_URL: `postgresql://postgres:postgres@${socket.getServerConn()}/leadcrm_record_plan_browser?connection_limit=1&statement_cache_size=0`, JWT_SECRET: randomBytes(32).toString('hex'), ENCRYPTION_KEY: randomBytes(32).toString('hex'), APP_URL: base, CORS_ORIGIN: base, ALLOWED_ORIGINS: base });
process.env.DIRECT_URL = process.env.DATABASE_URL;
// Fixtures never dispatch providers; remove inherited credentials as well.
for (const key of Object.keys(process.env)) if (/^(BREVO|TEXTBEE|SMTP|GMAIL|GOOGLE_CLIENT|GOOGLE_REFRESH)/.test(key)) delete process.env[key];
const require = createRequire(import.meta.url), Module = require('node:module'), originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) { return request === '@leadcrm/shared' ? resolve(root, 'backend/dist/shared/src/index.js') : originalResolve.call(this, request, parent, isMain, options); };
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const prisma = require('../dist/backend/src/config/database.config.js').default;
const app = require('../dist/backend/src/app.js').default;
const { tenantContext } = require('../dist/backend/src/core/tenant/tenant-context.js');
const { salesPipeline, salesTransaction } = require('../dist/backend/src/modules/crm/leads/lead-automation.service.js');
const { saveField } = require('../dist/backend/src/modules/crm/closing-requirements/closing-requirements.service.js');
const { updateFieldLayout } = require('../dist/backend/src/modules/crm/closing-requirements/field-layout.service.js');
const { issueAuthSession } = require('../dist/backend/src/core/auth/auth-session.js');
const checks = [], pageErrors = [], transportErrors = [], serverErrors = [];
let api, frontend, browser, page, apiBase, closing = false;
const record = (label, detail = {}) => { checks.push({ label, passed: true, ...detail }); console.log(`PASS ${label}`); };
try {
  const tenant = await prisma.tenant.create({ data: { name: 'Record Plan Acceptance', slug: randomUUID(), onboardingStep: 3, onboardingCompletedAt: new Date() } });
  const admin = await prisma.user.create({ data: { tenantId: tenant.id, firstName: 'Record', lastName: 'Tester', email: 'record-plan@camxian.com', role: 'Client Admin', status: 'ACTIVE', mustChangePassword: false, emailVerified: new Date(), onboardingCompletedAt: new Date() } });
  const token = (await issueAuthSession(admin)).token;
  const scope = run => tenantContext.run({ tenantId: tenant.id }, run);
  const { pipeline, initial } = await scope(() => salesTransaction(tx => salesPipeline(tx, tenant.id)));
  const product = await prisma.productInterest.create({ data: { tenantId: tenant.id, name: 'Acceptance product', dealValue: 25000 } });
  const account = await prisma.account.create({ data: { tenantId: tenant.id, name: 'Acceptance Account', website: 'https://example.test', assignedUserId: admin.id } });
  const lead = await prisma.lead.create({ data: { tenantId: tenant.id, firstName: 'Acceptance', lastName: 'Lead', email: 'lead@example.test', source: 'Website', accountId: account.id, assignedUserId: admin.id } });
  const contact = await prisma.contact.create({ data: { tenantId: tenant.id, firstName: 'Acceptance', lastName: 'Contact', email: 'contact@example.test', accountId: account.id, assignedUserId: admin.id, activeProducts: [], productInterests: [] } });
  const source = await prisma.lead.create({ data: { tenantId: tenant.id, firstName: 'Converted', lastName: 'Source', email: 'source@example.test', accountId: account.id, assignedUserId: admin.id, contactId: contact.id, convertedAt: new Date() } });
  const deal = await prisma.deal.create({ data: { tenantId: tenant.id, title: 'Acceptance Deal', pipelineId: pipeline.id, stageId: initial.id, accountId: account.id, assignedUserId: admin.id, ownerId: admin.id, productsNormalized: true, productInterestId: product.id, productInterestIds: [product.id], value: 25000, productInterests: [product.name], tags: [] } });
  await prisma.leadDeal.createMany({ data: [lead, source].map(item => ({ tenantId: tenant.id, leadId: item.id, dealId: deal.id, addedById: admin.id })) });
  await prisma.contactDeal.create({ data: { tenantId: tenant.id, contactId: contact.id, dealId: deal.id } });
  const records = { leads: lead, contacts: contact, accounts: account, deals: deal };
  const titles = { leads: 'Acceptance Lead', contacts: 'Acceptance Contact', accounts: account.name, deals: deal.title };
  const linkKeys = { leads: 'leadId', contacts: 'contactId', accounts: 'accountId', deals: 'dealId' };
  const fields = {};
  for (const module of Object.keys(records)) {
    const layout = await scope(() => updateFieldLayout(tenant.id, admin.id, module, { action: 'add', label: 'Project plan' }));
    const group = layout.layout.groups.find(item => item.label === 'Project plan');
    const key = module === 'accounts' ? 'website' : module === 'deals' ? 'priority' : 'email';
    const label = module === 'accounts' ? 'Public website' : module === 'deals' ? 'Project priority' : 'Work email';
    await scope(() => updateFieldLayout(tenant.id, admin.id, module, { action: 'field', technicalKey: key, label, groupId: group.id }));
    fields[module] = await scope(() => saveField(tenant.id, admin.id, { module, group: group.label, groupId: group.id, name: 'Project budget', type: 'Number', required: false }));
    await prisma.customFieldValue.create({ data: { tenantId: tenant.id, module, fieldId: fields[module].id, [linkKeys[module]]: records[module].id, value: 0 } });
    await prisma.activity.createMany({ data: [
      { tenantId: tenant.id, createdById: admin.id, type: 'note', title: `Keep ${module} note`, [linkKeys[module]]: records[module].id },
      { tenantId: tenant.id, createdById: admin.id, type: 'call', title: `Historical ${module} call`, [linkKeys[module]]: records[module].id },
    ] });
    await prisma.task.create({ data: { tenantId: tenant.id, createdById: admin.id, assignedUserId: admin.id, title: `Actual ${module} task`, dueDate: new Date('2026-12-01T09:00:00Z'), [module === 'leads' ? 'leadLinks' : module === 'contacts' ? 'contactLinks' : module === 'accounts' ? 'accountLinks' : 'dealLinks']: { create: { [linkKeys[module]]: records[module].id } } } });
  }
  await prisma.activity.create({ data: { tenantId: tenant.id, createdById: admin.id, type: 'note', title: 'Inherited source note', leadId: source.id } });
  await prisma.task.create({ data: { tenantId: tenant.id, createdById: admin.id, assignedUserId: admin.id, title: 'Inherited source task', dueDate: new Date('2026-12-01T09:00:00Z'), leadLinks: { create: { leadId: source.id } } } });
  // Both independent readers must expose the next page without assuming a 50-row cap.
  await prisma.activity.createMany({ data: Array.from({ length: 55 }, (_, index) => ({ tenantId: tenant.id, createdById: admin.id, type: 'note', title: `Older note ${String(index).padStart(2, '0')}`, leadId: lead.id, createdAt: new Date(Date.UTC(2026, 0, 1, 0, index)) })) });
  const staff = await prisma.user.create({ data: { tenantId: tenant.id, firstName: 'Scoped', lastName: 'Reader', email: 'scoped-reader@camxian.com', role: 'Acceptance Reader', status: 'ACTIVE', mustChangePassword: false, emailVerified: new Date(), onboardingCompletedAt: new Date() } });
  const role = await prisma.roleDefinition.create({ data: { tenantId: tenant.id, name: staff.role, permissions: { create: ['leads', 'contacts', 'accounts', 'deals', 'tasks', 'inbox'].map(module => ({ module, canView: true, canEdit: true, canCreate: true })) } } });
  await prisma.userRole.create({ data: { tenantId: tenant.id, roleId: role.id, userId: staff.id } });
  const staffToken = (await issueAuthSession(staff)).token;
  api = app.listen(0, '127.0.0.1'); await new Promise(done => api.once('listening', done));
  apiBase = `http://127.0.0.1:${api.address().port}/api/v1`;
  const log = createWriteStream(resolve(output, 'frontend.log'));
  frontend = spawn(process.execPath, [resolve(root, 'node_modules/next/dist/bin/next'), 'start', '-p', String(port), '-H', '127.0.0.1'], { cwd: resolve(root, 'frontend'), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NODE_ENV: 'production', API_URL: 'https://leadcrm-build.example/api/v1' } });
  frontend.stdout.pipe(log); frontend.stderr.pipe(log);
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) { try { if ((await fetch(base + '/login')).ok) { ready = true; break; } } catch {} await new Promise(done => setTimeout(done, 500)); }
  assert.ok(ready, 'Built Next server did not become ready');
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  async function session(auth) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addInitScript(() => {
      const NativeEventSource = window.EventSource;
      window.__recordPlanStreams = {};
      window.EventSource = class extends NativeEventSource {
        constructor(url, options) {
          super(url, options);
          this.addEventListener('open', () => { window.__recordPlanStreams[String(url)] = true; });
        }
      };
    });
    await context.addCookies([{ name: 'leadcrm_token', value: auth, url: base, httpOnly: true, sameSite: 'Lax' }]);
    const tab = await context.newPage(); tab.setDefaultTimeout(20000);
    tab.on('pageerror', error => pageErrors.push(error.message));
    // Production API_URL enforces HTTPS. Route only the test transport to the
    // disposable localhost API; keep the real API, auth, RBAC and SSE handlers.
    await tab.route('**/api/proxy/**', async route => {
      const request = route.request(), url = new URL(request.url());
      const path = url.pathname.replace('/api/proxy', ''), local = apiBase + path + url.search;
      const headers = { ...request.headers(), authorization: `Bearer ${auth}` };
      if (path.endsWith('/events') || path === '/crm/record-events') return route.continue({ url: local, headers });
      try { const response = await tab.request.fetch(local, { method: request.method(), headers, data: request.postDataBuffer() ?? undefined, maxRetries: request.method() === 'GET' ? 2 : 0 }); if (response.status() >= 500) { const failure = `${request.method()} ${path}: ${await response.text()}`; serverErrors.push(failure); console.error(failure); } await route.fulfill({ response }); }
      catch (error) { if (!closing) transportErrors.push(`${request.method()} ${path}: ${String(error).split('\n')[0]}`); await route.abort().catch(() => {}); }
    });
    return tab;
  }
  page = await session(token);
  const navigate = path => page.goto(base + path);
  const notes = tab => tab.getByRole('region', { name: 'Notes', exact: true });
  const timeline = tab => tab.getByRole('region', { name: 'Activity Timeline', exact: true });
  async function loadThroughOldest(region, buttonName) {
    const label = await region.getAttribute('aria-label');
    for (let pageNumber = 0; pageNumber < 10; pageNumber++) {
      if (await region.getByText('Older note 00', { exact: true }).count()) break;
      const before = await region.innerText();
      await region.getByRole('button', { name: buttonName, exact: true }).click();
      await page.waitForFunction(({ label, buttonName, before }) => {
        const section = [...document.querySelectorAll('section')].find(el => el.getAttribute('aria-label') === label);
        const button = [...section?.querySelectorAll('button') ?? []].find(el => el.textContent.trim() === buttonName);
        return section && section.innerText !== before && !button?.disabled;
      }, { label, buttonName, before });
    }
    await region.getByText('Older note 00', { exact: true }).waitFor();
    assert.equal(await region.getByText(/^Older note \d{2}$/).count(), 55, 'Every older seeded note must remain visible');
    await region.getByText('Keep leads note', { exact: true }).waitFor();
  }
  const taskSection = tab => tab.getByRole('button', { name: /^Tasks(?: \d+)?$/ }).locator('xpath=ancestor::section[1]');
  const streamsReady = tab => tab.waitForFunction(() => window.__recordPlanStreams['/api/proxy/auth/events'] && window.__recordPlanStreams['/api/proxy/crm/record-events'], undefined, { timeout: 20000 });
  async function preserveScrollBefore(tab) {
    const container = tab.locator('[data-record-scroll]');
    await container.evaluate(el => { el.scrollTop = Math.min(100, el.scrollHeight - el.clientHeight); });
    const offset = await container.evaluate(el => el.scrollTop);
    assert.ok(offset > 0, 'Scroll preservation must start from a nonzero position');
    return offset;
  }
  async function assertScrollPreserved(tab, before) {
    assert.ok(Math.abs(await tab.locator('[data-record-scroll]').evaluate(el => el.scrollTop) - before) <= 1, 'Background update moved Activity scroll');
  }
  async function open(module, mode) {
    await navigate(mode === 'page' ? `/crm/${module}/${records[module].id}` : `/crm/${module}?highlight=${records[module].id}`);
    if (mode === 'drawer') {
      if (module === 'contacts') await page.getByRole('row').filter({ hasText: 'contact@example.test' }).getByText('Acceptance', { exact: true }).click();
      else await page.getByText(titles[module], { exact: true }).first().click();
    }
    await page.getByRole('heading', { name: titles[module], exact: true }).waitFor();
    if (module === 'leads') await page.getByText('lead@example.test', { exact: true }).first().waitFor();
    if (module === 'contacts') await page.getByText('contact@example.test', { exact: true }).first().waitFor();
    if (module === 'accounts') await page.getByText('https://example.test', { exact: true }).first().waitFor();
    await notes(page).getByText(`Keep ${module} note`, { exact: true }).waitFor();
    await taskSection(page).getByText(`Actual ${module} task`, { exact: true }).waitFor();
  }
  async function responsive(label, focus) {
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(300);
      if (focus) await focus.scrollIntoViewIfNeeded();
      const dimensions = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, controls: [...document.querySelectorAll('input,textarea,select')].filter(el => el.getClientRects().length && (el.getBoundingClientRect().left < -1 || el.getBoundingClientRect().right > innerWidth + 1)).map(el => el.getAttribute('aria-label') || el.getAttribute('name')) }));
      assert.ok(dimensions.scroll <= width + 1 && !dimensions.controls.length, `${label}: ${JSON.stringify(dimensions)}`);
      if (label.endsWith('-activity')) await page.locator('[data-record-scroll]').evaluate(el => { el.scrollTop = 0; });
      await page.screenshot({ path: resolve(output, `${label}-${width}.png`) });
      record(`${label} ${width}px`, dimensions);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
  }
  for (const module of (process.env.RECORD_PLAN_BROWSER_MODULES?.split(',') || Object.keys(records))) for (const mode of ['drawer', 'page']) {
    await open(module, mode);
    const order = await page.locator('[data-record-scroll]').evaluate(el => [...el.querySelectorAll('section')].map(section => section.getAttribute('aria-label') || section.querySelector('button')?.textContent?.trim()).filter(name => name === 'Notes' || name?.startsWith('Tasks') || name === 'Activity Timeline'));
    assert.equal(order[0], 'Notes'); assert.match(order[1], /^Tasks/); assert.equal(order[2], 'Activity Timeline');
    assert.equal(await page.getByRole('button', { name: 'Open messages', exact: true }).count(), module === 'accounts' ? 0 : 1);
    assert.equal(await page.getByText('Quick Log', { exact: true }).count(), 0);
    await timeline(page).getByRole('button', { name: 'Emails', exact: true }).click();
    await notes(page).getByText(`Keep ${module} note`, { exact: true }).waitFor();
    await taskSection(page).getByText(`Actual ${module} task`, { exact: true }).waitFor();
    assert.equal(await timeline(page).getByText(`Historical ${module} call`, { exact: true }).count(), 0);
    await timeline(page).getByRole('button', { name: 'All', exact: true }).click();
    await timeline(page).getByText(`Historical ${module} call`, { exact: true }).waitFor();
    if (module === 'contacts') { await notes(page).getByText('Inherited source note', { exact: true }).waitFor(); await taskSection(page).getByText('Inherited source task', { exact: true }).waitFor(); }
    await responsive(`${module}-${mode}-activity`);
    await page.getByRole('tab', { name: /^Details/ }).click();
    const group = page.getByRole('button', { name: 'Project plan', exact: true }).locator('xpath=ancestor::section[1]');
    await group.getByText('Project budget', { exact: true }).waitFor();
    await group.getByText(module === 'accounts' ? /^Public website(?: \*)?$/ : module === 'deals' ? /^Project priority(?: \*)?$/ : /^Work email(?: \*)?$/).waitFor();
    if (module === 'leads' || module === 'contacts') await page.getByText(module === 'leads' ? 'lead@example.test' : 'contact@example.test', { exact: true }).first().waitFor();
    if (module === 'accounts') await page.getByText('https://example.test', { exact: true }).first().waitFor();
    if (module === 'deals') await page.getByText(titles.deals, { exact: true }).first().waitFor();
    assert.equal(await group.getByText('0', { exact: true }).count(), 1, 'Stored zero custom value must remain visible once');
    assert.equal(await page.getByRole('button', { name: /^Custom fields(?: \d+)?$/ }).count(), 0, 'No duplicate legacy custom fields block');
    if (module === 'deals') {
      await page.getByRole('button', { name: 'Lead/Contact', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Account', exact: true }).waitFor();
      await page.getByText('Acceptance Lead', { exact: true }).first().waitFor(); await page.getByText('Acceptance Contact', { exact: true }).first().waitFor();
    }
    record(`${module}-${mode} sections, independent filters, Inbox policy, mixed field group`);
    await responsive(`${module}-${mode}-details`, group);
  }
  await open('leads', 'page');
  await loadThroughOldest(notes(page), 'Load older notes');
  await loadThroughOldest(timeline(page), 'Load older activity');
  record('Notes and Timeline load their independent older pages');

  const other = await session(token);
  await other.goto(base + `/crm/leads/${lead.id}`);
  await notes(other).getByText('Keep leads note', { exact: true }).waitFor();
  // Let the initial access/content stream establish its current revisions first.
  await Promise.all([streamsReady(page), streamsReady(other)]);
  await notes(page).getByLabel('Note', { exact: true }).fill('Preserve my unfinished draft');
  const noteScrollBefore = await preserveScrollBefore(page);
  await notes(other).getByLabel('Note', { exact: true }).fill('Remote saved note');
  await notes(other).getByRole('button', { name: 'Save note', exact: true }).click();
  await notes(page).getByText('Remote saved note', { exact: true }).waitFor({ timeout: 12000 });
  assert.equal(await notes(page).getByLabel('Note', { exact: true }).inputValue(), 'Preserve my unfinished draft');
  assert.equal(await page.getByRole('tab', { name: /^Activity/ }).getAttribute('aria-selected'), 'true');
  await assertScrollPreserved(page, noteScrollBefore);
  await notes(page).getByText('Older note 00', { exact: true }).waitFor();
  record('Second-session note silently updates, preserving draft, Activity tab, nonzero scroll and loaded older Notes');

  await page.getByRole('tab', { name: /^Details/ }).click();
  const scroll = page.locator('[data-record-scroll]');
  await scroll.evaluate(el => { el.scrollTop = Math.min(180, el.scrollHeight - el.clientHeight); });
  const scrollBefore = await scroll.evaluate(el => el.scrollTop);
  const customResponse = await other.request.put(apiBase + `/crm/leads/${lead.id}`, { headers: { authorization: `Bearer ${token}` }, data: { customFieldValues: { [fields.leads.id]: 12000 } } });
  assert.equal(customResponse.status(), 200, await customResponse.text());
  await page.getByText('12000', { exact: true }).waitFor({ timeout: 12000 });
  assert.equal(await page.getByRole('tab', { name: /^Details/ }).getAttribute('aria-selected'), 'true');
  assert.ok(Math.abs((await scroll.evaluate(el => el.scrollTop)) - scrollBefore) <= 1, 'Background custom-value update moved Details scroll');
  record('Second-session custom value silently updates, preserving Details tab and scroll');
  await page.getByRole('tab', { name: /^Activity/ }).click();
  const taskScrollBefore = await preserveScrollBefore(page);
  const taskResponse = await other.request.post(apiBase + '/operations/tasks', { headers: { authorization: `Bearer ${token}` }, data: { title: 'Remote actual task', assignedUserId: admin.id, dueDate: '2026-12-02T09:00:00Z', leadIds: [lead.id] } });
  assert.equal(taskResponse.status(), 201, await taskResponse.text());
  await taskSection(page).getByText('Remote actual task', { exact: true }).waitFor({ timeout: 12000 });
  assert.equal(await notes(page).getByLabel('Note', { exact: true }).inputValue(), 'Preserve my unfinished draft');
  await assertScrollPreserved(page, taskScrollBefore);
  record('Second-session Task silently updates and preserves Note draft and nonzero Activity scroll');

  const restricted = await session(staffToken);
  await restricted.goto(base + `/crm/contacts/${contact.id}`);
  await notes(restricted).getByText('Inherited source note', { exact: true }).waitFor();
  await taskSection(restricted).getByText('Inherited source task', { exact: true }).waitFor();
  await streamsReady(restricted);
  await notes(restricted).getByLabel('Note', { exact: true }).fill('Private revoked draft');
  await prisma.rolePermission.updateMany({ where: { tenantId: tenant.id, roleId: role.id, module: { in: ['contacts', 'tasks'] } }, data: { canView: false, canEdit: false, canCreate: false } });
  await restricted.waitForFunction(() => !document.body.innerText.includes('Inherited source note') && !document.body.innerText.includes('Inherited source task') && !document.querySelector('textarea[aria-label="Note"]'), undefined, { timeout: 15000 });
  assert.equal(await restricted.getByText('Private revoked draft', { exact: true }).count(), 0);
  const denied = await restricted.request.get(apiBase + `/crm/contacts/${contact.id}`, { headers: { authorization: `Bearer ${staffToken}` } });
  assert.equal(denied.status(), 403);
  record('Live permission revoke clears protected Contact, inherited history, Tasks and private draft');
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(transportErrors, []);
  assert.deepEqual(serverErrors, []);
  writeFileSync(resolve(output, 'results.json'), JSON.stringify({ checks, pageErrors, transportErrors, serverErrors }, null, 2));
  console.log(`Record plan browser acceptance passed: ${checks.length} checks.`);
} catch (error) {
  process.exitCode = 1;
  if (page) { await page.screenshot({ path: resolve(output, 'failure.png') }).catch(() => {}); writeFileSync(resolve(output, 'failure.txt'), await page.locator('body').innerText().catch(() => '')); }
  writeFileSync(resolve(output, 'results.json'), JSON.stringify({ checks, pageErrors, transportErrors, serverErrors, error: String(error) }, null, 2));
  throw error;
} finally {
  closing = true;
  // A browser/socket shutdown must not leave a test worker holding this port.
  const shutdown = setTimeout(() => process.exit(process.exitCode ?? 0), 20000); shutdown.unref();
  await browser?.close(); frontend?.kill();
  if (api) { api.closeAllConnections(); await new Promise(done => api.close(done)); }
  await prisma.$disconnect(); await socket.stop(); await db.close();
}
