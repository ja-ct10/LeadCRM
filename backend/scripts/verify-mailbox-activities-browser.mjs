// Real UI/API/mailbox SSE against a disposable migration-replayed database.
// Provider-shaped messages enter the real ingestion service; no real mail is sent.
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, createWriteStream } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { replayCrmMigrations } from './replay-crm-migrations.mjs';
import { createAcceptanceContext } from './verify-browser-matrix.mjs';

const root = resolve(import.meta.dirname, '../..');
const output = process.env.LEADCRM_BROWSER_OUTPUT || resolve(tmpdir(), `leadcrm-mailbox-activities-${Date.now()}`);
mkdirSync(output, { recursive: true });
const db = await PGlite.create();
await replayCrmMigrations(db);
const socket = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 0 });
await socket.start();
const port = Number(process.env.MAILBOX_ACTIVITIES_BROWSER_PORT || 3037), base = `http://localhost:${port}`;
for (const key of Object.keys(process.env)) if (/^(BREVO|TEXTBEE|SMTP|GMAIL|GOOGLE_CLIENT|GOOGLE_REFRESH)/.test(key)) delete process.env[key];
Object.assign(process.env, { NODE_ENV: 'test', DATABASE_URL: `postgresql://postgres:postgres@${socket.getServerConn()}/leadcrm_mailbox_activities_browser?connection_limit=1&statement_cache_size=0`,
  JWT_SECRET: randomBytes(32).toString('hex'), ENCRYPTION_KEY: randomBytes(32).toString('hex'), APP_URL: base, CORS_ORIGIN: base, ALLOWED_ORIGINS: base,
  GMAIL_CLIENT_ID: 'isolated-client', GMAIL_CLIENT_SECRET: 'isolated-secret', GMAIL_REDIRECT_URI: base + '/callback' });
process.env.DIRECT_URL = process.env.DATABASE_URL;
const require = createRequire(import.meta.url), Module = require('node:module'), originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) { return request === '@leadcrm/shared' ? resolve(root, 'backend/dist/shared/src/index.js') : originalResolve.call(this, request, parent, isMain, options); };
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const prisma = require('../dist/backend/src/config/database.config.js').default;
const app = require('../dist/backend/src/app.js').default;
const { tenantContext } = require('../dist/backend/src/core/tenant/tenant-context.js');
const { salesPipeline, salesTransaction } = require('../dist/backend/src/modules/crm/leads/lead-automation.service.js');
const { issueAuthSession } = require('../dist/backend/src/core/auth/auth-session.js');
const { encryptToken } = require('../dist/backend/src/core/encryption/crypto.service.js');
const { ingestMailboxMessages } = require('../dist/backend/src/integrations/gmail/mailbox-ingestion.service.js');
const { mailboxChanged } = require('../dist/backend/src/integrations/gmail/mailbox-store.js');
const { associateMailboxDeal } = require('../dist/backend/src/integrations/gmail/mailbox-sync.service.js');
const checks = [], pageErrors = [], transportErrors = [], serverErrors = [], providerRequests = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, options) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) { providerRequests.push(url.origin); throw new Error('External network is disabled in mailbox Activity acceptance'); }
  return originalFetch(input, options);
};
let api, frontend, browser, page, apiBase, closing = false;
const record = (label, detail = {}) => { checks.push({ label, ...detail }); console.log(`PASS ${label}`); };
try {
  const tenant = await prisma.tenant.create({ data: { name: 'Mailbox Activity Acceptance', slug: randomUUID(), onboardingStep: 3, onboardingCompletedAt: new Date() } });
  const owner = await prisma.user.create({ data: { tenantId: tenant.id, email: 'mailbox-activity@camxian.com', firstName: 'Mailbox', lastName: 'Owner', role: 'Client Admin', status: 'ACTIVE', mustChangePassword: false, onboardingCompletedAt: new Date() } });
  const token = (await issueAuthSession(owner)).token;
  const account = await prisma.emailAccount.create({ data: { tenantId: tenant.id, userId: owner.id, email: owner.email, provider: 'gmail', accessToken: encryptToken('fixture-only'), scopes: ['https://www.googleapis.com/auth/gmail.modify'], tokenExpiresAt: new Date(Date.now() + 3600000), connectedAt: new Date() } });
  const scope = run => tenantContext.run({ tenantId: tenant.id }, run);
  const { pipeline, initial } = await scope(() => salesTransaction(tx => salesPipeline(tx, tenant.id)));
  const permissions = { leadsView: true, leadsEdit: true, contactsView: true, contactsEdit: true, dealsView: true, dealsEdit: true };
  let fixtureNumber = 0;
  async function fixture(module, ambiguous = false) {
    const suffix = ++fixtureNumber;
    const lead = await prisma.lead.create({ data: { tenantId: tenant.id, firstName: `Realtime Lead ${suffix}`, lastName: 'Customer', email: `lead-${suffix}@example.test`, assignedUserId: owner.id, status: 'Hot', productInterest: [] } });
    const contact = await prisma.contact.create({ data: { tenantId: tenant.id, firstName: `Realtime Contact ${suffix}`, lastName: 'Customer', email: `contact-${suffix}@example.test`, assignedUserId: owner.id, status: 'HOT', productInterests: [] } });
    const createDeal = title => prisma.deal.create({ data: { tenantId: tenant.id, pipelineId: pipeline.id, stageId: initial.id, title, assignedUserId: owner.id, ownerId: owner.id, value: 0, productInterests: [], tags: [],
      leadDeals: { create: { leadId: lead.id } }, contactDeals: { create: { contactId: contact.id } } } });
    const deal = await createDeal(`Realtime Deal ${suffix}`);
    if (ambiguous) await createDeal(`Other Deal ${suffix}`);
    const selected = module === 'leads' ? lead : module === 'contacts' ? contact : deal;
    const recordKey = module === 'leads' ? 'leadId' : module === 'contacts' ? 'contactId' : 'dealId';
    await prisma.activity.create({ data: { tenantId: tenant.id, [recordKey]: selected.id, createdById: owner.id, type: 'note', title: 'Persisted baseline note' } });
    return { module, selected, recordKey, lead, contact, deal, email: module === 'contacts' ? contact.email : lead.email, thread: randomUUID() };
  }
  api = app.listen(0, '127.0.0.1'); await new Promise(done => api.once('listening', done));
  apiBase = `http://127.0.0.1:${api.address().port}/api/v1`;
  const log = createWriteStream(resolve(output, 'frontend.log'));
  frontend = spawn(process.execPath, [resolve(root, 'node_modules/next/dist/bin/next'), 'start', '-p', String(port), '-H', '127.0.0.1'], { cwd: resolve(root, 'frontend'), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NODE_ENV: 'production', API_URL: 'https://leadcrm-build.example/api/v1' } });
  frontend.stdout.pipe(log); frontend.stderr.pipe(log);
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) { try { if ((await fetch(base + '/login')).ok) { ready = true; break; } } catch {} await new Promise(done => setTimeout(done, 500)); }
  assert.ok(ready, 'Built frontend must be available');
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  async function open(f, surface, filter) {
    let contextClosing = false, navigations = 0;
    const context = await createAcceptanceContext(browser, { viewport: { width: 1440, height: 900 } });
    await context.addCookies([{ name: 'leadcrm_token', value: token, url: base, httpOnly: true, sameSite: 'Lax' }]);
    await context.addInitScript(() => {
      const NativeEventSource = window.EventSource;
      window.__mailboxActivity = { opened: 0, changes: 0, access: 0, suppressedCrm: 0, interactions: 0, observing: false };
      class QuietCrmSource extends EventTarget { close() {} }
      window.EventSource = class extends NativeEventSource {
        constructor(url, options) {
          // A missing mailbox fix must fail even though generic CRM revisions change.
          if (String(url) === '/api/proxy/crm/record-events') { window.__mailboxActivity.suppressedCrm++; return new QuietCrmSource(); }
          super(url, options);
          if (String(url) === '/api/proxy/integrations/gmail/events') {
            this.addEventListener('open', () => window.__mailboxActivity.opened++);
            this.addEventListener('mailbox-change', () => window.__mailboxActivity.changes++);
            this.addEventListener('mailbox-access-changed', () => window.__mailboxActivity.access++);
          }
        }
      };
      for (const name of ['click', 'keydown', 'pointerdown']) document.addEventListener(name, () => { if (window.__mailboxActivity.observing) window.__mailboxActivity.interactions++; }, true);
    });
    const tab = await context.newPage(); page = tab; tab.setDefaultTimeout(20000);
    tab.on('pageerror', error => pageErrors.push(error.message));
    tab.on('framenavigated', frame => { if (frame === tab.mainFrame()) navigations++; });
    await tab.route('**/api/proxy/**', async route => {
      const request = route.request(), url = new URL(request.url()), path = url.pathname.replace('/api/proxy', ''), local = apiBase + path + url.search;
      assert.notEqual(path, '/integrations/gmail/sync', 'A CRM panel must not start Gmail synchronization');
      const headers = { ...request.headers(), authorization: `Bearer ${token}` };
      if (path.endsWith('/events') || path === '/crm/record-events') return route.continue({ url: local, headers });
      try {
        const response = await tab.request.fetch(local, { method: request.method(), headers, data: request.postDataBuffer() ?? undefined, maxRetries: request.method() === 'GET' ? 2 : 0 });
        if (response.status() >= 500) serverErrors.push(`${request.method()} ${path}: ${response.status()}`);
        await route.fulfill({ response });
      } catch (error) { if (!closing && !contextClosing) transportErrors.push(`${request.method()} ${path}: ${String(error).split('\n')[0]}`); await route.abort().catch(() => {}); }
    });
    await tab.goto(`${base}/crm/${f.module}${surface === 'page' ? '/' + f.selected.id : ''}`);
    const title = f.module === 'deals' ? f.selected.title : `${f.selected.firstName} ${f.selected.lastName}`;
    if (surface === 'panel') {
      if (f.module === 'contacts') await tab.getByRole('row').filter({ hasText: f.email }).getByText(f.selected.firstName, { exact: true }).click();
      else if (f.module === 'deals') await tab.getByRole('heading', { name: title, exact: true, level: 4 }).click();
      else await tab.getByText(title, { exact: true }).first().click();
    }
    await tab.getByRole('heading', { name: title, exact: true, level: 1 }).waitFor();
    await tab.getByRole('region', { name: 'Notes', exact: true }).getByText('Persisted baseline note', { exact: true }).waitFor();
    await tab.waitForFunction(() => window.__mailboxActivity.opened > 0);
    if (filter === 'Emails') await tab.getByRole('button', { name: 'Emails', exact: true }).click();
    const timeline = tab.getByRole('region', { name: 'Activity Timeline', exact: true });
    await tab.waitForFunction(expected => document.querySelector('[role="tab"][aria-selected="true"]')?.textContent === `Activity${expected}`, filter === 'Emails' ? 0 : 1);
    await timeline.evaluate(el => { el.dataset.mailboxAcceptance = 'same-mounted-timeline'; });
    const urlBefore = tab.url(), navigationBefore = navigations;
    await tab.evaluate(() => { window.__mailboxActivity.observing = true; });
    return { tab, timeline, close: async () => { contextClosing = true; await context.close(); }, assertUntouched: async () => {
      assert.equal(tab.url(), urlBefore); assert.equal(navigations, navigationBefore);
      assert.equal(await timeline.getAttribute('data-mailbox-acceptance'), 'same-mounted-timeline');
      const evidence = await tab.evaluate(() => window.__mailboxActivity);
      assert.equal(evidence.interactions, 0); assert.ok(evidence.suppressedCrm > 0);
      assert.equal(await tab.getByRole('tab', { name: /^Activity/ }).getAttribute('aria-selected'), 'true');
      assert.equal(await tab.getByRole('button', { name: filter, exact: true }).getAttribute('aria-pressed'), 'true');
      return evidence;
    } };
  }
  async function ingest(f, direction) {
    const body = `Persisted ${direction} ${f.thread}`;
    const message = { id: randomUUID(), threadId: f.thread, from: direction === 'outbound' ? owner.email : f.email, to: [direction === 'outbound' ? f.email : owner.email],
      subject: 'Customer email conversation', body, snippet: body, date: new Date(Date.now() - 1000).toISOString(), isRead: true,
      labels: [direction === 'outbound' ? 'SENT' : 'INBOX'], rfcMessageId: `<${randomUUID()}@example.test>` };
    await scope(() => ingestMailboxMessages(account, [message], permissions));
    await mailboxChanged(account.id);
    return body;
  }
  async function badge(tab, total) {
    await tab.waitForFunction(expected => document.querySelector('[role="tab"][aria-selected="true"]')?.textContent === `Activity${expected}`, total);
  }
  for (const module of ['leads', 'contacts', 'deals']) for (const surface of ['panel', 'page']) for (const filter of ['All', 'Emails']) {
    const f = await fixture(module), view = await open(f, surface, filter);
    for (const [index, direction] of ['outbound', 'inbound'].entries()) {
      const body = await ingest(f, direction);
      await view.timeline.getByText(body, { exact: true }).waitFor();
      await badge(view.tab, index + (filter === 'All' ? 2 : 1));
      assert.equal(await view.timeline.getByText(body, { exact: true }).count(), 1);
      const evidence = await view.assertUntouched(); assert.ok(evidence.changes > index);
      record(`${module} ${surface} ${filter}: ${direction} email and badge update without interaction`, { evidence });
    }
    await view.tab.screenshot({ path: resolve(output, `${module}-${surface}-${filter.toLowerCase()}.png`) });
    await view.close();
  }
  const associated = await fixture('deals', true), body = await ingest(associated, 'inbound');
  const view = await open(associated, 'panel', 'Emails');
  const original = await prisma.activity.findFirstOrThrow({ where: { tenantId: tenant.id, leadId: associated.lead.id, type: 'email' } });
  assert.equal(original.dealId, null);
  await scope(() => associateMailboxDeal(tenant.id, owner.id, associated.thread, associated.deal.id));
  await view.timeline.getByText(body, { exact: true }).waitFor(); await badge(view.tab, 1); await view.assertUntouched();
  assert.equal((await prisma.activity.findUniqueOrThrow({ where: { id: original.id } })).dealId, associated.deal.id);
  await scope(() => associateMailboxDeal(tenant.id, owner.id, associated.thread, associated.deal.id));
  assert.equal(await prisma.activity.count({ where: { mailboxMessageId: original.mailboxMessageId, type: 'email' } }), 1);
  record('An open Deal receives existing associated email history through mailbox SSE without duplication');
  const next = await prisma.user.create({ data: { tenantId: tenant.id, email: 'next-mailbox-activity@camxian.com', firstName: 'Next', lastName: 'Agent', role: 'Client Admin', status: 'ACTIVE', mustChangePassword: false, onboardingCompletedAt: new Date() } });
  await prisma.lead.update({ where: { id: associated.lead.id }, data: { assignedUserId: next.id } });
  await badge(view.tab, 0);
  assert.equal(await view.timeline.getByText(body, { exact: true }).count(), 0);
  const revoked = await view.assertUntouched(); assert.ok(revoked.access > 0);
  record('Mailbox access change removes revoked Deal email and badge without interaction', { evidence: revoked });
  await view.close();
  assert.deepEqual(pageErrors, []); assert.deepEqual(transportErrors, []); assert.deepEqual(serverErrors, []); assert.deepEqual(providerRequests, []);
  writeFileSync(resolve(output, 'results.json'), JSON.stringify({ checks, pageErrors, transportErrors, serverErrors, providerRequests }, null, 2));
  console.log(`Mailbox Activity browser acceptance passed: ${checks.length} checks. Evidence: ${output}`);
} catch (error) {
  process.exitCode = 1;
  if (page && !page.isClosed()) { await page.screenshot({ path: resolve(output, 'failure.png') }).catch(() => {}); writeFileSync(resolve(output, 'failure.txt'), await page.locator('body').innerText().catch(() => '')); }
  writeFileSync(resolve(output, 'results.json'), JSON.stringify({ checks, pageErrors, transportErrors, serverErrors, providerRequests, error: String(error) }, null, 2));
  throw error;
} finally {
  closing = true;
  const shutdown = setTimeout(() => process.exit(process.exitCode ?? 0), 20000); shutdown.unref();
  await browser?.close(); frontend?.kill();
  if (api) { api.closeAllConnections(); await new Promise(done => api.close(done)); }
  await prisma.$disconnect(); await socket.stop(); await db.close();
}
