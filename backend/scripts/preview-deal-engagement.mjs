// UI-only acceptance with intercepted APIs. SQL/permissions use separate disposable integration tests.
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
const output = resolve(root, 'data/outputs/system-audit/deal-engagement'); mkdirSync(output, { recursive: true });
const port = await acceptancePort(), base = `http://127.0.0.1:${port}`, log = createWriteStream(resolve(output, 'frontend.log'));
const server = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'start', '-p', String(port), '-H', '127.0.0.1'], {
  cwd: resolve(root, 'frontend'), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  env: qaEnvironment(root, { NODE_ENV: 'production', API_URL: 'https://leadcrm-deal-fixture.example/api/v1' }),
}); server.stdout.pipe(log); server.stderr.pipe(log);
const now = new Date().toISOString(), tenantId = randomUUID();
const user = { id: randomUUID(), tenantId, email: 'fixture@example.test', role: 'Client Admin', firstName: 'Fixture', lastName: 'Admin', status: 'ACTIVE', tenantName: 'Deal Fixture', tenantStatus: 'ACTIVE', onboardingStep: 3, onboardingCompletedAt: now, mustChangePassword: false, hasPassword: true, passwordChangedAt: now, groups: [] };
const permissions = Object.fromEntries(['deals', 'leads', 'contacts', 'accounts', 'products', 'tasks', 'users', 'settings', 'dashboard', 'notifications'].map(module => [module, { ...shared.EMPTY_PERMISSION_FLAGS, canView: true, canCreate: true, canEdit: true, canManageStages: true }]));
const pipeline = { id: 'sales', tenantId, name: 'Sales Pipeline', stages: ['Lead', 'Contacted', 'Qualified', 'Closed Deal', 'Cancelled'].map((name, order) => ({ id: `stage-${order}`, pipelineId: 'sales', name, order, isDefault: order === 0, isWon: order === 3, isLost: order === 4, color: '#64748B' })) };
const customer = { id: randomUUID(), tenantId, firstName: 'Actual', lastName: 'Customer', email: 'customer@example.test', status: 'Hot', assignedUserId: user.id, statusManagedByDeals: true };
const statuses = ['Warm', 'Inquiry', 'Cold', 'Closed Deal', 'Cancelled'];
const deals = pipeline.stages.map((stage, i) => ({ id: randomUUID(), tenantId, title: `Opportunity ${i + 1}`, pipelineId: pipeline.id, stageId: stage.id, pipeline, stage,
  engagementStatus: statuses[i], value: (i + 1) * 1000, priority: 'MEDIUM', leadDeals: [{ leadId: customer.id, lead: customer }], contactDeals: [], assignedUserId: user.id, createdAt: now, updatedAt: now }));
let browser; const checks = [];
try {
  for (let n = 0; n < 120; n++) { try { if ((await fetch(base + '/login')).ok) break; } catch {} await new Promise(done => setTimeout(done, 500)); }
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const width of [320, 375, 390, 430, 768, 1024, 1440]) {
    const context = await createAcceptanceContext(browser, { viewport: { width, height: 960 }, reducedMotion: 'reduce' });
    const page = await context.newPage(); const errors = []; page.on('pageerror', error => errors.push(error.message));
    await context.route('**/api/proxy/**', async route => {
      const path = new URL(route.request().url()).pathname.replace('/api/proxy', '');
      const json = data => route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
      const list = data => json({ success: true, data, meta: { total: data.length, page: 1, hasMore: false } });
      if (path === '/auth/me') return json({ success: true, data: { user, session: { lastActiveAt: now, idleExpiresAt: new Date(Date.now() + 1800000).toISOString(), expiresAt: new Date(Date.now() + 86400000).toISOString(), serverNow: new Date().toISOString() } } });
      if (path.endsWith('/permissions')) return json({ success: true, data: permissions });
      if (path.endsWith('/events') || path.endsWith('record-events')) return route.fulfill({ contentType: 'text/event-stream', body: ': fixture\n\n' });
      if (path === '/crm/record-access') return json({ success: true, data: { userId: user.id, tenantId, clientAdmin: true, assignmentRestricted: false } });
      if (path === '/crm/pipelines') return list([pipeline]);
      if (path === '/crm/pipelines/sales') return json({ success: true, data: pipeline });
      if (path.endsWith('/field-layout')) return json({ success: true, data: { layout: shared.defaultFieldLayout('deals') } });
      if (path.endsWith('/custom-fields')) return json({ success: true, data: path.includes('/crm/deals/') ? { fields: [], values: {}, files: [], layout: shared.defaultFieldLayout('deals') } : [] });
      if (path.endsWith('/closing-requirements')) return json({ success: true, data: { fields: [], values: {}, files: [] } });
      if (path === '/crm/deals') return list(deals);
      const deal = deals.find(deal => path === `/crm/deals/${deal.id}`); if (deal) return json({ success: true, data: deal });
      if (path === '/crm/leads') return list([customer]);
      if (path === `/crm/leads/${customer.id}`) return json({ success: true, data: customer });
      if (path.endsWith('/relationships')) return json({ success: true, data: { leads: [customer], contacts: [], deals: [], hasMoreDeals: false } });
      return list([]);
    });
    try {
      await page.goto(base + '/crm/deals'); await page.getByText('Opportunity 1', { exact: true }).waitFor();
      for (let i = 0; i < deals.length; i++) {
        const title = page.getByRole('heading', { name: deals[i].title, exact: true });
        const card = title.locator('xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " group ")][1]');
        const content = await card.innerText();
        assert.ok(content.includes('Medium') && content.includes(statuses[i]), `Priority/status ${i} at ${width}`);
        assert.equal(/₱/.test(content), i === 2, `Card amount ${i} at ${width}`);
        const heading = page.getByRole('heading', { name: pipeline.stages[i].name, exact: true });
        const header = heading.locator('xpath=../../..'); const headerText = await header.innerText();
        assert.equal(/₱/.test(headerText), i === 2 || i === 3, `Header amount ${i} at ${width}`);
        assert.match(headerText, /\b1\b/, `Stage count ${i} at ${width}`);
        checks.push({ width, stage: pipeline.stages[i].name, card: true, header: true, badges: true, count: true });
      }
      for (const label of ['Active Open Deals', 'Total Open Value', 'Closed Won Revenue']) {
        assert.equal(await page.getByText(label, { exact: true }).count(), 0);
      }
      assert.equal(await page.getByText('Weighted Forecast', { exact: true }).count(), 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `Board overflow at ${width}`);
      await page.screenshot({ path: resolve(output, `board-${width}.png`), fullPage: true });
      await page.getByRole('heading', { name: 'Opportunity 3', exact: true }).click();
      const panel = page.getByRole('dialog', { name: 'Deal details', exact: true }); await panel.getByText('Cold', { exact: true }).waitFor();
      assert.equal(await panel.getByRole('button', { name: /^(Lead|Contacted|Qualified|Closed Deal|Cancelled)$/ }).count(), 0);
      assert.equal(await panel.getByText('Hot', { exact: true }).count(), 0, 'Do not copy customer status');
      const details = panel.getByRole('tab', { name: /Details/ }); await details.focus(); await details.press('Enter');
      await panel.getByText('Qualified', { exact: true }).first().waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `Panel overflow at ${width}`);
      await page.screenshot({ path: resolve(output, `panel-${width}.png`), fullPage: true });
      const close = panel.getByRole('button', { name: 'Close record', exact: true }); await close.focus(); await close.press('Enter'); await panel.waitFor({ state: 'hidden' });
      assert.deepEqual(errors, []); checks.push({ width, panel: true, summary: true, keyboard: true, overflow: false });
      console.log(`${width}px: Deal status, amounts, counts, summary and panel PASS`);
    } finally { await context.close(); }
  }
  writeFileSync(resolve(output, 'responsive.json'), JSON.stringify({ evidence: 'Isolated API fixtures', success: true, checks }, null, 2));
} finally { await browser?.close(); server.kill(); log.end(); }
