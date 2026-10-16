// Real UI/API/mailbox SSE against the harness-owned native PostgreSQL database.
// Two Sales agents use mocked Gmail send/History and the existing worker; no real mail is sent.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, createWriteStream } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { acceptancePort, createAcceptanceContext } from './verify-browser-matrix.mjs';

const root = resolve(import.meta.dirname, '../..');
const output = process.env.LEADCRM_BROWSER_OUTPUT || resolve(tmpdir(), `leadcrm-mailbox-activities-${Date.now()}`);
mkdirSync(output, { recursive: true });
const database = new URL(process.env.DATABASE_URL);
assert.equal(database.hostname, '127.0.0.1');
assert.equal(database.pathname, '/leadcrm_forms_test_2', 'Run through the disposable browser harness');
const port = Number(process.env.MAILBOX_ACTIVITIES_BROWSER_PORT || await acceptancePort()), base = `http://localhost:${port}`;
for (const key of Object.keys(process.env)) if (/^(BREVO|TEXTBEE|SMTP|GMAIL|GOOGLE_CLIENT|GOOGLE_REFRESH)/.test(key)) delete process.env[key];
Object.assign(process.env, { NODE_ENV: 'test',
  JWT_SECRET: randomBytes(32).toString('hex'), ENCRYPTION_KEY: randomBytes(32).toString('hex'), APP_URL: base, CORS_ORIGIN: base, ALLOWED_ORIGINS: base,
  GMAIL_CLIENT_ID: 'isolated-client', GMAIL_CLIENT_SECRET: 'isolated-secret', GMAIL_REDIRECT_URI: base + '/callback', GMAIL_SYNC_INTERVAL_SECONDS: '10' });
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
const { associateMailboxDeal, startMailboxScheduler, syncMailbox, mailboxPermissions } = require('../dist/backend/src/integrations/gmail/mailbox-sync.service.js');
const { resolveMailboxScope } = require('../dist/backend/src/integrations/gmail/mailbox-scope.js');
const checks = [], pageErrors = [], transportErrors = [], serverErrors = [], providerRequests = [];
const gmailBoxes = new Map(), gmailReads = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, options) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (url.hostname === 'gmail.googleapis.com') {
    const box = gmailBoxes.get(new Headers(options?.headers).get('authorization'));
    assert.ok(box, 'Gmail must use this agent account token');
    if (options?.method === 'POST') {
      const raw = Buffer.from(JSON.parse(options.body).raw, 'base64url').toString();
      const message = { id: randomUUID(), threadId: randomUUID(), from: box.email, to: [raw.match(/To: ([^\r\n]+)/)[1]], subject: 'Customer email conversation',
        body: raw.split('\r\n\r\n').slice(1).join('\r\n\r\n'), rfcMessageId: raw.match(/Message-ID: ([^\r\n]+)/)[1], labels: ['SENT'], date: new Date(Date.now() - 1000).toISOString() };
      message.snippet = message.body; message.revision = ++box.revision; box.messages.set(message.id, message);
      return Promise.resolve(Response.json({ id: message.id, threadId: message.threadId }));
    }
    gmailReads.push({ userId: box.userId, path: url.pathname, time: Date.now() });
    if (url.pathname.endsWith('/profile')) return Promise.resolve(Response.json({ historyId: String(box.revision) }));
    if (url.pathname.endsWith('/history')) return Promise.resolve(Response.json({ historyId: String(box.revision), history: [{ messagesAdded: [...box.messages.values()].filter(message => message.revision > Number(url.searchParams.get('startHistoryId'))).map(message => ({ message: { id: message.id } })) }] }));
    if (url.pathname.endsWith('/drafts')) return Promise.resolve(Response.json({ drafts: [] }));
    if (url.pathname.endsWith('/messages')) return Promise.resolve(Response.json({ messages: [...box.messages.values()].map(message => ({ id: message.id })) }));
    const message = box.messages.get(url.pathname.split('/').at(-1)); assert.ok(message, 'Exact Gmail message must exist in its owner mailbox');
    return Promise.resolve(Response.json({ id: message.id, threadId: message.threadId, labelIds: message.labels, snippet: message.snippet, internalDate: String(Date.parse(message.date)),
      payload: { mimeType: 'text/html', body: { data: Buffer.from(message.body).toString('base64url') }, headers: [{ name: 'From', value: message.from }, { name: 'To', value: message.to.join(', ') }, { name: 'Subject', value: message.subject }, { name: 'Message-ID', value: message.rfcMessageId }] } }));
  }
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) { providerRequests.push(url.origin); throw new Error('External network is disabled in mailbox Activity acceptance'); }
  return originalFetch(input, options);
};
let api, frontend, browser, page, apiBase, stopWorker, closing = false;
const record = (label, detail = {}) => { checks.push({ label, ...detail }); console.log(`PASS ${label}`); };
try {
  const tenant = await prisma.tenant.create({ data: { name: 'Mailbox Activity Acceptance', slug: randomUUID(), onboardingStep: 3, onboardingCompletedAt: new Date() } });
  const role = await prisma.roleDefinition.create({ data: { tenantId: tenant.id, name: 'Sales', crmAssignmentRestricted: true } });
  await prisma.rolePermission.createMany({ data: ['leads', 'contacts', 'deals', 'accounts', 'tasks'].map(module => ({ tenantId: tenant.id, roleId: role.id, module, canView: true, canEdit: true, canCreate: true })) });
  const agents = [];
  for (const name of ['B', 'A']) {
    const user = await prisma.user.create({ data: { tenantId: tenant.id, email: `mailbox-activity-${name}@camxian.com`, firstName: name, lastName: 'Sales', role: 'Sales', status: 'ACTIVE', mustChangePassword: false, onboardingCompletedAt: new Date() } });
    await prisma.userRole.create({ data: { tenantId: tenant.id, roleId: role.id, userId: user.id } });
    const access = 'fixture-' + user.id;
    const account = await prisma.emailAccount.create({ data: { tenantId: tenant.id, userId: user.id, email: user.email, provider: 'gmail', accessToken: encryptToken(access), scopes: ['https://www.googleapis.com/auth/gmail.modify'], tokenExpiresAt: new Date(Date.now() + 3600000), connectedAt: new Date() } });
    gmailBoxes.set('Bearer ' + access, { email: user.email, userId: user.id, revision: 1, messages: new Map() });
    agents.push({ owner: user, account, box: gmailBoxes.get('Bearer ' + access), leadIds: [] });
  }
  let owner, account, token, box;
  const scope = run => tenantContext.run({ tenantId: tenant.id }, run);
  const { pipeline, initial } = await scope(() => salesTransaction(tx => salesPipeline(tx, tenant.id)));
  let fixtureNumber = 0;
  async function fixture(module, ambiguous = false) {
    const suffix = ++fixtureNumber;
    // Established engagement isolates email counts from separate legitimate status-change Activities.
    const engagement = { lastCustomerReplyAt: new Date(Date.now() - 2000), engagementEvaluatedAt: new Date(Date.now() - 2000) };
    const lead = await prisma.lead.create({ data: { tenantId: tenant.id, firstName: `Realtime Lead ${suffix}`, lastName: 'Customer', email: `lead-${suffix}@example.test`, assignedUserId: owner.id, status: 'Hot', productInterest: [], ...engagement } });
    const contact = await prisma.contact.create({ data: { tenantId: tenant.id, firstName: `Realtime Contact ${suffix}`, lastName: 'Customer', email: `contact-${suffix}@example.test`, assignedUserId: owner.id, status: 'HOT', productInterests: [], ...engagement } });
    const createDeal = title => prisma.deal.create({ data: { tenantId: tenant.id, pipelineId: pipeline.id, stageId: initial.id, title, assignedUserId: owner.id, ownerId: owner.id, value: 0, productInterests: [], tags: [],
      leadDeals: { create: { leadId: lead.id } }, contactDeals: { create: { contactId: contact.id } } } });
    const deal = await createDeal(`Realtime Deal ${suffix}`);
    if (ambiguous) await createDeal(`Other Deal ${suffix}`);
    const selected = module === 'leads' ? lead : module === 'contacts' ? contact : deal;
    const recordKey = module === 'leads' ? 'leadId' : module === 'contacts' ? 'contactId' : 'dealId';
    await prisma.activity.create({ data: { tenantId: tenant.id, [recordKey]: selected.id, createdById: owner.id, type: 'note', title: 'Persisted baseline note' } });
    await scope(async () => prisma.emailAccount.update({ where: { id: account.id }, data: { syncScopeHash: (await resolveMailboxScope(account, await mailboxPermissions(tenant.id, owner.id))).hash,
      syncCursor: String(box.revision), lastSyncAt: new Date(Date.now() - 10000) } }));
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
  async function waitForMailboxActivity(providerMessageId) {
    // Confirmed sends may finish history asynchronously. Discovery can also span
    // the 10s sync interval and next 10s queue tick; time the UI independently.
    const deadline = Date.now() + 35000;
    let stored, activity;
    do {
      stored = await prisma.mailboxMessage.findFirst({ where: { accountId: account.id, providerMessageId }, select: { id: true, tenantId: true } });
      if (stored) activity = await prisma.activity.findFirst({ where: { mailboxMessageId: stored.id, type: 'email' }, select: { id: true, createdById: true } });
      if (!activity) await new Promise(done => setTimeout(done, 250));
    } while (!activity && Date.now() < deadline);
    assert.ok(activity, 'Gmail history must persist the message and Activity within its polling budget');
    assert.equal(activity.createdById, owner.id);
    return stored;
  }
  async function ingest(f, direction, scheduledDiscovery = true) {
    const body = `Persisted ${direction} ${f.thread}`;
    if (direction === 'outbound') {
      const response = await originalFetch(apiBase + '/integrations/gmail/send', { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ requestId: randomUUID(), to: f.email, subject: 'Customer email conversation', body }) });
      const sent = await response.json(); assert.equal(response.status, 200, JSON.stringify(sent)); f.thread = sent.threadId;
      const stored = await waitForMailboxActivity(sent.messageId);
      assert.equal(stored.tenantId, tenant.id);
      assert.equal((await prisma.activity.findFirstOrThrow({ where: { mailboxMessageId: stored.id, type: 'email' } })).createdById, owner.id);
      return body;
    }
    const message = { id: randomUUID(), threadId: f.thread, from: direction === 'outbound' ? owner.email : f.email, to: [direction === 'outbound' ? f.email : owner.email],
      subject: 'Customer email conversation', body, snippet: body, date: new Date(Date.now() - 1000).toISOString(), isRead: true,
      labels: [direction === 'outbound' ? 'SENT' : 'INBOX'], rfcMessageId: `<${randomUUID()}@example.test>` };
    message.revision = ++box.revision; box.messages.set(message.id, message);
    if (!scheduledDiscovery) await scope(() => syncMailbox(tenant.id, owner.id, 'worker'));
    await waitForMailboxActivity(message.id);
    return body;
  }
  async function badge(tab, total) {
    await tab.waitForFunction(expected => document.querySelector('[role="tab"][aria-selected="true"]')?.textContent === `Activity${expected}`, total);
  }
  for (const agent of agents) {
    ({ owner, account, box } = agent);
    token = (await issueAuthSession(owner)).token;
  for (const module of ['leads', 'contacts', 'deals']) for (const surface of ['panel', 'page']) for (const filter of ['All', 'Emails']) {
    const f = await fixture(module), view = await open(f, surface, filter);
    agent.leadIds.push(f.lead.id);
    stopWorker = startMailboxScheduler();
    for (const [index, direction] of ['outbound', 'inbound'].entries()) {
      const observedAt = Date.now();
      const body = await ingest(f, direction);
      await view.timeline.getByText(body, { exact: true }).waitFor();
      await badge(view.tab, index + (filter === 'All' ? 2 : 1));
      assert.equal(await view.timeline.getByText(body, { exact: true }).count(), 1);
      const evidence = await view.assertUntouched(); assert.ok(evidence.changes > index);
      record(`Agent ${owner.firstName}: ${module} ${surface} ${filter}: ${direction} email and badge update without interaction`, { evidence, visibilityMs: Date.now() - observedAt });
      if (owner.firstName === 'B') assert.equal(await prisma.session.count({ where: { userId: agents[1].owner.id } }), 0, 'B cannot depend on A being signed in');
    }
    await stopWorker(); stopWorker = undefined;
    for (let attempt = 0; attempt < 100 && await prisma.emailAccount.count({ where: { tenantId: tenant.id, syncLeaseId: { not: null } } }); attempt++) await new Promise(done => setTimeout(done, 100));
    assert.equal(await prisma.emailAccount.count({ where: { tenantId: tenant.id, syncLeaseId: { not: null } } }), 0);
    await view.tab.screenshot({ path: resolve(output, `${owner.firstName}-${module}-${surface}-${filter.toLowerCase()}.png`) });
    await view.close();
  }
  }
  const associated = await fixture('deals', true), body = await ingest(associated, 'inbound', false);
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
  for (const agent of agents) {
    const session = (await issueAuthSession(agent.owner)).token;
    const response = await originalFetch(apiBase + '/crm/activities?type=email&limit=100', { headers: { authorization: `Bearer ${session}` } });
    assert.equal(response.status, 200); const own = await response.json();
    assert.ok(own.total > 0); assert.ok(own.data.every(activity => activity.metadata.email.accountId === agent.account.id && activity.createdBy.id === agent.owner.id));
    const other = agents.find(item => item !== agent);
    const denied = await originalFetch(apiBase + '/crm/activities?type=email&leadId=' + other.leadIds[0], { headers: { authorization: `Bearer ${session}` } });
    assert.ok([200, 403, 404].includes(denied.status)); assert.deepEqual((await denied.json()).data ?? [], []);
  }
  record('Both Sales agents read only their own mailbox Activities; the other assigned Lead remains inaccessible');
  assert.deepEqual(pageErrors, []); assert.deepEqual(transportErrors, []); assert.deepEqual(serverErrors, []); assert.deepEqual(providerRequests, []);
  assert.ok(gmailReads.some(read => read.userId === agents[0].owner.id)); assert.ok(gmailReads.some(read => read.userId === agents[1].owner.id));
  writeFileSync(resolve(output, 'results.json'), JSON.stringify({ checks, pageErrors, transportErrors, serverErrors, providerRequests, gmailReads }, null, 2));
  console.log(`Mailbox Activity browser acceptance passed: ${checks.length} checks. Evidence: ${output}`);
} catch (error) {
  process.exitCode = 1;
  if (page && !page.isClosed()) { await page.screenshot({ path: resolve(output, 'failure.png') }).catch(() => {}); writeFileSync(resolve(output, 'failure.txt'), await page.locator('body').innerText().catch(() => '')); }
  writeFileSync(resolve(output, 'results.json'), JSON.stringify({ checks, pageErrors, transportErrors, serverErrors, providerRequests, error: String(error) }, null, 2));
  throw error;
} finally {
  closing = true;
  await stopWorker?.();
  const shutdown = setTimeout(() => process.exit(process.exitCode ?? 0), 20000); shutdown.unref();
  await browser?.close(); frontend?.kill();
  if (api) { api.closeAllConnections(); await new Promise(done => api.close(done)); }
  await prisma.$disconnect();
}
