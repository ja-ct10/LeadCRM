// Local rendered UI preview with isolated API fixtures, outside the database-backed
// acceptance inventory. Database/security checks use test-security-export-products.mjs.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, createWriteStream } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { acceptancePort } from './verify-browser-matrix.mjs';
const require = createRequire(import.meta.url), { chromium } = require('playwright');
const root = resolve(import.meta.dirname, '../..'), output = resolve(root, 'data/outputs/system-audit/security/browser');
mkdirSync(output, { recursive: true });
const port = await acceptancePort(), base = `http://127.0.0.1:${port}`;
const log = createWriteStream(resolve(output, 'frontend.log'));
const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'start', '-p', String(port), '-H', '127.0.0.1'], { cwd: resolve(root, 'frontend'), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1', API_URL: 'https://leadcrm-browser-fixture.example/api/v1' } });
child.stdout.pipe(log); child.stderr.pipe(log);
let browser;
const assertions = [];
try {
  for (let attempt = 0; attempt < 60; attempt++) { try { if ((await fetch(base + '/login')).ok) break; } catch {} await new Promise(done => setTimeout(done, 500)); }
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const now = new Date().toISOString();
  const user = { id: 'ui-user', tenantId: 'ui-tenant', email: 'ui@camxian.com', role: 'Client Admin', firstName: 'UI', lastName: 'Acceptance', status: 'ACTIVE', tenantName: 'UI Acceptance', tenantStatus: 'ACTIVE', onboardingStep: 3, onboardingCompletedAt: now, mustChangePassword: false, hasPassword: true, passwordChangedAt: now, currency: 'PHP', groups: [], avatarUrl: null };
  const permissions = Object.fromEntries(['leads','contacts','accounts','deals','products','settings','users','groups','roles','custom_fields','archived_data','tasks','forms','notifications','dashboard','reporting'].map(module => [module, Object.fromEntries(['canView','canCreate','canEdit','canArchive','canActivate','canViewClosedWon'].map(flag => [flag, true]))]));
  const product = { id: 'ui-product', name: 'Camera Installation', category: 'CCTV', description: 'Installation and configuration', dealValue: 25000, active: true, createdAt: now, updatedAt: now };
  async function pageFor(width, authenticated, lockMode = 'full') {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    let temporaryUntil;
    await context.route('**/api/proxy/**', async route => {
      const url = new URL(route.request().url()), path = url.pathname.replace('/api/proxy', '');
      const json = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
      if (path === '/auth/me') return authenticated ? json({ success: true, data: { user, session: { lastActiveAt: now, idleExpiresAt: new Date(Date.now() + 1800000).toISOString(), expiresAt: new Date(Date.now() + 86400000).toISOString(), serverNow: new Date().toISOString() } } }) : json({ error: 'Authentication required' }, 401);
      if (path === '/auth/login-lockout') return json({ success: true, data: { locked: !!temporaryUntil, retryAt: temporaryUntil, serverNow: new Date().toISOString() } });
      if (path === '/auth/login') {
        if (lockMode === 'full') return json({ error: { code: 'AUTH_ACCOUNT_LOCKED', message: 'Your account has been locked due to repeated failed login attempts. Please contact your administrator.' } }, 423);
        temporaryUntil ??= new Date(Date.now() + 300000).toISOString();
        return json({ error: { code: 'AUTH_LOGIN_LOCKED', message: 'Too many failed login attempts. Please try again in 5 minutes.', serverNow: new Date().toISOString(), retryAt: temporaryUntil } }, 429);
      }
      if (path.endsWith('/permissions')) return json({ success: true, data: permissions });
      if (path.startsWith('/preferences/table/')) return json({ success: true, data: { pageSize: 25, viewMode: 'wrap', sort: { field: 'createdAt', direction: 'desc' }, viewType: null, conditions: [] } });
      if (path.endsWith('/events') || path.endsWith('record-events')) return route.fulfill({ contentType: 'text/event-stream', body: ': fixture\n\n' });
      if (path === '/administration/product-interests') return json({ success: true, data: [product], meta: { enabled: true, categories: ['CCTV', 'Network Infrastructure'] } });
      if (path === '/crm/pipelines') return json({ success: true, data: [{ id: 'ui-pipeline', name: 'Sales Pipeline', isArchived: false, stages: [{ id: 'ui-stage', name: 'Lead', order: 0, isDefault: true }] }] });
      if (path.endsWith('/export')) return route.fulfill({ contentType: 'text/csv', body: '\uFEFF"Name"\r\n"Fixture"' });
      if (path === '/crm/record-access') return json({ success: true, data: { userId: user.id, tenantId: user.tenantId, clientAdmin: true, assignmentRestricted: false } });
      return json({ success: true, data: [], meta: { page: 1, limit: 25, total: 0, hasMore: false, totalPages: 0 }, unreadCount: 0, totalCount: 0 });
    });
    return { context, page: await context.newPage() };
  }
  async function fits(page, label, width) {
    // Wait for the existing motion drawer/Toast entrance before measuring it.
    await page.waitForFunction(() => [...document.querySelectorAll('[role="dialog"]')].every(element => {
      const box = element.getBoundingClientRect(); return box.left >= -1 && box.right <= innerWidth + 1;
    }));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true, `${label} overflow at ${width}`);
    assert.equal(await page.locator('[role="dialog"] input, [role="dialog"] select, [role="dialog"] textarea, [role="dialog"] button').evaluateAll(elements => elements.every(element => { const box = element.getBoundingClientRect(); return box.left >= -1 && box.right <= innerWidth + 1; })), true, `${label} clipped controls at ${width}`);
    assertions.push({ label, width, passed: true });
  }
  for (const width of [320, 375, 390, 430, 768, 1024, 1440]) {
    const { context, page } = await pageFor(width, true);
    page.on('pageerror', error => writeFileSync(resolve(output, 'page-error.txt'), error.stack ?? error.message));
    try {
      await page.goto(base + '/settings?tab=profile&changePassword=1');
      await page.getByRole('dialog').waitFor();
      for (const label of ['Old Password', 'New password', 'Confirm new password']) await page.getByLabel(label, { exact: false }).first().waitFor();
      await fits(page, 'Change Password', width);
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      await page.goto(base + '/settings?tab=products'); await page.getByRole('button', { name: 'Add Product', exact: true }).click();
      await page.getByRole('combobox', { name: 'Category', exact: true }).selectOption('__add__'); await page.getByLabel('New Category', { exact: false }).fill('Security');
      await page.getByLabel('Product Description').fill('Description with commas, quotes " and a new line\nMore description');
      await page.getByLabel('Deal Value (PHP)').fill('25000'); await fits(page, 'Product form', width);
      await page.screenshot({ path: resolve(output, `product-${width}.png`) });
      for (const module of ['leads','contacts','accounts','deals']) {
        await page.goto(base + '/crm/' + module); const button = page.getByRole('button', { name: 'Export CSV', exact: true });
        try { await button.waitFor(); } catch (error) {
          await page.screenshot({ path: resolve(output, `failure-${module}-${width}.png`) });
          writeFileSync(resolve(output, 'page-failure.txt'), `${page.url()}\n${await page.locator('body').innerText()}`);
          throw error;
        }
        await fits(page, `${module} toolbar`, width);
        assert.equal(await button.evaluate(element => { const previous = element.previousElementSibling; return !!previous && /filter/i.test(previous.getAttribute('aria-label') ?? previous.textContent ?? ''); }), true, `${module} export order`);
        const download = page.waitForEvent('download'); await button.click(); assert.match((await download).suggestedFilename(), new RegExp(`^${module}-[0-9]{4}-[0-9]{2}-[0-9]{2}\\.csv$`));
      }
    } catch (error) {
      await page.screenshot({ path: resolve(output, `failure-${width}.png`) });
      writeFileSync(resolve(output, 'page-failure.txt'), `${page.url()}\n${await page.locator('body').innerText()}`);
      throw error;
    } finally { await context.close(); }
    for (const lockMode of ['temporary','full']) {
      const fixture = await pageFor(width, false, lockMode), login = fixture.page;
      try {
        await login.goto(base + '/login'); await login.getByLabel('Email address', { exact: true }).fill('ui@camxian.com'); await login.getByLabel('Password', { exact: true }).fill('WrongPassword1!');
        await login.getByRole('button', { name: 'Login', exact: true }).click();
        if (lockMode === 'temporary') {
          await login.getByRole('timer').waitFor(); assert.equal(await login.getByRole('dialog').count(), 1);
          await login.reload(); await login.getByRole('timer').waitFor();
          assert.match(await login.getByRole('timer').innerText(), /0[45]:[0-5][0-9]/);
        }
        else { await login.getByRole('alert').filter({ hasText: 'Your account has been locked due to repeated failed login attempts. Please contact your administrator.' }).waitFor(); assert.equal(await login.getByRole('timer').count(), 0); }
        await fits(login, `${lockMode} lock`, width); await login.screenshot({ path: resolve(output, `login-${lockMode}-${width}.png`) });
      } finally { await fixture.context.close(); }
    }
  }
  writeFileSync(resolve(output, 'results.json'), JSON.stringify({ passed: assertions.length, assertions, evidence: 'Production frontend with isolated API responses; native database tests are separate.' }, null, 2));
  console.log(JSON.stringify({ passed: assertions.length, output }));
} catch (error) { writeFileSync(resolve(output, 'failure.json'), JSON.stringify({ message: error.message, stack: error.stack, assertions }, null, 2)); throw error; }
finally { await browser?.close(); child.kill(); log.end(); }
