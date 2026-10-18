// Local preview: render the production UI against intercepted API fixtures. SQL/RBAC are
// exercised separately by deal-association.integration.test.ts.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { createWriteStream, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { acceptancePort, createAcceptanceContext } from './verify-browser-matrix.mjs';

const require = createRequire(import.meta.url), root = resolve(import.meta.dirname, '../..');
const { chromium } = require('playwright'), shared = require(resolve(root, 'shared/src/index.js'));
const { qaEnvironment } = require('../../scripts/qa-environment.cjs');
const output = resolve(root, 'data/outputs/system-audit/deal-association'); mkdirSync(output, { recursive: true });
const port = await acceptancePort(), base = `http://127.0.0.1:${port}`;
const log = createWriteStream(resolve(output, 'browser-frontend.log'));
const server = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'start', '-p', String(port), '-H', '127.0.0.1'], {
  cwd: resolve(root, 'frontend'), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  env: qaEnvironment(root, { NODE_ENV: 'production', API_URL: 'https://leadcrm-association-fixture.example/api/v1' }),
});
server.stdout.pipe(log); server.stderr.pipe(log);
const now = new Date().toISOString(), tenantId = randomUUID();
const user = { id: randomUUID(), tenantId, email: 'preview@example.test', role: 'Client Admin', firstName: 'Preview', lastName: 'Admin', status: 'ACTIVE', tenantName: 'Deal Preview', tenantStatus: 'ACTIVE', onboardingStep: 3, onboardingCompletedAt: now, mustChangePassword: false, hasPassword: true, passwordChangedAt: now, groups: [] };
const product = { id: randomUUID(), name: 'CCTV installation and support', dealValue: 1234.56, active: true, createdAt: now, updatedAt: now };
const lead = { id: randomUUID(), tenantId, firstName: 'Nora', lastName: 'Lead', email: 'lead@example.test', status: 'Inquiry' };
const contact = { id: randomUUID(), tenantId, firstName: 'Maria', lastName: 'Contact', email: 'contact@example.test', status: 'INQUIRY' };
const pipeline = { id: randomUUID(), tenantId, name: 'Sales Pipeline', stages: [{ id: randomUUID(), name: 'Lead', order: 0, isDefault: true }] };
const initialDeal = { id: randomUUID(), tenantId, title: 'Existing Deal', pipelineId: pipeline.id, stageId: pipeline.stages[0].id, stage: pipeline.stages[0], pipeline, priority: 'MEDIUM', value: 1234.56, productInterestId: product.id, leadDeals: [{ leadId: lead.id, lead }], contactDeals: [], assignedUserId: user.id, createdAt: now };
const permissions = Object.fromEntries(['deals', 'leads', 'contacts', 'accounts', 'products', 'tasks', 'users', 'settings', 'dashboard', 'notifications'].map(module => [module, { ...shared.EMPTY_PERMISSION_FLAGS, canView: true, canCreate: true, canEdit: true }]));
const checks = []; let browser;

async function fits(page, label, width) {
  await page.waitForFunction(() => [...document.querySelectorAll('[role="dialog"]')].every(element => { const rect = element.getBoundingClientRect(); return rect.left >= -1 && rect.right <= innerWidth + 1; }));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `${label}: overflow at ${width}`);
  const fields = await page.locator('[role="dialog"] form select, [role="dialog"] form [role="combobox"]').all();
  for (const field of fields) {
    const box = await field.boundingBox();
    if (box) assert.ok(box.x >= -1 && box.x + box.width <= width + 1, `${label}: field overflow at ${width}`);
  }
  checks.push({ width, label });
}
async function choose(page, type) {
  await page.getByRole('combobox', { name: `Search ${type}s...`, exact: true }).click();
  await page.getByRole('combobox', { name: `Search ${type}s`, exact: true }).fill(type === 'lead' ? 'Nora' : 'Maria');
  await page.getByRole('option', { name: type === 'lead' ? /Nora Lead/ : /Maria Contact/ }).click();
}
try {
  for (let attempt = 0; attempt < 90; attempt++) { try { if ((await fetch(base + '/login')).ok) break; } catch {} await new Promise(done => setTimeout(done, 500)); }
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const width of [320, 375, 390, 430, 640, 768, 1024, 1440]) {
    const context = await createAcceptanceContext(browser, { viewport: { width, height: 960 }, reducedMotion: 'reduce' });
    const page = await context.newPage(); page.setDefaultTimeout(20000);
    const errors = [], writes = []; let deal = structuredClone(initialDeal);
    page.on('pageerror', error => errors.push(error.message));
    await context.route('**/api/proxy/**', async route => {
      const url = new URL(route.request().url()), path = url.pathname.replace('/api/proxy', ''), method = route.request().method();
      const json = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
      const list = data => json({ success: true, data, meta: { total: data.length, page: 1, limit: 100, hasMore: false } });
      if (path === '/auth/me') return json({ success: true, data: { user, session: { lastActiveAt: now, idleExpiresAt: new Date(Date.now() + 1800000).toISOString(), expiresAt: new Date(Date.now() + 86400000).toISOString(), serverNow: new Date().toISOString() } } });
      if (path.endsWith('/permissions')) return json({ success: true, data: permissions });
      if (path.endsWith('/events') || path.endsWith('record-events')) return route.fulfill({ contentType: 'text/event-stream', body: ': isolated UI preview\n\n' });
      if (path.startsWith('/preferences/table/')) return json({ success: true, data: { pageSize: 25, sort: { field: 'createdAt', direction: 'desc' }, conditions: [] } });
      if (path === '/crm/record-access') return json({ success: true, data: { userId: user.id, tenantId, clientAdmin: true, assignmentRestricted: false } });
      if (path === '/administration/product-interests') return json({ success: true, data: [product], meta: { enabled: true, categories: [] } });
      if (path === '/crm/pipelines') return json({ success: true, data: [pipeline] });
      if (path.endsWith('/field-layout')) return json({ success: true, data: { layout: shared.defaultFieldLayout('deals') } });
      if (path.endsWith('/custom-fields')) return json({ success: true, data: path.includes(deal.id) ? { fields: [], values: {}, files: [], layout: shared.defaultFieldLayout('deals') } : [] });
      if (path === '/crm/leads') return list([lead]);
      if (path === '/crm/contacts') return list([contact]);
      if (path === `/crm/leads/${lead.id}`) return json({ success: true, data: lead });
      if (path === `/crm/contacts/${contact.id}`) return json({ success: true, data: contact });
      if (path === '/crm/deals/batch') {
        const body = route.request().postDataJSON(); writes.push(body);
        assert.equal((body.leadIds?.length ?? 0) + (body.contactIds?.length ?? 0), 1);
        return json({ success: true, data: { deals: [{ ...deal, id: randomUUID(), title: body.title }], replayed: false } }, 201);
      }
      if (path === `/crm/deals/${deal.id}` && method === 'PUT') { const body = route.request().postDataJSON(); writes.push(body); return json({ success: true, data: deal }); }
      if (path === `/crm/deals/${deal.id}`) return json({ success: true, data: deal });
      if (path === '/crm/deals') return list([deal]);
      if (path.endsWith('/relationships')) return json({ success: true, data: { leads: [lead], contacts: [], deals: [], hasMoreDeals: false } });
      return list([]);
    });
    try {
      await page.goto(base + '/crm/deals');
      await page.getByRole('button', { name: 'New Deal', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'New Deal', exact: true });
      await dialog.getByLabel(/Associate Deal To/).waitFor();
      assert.equal(await dialog.getByRole('combobox', { name: /Search (leads|contacts)/ }).count(), 0);
      assert.equal(await dialog.getByText('Account', { exact: true }).count(), 0);
      assert.equal(await dialog.getByText('Assigned Agent', { exact: true }).count(), 0);
      await dialog.getByLabel(/Title/).fill('Responsive associated Deal');
      const titleBox = await dialog.getByLabel(/Title/).boundingBox();
      const productBox = await dialog.getByRole('button', { name: 'Product Interest', exact: true }).boundingBox();
      assert.ok(titleBox && productBox && productBox.y >= titleBox.y + titleBox.height, 'Product Interests stays below Title');
      await dialog.getByRole('button', { name: 'Product Interest', exact: true }).click();
      await page.getByRole('checkbox', { name: product.name }).check(); await page.keyboard.press('Escape');
      assert.equal(await dialog.getByRole('button', { name: 'Create Deal', exact: true }).isDisabled(), true);
      await dialog.getByLabel(/Associate Deal To/).selectOption('lead'); await choose(page, 'lead');
      await fits(page, 'Create with Lead', width);
      await dialog.getByLabel(/Associate Deal To/).selectOption('contact');
      assert.equal(await dialog.getByRole('combobox', { name: 'Search leads...', exact: true }).count(), 0);
      assert.equal(await dialog.getByRole('button', { name: 'Create Deal', exact: true }).isDisabled(), true);
      await choose(page, 'contact'); await fits(page, 'Create with Contact', width);
      await page.screenshot({ path: resolve(output, `create-${width}.png`), fullPage: true });
      await dialog.getByRole('button', { name: 'Create Deal', exact: true }).click();
      await dialog.waitFor({ state: 'hidden' }); assert.equal(writes.length, 1); assert.deepEqual(writes[0].contactIds, [contact.id]);
      await page.getByRole('button', { name: 'Actions for Existing Deal', exact: true }).click();
      await page.getByRole('menuitem', { name: 'Edit deal', exact: true }).click();
      const edit = page.getByRole('dialog', { name: 'Edit Deal', exact: true });
      assert.equal(await edit.getByLabel(/Associate Deal To/).inputValue(), 'lead');
      assert.equal(await edit.getByLabel('Value', { exact: true }).inputValue(), '1,234.56');
      assert.equal(await edit.getByLabel('Value', { exact: true }).evaluate(element => element.readOnly), true);
      await edit.getByRole('combobox', { name: 'Search leads...', exact: true }).getByText('Nora Lead').waitFor();
      await edit.getByLabel(/Associate Deal To/).selectOption('contact'); await choose(page, 'contact');
      await fits(page, 'Edit association', width); await page.screenshot({ path: resolve(output, `edit-${width}.png`), fullPage: true });
      await edit.getByRole('button', { name: 'Update Deal', exact: true }).click(); await edit.waitFor({ state: 'hidden' });
      assert.deepEqual(writes[1].primaryAssociation, { type: 'contact', id: contact.id, previous: { type: 'lead', id: lead.id } });
      for (const key of ['leadIds', 'contactIds', 'assignedUserId', 'accountId']) assert.equal(writes[1][key], undefined);
      assert.deepEqual(errors, []); console.log(`${width}px: Create, switching, Edit, payloads and overflow PASS`);
    } finally { await context.close(); }
  }
  writeFileSync(resolve(output, 'responsive.json'), JSON.stringify({ checks, success: true }, null, 2));
} finally { await browser?.close(); server.kill(); log.end(); }
