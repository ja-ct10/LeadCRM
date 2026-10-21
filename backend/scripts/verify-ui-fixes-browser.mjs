import { acceptancePort, setAcceptanceTheme, responsiveMatrix, createAcceptanceContext } from './verify-browser-matrix.mjs';
// Browser acceptance against a disposable DB and locally built application.
// Usage: set PLAYWRIGHT_MODULE to an installed Playwright package, then run.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, createWriteStream } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const root = resolve(import.meta.dirname, '../..'), output = process.env.LEADCRM_BROWSER_OUTPUT || (resolve(root, 'data/outputs/ui-fixes-browser'));
mkdirSync(output, { recursive: true });
const database = new URL(process.env.DATABASE_URL);
assert.equal(database.hostname, '127.0.0.1'); assert.equal(database.pathname, '/leadcrm_forms_test_2');
const base = `http://localhost:${await acceptancePort()}`;
Object.assign(process.env, { NODE_ENV: 'test', JWT_SECRET: randomBytes(32).toString('hex'), ENCRYPTION_KEY: randomBytes(32).toString('hex'), APP_URL: base, CORS_ORIGIN: base });
process.env.DIRECT_URL = process.env.DATABASE_URL;
process.env.ALLOWED_ORIGINS = base;
const require = createRequire(import.meta.url), Module = require('node:module'), originalResolve = Module._resolveFilename;
Module._resolveFilename = function(request, parent, isMain, options) { return request === '@leadcrm/shared' ? resolve(root, 'backend/dist/shared/src/index.js') : originalResolve.call(this, request, parent, isMain, options); };
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || process.argv[2] || 'playwright');
const prisma = require('../dist/backend/src/config/database.config.js').default;
const app = require('../dist/backend/src/app.js').default;
const { tenantContext } = require('../dist/backend/src/core/tenant/tenant-context.js');
const { salesPipeline, salesTransaction } = require('../dist/backend/src/modules/crm/leads/lead-automation.service.js');
const { issueAuthSession } = require('../dist/backend/src/core/auth/auth-session.js');
const { hashResetToken } = require('../dist/backend/src/core/auth/password-reset.service.js');
let api, frontend, browser, page, closing = false;
const checks = [], pageErrors = [], transportErrors = [];
try {
  const tenant = await prisma.tenant.create({ data: { name: 'UI Fix Acceptance', slug: randomUUID(), onboardingStep: 3, onboardingCompletedAt: new Date() } });
  const admin = await prisma.user.create({ data: { tenantId: tenant.id, firstName: 'Custom', lastName: 'Tester', email: 'custom-preview@camxian.com', role: 'Client Admin', status: 'ACTIVE', mustChangePassword: false, onboardingCompletedAt: new Date() } });
  const { token } = await issueAuthSession(admin);
  let activeToken = token;
  const role = await prisma.roleDefinition.create({ data: { tenantId: tenant.id, name: 'UI task staff', permissions: { create: { module: 'tasks', canView: true } } } });
  await prisma.user.create({ data: { tenantId: tenant.id, firstName: 'QA', lastName: 'Agent', email: 'ui-task-agent@camxian.com', role: role.name, userRoles: { create: { roleId: role.id } } } });
  await prisma.productInterest.create({ data: { tenantId: tenant.id, name: 'CCTV Acceptance', dealValue: 25000 } });
  const scope = run => tenantContext.run({ tenantId: tenant.id }, run);
  await scope(() => salesTransaction(tx => salesPipeline(tx, tenant.id)));
  const account = await prisma.account.create({ data: { tenantId: tenant.id, name: 'QAAccount' } });
  const historicalNote = await prisma.activity.create({ data: { tenantId: tenant.id, accountId: account.id, type: 'note', title: 'Legacy Internal Notes', description: 'Historical note', metadata: { legacyAccountNote: 'v1', sourceField: 'internalNotes', originalAuthorUnknown: true } } });
  const lead = await prisma.lead.create({ data: { tenantId: tenant.id, firstName: 'QALead', lastName: 'Tester', email: 'lead@example.test', companyName: ' McDonalds ' } });
  const contact = await prisma.contact.create({ data: { tenantId: tenant.id, firstName: 'QAContact', lastName: 'Tester', email: 'contact@example.test', companyName: 'McDonalds' } });
  const pipeline = await prisma.pipeline.findFirstOrThrow({ where: { tenantId: tenant.id }, include: { stages: true } });
  const deal = await prisma.deal.create({ data: { tenantId: tenant.id, pipelineId: pipeline.id, stageId: pipeline.stages[0].id, title: 'QADeal', value: 100 } });
  for (const [key, record] of [['leadId', lead], ['contactId', contact], ['accountId', account], ['dealId', deal]]) {
    for (let i = 0; i < 16; i++) await prisma.activity.create({ data: { tenantId: tenant.id, [key]: record.id, type: 'note', title: `QA activity ${i}`, description: 'Timeline scrolling acceptance', createdById: admin.id } });
  }
  api = app.listen(0, '127.0.0.1'); await new Promise(done => api.once('listening', done));
  const log = createWriteStream(resolve(output, 'frontend.log'));
  frontend = spawn(process.execPath, [resolve(root, 'node_modules/next/dist/bin/next'), 'start', '-p', new URL(base).port, '-H', '127.0.0.1'], { cwd: resolve(root, 'frontend'), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NODE_ENV: 'production', API_URL: 'https://leadcrm-build.example/api/v1' } });
  frontend.stdout.pipe(log); frontend.stderr.pipe(log);
  for (let attempt = 0; attempt < 60; attempt++) { try { if ((await fetch(base + '/login')).ok) break; } catch {} await new Promise(done => setTimeout(done, 500)); }
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await createAcceptanceContext(browser, { viewport: { width: 1440, height: 900 } });

  await context.addCookies([{ name: 'leadcrm_token', value: token, url: base, httpOnly: true, sameSite: 'Lax' }]);
  page = await context.newPage(); page.setDefaultTimeout(20000); page.setDefaultNavigationTimeout(120000); page.on('pageerror', error => pageErrors.push(error.message));
  // Only the browser transport is redirected; authentication and all data use the real local API/SQL.
  await page.route('**/api/proxy/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.endsWith('/events') || url.pathname.endsWith('/record-events')) return route.continue({ url: `http://127.0.0.1:${api.address().port}/api/v1${url.pathname.replace('/api/proxy', '')}${url.search}`, headers: { ...request.headers(), ...(activeToken ? { authorization: `Bearer ${activeToken}` } : {}) } });
    try {
      const response = await page.request.fetch(`http://127.0.0.1:${api.address().port}/api/v1${url.pathname.replace('/api/proxy', '')}${url.search}`, { method: request.method(), headers: { ...request.headers(), ...(activeToken ? { authorization: `Bearer ${activeToken}` } : {}) }, data: request.postDataBuffer() ?? undefined, maxRetries: request.method() === 'GET' ? 2 : 0 });
      await route.fulfill({ response });
    } catch (error) {
      if (!closing) transportErrors.push(`${request.method()} ${url.pathname}: ${String(error).split('\n')[0]}`);
      await route.abort().catch(() => {});
    }
  });
  const navigate = path => page.goto(base + path);
  const record = label => { checks.push({ label }); console.log('PASS', label); };
  async function responsive(label, rootLocator, themeOptions = {}) {
    const fixedAppearance = themeOptions.allowUnscoped ? await rootLocator.evaluate(root => ({ color: getComputedStyle(root).color, background: getComputedStyle(root.closest('.bg-white') ?? root).backgroundColor })) : undefined;
    for await (const { theme, width } of responsiveMatrix(page, { themes: ['Classic', 'Light', 'Dark', 'System'], ...themeOptions })) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(350);
      const dimensions = await rootLocator.evaluate(root => ({ width: innerWidth, overflow: root.scrollWidth > root.clientWidth + 1, outside: [...root.querySelectorAll('input, select, textarea, button')].filter(el => el.getClientRects().length && (el.getBoundingClientRect().left < -1 || el.getBoundingClientRect().right > innerWidth + 1)).map(el => el.getAttribute('aria-label') || el.textContent) }));
      assert.equal(dimensions.overflow, false, JSON.stringify(dimensions)); assert.deepEqual(dimensions.outside, [], JSON.stringify(dimensions));
      if (label === 'task-picker') {
        const done = rootLocator.getByRole('button', { name: 'Done', exact: true });
        await done.scrollIntoViewIfNeeded();
        const bounds = await done.boundingBox(); assert.ok(bounds && bounds.y >= 0 && bounds.y + bounds.height <= 900);
      }
      if (label.startsWith('audience-') && label !== 'audience-product-options') {
        const footer = rootLocator.getByRole('button', { name: 'Create Audience', exact: true });
        const bounds = await footer.boundingBox(); assert.ok(bounds && bounds.y >= 0 && bounds.y + bounds.height <= 900);
      }
      await page.screenshot({ path: resolve(output, `${label}-${theme}-${width}.png`) });
      if (fixedAppearance) assert.deepEqual(await rootLocator.evaluate(root => ({ color: getComputedStyle(root).color, background: getComputedStyle(root.closest('.bg-white') ?? root).backgroundColor })), fixedAppearance);
      checks.push({ label, ...(fixedAppearance ? { themePreference: theme, appearance: 'fixed public appearance' } : { theme }), ...dimensions });
    }
    await page.setViewportSize({ width: 1440, height: 900 });
  }
  await navigate('/crm/contacts');
  await page.getByRole('button', { name: 'Create Contact', exact: true }).click();
  await page.getByText('Create New', { exact: true }).click();
  await page.getByLabel('Contact Address', { exact: true }).fill('123 QA Street, Manila');
  const contactForm = page.locator('form').last();
  await contactForm.getByRole('textbox', { name: /^First Name/ }).fill('NewQA'); await contactForm.getByRole('textbox', { name: /^Last Name/ }).fill('Contact'); await contactForm.getByRole('textbox', { name: /^Email/ }).fill('newqa@example.test');
  const initialStatus = contactForm.getByRole('textbox', { name: 'Status' });
  assert.equal(await initialStatus.inputValue(), 'Inquiry'); assert.equal(await initialStatus.evaluate(el => el.readOnly), true);
  await responsive('contact-create', page.locator('form').last());
  await page.locator('form button[type="submit"]').click();
  await page.getByText('NewQA', { exact: true }).first().waitFor();
  assert.equal((await prisma.contact.findFirstOrThrow({ where: { tenantId: tenant.id, email: 'newqa@example.test' } })).address, '123 QA Street, Manila'); record('Contact Full Address persists existing address');
  assert.ok(await page.getByText('Assigned Agent', { exact: true }).count());
  await navigate('/crm/leads'); await page.getByText('Assigned Agent', { exact: true }).first().waitFor(); record('Lead Assigned Agent column visible');
  await page.getByRole('button', { name: 'Create Lead', exact: true }).click();
  await page.getByText('Create New', { exact: true }).click();
  const leadForm = page.locator('form').last();
  await leadForm.getByRole('textbox', { name: /^First Name/ }).fill('NewQA');
  await leadForm.getByRole('textbox', { name: /^Last Name/ }).fill('Lead');
  await leadForm.getByRole('textbox', { name: /^Email/ }).fill('newqa-lead@example.test');
  assert.equal(await leadForm.getByRole('textbox', { name: 'Status', exact: true }).inputValue(), 'Inquiry');
  assert.equal(await leadForm.getByRole('textbox', { name: 'Status', exact: true }).evaluate(el => el.readOnly), true);
  await leadForm.locator('button[type="submit"]').click();
  await page.getByText('NewQA Lead', { exact: true }).first().waitFor();
  assert.equal((await prisma.lead.findFirstOrThrow({ where: { tenantId: tenant.id, email: 'newqa-lead@example.test' } })).status, 'Inquiry');
  record('Manual Lead creation displays and persists Inquiry');

  await navigate('/crm/accounts'); await page.getByRole('button', { name: 'Add Account', exact: true }).click();
  await page.getByText('Create New', { exact: true }).click();
  const accountForm = page.locator('form').last();
  for (const label of ['Assigned Agent', 'Product Interest', 'Active Products', 'Products & Interests']) assert.equal(await accountForm.getByText(label, { exact: true }).count(), 0, `${label} is retired from Account creation`);
  assert.equal(await accountForm.getByText('Internal Notes', { exact: true }).count(), 0);
  await responsive('account-create', accountForm);
  await accountForm.getByLabel('Account Name *').fill('NewQA Account'); await accountForm.locator('button[type="submit"]').click();
  await page.getByText('NewQA Account', { exact: true }).first().waitFor();
  assert.equal((await prisma.activity.findUniqueOrThrow({ where: { id: historicalNote.id } })).description, 'Historical note'); record('Account creation preserves migrated historical notes');
  for (const [module, name] of [['leads', 'QALead'], ['contacts', 'QAContact'], ['accounts', 'QAAccount'], ['deals', 'QADeal']]) {
    await navigate(`/crm/${module}`); await page.getByText(module === 'leads' ? `${name} Tester` : name, { exact: true }).first().click();
    const scroll = page.locator('[data-record-scroll]'); await scroll.waitFor();
    await scroll.evaluate(el => { el.scrollTop = el.scrollHeight; });
    const browserY = await page.evaluate(() => scrollY);
    assert.equal(await scroll.getByRole('button', { name: 'Log an activity' }).count(), 0);
    const note = scroll.getByPlaceholder('Write a note...');
    await note.scrollIntoViewIfNeeded(); await note.focus();
    await page.waitForTimeout(600);
    assert.ok(await scroll.evaluate(el => el.scrollTop < 100)); assert.equal(await page.evaluate(() => scrollY), browserY);
    await note.waitFor(); record(`${module} Notes focus scroll stays in panel`);
    assert.ok(await scroll.evaluate(el => el.contains(document.activeElement)));
    if (module === 'deals') {
      await page.getByRole('tab', { name: /Details/ }).click();
      const toggle = page.getByRole('button', { name: 'Closed Won Requirements', exact: true });
      await toggle.click(); assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
      await toggle.click(); assert.equal(await toggle.getAttribute('aria-expanded'), 'true'); record('Closed Won collapse');
    }
  }
  // Table/card Edit opens the existing Details panel. Exercise real writes, cancel and retained failed input.
  for (const [module, name, id, field] of [['leads', 'QALead', lead.id, 'Lead Address'], ['contacts', 'QAContact', contact.id, 'Contact Address'], ['accounts', 'QAAccount', account.id, 'Company Address'], ['deals', 'QADeal', deal.id, 'Deal Address (override)']]) {
    await navigate(`/crm/${module}`);
    if (module === 'deals') {
      await page.getByRole('button', { name: 'Actions for ' + name, exact: true }).click();
      await page.getByRole('menuitem', { name: /^Edit deal/ }).click();
    } else {
      const row = page.getByRole('row').filter({ has: page.getByText(module === 'leads' ? name + ' Tester' : name, { exact: true }) });
      await row.getByRole('button', { name: 'Row actions', exact: true }).click();
      await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
    }
    const panel = page.getByRole('dialog');
    await panel.getByRole('tab', { name: /Details/ }).waitFor();
    assert.equal(await panel.getByRole('tab', { name: /Details/ }).getAttribute('aria-selected'), 'true');
    await panel.getByRole('button', { name: 'Edit ' + field, exact: true }).click();
    const input = panel.getByLabel(field, { exact: true });
    await input.fill('Discard this address'); await input.press('Escape');
    await panel.getByRole('button', { name: 'Edit ' + field, exact: true }).click();
    assert.notEqual(await input.inputValue(), 'Discard this address');
    const address = `Saved ${module} address`;
    await input.fill(address);
    if (module === 'leads') {
      await page.route(`**/api/proxy/crm/${module}/${id}`, route => route.request().method() === 'PUT' ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'Disposable save failure' }) }) : route.fallback(), { times: 1 });
      await panel.getByRole('button', { name: 'Save', exact: true }).click();
      await panel.getByRole('alert').filter({ hasText: 'Disposable save failure' }).waitFor();
      assert.equal(await input.inputValue(), address);
      assert.notEqual((await prisma.lead.findUniqueOrThrow({ where: { id } })).address, address);
    }
    await panel.getByRole('button', { name: 'Save', exact: true }).click();
    await panel.getByRole('button', { name: 'Edit ' + field, exact: true }).waitFor();
    const delegate = module === 'leads' ? prisma.lead : module === 'contacts' ? prisma.contact : module === 'accounts' ? prisma.account : prisma.deal;
    assert.equal((await delegate.findUniqueOrThrow({ where: { id } })).address, address);
    await responsive(module + '-details', panel);
    await panel.getByRole('button', { name: 'Close record', exact: true }).click();
    record(module + ' Edit opens Details; inline save/cancel and committed response persist');
  }
  const salesRole = await prisma.roleDefinition.create({ data: { tenantId: tenant.id, name: 'Sales Agent', crmAssignmentRestricted: true } });
  await prisma.rolePermission.createMany({ data: ['leads', 'contacts', 'deals', 'products'].map(module => ({ tenantId: tenant.id, roleId: salesRole.id, module, canView: true, canViewMy: true, canCreate: true, canEdit: true })) });
  const salesUser = await prisma.user.create({ data: { tenantId: tenant.id, firstName: 'Sales', lastName: 'Agent', email: 'sales-self-creation@camxian.com', role: 'Sales Agent', status: 'ACTIVE', mustChangePassword: false, onboardingCompletedAt: new Date(), userRoles: { create: { roleId: salesRole.id } } } });
  const salesToken = (await issueAuthSession(salesUser)).token;
  await context.clearCookies(); await context.addCookies([{ name: 'leadcrm_token', value: salesToken, url: base, httpOnly: true, sameSite: 'Lax' }]); activeToken = salesToken;
  for (const [module, label] of [['leads', 'Lead'], ['contacts', 'Contact']]) {
    await navigate('/crm/' + module);
    await page.getByRole('button', { name: 'Create ' + label, exact: true }).click();
    const createNew = page.getByText('Create New', { exact: true });
    if (await createNew.isVisible()) await createNew.click();
    const form = page.locator('form').last();
    const assignee = form.getByRole('textbox', { name: 'Assigned Agent', exact: true });
    assert.equal(await assignee.inputValue(), 'Sales Agent'); assert.equal(await assignee.evaluate(el => el.readOnly), true);
    assert.equal(await form.getByRole('combobox', { name: 'Assigned Agent', exact: true }).count(), 0);
    await form.getByRole('textbox', { name: /^First Name/ }).fill('Own');
    await form.getByRole('textbox', { name: /^Last Name/ }).fill(label);
    const email = `own-${module}@example.test`; await form.getByRole('textbox', { name: /^Email/ }).fill(email);
    await form.locator('button[type="submit"]').click();
    await page.getByText(email, { exact: true }).first().waitFor();
    const saved = await (module === 'leads' ? prisma.lead : prisma.contact).findFirstOrThrow({ where: { tenantId: tenant.id, email } });
    assert.equal(saved.assignedUserId, salesUser.id);
    record('Sales manual ' + label + ' displays own name read-only and persists own assignment');
  }
  await context.clearCookies(); await context.addCookies([{ name: 'leadcrm_token', value: token, url: base, httpOnly: true, sameSite: 'Lax' }]); activeToken = token;
  const { defaultContactForm } = require('../dist/shared/src/index.js');
  const config = defaultContactForm();
  const form = await prisma.marketingForm.create({ data: { tenantId: tenant.id, createdById: admin.id, name: 'QA published form', status: 'published', fields: config.fields, design: config.design, settings: config.settings, revision: 1, publishedRevision: 1, publishedVersion: 1, publishedConfig: config } });
  const submission = await prisma.formSubmission.create({ data: { tenantId: tenant.id, formId: form.id, leadId: lead.id, publishedVersion: 1, publishedConfig: config, email: 'stored@example.test', values: { firstName: 'Stored' } } });
  let historyRequests = 0;
  page.on('request', request => { if (request.url().includes('/submissions')) historyRequests++; });
  await navigate('/settings?tab=forms&formId=' + form.id);
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  await page.getByRole('heading', { name: 'Share Link', exact: true }).waitFor();
  assert.equal(await page.getByText('Submission History', { exact: true }).count(), 0);
  await responsive('forms-share', page.locator('fieldset'));
  await page.getByRole('main').getByRole('button', { name: 'Settings', exact: true }).click();
  await responsive('forms-settings', page.locator('fieldset'));
  assert.equal(historyRequests, 0); assert.ok(await prisma.formSubmission.findUnique({ where: { id: submission.id } }));
  record('Forms Settings/Share expand without fetching history; stored submission preserved');
  // Appearance preference updates use the existing event/store and respond to OS changes.
  await page.emulateMedia({ colorScheme: 'light' }); await setAcceptanceTheme(page, 'System');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForFunction(() => document.documentElement.dataset.appTheme === 'dark');
  await page.evaluate(() => { localStorage.setItem('app_accent_color', 'purple'); window.dispatchEvent(new Event('accentcolorchange')); });
  await page.reload();
  await page.waitForFunction(() => document.documentElement.dataset.appTheme === 'dark');
  assert.equal(await page.evaluate(() => localStorage.getItem('app_theme')), 'System');
  assert.equal(await page.evaluate(() => localStorage.getItem('app_accent_color')), 'purple');
  record('System responds to OS preference; theme/accent persist after reload');
  await page.emulateMedia({ colorScheme: 'light' }); await setAcceptanceTheme(page, 'Light');
  await navigate('/operations/taskboard'); await page.getByRole('button', { name: /Create task/i }).first().click();
  const due = page.getByLabel('Due date and time *'); const previousDue = await due.textContent(); await due.click();
  await page.getByLabel('Due minute').selectOption('17'); await page.getByRole('group', { name: 'Choose due date and time' }).getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.equal(await due.textContent(), previousDue); await due.click(); await page.getByLabel('Due minute').selectOption('23');
  await responsive('task-picker', page.getByRole('group', { name: 'Choose due date and time' }));
  await page.getByRole('button', { name: 'Done', exact: true }).click(); assert.match(await due.textContent(), /:23$/); record('Task Cancel and Done');
  await page.getByLabel('Title *').fill('QA task saved');
  await page.getByRole('button', { name: /^Assigned Agent/ }).click();
  await page.getByRole('dialog', { name: 'Select owner', exact: true }).getByLabel('QA Agent', { exact: true }).check();
  await page.getByLabel('Search owner', { exact: true }).press('Escape');
  await page.getByRole('button', { name: /Associate task to deal/ }).click();
  await page.getByRole('dialog', { name: 'Select deal', exact: true }).getByLabel('QADeal', { exact: true }).check();
  await page.getByLabel('Search deal', { exact: true }).press('Escape');
  await page.getByRole('button', { name: 'Create task', exact: true }).click();
  await page.getByText('QA task saved', { exact: true }).first().waitFor();
  assert.equal(await prisma.task.count({ where: { tenantId: tenant.id, title: 'QA task saved' } }), 1); record('Task creation persists');
  const campaignStatuses = ['Draft', 'Scheduled', 'Sending', 'Interrupted', 'Sent', 'Partially Sent', 'Delivered', 'Failed'];
  await prisma.campaign.createMany({ data: ['EMAIL', 'SMS'].flatMap(type => campaignStatuses.map(status => ({ tenantId: tenant.id, createdById: admin.id, name: `${type} filter fixture ${status}`, type, status: status.toUpperCase().replaceAll(' ', '_') }))) });
  await navigate('/marketing/campaigns');
  await page.getByLabel('Filter campaigns', { exact: true }).click();
  for (const type of ['Email', 'SMS']) {
    const typeFilter = page.getByRole('checkbox', { name: 'Filter by ' + type, exact: true });
    await typeFilter.check();
    for (const status of campaignStatuses) {
      const statusFilter = page.getByRole('checkbox', { name: 'Filter by ' + status, exact: true });
      await statusFilter.check();
      await page.getByRole('grid').getByText(`${type.toUpperCase()} filter fixture ${status}`, { exact: true }).waitFor();
      await page.waitForFunction(() => [...document.querySelectorAll('[role="row"]')].filter(row => row.textContent.includes('filter fixture')).length === 1);
      assert.equal(await page.getByRole('row').filter({ hasText: 'filter fixture' }).count(), 1);
      await statusFilter.uncheck();
      record(`${type} campaign ${status} filter returns the persisted outcome`);
    }
    await typeFilter.uncheck();
  }
  for (const unsupported of ['Active', 'Paused', 'Completed']) assert.equal(await page.getByRole('checkbox', { name: 'Filter by ' + unsupported, exact: true }).count(), 0);
  await page.getByText('16 total records', { exact: true }).waitFor();
  await page.getByLabel('Filter campaigns', { exact: true }).click();
  record('Clearing campaign filters restores the complete fixture list');
  await page.getByRole('button', { name: 'Create Campaign', exact: true }).first().click();
  assert.equal(await page.getByRole('button', { name: 'Multi', exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Email', exact: true }).waitFor(); await page.getByRole('button', { name: 'SMS', exact: true }).waitFor();
  await page.getByRole('button', { name: /New Audience|Create Audience|Add Audience|New$/ }).last().click();
  await page.getByRole('button', { name: '+ Add Condition', exact: true }).click();
  assert.equal(await page.getByText('Select a status.', { exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Create Audience', exact: true }).click(); await page.getByText('Enter a condition value.', { exact: true }).waitFor();
  await page.getByLabel('Condition 1 field', { exact: true }).selectOption({ label: 'Company Name' });
  const company = page.getByLabel('Condition 1 value', { exact: true });
  await company.fill('McDonalds');
  const audienceRoot = page.getByText('Create Target Audience', { exact: true }).locator('xpath=../..').locator('..');
  await audienceRoot.getByText('1 eligible recipient', { exact: true }).waitFor(); record('Company audience preview returns the matching Lead in the explicitly selected source');
  await responsive('audience-company', audienceRoot);
  await page.getByLabel('Condition 1 field', { exact: true }).selectOption({ label: 'Created' }); await page.getByLabel('Condition 1 operator', { exact: true }).selectOption('gte');
  await responsive('audience-date', audienceRoot);
  await page.getByLabel('Condition 1 field', { exact: true }).selectOption({ label: 'Product Interest' }); await responsive('audience-products', audienceRoot);
  await audienceRoot.getByRole('button', { name: 'Product Interest', exact: true }).click();
  const choices = page.getByRole('group', { name: 'Product interests', exact: true });
  await choices.getByRole('checkbox', { name: 'CCTV Acceptance' }).waitFor();
  await responsive('audience-product-options', choices);
  assert.equal(await page.getByText('Select a Product Interest.', { exact: true }).count(), 0);
  await choices.getByRole('checkbox', { name: 'CCTV Acceptance' }).check(); await choices.press('Escape');
  record('Product popup remains unvalidated while choosing and fits all eight widths in both themes');
  record('Audience validation, companies, and responsive layouts');
  await navigate('/settings?tab=custom-fields'); await page.getByLabel('Module', { exact: true }).selectOption('accounts');
  await page.getByRole('button', { name: 'Add Field', exact: true }).click();
  const group = page.getByRole('combobox', { name: /^Group/ }); assert.equal(await group.evaluate(el => el.tagName), 'SELECT');
  assert.equal(await page.getByLabel('Module', { exact: true }).last().inputValue(), '');
  await page.getByLabel('Module', { exact: true }).last().selectOption('accounts');
  await group.selectOption({ label: 'Basic Information' });
  assert.equal(await group.locator('option', { hasText: 'Closed Won Requirements' }).count(), 0);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('dialog', { name: 'Add Field', exact: true }).waitFor({ state: 'hidden' });
  await page.getByRole('main').getByLabel('Module', { exact: true }).selectOption('deals'); await page.getByRole('button', { name: 'Add Field', exact: true }).click();
  await page.getByLabel('Module', { exact: true }).last().selectOption('deals');
  await group.selectOption({ label: 'Closed Won Requirements' }); record('Module-aware group dropdown and explicit creation module');
  await context.clearCookies();
  await page.route('**/api/proxy/auth/me', route => route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'Unauthenticated' }) }));
  const resetToken = randomBytes(32).toString('hex');
  await prisma.passwordResetToken.create({ data: { userId: admin.id, email: admin.email, token: hashResetToken(resetToken), expires: new Date(Date.now() + 3600000) } });
  await navigate(`/reset-password?token=${resetToken}`);
  await page.getByLabel('New Password', { exact: true }).fill('StrongPassword2!'); await page.getByLabel('Confirm Password', { exact: true }).fill('Different3!');
  await page.getByText('Passwords do not match.', { exact: true }).waitFor(); assert.equal(await page.getByRole('button', { name: 'Reset Password', exact: true }).isDisabled(), true);
  await page.getByLabel('Confirm Password', { exact: true }).fill('StrongPassword2!'); assert.equal(await page.getByRole('button', { name: 'Reset Password', exact: true }).isEnabled(), true);
  await page.getByRole('progressbar', { name: 'Password requirements met' }).waitFor();
  assert.equal(await page.locator('[data-theme-container]').count(), 0);
  await responsive('reset-password', page.locator('form'), { allowUnscoped: true }); record('Shared password strength and confirmation; fixed public appearance under both theme preferences');
  await page.getByRole('button', { name: 'Reset Password', exact: true }).click(); await page.getByText('Password Updated', { exact: true }).waitFor();
  assert.equal(await prisma.passwordResetToken.count({ where: { token: hashResetToken(resetToken) } }), 0);
  assert.equal(await prisma.session.count({ where: { userId: admin.id } }), 0); record('Valid local reset token consumed and sessions revoked');
  const reset = value => page.request.post(`http://127.0.0.1:${api.address().port}/api/v1/auth/reset-password`, { data: { token: value, password: 'DifferentPassword3!' } });
  assert.equal((await reset(resetToken)).status(), 400);
  assert.equal((await reset(randomBytes(32).toString('hex'))).status(), 400);
  const expiredToken = randomBytes(32).toString('hex');
  await prisma.passwordResetToken.create({ data: { userId: admin.id, email: admin.email, token: hashResetToken(expiredToken), expires: new Date(Date.now() - 60000) } });
  assert.equal((await reset(expiredToken)).status(), 400);
  assert.equal(await prisma.passwordResetToken.count({ where: { token: hashResetToken(expiredToken) } }), 0); record('Reused, invalid, and expired reset tokens rejected');
  activeToken = undefined;
  await page.unroute('**/api/proxy/auth/me');
  await navigate('/login');
  const loginEmail = page.getByLabel('Email address', { exact: true }), loginPassword = page.getByLabel('Password', { exact: true });
  await loginEmail.fill(admin.email); await loginPassword.fill('IncorrectPassword2!');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await page.waitForFunction(() => document.getElementById('email')?.value === '' && document.getElementById('password')?.value === '');
  await loginEmail.fill(admin.email); await loginPassword.fill('StrongPassword2!');
  await page.route('**/api/proxy/auth/login', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'Temporary sign in failure' }) }), { times: 1 });
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Temporary sign in failure' }).waitFor();
  assert.equal(await loginEmail.inputValue(), admin.email); assert.equal(await loginPassword.inputValue(), 'StrongPassword2!');
  record('Invalid credentials clear both fields; recoverable server failure retains input');
  for (const rememberMe of [false, true]) {
    if (rememberMe) { await loginEmail.fill(admin.email); await loginPassword.fill('StrongPassword2!'); }
    await page.getByRole('checkbox', { name: 'Remember me', exact: true }).setChecked(rememberMe);
    const response = page.waitForResponse(r => r.url().endsWith('/api/proxy/auth/login') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    assert.equal((await response).status(), 200);
    await page.waitForURL(/\/dashboard/);
    const cookie = (await context.cookies(base)).find(cookie => cookie.name === 'leadcrm_token');
    assert.ok(cookie?.httpOnly); assert.equal(cookie.sameSite, 'Lax');
    if (rememberMe) assert.ok(cookie.expires > Date.now() / 1000 + 6.9 * 86400 && cookie.expires <= Date.now() / 1000 + 7 * 86400);
    else assert.equal(cookie.expires, -1);
    const session = await prisma.session.findFirstOrThrow({ where: { userId: admin.id, revokedAt: null }, orderBy: { createdAt: 'desc' } });
    assert.ok(+session.expiresAt <= Date.now() + 7 * 86400000);
    await page.reload();
    await page.getByRole('button', { name: 'User profile menu', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Log out', exact: true }).click();
    await page.waitForURL(/\/login/);
    assert.equal((await context.cookies(base)).some(cookie => cookie.name === 'leadcrm_token'), false);
    assert.ok((await prisma.session.findUniqueOrThrow({ where: { id: session.id } })).revokedAt);
    record(`Remember Me ${rememberMe}: cookie persistence, seven-day cap and real logout revocation`);
  }
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(transportErrors, []);
  writeFileSync(resolve(output, 'results.json'), JSON.stringify({ checks, pageErrors, transportErrors }, null, 2));
  console.log(`Browser acceptance passed: ${checks.length} checks.`);
} catch (error) {
  if (page) { await page.screenshot({ path: resolve(output, 'failure.png') }).catch(() => {}); writeFileSync(resolve(output, 'failure.txt'), await page.locator('body').innerText().catch(() => '')); }
  writeFileSync(resolve(output, 'results.json'), JSON.stringify({ checks, pageErrors, transportErrors, error: String(error) }, null, 2));
  throw error;
} finally {
  closing = true;
  await browser?.close(); frontend?.kill(); if (api) { api.closeAllConnections(); await new Promise(done => api.close(done)); }
  await prisma.$disconnect();
}
