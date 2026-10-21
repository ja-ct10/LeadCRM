// Real UI, authenticated API and disposable PostgreSQL; no configured application database or providers.
import { acceptancePort, createAcceptanceContext, setAcceptanceTheme } from './verify-browser-matrix.mjs';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { createWriteStream, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const root = resolve(import.meta.dirname, '../..');
const output = process.env.LEADCRM_BROWSER_OUTPUT;
assert.ok(output, 'Run through the isolated browser QA coordinator.');
const database = new URL(process.env.DATABASE_URL);
assert.equal(database.hostname, '127.0.0.1');
assert.equal(database.pathname, '/leadcrm_forms_test_2');
mkdirSync(output, { recursive: true });
const base = `http://localhost:${await acceptancePort()}`;
Object.assign(process.env, { NODE_ENV: 'test', JWT_SECRET: randomBytes(32).toString('hex'), ENCRYPTION_KEY: randomBytes(32).toString('hex'), APP_URL: base, ALLOWED_ORIGINS: base, DIRECT_URL: process.env.DATABASE_URL });
const require = createRequire(import.meta.url);
const Module = require('node:module'), originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  return request === '@leadcrm/shared' ? resolve(root, 'backend/dist/shared/src/index.js') : originalResolve.call(this, request, parent, isMain, options);
};
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const prisma = require('../dist/backend/src/config/database.config.js').default;
const app = require('../dist/backend/src/app.js').default;
const { issueAuthSession } = require('../dist/backend/src/core/auth/auth-session.js');
const checks = [], errors = [], colors = [];
let api, frontend, browser, page;
let holdTaskReads = false, rejectTaskSave = false, heldReads = [];

try {
  const tenantId = (await prisma.tenant.create({ data: { name: 'CRM stability fixture', slug: randomUUID(), status: 'ACTIVE', onboardingStep: 3, onboardingCompletedAt: new Date() } })).id;
  const admin = await prisma.user.create({ data: { tenantId, firstName: 'Stability', lastName: 'Admin', email: `${randomUUID()}@camxian.com`, role: 'Client Admin', status: 'ACTIVE', mustChangePassword: false, onboardingCompletedAt: new Date() } });
  const taskRole = await prisma.roleDefinition.create({ data: { tenantId, name: 'Stability task staff', permissions: { create: { module: 'tasks', canView: true } } } });
  const assignee = await prisma.user.create({ data: { tenantId, firstName: 'Task', lastName: 'Staff', email: `${randomUUID()}@camxian.com`, role: taskRole.name, status: 'ACTIVE', mustChangePassword: false, onboardingCompletedAt: new Date(), userRoles: { create: { roleId: taskRole.id } } } });
  const token = (await issueAuthSession(admin)).token;
  const statuses = ['Inquiry', 'Hot', 'Warm', 'Cold', 'Closed Deal', 'Cancelled'];
  const people = [];
  for (const module of ['leads', 'contacts']) for (const status of statuses) {
    const person = await prisma[module === 'leads' ? 'lead' : 'contact'].create({ data: {
      tenantId, assignedUserId: admin.id, firstName: `Stability${status.replaceAll(' ', '')}`, lastName: module,
      email: `${randomUUID()}@example.test`, status: module === 'contacts' ? status.toUpperCase().replaceAll(' ', '_') : status,
    } });
    people.push({ ...person, module, label: status });
  }
  const product = await prisma.productInterest.create({ data: { tenantId, name: 'Stability Product', dealValue: 15000 } });
  const pipeline = await prisma.pipeline.create({ data: { tenantId, name: 'Sales Pipeline' } });
  const stage = await prisma.stage.create({ data: { tenantId, pipelineId: pipeline.id, name: 'Lead', order: 0, isDefault: true } });
  await prisma.stage.createMany({ data: [
    { tenantId, pipelineId: pipeline.id, name: 'Qualified', order: 1 },
    { tenantId, pipelineId: pipeline.id, name: 'Closed Deal', order: 2, isWon: true },
    { tenantId, pipelineId: pipeline.id, name: 'Cancelled', order: 3, isLost: true },
  ] });
  const deal = await prisma.deal.create({ data: { tenantId, title: 'Stability Opportunity', pipelineId: pipeline.id, stageId: stage.id, assignedUserId: admin.id, ownerId: admin.id, productInterestId: product.id, productInterestIds: [product.id], productsNormalized: true, value: 15000 } });
  await prisma.leadDeal.create({ data: { tenantId, leadId: people[0].id, dealId: deal.id, addedById: admin.id } });
  api = app.listen(0, '127.0.0.1');
  await new Promise(done => api.once('listening', done));
  const apiBase = `http://127.0.0.1:${api.address().port}/api/v1`;
  async function call(path, method = 'GET', body, expected = 200) {
    const response = await fetch(apiBase + path, { method, headers: { authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    assert.equal(response.status, expected, `${method} ${path}: ${await response.clone().text()}`);
    return response.json();
  }
  const task = (await call('/operations/tasks', 'POST', { title: 'Stable Task', description: 'Saved notes', priority: 'Medium', status: 'pending', assignedUserId: assignee.id, dueDate: '2099-01-01T00:00:00.000Z', dealIds: [deal.id], requestId: randomUUID() }, 201)).data;
  const log = createWriteStream(resolve(output, 'frontend.log'));
  frontend = spawn(process.execPath, [resolve(root, 'node_modules/next/dist/bin/next'), 'start', '-p', new URL(base).port, '-H', '127.0.0.1'], { cwd: resolve(root, 'frontend'), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NODE_ENV: 'production', API_URL: 'https://leadcrm-build.example/api/v1', NEXT_PUBLIC_USE_MOCK_AUTH: 'false', NEXT_PUBLIC_USE_MOCK_DATA: 'false' } });
  frontend.stdout.pipe(log); frontend.stderr.pipe(log);
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch(base + '/login')).ok) { ready = true; break; } } catch { /* Server startup only. */ }
    await new Promise(done => setTimeout(done, 500));
  }
  assert.ok(ready, 'Local frontend did not start.');
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await createAcceptanceContext(browser, { viewport: { width: 1440, height: 900 } });
  await context.addCookies([{ name: 'leadcrm_token', value: token, url: base, httpOnly: true, sameSite: 'Lax' }]);
  await context.addInitScript(() => {
    const NativeEventSource = window.EventSource;
    window.__crmStreams = [];
    window.EventSource = class extends NativeEventSource {
      constructor(url, options) { super(url, options); window.__crmStreams.push({ url: String(url), source: this }); }
    };
  });
  page = await context.newPage();
  page.setDefaultTimeout(30000); page.setDefaultNavigationTimeout(120000);
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/proxy/**', async route => {
    const request = route.request(), url = new URL(request.url());
    const path = url.pathname.replace('/api/proxy', ''), local = apiBase + path + url.search;
    const headers = { ...request.headers(), authorization: `Bearer ${token}` };
    if (path.endsWith('/events') || path === '/crm/record-events') return route.continue({ url: local, headers });
    if (holdTaskReads && request.method() === 'GET' && path.startsWith('/operations/tasks')) await new Promise(done => heldReads.push(done));
    if (rejectTaskSave && request.method() === 'PUT' && path === `/operations/tasks/${task.id}`) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Recoverable fixture error' }) });
    try {
      const response = await page.request.fetch(local, { method: request.method(), headers, data: request.postDataBuffer() ?? undefined });
      await route.fulfill({ response });
    } catch { await route.abort().catch(() => {}); }
  });
  const revision = async value => page.evaluate(value => {
    const current = window.__crmStreams.findLast(entry => entry.url.endsWith('/crm/record-events'));
    if (!current) throw Error('CRM stream missing');
    current.source.dispatchEvent(new MessageEvent('crm-change', { data: JSON.stringify({ content: value }) }));
  }, value);

  await page.goto(`${base}/operations/taskboard?taskId=${task.id}`);
  await page.getByRole('button', { name: 'Task actions', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Edit task', exact: true }).click();
  await page.getByRole('button', { name: 'Edit Title', exact: true }).click();
  const title = page.getByRole('textbox', { name: 'Title', exact: true });
  await title.fill('Preserved task draft');
  holdTaskReads = true;
  await revision('draft-refresh');
  await page.waitForFunction(() => document.querySelector('[aria-label="Refresh tasks"]')?.disabled);
  assert.equal(await title.inputValue(), 'Preserved task draft');
  assert.equal(await page.getByRole('status', { name: /Refreshing/ }).count(), 0);
  holdTaskReads = false; heldReads.splice(0).forEach(done => done());
  rejectTaskSave = true;
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Recoverable fixture error' }).waitFor();
  assert.equal(await title.inputValue(), 'Preserved task draft');
  assert.equal((await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).title, 'Stable Task');
  rejectTaskSave = false;
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('heading', { name: 'Preserved task draft', exact: true }).waitFor();
  assert.equal((await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).title, 'Preserved task draft');
  assert.equal(await prisma.taskDeal.count({ where: { tenantId, taskId: task.id, dealId: deal.id } }), 1);
  checks.push('Real Task editor retains its draft during delayed revisions and failed save, then persists the retry with its Deal link.');

  await page.goto(`${base}/crm/deals`);
  for (let repetition = 0; repetition < 3; repetition++) {
    await page.getByRole('button', { name: `Actions for ${deal.title}`, exact: true }).click();
    const menu = page.getByRole('menu');
    await menu.getByRole('menuitem', { name: 'Send an email', exact: true }).waitFor();
    await menu.evaluate(async element => { await Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => {}))); });
    const bounds = await menu.boundingBox();
    for (const item of await menu.getByRole('menuitem').all()) {
      assert.equal(await item.locator('span span').count(), 0, 'No secondary descriptions');
      await item.hover({ force: true });
      const next = await menu.boundingBox();
      assert.ok(Math.abs(next.height - bounds.height) <= 1 && Math.abs(next.y - bounds.y) <= 1, 'Menu geometry changed');
    }
    await page.keyboard.press('Escape');
  }
  checks.push('Deal menu stays label-only and stable across repeated opens and hover.');

  const action = async label => {
    await page.getByRole('button', { name: `Actions for ${deal.title}`, exact: true }).click();
    await page.getByRole('menuitem', { name: label, exact: true }).click();
  };
  await action('Edit deal');
  await page.getByRole('button', { name: 'Edit Title', exact: true }).click();
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Edited Opportunity');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('dialog').getByRole('heading', { name: 'Edited Opportunity', exact: true }).waitFor();
  assert.equal((await prisma.deal.findUniqueOrThrow({ where: { id: deal.id } })).title, 'Edited Opportunity');
  deal.title = 'Edited Opportunity';
  await page.getByRole('button', { name: 'Close record', exact: true }).click();
  await action('Add a task');
  await page.getByRole('heading', { name: 'Create task', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await action('Add a note');
  await page.getByRole('textbox', { name: 'Note', exact: true }).fill('Persistent menu note');
  const noteResponse = page.waitForResponse(response => response.url().endsWith('/api/proxy/crm/activities') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Save note', exact: true }).click();
  const committedNote = await noteResponse;
  assert.equal(committedNote.status(), 201);
  const noteId = (await committedNote.json()).data.id;
  assert.equal((await prisma.activity.findUniqueOrThrow({ where: { id: noteId } })).dealId, deal.id);
  await page.getByRole('region', { name: 'Notes', exact: true }).getByText('Persistent menu note', { exact: true }).waitFor();
  assert.equal(await prisma.activity.count({ where: { tenantId, dealId: deal.id, type: 'note', title: 'Persistent menu note' } }), 1);
  await page.getByRole('button', { name: 'Close record', exact: true }).click();
  await action('Send an email');
  await page.waitForURL(url => url.pathname === '/inbox');
  assert.ok(page.url().includes(encodeURIComponent(people[0].email)));
  checks.push('Edit Deal persists and synchronizes its card; Add Task opens; Add Note persists once; Send Email opens the existing composer.');

  const account = await prisma.account.create({ data: { tenantId, name: 'Shared Account' } });
  for (const record of [people[1], people[7], { ...account, module: 'accounts' }]) {
    await page.goto(`${base}/crm/${record.module}/${record.id}`);
    await page.getByRole('tab', { name: /^Details/ }).click();
    const field = record.module === 'accounts' ? /Account name/i : /Last name/i;
    await page.getByRole('button', { name: record.module === 'accounts' ? /Edit Account name/i : /Edit Last name/i }).click();
    const input = page.getByRole('textbox', { name: field });
    await input.fill('Saved together');
    const read = page.waitForResponse(response => response.url().includes(`/crm/${record.module}/${record.id}`) && response.request().method() === 'GET');
    await revision(`edit-${record.module}`); await read;
    assert.equal(await input.inputValue(), 'Saved together');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await input.waitFor({ state: 'hidden' });
    const saved = await prisma[record.module === 'leads' ? 'lead' : record.module === 'contacts' ? 'contact' : 'account'].findUniqueOrThrow({ where: { id: record.id } });
    assert.equal(record.module === 'accounts' ? saved.name : saved.lastName, 'Saved together');
    if (record.module !== 'accounts') {
      await page.getByRole('button', { name: 'Hot', exact: true }).click();
      await page.getByRole('menuitem', { name: 'Cold', exact: true }).click();
      await page.getByRole('button', { name: 'Cold', exact: true }).waitFor();
      const canonical = await call(`/crm/${record.module}/${record.id}`);
      assert.equal(canonical.data.status, 'Cold');
      await page.getByRole('button', { name: 'Cold', exact: true }).click();
      await page.getByRole('menuitem', { name: 'Hot', exact: true }).click();
      await page.getByRole('button', { name: 'Hot', exact: true }).waitFor();
    }
  }
  checks.push('Lead, Contact and Account field drafts survive revisions and save; permitted status changes persist through the shared profile header.');

  const accents = ['blue', 'teal', 'green', 'orange', 'red', 'purple', 'indigo'];
  const themes = [['Classic', 'light'], ['Light', 'light'], ['Dark', 'dark'], ['System', 'light'], ['System', 'dark']];
  for (const person of people) for (const surface of ['full', 'panel']) {
    await page.goto(surface === 'full' ? `${base}/crm/${person.module}/${person.id}` : `${base}/crm/${person.module}?highlight=${person.id}`);
    if (surface === 'panel') await page.locator(`[data-row-id="${person.id}"]`).click();
    const badge = page.getByRole('button', { name: person.label, exact: true });
    await badge.waitFor();
    for (const [theme, colorScheme] of themes) for (const accent of accents) {
      await page.emulateMedia({ colorScheme });
      await page.evaluate(accent => { localStorage.setItem('app_accent_color', accent); window.dispatchEvent(new Event('accentcolorchange')); }, accent);
      await setAcceptanceTheme(page, theme);
      await page.mouse.move(0, 0); await badge.evaluate(element => element.blur());
      await badge.evaluate(async element => { await Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => {}))); });
      const sample = () => badge.evaluate(element => {
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
        const context = canvas.getContext('2d');
        const rgba = color => { context.clearRect(0, 0, 1, 1); context.fillStyle = color; context.fillRect(0, 0, 1, 1); return [...context.getImageData(0, 0, 1, 1).data]; };
        const ancestors = []; for (let node = element; node; node = node.parentElement) ancestors.unshift(node);
        let background = [255, 255, 255];
        for (const ancestor of ancestors) { const color = rgba(getComputedStyle(ancestor).backgroundColor), alpha = color[3] / 255; background = background.map((channel, index) => color[index] * alpha + channel * (1 - alpha)); }
        const style = getComputedStyle(element), foreground = rgba(style.color);
        const luminance = rgb => rgb.slice(0, 3).map(channel => { const value = channel / 255; return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4; }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
        const a = luminance(foreground), b = luminance(background);
        return { background: style.backgroundColor, color: style.color, contrast: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) };
      });
      const normal = await sample();
      assert.ok(normal.contrast >= 4.5, `${person.module}/${person.label}/${surface}/${theme}/${accent}: contrast ${normal.contrast}`);
      for (const interaction of ['hover', 'focus', 'active']) {
        if (interaction === 'hover') await badge.hover();
        if (interaction === 'focus') {
          await page.mouse.move(0, 0); await badge.focus();
          await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab');
          assert.equal(await badge.evaluate(element => element === document.activeElement), true);
        }
        if (interaction === 'active') { await badge.hover(); await page.mouse.down(); }
        const current = await sample();
        assert.equal(current.background, normal.background, `${person.label} ${interaction} background changed`);
        assert.equal(current.color, normal.color, `${person.label} ${interaction} text changed`);
        if (interaction === 'active') { await page.mouse.up(); await page.keyboard.press('Escape'); }
      }
      colors.push({ module: person.module, status: person.label, surface, theme, colorScheme, accent, ...normal });
    }
  }
  checks.push(`All status interactions and contrast passed for ${colors.length} combinations of records, profile surfaces, themes and accents.`);
  await page.screenshot({ path: resolve(output, 'status-dark-panel.png') });
  assert.deepEqual(errors, []);
  writeFileSync(resolve(output, 'results.json'), JSON.stringify({ checks, colors, errors }, null, 2));
  console.log(JSON.stringify({ checks, appearanceCombinations: colors.length }));
} catch (error) {
  process.exitCode = 1;
  await page?.screenshot({ path: resolve(output, 'failure.png') }).catch(() => {});
  writeFileSync(resolve(output, 'results.json'), JSON.stringify({ checks, colors, errors, error: String(error) }, null, 2));
  throw error;
} finally {
  holdTaskReads = false; heldReads.splice(0).forEach(done => done());
  await browser?.close(); frontend?.kill();
  if (api) { api.closeAllConnections(); await new Promise(done => api.close(done)); }
  await prisma.$disconnect();
}
