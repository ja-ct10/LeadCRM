// UI-only acceptance with intercepted APIs; authorization uses separate disposable HTTP/database suites.
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
const output = resolve(root, 'data/outputs/system-audit/crm-tab-browser'); mkdirSync(output, { recursive: true });
const port = await acceptancePort(), base = `http://127.0.0.1:${port}`, log = createWriteStream(resolve(output, 'frontend.log'));
const server = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'start', '-p', String(port), '-H', '127.0.0.1'], {
  cwd: resolve(root, 'frontend'), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  env: qaEnvironment(root, { NODE_ENV: 'production', API_URL: 'https://leadcrm-tab-fixture.example/api/v1' }),
}); server.stdout.pipe(log); server.stderr.pipe(log);
const now = new Date().toISOString(), tenantId = randomUUID();
const user = { id: randomUUID(), tenantId, email: 'fixture@example.test', role: 'Client Admin', firstName: 'Fixture', lastName: 'Admin', status: 'ACTIVE', tenantName: 'CRM Tabs', tenantStatus: 'ACTIVE', onboardingStep: 3, onboardingCompletedAt: now, mustChangePassword: false, hasPassword: true, groups: [] };
const full = Object.fromEntries(shared.PERMISSION_MODULES.map(module => [module.key, { ...shared.EMPTY_PERMISSION_FLAGS, ...Object.fromEntries(module.actions.map(action => [action, true])) }]));
let permissions = full;
let role = { id: randomUUID(), tenantId, name: 'Fixture Staff', description: 'Disposable UI fixture', isSystemRole: false, isArchived: false, userCount: 1,
  createdAt: now, updatedAt: now, permissions: Object.entries(full).map(([module, flags]) => ({ module, ...flags })) };
const pipeline = { id: 'sales', tenantId, name: 'Sales Pipeline', stages: [{ id: 'lead', pipelineId: 'sales', name: 'Lead', order: 0, isDefault: true }] };
let browser; const checks = [];
try {
  let ready = false;
  for (let n = 0; n < 90; n++) { try { if ((await fetch(base + '/login')).ok) { ready = true; break; } } catch {} await new Promise(done => setTimeout(done, 500)); }
  assert.ok(ready, 'Production fixture server did not become ready');
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const width of [1440, 768, 320]) {
    user.role = 'Client Admin'; permissions = full;
    const context = await createAcceptanceContext(browser, { viewport: { width, height: 960 }, reducedMotion: 'reduce' });
    const page = await context.newPage(), errors = []; page.on('pageerror', error => { errors.push(error.message); console.error('Fixture page error:', error.message); });
    await context.addInitScript(() => {
      window.__tabEvents = [];
      window.EventSource = class extends EventTarget {
        constructor(url) { super(); this.url = url; window.__tabEvents.push(this); queueMicrotask(() => this.dispatchEvent(new Event('open'))); }
        close() {}
      };
    });
    await context.route('**/api/proxy/**', async route => {
      const path = new URL(route.request().url()).pathname.replace('/api/proxy', '');
      const json = data => route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
      const list = data => json({ success: true, data, meta: { total: data.length, page: 1, limit: 25, hasMore: false } });
      if (path === '/auth/me') return json({ success: true, data: { user, session: { lastActiveAt: now, idleExpiresAt: new Date(Date.now() + 1800000).toISOString(), expiresAt: new Date(Date.now() + 86400000).toISOString(), serverNow: new Date().toISOString() } } });
      if (path === '/administration/permissions') return json({ success: true, data: shared.PERMISSION_MODULES });
      if (path.endsWith('/permissions')) return json({ success: true, data: permissions });
      if (path === '/administration/roles') return list([role]);
      if (path === `/administration/roles/${role.id}`) {
        if (route.request().method() === 'PUT') role = { ...role, ...route.request().postDataJSON() };
        return json({ success: true, data: { ...role, assignedUsers: [] } });
      }
      if (path === '/crm/record-access') return json({ success: true, data: { userId: user.id, tenantId, clientAdmin: user.role === 'Client Admin', assignmentRestricted: false } });
      if (path === '/crm/pipelines') return list([pipeline]);
      if (path.startsWith('/preferences/table/')) return json({ success: true, data: { pageSize: 25, viewMode: 'wrap', viewType: 'table', sort: { field: 'createdAt', direction: 'desc' }, columns: [], conditions: [] } });
      if (path.endsWith('/field-layout')) return json({ success: true, data: { layout: shared.defaultFieldLayout(path.includes('contacts') ? 'contacts' : 'leads') } });
      return list([]);
    });
    try {
      await page.goto(base + '/settings?tab=roles');
      await page.getByRole('button', { name: 'Actions for Fixture Staff' }).click();
      await page.getByRole('menuitem', { name: 'Edit Permissions' }).click();
      for (const name of ['All Leads', 'My Leads', 'Active Lead', 'All Contacts', 'My Contacts', 'Active Contacts', 'All Accounts', 'All Deals', 'My Deals', 'Manage Pipeline Stages']) await page.getByRole('checkbox', { name, exact: true }).waitFor();
      const allLeads = page.getByRole('checkbox', { name: 'All Leads', exact: true });
      if (await allLeads.isChecked()) { await allLeads.focus(); await allLeads.press('Space'); }
      assert.ok(await page.getByRole('checkbox', { name: 'My Leads', exact: true }).isChecked());
      assert.ok(await page.getByRole('checkbox', { name: 'Active Lead', exact: true }).isChecked());
      const row = page.locator('tr[data-row-id="contacts"]');
      assert.ok((await row.boundingBox()).height <= 90, 'CRM permissions should fit in two compact rows');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Role editor document overflow');
      await page.screenshot({ path: resolve(output, `role-editor-${width}.png`), fullPage: true });
      await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
      await page.getByRole('button', { name: 'Actions for Fixture Staff' }).waitFor();
      assert.equal(role.permissions.find(row => row.module === 'leads').canViewAll, false);
      await page.getByRole('button', { name: 'Actions for Fixture Staff' }).click(); await page.getByRole('menuitem', { name: 'Edit Permissions' }).click();
      assert.equal(await page.getByRole('checkbox', { name: 'All Leads', exact: true }).isChecked(), false);
      user.role = 'Fixture Staff';
      permissions = Object.fromEntries(['leads', 'contacts', 'accounts', 'deals'].map(module => [module, { ...shared.EMPTY_PERMISSION_FLAGS, canView: true,
        canViewMy: module === 'leads' || module === 'deals', canViewActive: module === 'contacts' }]));
      for (const [module, permitted, denied] of [['leads', 'My Leads', 'All Leads'], ['contacts', 'Active Contacts', 'All Contacts'], ['deals', 'My Deals', 'All Deals']]) {
        await page.goto(base + `/crm/${module}?tab=all`);
        await page.getByRole('button', { name: permitted, exact: true, pressed: true }).waitFor();
        assert.equal(await page.getByRole('button', { name: denied, exact: true }).count(), 0);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${module} document overflow`);
        await page.screenshot({ path: resolve(output, `${module}-${width}.png`), fullPage: true });
      }
      permissions = { ...permissions, deals: { ...shared.EMPTY_PERMISSION_FLAGS, canView: true } };
      await page.evaluate(() => window.__tabEvents.filter(source => source.url.includes('/auth/events')).forEach(source => source.dispatchEvent(new MessageEvent('authorization-change', { data: 'revoked' }))));
      await page.getByRole('alert').filter({ hasText: 'You do not have permission to access this module.' }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'My Deals', exact: true }).count(), 0);
      await page.goto(base + '/crm/accounts'); await page.getByRole('alert').filter({ hasText: 'You do not have permission to access this module.' }).waitFor();
      assert.deepEqual(errors, []);
      checks.push({ width, checkboxes: 9, savedAndReopened: true, fallback: true, liveRevocation: true, noTabsDenied: true, overflow: false });
      console.log(`${width}px: role saving, tab visibility, fallback and live revocation PASS`);
    } catch (error) { await page.screenshot({ path: resolve(output, `failure-${width}.png`), fullPage: true }); throw error; }
    finally { await context.close(); }
  }
  writeFileSync(resolve(output, 'report.json'), JSON.stringify({ evidence: 'Production UI with isolated API/session/event fixtures', success: true, checks }, null, 2));
} finally { await browser?.close(); server.kill(); log.end(); }
