// Rendered frontend checks with isolated API fixtures. Database behavior is tested
// separately by test-forms-disposable.mjs; this preview never uses a backend.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createWriteStream, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { acceptancePort } from './verify-browser-matrix.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const shared = require('../../shared/src/index.js');
const root = resolve(import.meta.dirname, '../..');
const output = resolve(root, 'data/outputs/system-audit/form-product-categories');
mkdirSync(output, { recursive: true });
const port = await acceptancePort(), base = `http://127.0.0.1:${port}`;
const log = createWriteStream(resolve(output, 'frontend.log'));
const frontend = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'start', '-p', String(port), '-H', '127.0.0.1'], {
  cwd: resolve(root, 'frontend'), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1', API_URL: 'https://leadcrm-browser-fixture.example/api/v1' },
});
frontend.stdout.pipe(log); frontend.stderr.pipe(log);
const now = new Date().toISOString();
const products = Array.from({ length: 10 }, (_, index) => ({
  id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  name: index === 0 ? 'Smart Lock' : index === 1 ? 'Network Router' : index === 2 ? 'Legacy product' : `Security product ${index} with a long label for responsive checkbox wrapping`,
  category: index === 1 ? 'Networking' : index === 2 ? '' : 'Security',
  dealValue: 100, active: true, createdAt: now, updatedAt: now,
}));
let categories = ['Security', 'Networking', 'Empty category', 'A newly configured category with a long descriptive name'];
const form = { ...shared.defaultContactForm('Product category preview'), id: 'fixture-form', publicId: 'fixture-public', tenantId: 'fixture-tenant', status: 'published', revision: 0, publishedRevision: 0, publishedVersion: 1, createdAt: now, updatedAt: now };
form.fields = shared.withProductOptions(form.fields, products);
const user = { id: 'fixture-user', tenantId: form.tenantId, email: 'fixture@camxian.com', role: 'Client Admin', firstName: 'Forms', lastName: 'Preview', status: 'ACTIVE', tenantName: 'Forms preview', tenantStatus: 'ACTIVE', onboardingStep: 3, onboardingCompletedAt: now, mustChangePassword: false, hasPassword: true, passwordChangedAt: now, currency: 'PHP', groups: [], avatarUrl: null };
const permissions = Object.fromEntries(['leads', 'contacts', 'accounts', 'deals', 'products', 'settings', 'users', 'groups', 'roles', 'custom_fields', 'archived_data', 'tasks', 'forms', 'notifications', 'dashboard', 'reporting'].map(module => [module, Object.fromEntries(['canView', 'canCreate', 'canEdit', 'canDelete', 'canPublish', 'canDuplicate', 'canArchive', 'canActivate', 'canViewClosedWon'].map(flag => [flag, true]))]));
const assertions = [], pageErrors = [], submissions = [];
let browser;
function record(label, width, surface) { assertions.push({ label, width, surface, passed: true }); }
async function fixture(width, authenticated, legacy = false) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
  let catalogRequests = 0;
  await context.route('**/api/proxy/**', route => {
    const path = new URL(route.request().url()).pathname.replace('/api/proxy', '');
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (path === '/auth/me') return authenticated ? json({ success: true, data: { user, session: { lastActiveAt: now, idleExpiresAt: new Date(Date.now() + 1800000).toISOString(), expiresAt: new Date(Date.now() + 86400000).toISOString(), serverNow: now } } }) : json({ error: 'Authentication required' }, 401);
    if (path.endsWith('/permissions')) return json({ success: true, data: permissions });
    if (path.endsWith('/events') || path.endsWith('record-events')) return route.fulfill({ contentType: 'text/event-stream', body: ': fixture\n\n' });
    if (path === '/administration/product-interests') { catalogRequests++; return json({ success: true, data: products, meta: { enabled: true, categories } }); }
    if (path === '/marketing/forms/field-catalog') return json({ success: true, data: shared.getCrmFieldCatalog('leads') });
    if (path === '/marketing/forms/fixture-form') return json({ success: true, data: form });
    if (path === '/marketing/forms') return json({ success: true, data: [form], meta: { hasMore: false } });
    if (path === '/public/forms/fixture-public/submissions') { submissions.push(route.request().postDataJSON()); return json({ success: true, data: { accepted: true } }); }
    if (path === '/public/forms/fixture-public') return json({ success: true, data: { name: form.name, fields: form.fields, design: form.design, version: 1, trackUrlParams: false, ...(legacy ? {} : { productCatalog: { categories, products: products.map(({ id, name, category }) => ({ id, name, category })) } }) } });
    if (path.startsWith('/preferences/table/')) return json({ success: true, data: { pageSize: 25, viewMode: 'wrap', conditions: [] } });
    if (path === '/crm/record-access') return json({ success: true, data: { userId: user.id, tenantId: user.tenantId, clientAdmin: true, assignmentRestricted: false } });
    return json({ success: true, data: [], meta: { page: 1, limit: 25, total: 0, hasMore: false, totalPages: 0 }, unreadCount: 0, totalCount: 0 });
  });
  const page = await context.newPage();
  page.on('pageerror', error => pageErrors.push(error.message));
  page.setDefaultTimeout(20000);
  return { context, page, catalogRequests: () => catalogRequests };
}
async function fits(page, width, surface) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `${surface} horizontal overflow at ${width}`);
  const category = page.getByRole('combobox', { name: 'Product category filter', exact: true });
  assert.equal(await category.evaluate(element => { const box = element.getBoundingClientRect(); return box.width > 0 && box.left >= 0 && box.right <= innerWidth + 1; }), true);
  record('Category and page fit the viewport', width, surface);
}
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { if ((await fetch(base + '/login')).ok) { ready = true; break; } } catch {}
    await new Promise(done => setTimeout(done, 500));
  }
  assert.ok(ready, 'Production frontend did not start');
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const width of [320, 375, 390, 430, 768, 1024, 1440]) {
    for (const surface of ['builder', 'public']) {
      const current = await fixture(width, surface === 'builder');
      const { page } = current;
      try {
        await page.goto(base + (surface === 'builder' ? '/settings?tab=forms&formId=fixture-form' : '/forms/fixture-public'));
        const category = page.getByRole('combobox', { name: 'Product category filter', exact: true });
        await category.waitFor();
        assert.equal(await category.inputValue(), '');
        assert.equal(await category.locator('option').count(), categories.length + 1);
        assert.equal(await category.locator('option').filter({ hasText: /^Uncategorized$/ }).count(), 0);
        const list = page.getByRole('group', { name: 'Product Interest', exact: true });
        assert.equal(await list.getByRole('checkbox').count(), products.length);
        assert.equal(await list.evaluate(element => element.scrollHeight > element.clientHeight), true);
        assert.equal(await category.evaluate(element => !!(element.compareDocumentPosition(document.getElementById('input-productInterest')) & Node.DOCUMENT_POSITION_FOLLOWING)), true);
        record('Default categories, list order, legacy products, and scrollable list', width, surface);
        if (surface === 'public') {
          await page.getByLabel('First Name', { exact: false }).fill('Browser');
          await page.getByLabel('Last Name', { exact: false }).fill('Visitor');
          await page.getByLabel('Email Address', { exact: false }).fill('browser@example.com');
          await page.getByRole('button', { name: 'Submit', exact: true }).click();
          assert.equal(await list.getAttribute('aria-invalid'), 'true');
          await list.focus();
          assert.equal(await list.evaluate(element => element === document.activeElement), true);
          record('Required Product Interest validation and focus', width, surface);
        }
        await category.focus();
        await page.keyboard.press('Tab');
        assert.equal(await list.getByRole('checkbox').first().evaluate(element => element === document.activeElement), true);
        await page.keyboard.press('Space');
        assert.equal(await page.getByRole('checkbox', { name: 'Smart Lock', exact: true }).isChecked(), true);
        await category.selectOption('Networking');
        assert.equal(await list.getByRole('checkbox').count(), 1);
        assert.equal(await page.getByRole('checkbox', { name: 'Smart Lock', exact: true }).count(), 0);
        await page.getByRole('checkbox', { name: 'Network Router', exact: true }).check();
        await category.selectOption('Empty category');
        assert.equal(await list.getByRole('checkbox').count(), 0);
        await category.selectOption('');
        assert.equal(await list.getByRole('checkbox').count(), products.length);
        assert.equal(await page.getByRole('checkbox', { name: 'Smart Lock', exact: true }).isChecked(), true);
        assert.equal(await page.getByRole('checkbox', { name: 'Network Router', exact: true }).isChecked(), true);
        record('Category changes, hidden selections, and All categories restoration', width, surface);
        await fits(page, width, surface);
        await category.scrollIntoViewIfNeeded();
        await page.screenshot({ path: resolve(output, `${surface}-${width}.png`), fullPage: true });
        if (surface === 'builder') {
          assert.equal(await page.getByText('Unsaved changes', { exact: true }).count(), 0);
          assert.equal(await page.getByRole('button', { name: 'Save draft', exact: true }).isDisabled(), true);
          await page.getByLabel('Edit Product Interest', { exact: true }).click();
          await page.getByText('Options are managed in Settings → Products.', { exact: true }).waitFor();
          assert.equal(await page.getByLabel('Drag Product Interest', { exact: true }).count(), 1);
          assert.equal(await page.getByLabel('Remove Product Interest', { exact: true }).count(), 1);
          record('Preview leaves configuration clean and keeps field controls', width, surface);
        } else {
          await category.selectOption('Networking');
          await page.getByRole('checkbox', { name: 'Network Router', exact: true }).uncheck();
          await page.getByRole('button', { name: 'Submit', exact: true }).click();
          await page.getByRole('status').filter({ hasText: 'Thank you!' }).waitFor();
          assert.deepEqual(submissions.at(-1).values.productInterest, [products[0].id]);
          assert.equal(Object.hasOwn(submissions.at(-1).values, 'productCategory'), false);
          assert.equal(current.catalogRequests(), 0);
          record('Hidden IDs submitted unchanged without authenticated catalog requests', width, surface);
        }
      } catch (error) {
        await page.screenshot({ path: resolve(output, `failure-${surface}-${width}.png`), fullPage: true }).catch(() => {});
        writeFileSync(resolve(output, 'failure-page.txt'), await page.locator('body').innerText());
        throw error;
      } finally { await current.context.close(); }
    }
  }
  categories = [...categories, 'Added after publication'];
  const fresh = await fixture(375, false);
  try { await fresh.page.goto(base + '/forms/fixture-public'); await fresh.page.getByRole('option', { name: 'Added after publication', exact: true }).waitFor({ state: 'attached' }); record('New categories appear on reload without republishing', 375, 'public'); }
  finally { await fresh.context.close(); }
  const legacy = await fixture(320, false, true);
  try { await legacy.page.goto(base + '/forms/fixture-public'); await legacy.page.getByRole('checkbox', { name: 'Smart Lock', exact: true }).waitFor(); assert.equal(await legacy.page.getByRole('option').count(), 1); await fits(legacy.page, 320, 'legacy-public'); record('Older response without metadata retains all products', 320, 'legacy-public'); }
  finally { await legacy.context.close(); }
  assert.deepEqual(pageErrors, []);
  writeFileSync(resolve(output, 'results.json'), JSON.stringify({ passed: assertions.length, assertions, pageErrors, evidence: 'Production frontend with isolated API fixtures. Disposable backend integration is verified separately.' }, null, 2));
  console.log(JSON.stringify({ passed: assertions.length, output }));
} catch (error) {
  writeFileSync(resolve(output, 'failure.json'), JSON.stringify({ message: error.message, stack: error.stack, assertions, pageErrors }, null, 2));
  throw error;
} finally { await browser?.close(); frontend.kill(); log.end(); }
