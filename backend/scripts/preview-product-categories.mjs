// Rendered responsive preview with isolated API fixtures. Real database/RBAC
// acceptance is covered by test-product-categories-postgres.mjs.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createWriteStream, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { acceptancePort } from './verify-browser-matrix.mjs';
const require = createRequire(import.meta.url), { chromium } = require('playwright');
const root = resolve(import.meta.dirname, '../..'), output = resolve(root, 'data/outputs/system-audit/product-categories');
mkdirSync(output, { recursive: true });
const port = await acceptancePort(), base = `http://127.0.0.1:${port}`;
const log = createWriteStream(resolve(output, 'frontend.log'));
const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'start', '-p', String(port), '-H', '127.0.0.1'], { cwd: resolve(root, 'frontend'), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NODE_ENV: 'production', API_URL: 'https://leadcrm-browser-fixture.example/api/v1', NEXT_TELEMETRY_DISABLED: '1' } });
child.stdout.pipe(log); child.stderr.pipe(log);
let browser;
const checks = [];
try {
  for (let attempt = 0; attempt < 100; attempt++) { try { if ((await fetch(base + '/login')).ok) break; } catch {} await new Promise(done => setTimeout(done, 500)); }
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const now = new Date().toISOString();
  const user = { id: 'preview-user', tenantId: 'preview-tenant', email: 'preview@camxian.com', firstName: 'UI', lastName: 'Preview', role: 'Client Admin', status: 'ACTIVE', tenantStatus: 'ACTIVE', tenantName: 'Category Preview', onboardingStep: 3, onboardingCompletedAt: now, mustChangePassword: false, hasPassword: true, passwordChangedAt: now, currency: 'PHP', groups: [], avatarUrl: null };
  const permissions = Object.fromEntries(['products', 'settings', 'leads', 'contacts', 'accounts', 'deals', 'tasks', 'campaigns', 'forms', 'notifications', 'dashboard', 'reporting'].map(module => [module, Object.fromEntries(['canView', 'canCreate', 'canEdit', 'canArchive'].map(flag => [flag, true]))]));
  for (const width of [320, 375, 390, 430, 768, 1024, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let products = [{ id: 'preview-product', name: 'Camera Installation', category: 'Security', description: 'Installation and setup', dealValue: 25000, active: true, createdAt: now, updatedAt: now }];
    let categories = ['Security', 'Unused', 'LongCategoryName'.repeat(12), ...Array.from({ length: 12 }, (_, index) => `Existing category ${index + 1}`)];
    const catalog = () => ({ success: true, data: products, meta: { enabled: true, categories } });
    await context.route('**/api/proxy/**', async route => {
      const path = new URL(route.request().url()).pathname.replace('/api/proxy', ''), method = route.request().method();
      const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
      if (path === '/auth/me') return json({ success: true, data: { user, session: { lastActiveAt: now, idleExpiresAt: new Date(Date.now() + 1800000).toISOString(), expiresAt: new Date(Date.now() + 86400000).toISOString(), serverNow: new Date().toISOString() } } });
      if (path.endsWith('/permissions')) return json({ success: true, data: permissions });
      if (path.endsWith('/events') || path.endsWith('record-events')) return route.fulfill({ contentType: 'text/event-stream', body: ': preview\n\n' });
      if (path.startsWith('/preferences/table/')) return json({ success: true, data: { pageSize: 25, viewMode: 'wrap', sort: null, conditions: [] } });
      if (path === '/administration/product-interests/categories') {
        const input = route.request().postDataJSON();
        if (input.action === 'add') categories.push(input.name);
        if (input.action === 'rename') { categories = categories.map(name => name === input.name ? input.newName : name); products = products.map(product => product.category === input.name ? { ...product, category: input.newName } : product); }
        if (input.action === 'delete') {
          if (products.some(product => product.category === input.name)) return json({ error: 'This category cannot be deleted because it is currently assigned to one or more products.' }, 409);
          categories = categories.filter(name => name !== input.name);
        }
        return json(catalog());
      }
      if (path === '/administration/product-interests') {
        if (method === 'POST') products.push({ ...products[0], ...route.request().postDataJSON(), id: 'new-product' });
        return json(catalog());
      }
      if (path === '/crm/record-access') return json({ success: true, data: { userId: user.id, tenantId: user.tenantId, clientAdmin: true, assignmentRestricted: false } });
      return json({ success: true, data: [], meta: { page: 1, limit: 25, total: 0, hasMore: false }, unreadCount: 0, totalCount: 0 });
    });
    async function fits(label) {
      await page.waitForFunction(() => [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')].every(element => { const box = element.getBoundingClientRect(), style = getComputedStyle(element); return Number(style.opacity) >= 0.999 && box.left >= -1 && box.right <= innerWidth + 1; }));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `${label} page overflow at ${width}`);
      assert.equal(await page.locator('[role="dialog"] input, [role="dialog"] button, [role="dialog"] select, [role="alertdialog"] button').evaluateAll(elements => elements.every(element => { const box = element.getBoundingClientRect(); return box.left >= -1 && box.right <= innerWidth + 1; })), true, `${label} clipped controls at ${width}`);
      checks.push({ width, label });
    }
    try {
      await page.goto(base + '/settings?tab=products');
      const gear = page.getByRole('button', { name: 'Manage Product Categories', exact: true });
      await gear.waitFor();
      const a = await gear.boundingBox(), b = await page.getByRole('button', { name: 'Add Product', exact: true }).boundingBox();
      assert.ok(a.x + a.width <= b.x && Math.abs(a.y - b.y) < 2, `Gear position at ${width}`);
      await gear.click();
      const dialog = page.getByRole('dialog', { name: 'Manage Product Categories', exact: true });
      await dialog.waitFor(); await fits('category manager');
      assert.equal(await dialog.locator('.overflow-y-auto').evaluate(element => element.scrollHeight > element.clientHeight), true, `Scrollable category list at ${width}`);
      assert.equal(await dialog.getByText('15 categories', { exact: true }).evaluate(element => { const box = element.getBoundingClientRect(); return box.top >= 0 && box.bottom <= innerHeight; }), true, `Visible category count at ${width}`);
      await page.screenshot({ path: resolve(output, `categories-${width}.png`) });
      await dialog.getByPlaceholder('New category name').fill('  Cabling  '); await dialog.getByRole('button', { name: 'Add', exact: true }).click();
      await dialog.getByText('Cabling', { exact: true }).waitFor();
      await dialog.getByRole('button', { name: 'Rename Security', exact: true }).click();
      await dialog.getByRole('textbox', { name: 'Category name: Security', exact: true }).fill('CCTV'); await dialog.getByRole('button', { name: 'Save', exact: true }).click();
      await dialog.getByText('CCTV', { exact: true }).waitFor(); await fits('inline rename');
      const trash = dialog.getByRole('button', { name: 'Delete Unused category', exact: true });
      const color = await trash.evaluate(element => getComputedStyle(element).color);
      const rgb = color.match(/[\d.]+/g)?.map(Number); assert.ok(rgb && rgb[0] > rgb[1] && rgb[0] > rgb[2], `Red trash at ${width}: ${color}`);
      await trash.click(); await fits('delete confirmation'); await page.getByRole('alertdialog').getByRole('button', { name: 'Delete Category', exact: true }).click();
      await page.getByRole('alertdialog').waitFor({ state: 'hidden' }); assert.equal(await dialog.getByText('Unused', { exact: true }).count(), 0);
      await dialog.getByRole('button', { name: 'Delete CCTV category', exact: true }).click();
      await page.getByRole('alertdialog').getByRole('button', { name: 'Delete Category', exact: true }).click();
      await page.getByRole('alertdialog').getByRole('alert').waitFor(); await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel', exact: true }).click();
      await dialog.getByRole('button', { name: 'Close dialog', exact: true }).click(); await dialog.waitFor({ state: 'hidden' });
      // Move away from the existing top-right toast stack so hover does not pause
      // its dismissal while the next page-header action is exercised.
      await page.mouse.move(0, 899);
      await page.waitForFunction(() => document.querySelectorAll('[data-sonner-toast]').length === 0);
      await page.getByRole('button', { name: 'Add Product', exact: true }).click();
      const category = page.getByRole('combobox', { name: 'Category', exact: true });
      assert.equal(await category.evaluate(element => element.required), true);
      for (const name of ['Cabling', 'CCTV']) assert.equal(await category.getByRole('option', { name, exact: true }).count(), 1);
      assert.equal(await category.getByRole('option', { name: 'Unused', exact: true }).count(), 0);
      await category.selectOption('__add__'); await page.getByRole('textbox', { name: 'New Category', exact: true }).fill('Inline category');
      await page.getByRole('textbox', { name: 'Product Name', exact: true }).fill('Inline Product'); await page.getByLabel('Deal Value (PHP)', { exact: true }).fill('500');
      await fits('new Product and inline category'); await page.getByRole('button', { name: 'Save Product', exact: true }).click();
      await page.getByRole('grid').getByText('Inline Product', { exact: true }).waitFor();
      assert.equal(errors.length, 0, errors.join('\n'));
    } catch (error) {
      await page.screenshot({ path: resolve(output, `failure-${width}.png`) }); writeFileSync(resolve(output, 'failure.txt'), `${error.stack}\n${await page.locator('body').innerText()}`); throw error;
    } finally { await context.close(); }
  }
  writeFileSync(resolve(output, 'results.json'), JSON.stringify({ passed: checks.length, checks, evidence: 'Production frontend with isolated API fixtures. Database and native concurrency verified separately.' }, null, 2));
  console.log(`Passed ${checks.length} responsive checks across seven widths.`);
} finally { await browser?.close(); child.kill(); log.end(); }
