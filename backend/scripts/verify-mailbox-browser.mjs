// Local acceptance: real API/database/proxy/SSE, simulated Google provider only.
// Requires backend build and PLAYWRIGHT_MODULE pointing to installed Playwright.
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, createWriteStream, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { replayCrmMigrations } from './replay-crm-migrations.mjs';
import { acceptanceGateway, responsiveMatrix, createAcceptanceContext } from './verify-browser-matrix.mjs';
const root = resolve(import.meta.dirname, '../..'), output = process.env.LEADCRM_BROWSER_OUTPUT || (process.env.MAILBOX_VERIFY_OUTPUT ? resolve(process.env.MAILBOX_VERIFY_OUTPUT) : resolve(root, 'data/outputs/mailbox-browser'));
mkdirSync(output, { recursive: true });
const db = await PGlite.create(); await replayCrmMigrations(db);
const socket = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 0 }); await socket.start();
const gateway = await acceptanceGateway(output), base = gateway.base;
Object.assign(process.env, { NODE_ENV: 'test', DATABASE_URL: `postgresql://postgres:postgres@${socket.getServerConn()}/leadcrm_mailbox_browser?connection_limit=1&statement_cache_size=0`, JWT_SECRET: randomBytes(32).toString('hex'), ENCRYPTION_KEY: randomBytes(32).toString('hex'), APP_URL: base, CORS_ORIGIN: base, GMAIL_SYNC_INTERVAL_SECONDS: '60' });
process.env.DIRECT_URL = process.env.DATABASE_URL;
const require = createRequire(import.meta.url), Module = require('node:module'), originalResolve = Module._resolveFilename;
Module._resolveFilename = function(request, parent, isMain, options) { return request === '@leadcrm/shared' ? resolve(root, 'backend/dist/shared/src/index.js') : originalResolve.call(this, request, parent, isMain, options); };
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const prisma = require('../dist/backend/src/config/database.config.js').default;
const app = require('../dist/backend/src/app.js').default;
const { tenantContext } = require('../dist/backend/src/core/tenant/tenant-context.js');
const { issueAuthSession } = require('../dist/backend/src/core/auth/auth-session.js');
const { encryptToken } = require('../dist/backend/src/core/encryption/crypto.service.js');
const { ingestMailboxMessages } = require('../dist/backend/src/integrations/gmail/mailbox-ingestion.service.js');
const { resolveMailboxScope } = require('../dist/backend/src/integrations/gmail/mailbox-scope.js');
const { startMailboxScheduler } = require('../dist/backend/src/integrations/gmail/mailbox-sync.service.js');
const { runScheduledMailboxEmails } = require('../dist/backend/src/integrations/gmail/scheduled-mailbox.service.js');
const rights = { leadsView: true, contactsView: true, leadsEdit: true, contactsEdit: true, dealsEdit: true, dealsView: true };
const realFetch = globalThis.fetch, calls = [], messages = new Map(), drafts = new Map(), attachmentBytes = new Map();
let api, frontend, browser, secondBrowser, stopWorker, account, pageForFailure, history = [], sends = 0;
const checks = [], pageErrors = [], transportErrors = [];
const apiMessage = email => ({ id: email.id, threadId: email.threadId, labelIds: email.labels, snippet: email.snippet, internalDate: String(Date.parse(email.date)), payload: { headers: [{ name: 'From', value: email.from }, { name: 'To', value: email.to.join(', ') }, { name: 'Subject', value: email.subject }, ...(email.rfcMessageId ? [{ name: 'Message-ID', value: email.rfcMessageId }] : [])], mimeType: email.attachments?.length ? 'multipart/mixed' : email.bodyMimeType ?? 'text/html', ...(email.attachments?.length ? { parts: [{ mimeType: 'text/html', body: { data: Buffer.from(email.body).toString('base64url') } }, ...email.attachments.map(file => ({ filename: file.filename, mimeType: file.mimeType, headers: file.contentId ? [{ name: 'Content-ID', value: `<${file.contentId}>` }, { name: 'Content-Disposition', value: 'inline' }] : [], body: { attachmentId: file.id, size: file.size } }))] } : { body: { data: Buffer.from(email.body).toString('base64url') } }) } });
globalThis.fetch = async (input, init) => {
  const url = String(input);
  if (!url.startsWith('https://gmail.googleapis.com/')) return realFetch(input, init);
  const path = new URL(url).pathname.split('/me/')[1]; calls.push({ path, method: init?.method ?? 'GET' });
  if (/^messages\/[^/]+\/attachments\//.test(path)) {
    const bytes = attachmentBytes.get(path.split('/').pop());
    return bytes ? Response.json({ data: bytes.toString('base64url'), size: bytes.length }) : Response.json({ error: {} }, { status: 404 });
  }
  if (path === 'history') { const ids = history; history = []; return Response.json({ historyId: '120', history: [{ messagesAdded: ids.map(id => ({ message: { id } })) }] }); }
  if (path === 'drafts' && init?.method === 'POST' || path.startsWith('drafts/') && init?.method === 'PUT') {
    const raw = Buffer.from(JSON.parse(init.body).message.raw, 'base64url').toString();
    const header = name => raw.match(new RegExp('^' + name + ': (.*)$', 'im'))?.[1].trim() ?? '';
    const id = path === 'drafts' ? 'draft-' + randomUUID() : path.slice(7);
    const body = raw.split('\r\n\r\n').slice(1).join('\r\n\r\n');
    const subject = header('Subject').replace(/=\?UTF-8\?B\?(.+)\?=/i, (_, encoded) => Buffer.from(encoded, 'base64').toString());
    const email = { id: id + '-message', threadId: JSON.parse(init.body).message.threadId ?? id, from: account.email, to: header('To').split(',').map(value => value.trim()), subject, body, snippet: 'Scheduled details', date: new Date().toISOString(), labels: ['DRAFT'], rfcMessageId: header('Message-ID') };
    drafts.set(id, email); messages.set(email.id, email); return Response.json({ id, message: { id: email.id, threadId: email.threadId } });
  }
  if (path === 'drafts/send') {
    const id = JSON.parse(init.body).id, draft = drafts.get(id); assert.ok(draft); sends++;
    const email = { ...draft, id: 'sent-' + randomUUID(), labels: ['SENT'], date: new Date(Date.now() - 50).toISOString() };
    messages.set(email.id, email); return Response.json({ id: email.id, threadId: email.threadId });
  }
  if (path.endsWith('/modify') || path.endsWith('/trash')) {
    const email = messages.get(path.split('/')[1]);
    if (email) { const data = init?.body ? JSON.parse(init.body) : {}; email.labels = path.endsWith('/trash') ? [...email.labels, 'TRASH'] : [...new Set([...email.labels.filter(label => !(data.removeLabelIds ?? []).includes(label)), ...(data.addLabelIds ?? [])])]; }
    return Response.json({});
  }
  if (path.startsWith('drafts/') && init?.method !== 'DELETE') return Response.json({ message: apiMessage(drafts.get(path.slice(7))) });
  if (path.startsWith('messages/') && init?.method === undefined) return Response.json(apiMessage(messages.get(path.slice(9))));
  if (init?.method === 'DELETE') return new Response(null, { status: 204 });
  if (path.endsWith('/modify') || path.endsWith('/trash')) return Response.json({});
  throw new Error('Unexpected provider request: ' + path);
};
try {
  const tenant = await prisma.tenant.create({ data: { name: 'Mailbox Acceptance', slug: randomUUID(), onboardingStep: 3, onboardingCompletedAt: new Date() } });
  const user = await prisma.user.create({ data: { tenantId: tenant.id, firstName: 'Inbox', lastName: 'Tester', email: 'inbox-preview@camxian.com', role: 'Client Admin', mustChangePassword: false, onboardingCompletedAt: new Date() } });
  await prisma.user.create({ data: { tenantId: tenant.id, firstName: 'Planning', lastName: 'Team', email: 'planning.and.implementation.team.with.a.long.address@camxian.com', role: 'Sales' } });
  const { token } = await issueAuthSession(user), scope = fn => tenantContext.run({ tenantId: tenant.id }, fn);
  account = await prisma.emailAccount.create({ data: { tenantId: tenant.id, userId: user.id, email: user.email, accessToken: encryptToken('preview-only'), tokenExpiresAt: new Date(Date.now() + 3600000), scopes: ['https://www.googleapis.com/auth/gmail.modify'], syncCursor: '100', lastSyncAt: new Date() } });
  const lead = await prisma.lead.create({ data: { tenantId: tenant.id, assignedUserId: user.id, firstName: 'Doris', lastName: 'Customer', email: 'doris.customer.inquiry.with.a.long.address@example.test', productInterest: [] } });
  const { salesPipeline, salesTransaction } = require('../dist/backend/src/modules/crm/leads/lead-automation.service.js');
  const { pipeline, initial } = await scope(() => salesTransaction(tx => salesPipeline(tx, tenant.id)));
  const deals = [];
  for (const title of ['Telephone installation', 'Fire detection and alarm system']) deals.push(await prisma.deal.create({ data: { tenantId: tenant.id, pipelineId: pipeline.id, stageId: initial.id, title, value: 1000, leadDeals: { create: { leadId: lead.id, position: 0 } }, productInterests: [], tags: [] } }));
  const mail = (id, subject, from = `Doris <${lead.email}>`) => ({ id, threadId: id, from, to: [account.email], subject, body: '<p>We have 25 employees and need around 18 phones.</p><p>Please send your recommendation for extensions, call transfer, and an automated greeting.</p><pre>' + 'Long technical details '.repeat(20) + '</pre>', snippet: 'We have 25 employees and need around 18 phones.', labels: ['INBOX', 'UNREAD'], isRead: false, date: new Date(Date.now() - 60000).toISOString(), rfcMessageId: `<${id}@mailbox-preview.example.test>` });
  const seed = [mail('inquiry', 'Re: Thank You for Your Inquiry – IPBX/IP PHONES/PABGM Solutions'), mail('welcome', 'Welcome to LeadCRM', 'Camxian Technologies <info@camxian.com>')];
  const older = { ...mail('earlier', 'Thank You for Your Inquiry – IPBX/IP PHONES/PABGM Solutions', account.email), threadId: 'inquiry', to: [lead.email], labels: ['SENT'], isRead: true, date: new Date(Date.now() - 120000).toISOString(), body: '<p>Thank you for your inquiry. Please tell us about your requirements.</p>' };
  const PDFDocument = require('pdfkit');
  const pdf = await new Promise(done => { const document = new PDFDocument(), chunks = []; document.on('data', chunk => chunks.push(chunk)); document.on('end', () => done(Buffer.concat(chunks))); document.fontSize(24).text('Quotation QT-2026-00124'); document.fontSize(12).text('Original Gmail attachment fixture'); document.addPage().text('Second original PDF page'); document.end(); });
  const logo = readFileSync(resolve(root, 'frontend/public/leadcrm_logo.png'));
  attachmentBytes.set('quotation-pdf', pdf); attachmentBytes.set('inline-logo', logo); attachmentBytes.set('photo', logo); attachmentBytes.set('office', Buffer.from('Original unsupported file bytes'));
  seed[0].attachments = [{ id: 'quotation-pdf', filename: 'QT-2026-00124.pdf', mimeType: 'application/pdf', size: pdf.length }, { id: 'inline-logo', filename: 'logo.png', contentId: 'logo@mail', disposition: 'inline', mimeType: 'image/png', size: logo.length }, { id: 'photo', filename: 'installation-photo.png', mimeType: 'image/png', size: logo.length }, { id: 'office', filename: 'specifications.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: attachmentBytes.get('office').length }];
  seed[0].body = '<style>body{background:#fff9f0}h1{color:#1264ea}.email-button{display:inline-block;background:#1264ea;color:white;padding:12px 20px;border-radius:6px}</style><h1>Quotation details</h1><img alt="Inline logo" src="cid:logo@mail" width="80"><img alt="External logo" src="https://images.example.test/logo.png" width="80"><p><a class="email-button" href="https://example.test/quotation">View quotation</a></p>' + seed[0].body;
  seed[0].body += '<div class="gmail_quote"><p>On Thursday, staff wrote:</p><blockquote>Thank you for your inquiry. Please tell us about your requirements.</blockquote></div><table><tbody><tr>' + Array.from({ length: 12 }, (_, i) => `<td>Specification${i}XXXXXXXXXXXXXXXXXXXXX</td>`).join('') + '</tr></tbody></table><p>' + 'https://example.test/'.repeat(12) + '</p><script>window.emailAttack=true;parent.emailAttack=true</script><img src="javascript:alert(1)" onerror="parent.emailAttack=true"><iframe src="https://evil.example.test"></iframe>';
  const otherSenderName = 'Doris Customer With A Long Sender Name For Layout Checks';
  const otherTopic = { ...mail('other-topic', 'CCTV installation quotation with a long subject covering requirements, installation, commissioning and maintenance', `${otherSenderName} <${lead.email}>`), bodyMimeType: 'text/plain', body: 'Plain quotation details\n<Original & preserved>', date: new Date(Date.now() - 180000).toISOString(), labels: ['INBOX'], isRead: true };
  const { buildPasswordResetEmail } = require('../dist/backend/src/shared/services/auth-email.templates.js');
  const reset = { ...mail('reset', 'Reset your LeadCRM password', 'Camxian Technologies <info@camxian.com>'), body: buildPasswordResetEmail(base + '/reset-password?token=fixture-only', 'Julie Ann'), date: new Date(Date.now() - 240000).toISOString() };
  seed.push(older, otherTopic, reset);
  seed.forEach(email => messages.set(email.id, email)); await scope(() => ingestMailboxMessages(account, seed, rights));
  await prisma.emailAccount.update({ where: { id: account.id }, data: { syncScopeHash: (await resolveMailboxScope(account, rights)).hash } });
  api = app.listen(0, '127.0.0.1'); await new Promise(done => api.once('listening', done));
  const apiBase = `http://127.0.0.1:${api.address().port}/api/v1`;
  const initialList = await realFetch(apiBase + '/integrations/gmail/emails?filter=all&sort=newest&query=&maxResults=30', { headers: { Authorization: `Bearer ${token}` } });
  const initialPayload = await initialList.json();
  writeFileSync(resolve(output, 'initial-api.json'), JSON.stringify({ status: initialList.status, payload: initialPayload }, null, 2));
  assert.equal(initialList.status, 200);
  assert.equal(await prisma.mailboxMessage.count({ where: { accountId: account.id } }), seed.length, 'Every authorized synthetic seed must persist before browser acceptance');
  const log = createWriteStream(resolve(output, 'frontend.log'));
  frontend = spawn(process.execPath, [resolve(root, 'node_modules/next/dist/bin/next'), 'start', '-p', new URL(gateway.internalBase).port, '-H', '127.0.0.1'], { cwd: resolve(root, 'frontend'), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NODE_ENV: 'development', LEADCRM_QA_BUILD_ASSETS: '1', API_URL: apiBase } });
  frontend.stdout.pipe(log); frontend.stderr.pipe(log);
  for (let attempt = 0; attempt < 90; attempt++) { try { if ((await realFetch(gateway.internalBase + '/login')).ok) break; } catch {} await new Promise(done => setTimeout(done, 500)); }
  // Warm the built route before starting the public TLS gateway and browser timing.
  const warmedInbox = await realFetch(gateway.internalBase + '/inbox', { signal: AbortSignal.timeout(180000) });
  assert.equal(warmedInbox.status, 200, 'The local Inbox route must be available before browser assertions');
  await warmedInbox.arrayBuffer();
  await gateway.start();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await createAcceptanceContext(browser, { ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } });
  // The isolation catch-all must allow Chrome's bundled PDF viewer, which uses
  // browser-internal resources rather than network/provider requests.
  await context.route(/^chrome(?:-extension)?:\/\/(?:mhjfbmdgcfjbbpaeojofohoefgiehjai|resources)\//, route => route.continue());
  await context.addCookies([{ name: 'leadcrm_token', value: token, url: base, httpOnly: true, sameSite: 'Lax' }]);
  const page = await context.newPage(); pageForFailure = page; page.setDefaultTimeout(30000); page.setDefaultNavigationTimeout(120000); page.setDefaultNavigationTimeout(120000); page.on('pageerror', error => pageErrors.push(error.message));
  const imageReady = async locator => {
    let state;
    // Recovery can replace srcdoc while an image loads; poll the current frame DOM.
    for (let attempt = 0; attempt < 100; attempt++) {
      state = await locator.evaluate(img => ({ src: img.currentSrc || img.src, complete: img.complete, width: img.naturalWidth }));
      if (state.complete && state.width > 0) return;
      await page.waitForTimeout(100);
    }
    await page.screenshot({ path: resolve(output, 'image-load-failure.png'), fullPage: true });
    assert.fail('Email image did not load: ' + JSON.stringify({ state, transportErrors }));
  };
  let remoteImageLoads = 0;
  await context.route('https://images.example.test/logo.png', async route => {
    remoteImageLoads++; assert.equal(route.request().headers().referer, undefined); assert.equal(route.request().headers().cookie, undefined);
    await route.fulfill({ contentType: 'image/png', body: logo });
  });
  page.on('requestfailed', request => { if (!request.url().includes('/events') && request.failure()?.errorText !== 'net::ERR_ABORTED') transportErrors.push({ url: request.url(), error: request.failure()?.errorText }); });
  let browserSyncs = 0; context.on('request', request => { if (request.url().includes('/integrations/gmail/sync')) browserSyncs++; });
  await page.goto(base + '/inbox', { waitUntil: 'domcontentloaded' });
  try { await page.getByText(seed[0].subject, { exact: true }).waitFor({ timeout: 120000 }); }
  catch (error) { await page.screenshot({ path: resolve(output, 'startup-failure.png'), fullPage: true }); writeFileSync(resolve(output, 'startup-page.txt'), await page.locator('body').innerText()); throw error; }
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
  const responsive = async (label, toolbar = false) => {
    for await (const { theme, width } of responsiveMatrix(page)) {
      await page.setViewportSize({ width, height: 900 }); await page.waitForTimeout(350);
      const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, toolbar: (() => { const bar = document.querySelector('[role="toolbar"][aria-label="Message formatting"]'); if (!bar) return null; return { width: bar.clientWidth, scroll: bar.scrollWidth, positions: [...bar.querySelectorAll('button')].map(el => Math.round(el.getBoundingClientRect().top)), sendBottom: document.querySelector('[aria-label="Send email"]').getBoundingClientRect().bottom }; })() }));
      assert.ok(dimensions.document <= width + 1, `${label}: page overflow ${JSON.stringify(dimensions)}`);
      if (label === 'inbox') {
        const counts = await page.locator('[data-mailbox-list] span[aria-label$=" messages"]').evaluateAll(elements => elements.map(element => {
          const count = element.getBoundingClientRect(), sender = element.parentElement.getBoundingClientRect();
          return { text: element.textContent, visible: count.width > 0 && count.left >= sender.left && count.right <= sender.right };
        }));
        assert.equal(counts.length, 2); assert.ok(counts.every(count => count.visible), `Message count clipped at ${width}px: ${JSON.stringify(counts)}`);
      }
      if (label === 'conversation' || label.endsWith('-conversation')) {
        const layout = await page.evaluate(() => {
          const fits = element => { const box = element.getBoundingClientRect(); return box.width > 0 && box.left >= -1 && box.right <= innerWidth + 1; };
          const toolbar = document.querySelector('[role="toolbar"][aria-label="Conversation actions"]');
          const controls = [...toolbar.querySelectorAll('button')].map(element => element.getBoundingClientRect());
          return {
            toolbar: fits(toolbar) && controls.every((box, index) => box.width >= 40 && (!index || box.left >= controls[index - 1].right)),
            headers: [...document.querySelectorAll('article button[aria-controls]')].every(button => {
              const chevron = button.lastElementChild;
              const senderRow = button.children[1].firstElementChild;
              const date = senderRow.querySelector('time');
              const preview = button.getAttribute('aria-expanded') === 'false' ? button.children[1].lastElementChild : null;
              return fits(button) && fits(chevron) && getComputedStyle(chevron).display !== 'none' &&
                (!date || senderRow.firstElementChild.getBoundingClientRect().right <= date.getBoundingClientRect().left) &&
                (!preview || getComputedStyle(preview).whiteSpace === 'nowrap' && preview.clientHeight <= parseFloat(getComputedStyle(preview).lineHeight) + 1);
            }),
            subjects: [...document.querySelectorAll('article h2')].every(fits),
            attachments: [...document.querySelectorAll('[aria-label="Message attachments"] li, [aria-label="Message attachments"] button')].every(fits),
            links: [...document.querySelectorAll('article a[href^="/crm/"]')].every(fits),
            actions: [...document.querySelectorAll('article')].every(article => {
              const expanded = article.querySelector('button[aria-controls]').getAttribute('aria-expanded') === 'true';
              const buttons = [...article.querySelectorAll('button')];
              return ['Reply', 'Forward'].every(label => buttons.filter(button => button.textContent.trim() === label).length === (expanded ? 1 : 0)) &&
                !article.querySelector('[data-message-header]').textContent.match(/Reply|Forward/);
            }),
            replyAll: !![...document.querySelectorAll('button')].find(button => /reply\s*all/i.test(button.textContent + ' ' + button.getAttribute('aria-label'))),
          };
        });
        assert.equal(layout.replyAll, false); for (const [part, valid] of Object.entries(layout).filter(([part]) => part !== 'replyAll')) assert.ok(valid, `${label}: ${part} at ${width}px ${theme}`);
      }
      if (toolbar) { assert.equal(new Set(dimensions.toolbar.positions).size, 1); assert.ok(dimensions.toolbar.positions[0] >= dimensions.toolbar.sendBottom); }
      checks.push({ label, theme, width, ...dimensions }); await page.screenshot({ path: resolve(output, `${label}-${theme}-${width}.png`) });
    }
  };
  await responsive('inbox');
  assert.equal(await page.getByRole('button', { name: /Open email from/ }).count(), 2);
  await page.getByLabel('3 messages', { exact: true }).waitFor();
  await page.getByLabel('2 messages', { exact: true }).waitFor();
  // Manual refresh must retain chrome, suppress duplicate requests and restore
  // cached conversations after a failed read. Provider sync is never invoked.
  await page.setViewportSize({ width: 1440, height: 900 });
  let releaseRefresh, refreshRequests = 0;
  await page.route('**/integrations/gmail/emails?**', async route => {
    refreshRequests++; await new Promise(done => { releaseRefresh = done; }); await route.continue();
  });
  await page.getByLabel('Refresh', { exact: true }).click();
  await page.getByRole('status', { name: 'Loading conversations' }).waitFor();
  assert.ok(await page.getByRole('toolbar', { name: 'Email list actions' }).isVisible());
  for (const name of ['Inbox', 'Work email', 'Sync now', 'Disconnect']) assert.ok(await page.getByText(name, { exact: true }).isVisible());
  assert.ok(await page.getByLabel('Search email', { exact: true }).isVisible());
  await page.getByLabel('Refresh', { exact: true }).evaluate(button => button.click());
  assert.equal(refreshRequests, 1);
  await page.screenshot({ path: resolve(output, 'refresh-spinner-1440.png') });
  releaseRefresh(); await page.getByRole('status', { name: 'Loading conversations' }).waitFor({ state: 'hidden' });
  await page.unroute('**/integrations/gmail/emails?**');
  await page.route('**/integrations/gmail/emails?**', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Controlled refresh failure' }) }));
  await page.getByLabel('Refresh', { exact: true }).click();
  await page.getByText('Controlled refresh failure', { exact: true }).waitFor(); await page.getByRole('status', { name: 'Loading conversations' }).waitFor({ state: 'hidden' });
  assert.equal(await page.getByRole('button', { name: /Open email from/ }).count(), 2);
  assert.equal(await page.getByText('No emails found', { exact: true }).count(), 0);
  await page.unroute('**/integrations/gmail/emails?**');
  await page.getByLabel('Refresh', { exact: true }).click(); await page.getByText('Controlled refresh failure', { exact: true }).waitFor({ state: 'hidden' });
  checks.push({ label: 'One row per exact correspondent across separate topics, including Welcome/Reset; refresh spinner below visible toolbar; duplicate click suppressed; cached rows restored on failure; successful retry' });
  await page.getByLabel('Filter emails').click(); assert.deepEqual(await page.getByRole('menuitemradio').allTextContents(), ['All emails', 'Unread only', 'Sent', 'Scheduled', 'Drafts only']);
  await page.getByRole('menuitemradio', { name: 'All emails', exact: true }).click();
  await page.getByText(seed[1].subject, { exact: true }).click();
  await page.locator('article').nth(1).waitFor();
  await page.getByText('Loading conversation…', { exact: true }).waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Expand message from Camxian Technologies', exact: true }).click();
  const resetFrame = page.frameLocator('iframe[data-mailbox-body]').first();
  await resetFrame.getByRole('heading', { name: 'Reset your password' }).waitFor();
  assert.equal(await resetFrame.getByRole('link', { name: 'Reset password' }).evaluate(el => getComputedStyle(el.parentElement).backgroundColor), 'rgb(18, 100, 234)');
  await imageReady(resetFrame.getByAltText('LeadCRM logo'));
  assert.ok(await resetFrame.getByAltText('LeadCRM logo').evaluate(img => img.naturalWidth > 0));
  await responsive('password-reset'); await page.getByRole('button', { name: 'Back to inbox' }).click();
  await page.getByText(seed[0].subject, { exact: true }).click(); await page.getByRole('heading', { name: seed[0].subject, exact: true }).waitFor();
  await page.getByRole('button', { name: 'Reply', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Collapse message from Doris' }).waitFor();
  await page.locator('article').nth(1).waitFor();
  assert.equal(await page.locator('article').count(), 3);
  assert.equal(await page.getByRole('heading', { name: otherTopic.subject, exact: true }).count(), 0);
  assert.equal(await page.getByRole('heading', { name: older.subject, exact: true }).count(), 0);
  assert.equal(await page.getByText('Toolbar actions apply to all accessible messages.', { exact: false }).count(), 0);
  assert.ok(await page.getByRole('heading', { level: 1 }).isVisible());
  assert.ok(await page.getByLabel('3 messages', { exact: true }).isVisible());
  await page.getByRole('button', { name: `Actions for topic: ${otherTopic.subject}`, exact: true }).click();
  assert.ok(await page.getByRole('menuitem', { name: `Archive topic: ${otherTopic.subject}`, exact: true }).isVisible());
  assert.ok(await page.getByRole('menuitem', { name: `Trash topic: ${otherTopic.subject}`, exact: true }).isVisible());
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('button', { name: 'Expand message from inbox-preview' }).getAttribute('aria-expanded'), 'false');
  const bodyFrame = page.frameLocator('iframe[data-mailbox-body]').last();
  await bodyFrame.getByAltText('Inline logo').waitFor();
  await imageReady(bodyFrame.getByAltText('Inline logo'));
  assert.equal(await bodyFrame.locator('details').evaluate(el => el.open), false);
  assert.ok(remoteImageLoads > 0, 'External images load automatically');
  assert.equal(await bodyFrame.getByRole('heading', { name: 'Quotation details' }).evaluate(el => getComputedStyle(el).color), 'rgb(18, 100, 234)');
  assert.equal(await bodyFrame.getByRole('link', { name: 'View quotation' }).evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(18, 100, 234)');
  assert.notEqual(await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(255, 249, 240)');
  assert.equal(await bodyFrame.locator('script,iframe,[onerror]').count(), 0);
  assert.equal(await bodyFrame.locator('body').evaluate(() => window.emailAttack), undefined);
  const originalDownload = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download QT-2026-00124.pdf' }).click();
  const download = await originalDownload;
  assert.equal(download.suggestedFilename(), 'QT-2026-00124.pdf'); assert.deepEqual(readFileSync(await download.path()), pdf);
  assert.equal(await page.getByRole('button', { name: 'Preview specifications.docx' }).count(), 0);
  await page.getByRole('button', { name: 'Preview QT-2026-00124.pdf' }).click();
  await page.getByTitle('Email attachment PDF preview').waitFor();
  let nativePdf, pageCount;
  for (let attempt = 0; attempt < 100; attempt++) {
    nativePdf = page.frames().find(frame => frame.url().startsWith('chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai/'));
    if (nativePdf && await nativePdf.locator('viewer-page-selector').count()) pageCount = await nativePdf.locator('viewer-page-selector').evaluate(element => element.docLength);
    if (pageCount === 2) break;
    await page.waitForTimeout(100);
  }
  assert.equal(pageCount, 2, 'Native PDF viewer renders both original pages');
  const pdfSource = await page.getByTitle('Email attachment PDF preview').getAttribute('src');
  assert.deepEqual(Buffer.from(await page.evaluate(async source => [...new Uint8Array(await (await fetch(source.split('#')[0])).arrayBuffer())], pdfSource)), pdf);
  await responsive('pdf-preview');
  await nativePdf.locator('viewer-page-selector input').fill('2'); await nativePdf.locator('viewer-page-selector input').press('Enter');
  for (let attempt = 0; attempt < 30 && await nativePdf.locator('viewer-page-selector').evaluate(element => element.pageNo) !== 2; attempt++) await page.waitForTimeout(100);
  assert.equal(await nativePdf.locator('viewer-page-selector').evaluate(element => element.pageNo), 2);
  await page.screenshot({ path: resolve(output, 'pdf-page-two.png') });
  await page.getByLabel('Close sheet', { exact: true }).click();
  await page.getByRole('button', { name: 'Preview installation-photo.png' }).click(); await page.getByRole('dialog', { name: 'installation-photo.png' }).waitFor();
  await responsive('image-preview'); await page.getByLabel('Close sheet', { exact: true }).click();
  checks.push({ label: 'Formatted isolated HTML, automatic no-referrer remote images, authorized CID images, original two-page PDF preview/download bytes and native image preview' });
  await page.getByRole('button', { name: `Expand message from ${otherSenderName}`, exact: true }).click();
  const plainFrame = page.frameLocator('iframe[data-mailbox-body]').first();
  await plainFrame.locator('pre').waitFor(); assert.equal(await plainFrame.locator('pre').innerText(), otherTopic.body);
  assert.ok(await page.getByRole('heading', { name: otherTopic.subject, exact: true }).isVisible());
  await responsive('plain-conversation');
  await page.getByRole('button', { name: `Collapse message from ${otherSenderName}`, exact: true }).click();
  checks.push({ label: 'Plain text retains whitespace and escapes markup; original password-reset template retains branding and button styles' });
  await responsive('conversation');
  await bodyFrame.getByText('Show trimmed content', { exact: true }).click(); assert.equal(await bodyFrame.locator('details').evaluate(el => el.open), true);
  await page.getByRole('button', { name: 'Expand message from inbox-preview' }).focus(); await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Collapse message from inbox-preview' }).waitFor();
  await responsive('expanded-conversation');
  assert.equal(await bodyFrame.locator('details').evaluate(el => el.open), true, 'Opening another message or refreshing the thread must retain expanded quotes');
  assert.equal(await page.evaluate(() => window.emailAttack), undefined);
  const storedRead = await prisma.mailboxMessage.findFirstOrThrow({ where: { accountId: account.id, providerMessageId: 'inquiry' } }); assert.ok(!storedRead.labels.includes('UNREAD'));
  const readWrites = calls.filter(call => call.path === 'messages/inquiry/modify').length; assert.equal(readWrites, 1);
  await page.getByRole('combobox', { name: 'Associate conversation with Deal' }).last().selectOption(deals[1].id);
  await page.getByRole('button', { name: 'Associate Deal', exact: true }).last().click(); await page.getByRole('link', { name: 'View related Deal' }).first().waitFor();
  assert.equal((await prisma.deal.findUniqueOrThrow({ where: { id: deals[1].id } })).stageId, initial.id);
  await responsive('associated-conversation');
  checks.push({ label: 'Vertical order, keyboard collapse, sanitized expandable quote, persisted read, one read write and Deal association without stage movement' });
  await page.getByRole('button', { name: 'Reply', exact: true }).last().click(); await page.getByLabel('To', { exact: true }).waitFor(); assert.equal(await page.getByLabel('To', { exact: true }).inputValue(), lead.email);
  await responsive('composer', true);
  const scheduledSubject = seed[0].subject;
  await page.getByPlaceholder('Subject', { exact: true }).fill(scheduledSubject);
  await page.getByLabel('Email body', { exact: true }).fill('Please review our proposed telephone setup.');
  await page.getByLabel('Schedule send options').click(); await responsive('schedule-picker', true);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click(); assert.equal(await prisma.scheduledMailboxEmail.count(), 0);
  await page.getByLabel('Schedule send options').click(); await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('dialog', { name: 'Compose email' }).waitFor({ state: 'hidden' }); await page.getByRole('button', { name: 'Back to inbox' }).click();
  await page.getByRole('heading', { name: 'Inbox', exact: true }).waitFor();
  const scheduled = await prisma.scheduledMailboxEmail.findFirstOrThrow(); assert.equal(scheduled.status, 'pending'); assert.equal(sends, 0);
  await page.getByLabel('Filter emails').click(); await page.getByRole('menuitemradio', { name: 'Scheduled', exact: true }).click(); await page.getByText(scheduledSubject, { exact: true }).waitFor();
  await page.reload(); await page.getByText(seed[0].subject, { exact: true }).waitFor();
  secondBrowser = await chromium.launch({ channel: 'chrome', headless: true });
  const secondContext = await createAcceptanceContext(secondBrowser, { ignoreHTTPSErrors: true, storageState: await context.storageState(), viewport: { width: 1440, height: 900 } });
  const second = await secondContext.newPage(); second.setDefaultNavigationTimeout(120000); await second.goto(base + '/inbox', { waitUntil: 'domcontentloaded' }); await second.getByText(seed[0].subject, { exact: true }).waitFor();
  const events = [];
  for (const [index, target] of [page, second].entries()) {
    const session = await target.context().newCDPSession(target); await session.send('Network.enable');
    session.on('Network.eventSourceMessageReceived', event => events.push({ session: index, name: event.eventName, data: event.data }));
  }
  console.log(JSON.stringify({ visibleSessions: await Promise.all([page, second].map(target => target.evaluate(() => document.visibilityState))) }));
  for (const target of [page, second]) await target.evaluate(() => { window.mailboxLoadingFlashes = 0; new MutationObserver(() => { if (document.body.textContent.includes('Loading emails...')) window.mailboxLoadingFlashes++; }).observe(document.body, { childList: true, subtree: true }); });
  assert.equal(browserSyncs, 0); assert.equal(calls.filter(call => call.path === 'history').length, 0);
  const relevant = { ...mail('new-customer', seed[0].subject), threadId: 'inquiry', snippet: 'Realtime customer acceptance' }, unrelated = { ...mail('new-bank', 'Private unrelated acceptance', 'bank@example.test'), threadId: 'inquiry' };
  messages.set(relevant.id, relevant); messages.set(unrelated.id, unrelated); history = [relevant.id, unrelated.id];
  await prisma.emailAccount.update({ where: { id: account.id }, data: { lastSyncAt: new Date(Date.now() - 61000) } });
  const start = Date.now();
  stopWorker = startMailboxScheduler();
  try { await page.getByText('— Realtime customer acceptance', { exact: true }).waitFor(); await second.getByText('— Realtime customer acceptance', { exact: true }).waitFor(); }
  catch (error) {
    console.log(JSON.stringify({ events, visibleSessions: await Promise.all([page, second].map(target => target.evaluate(() => document.visibilityState))), accountVersion: (await prisma.emailAccount.findUniqueOrThrow({ where: { id: account.id } })).mailboxVersion }));
    throw error;
  }
  for (const target of [page, second]) { assert.equal(await target.getByRole('button', { name: /Open email from/ }).count(), 2); await target.getByLabel('4 messages', { exact: true }).waitFor(); }
  assert.equal(await page.getByText(unrelated.subject).count(), 0); assert.equal(await prisma.mailboxMessage.count({ where: { providerMessageId: relevant.id } }), 1);
  assert.equal(calls.filter(call => call.path === 'history').length, 1); assert.equal(browserSyncs, 0);
  checks.push({ label: 'server incremental Gmail check through real API, worker, database, proxy and two SSE tabs', elapsedMs: Date.now() - start, providerHistoryCalls: 1, browserSyncs });
  await stopWorker(); stopWorker = undefined;
  await page.getByLabel('Filter emails').click(); await page.getByRole('menuitemradio', { name: 'Scheduled', exact: true }).click(); await page.getByText(scheduledSubject, { exact: true }).waitFor();
  await prisma.scheduledMailboxEmail.update({ where: { id: scheduled.id }, data: { scheduledAt: new Date(Date.now() - 1000) } });
  await runScheduledMailboxEmails(); await runScheduledMailboxEmails(); assert.equal(sends, 1); assert.equal((await prisma.scheduledMailboxEmail.findUniqueOrThrow({ where: { id: scheduled.id } })).status, 'sent');
  await page.getByText('No emails found', { exact: true }).waitFor(); await second.getByLabel('5 messages', { exact: true }).waitFor();
  for (const target of [page, second]) assert.equal(await target.evaluate(() => window.mailboxLoadingFlashes), 0);
  await page.getByLabel('Filter emails').click(); await page.getByRole('menuitemradio', { name: 'Sent', exact: true }).click(); await page.getByText(scheduledSubject, { exact: true }).waitFor();
  checks.push({ label: 'schedule survived browser reload; controlled due time sent once; two-tab Scheduled to Sent SSE transition without loading flashes', sends });
  await page.screenshot({ path: resolve(output, 'sent-320.png') });
  assert.deepEqual(pageErrors, []); assert.deepEqual(transportErrors, []); writeFileSync(resolve(output, 'results.json'), JSON.stringify({ checks, pageErrors, transportErrors, provider: 'Simulated. No real email sent.', backend: 'Compiled build', frontend: 'Local built Next.js frontend' }, null, 2));
  console.log(JSON.stringify({ passed: checks.length, output, sends, browserSyncs }));
} catch (error) {
  if (pageForFailure && !pageForFailure.isClosed()) {
    await pageForFailure.screenshot({ path: resolve(output, 'failure.png'), fullPage: true }).catch(() => {});
    writeFileSync(resolve(output, 'failure-page.html'), await pageForFailure.content());
  }
  throw error;
} finally {
  await stopWorker?.(); await secondBrowser?.close(); await browser?.close(); frontend?.kill();
  if (api) { api.closeAllConnections(); await new Promise(done => api.close(done)); }
  await gateway.close();
  globalThis.fetch = realFetch; await prisma.$disconnect(); await socket.stop(); await db.close();
}
