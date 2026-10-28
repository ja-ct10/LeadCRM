// Real local API/SQL preview. All data and credentials belong to this disposable fixture.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, createWriteStream } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..'), output = resolve(root, 'data/outputs/source-attribution');
mkdirSync(output, { recursive: true });
const require = createRequire(import.meta.url), { qaEnvironment } = require('./qa-environment.cjs');
const { notificationTestPostgres } = await import('../backend/scripts/notification-test-postgres.mjs');
const pg = await notificationTestPostgres();
let frontend, api, website, browser, prisma, activePage;
try {
  const url = await pg.database('leadcrm_source_demo_1'), base = 'http://localhost:3300';
  Object.assign(process.env, qaEnvironment(root, { DATABASE_URL: url, DIRECT_URL: url, APP_URL: base, ALLOWED_ORIGINS: base, API_URL: 'http://127.0.0.1:4300/api/v1', PUBLIC_FORM_ORIGIN: base, LEADCRM_QA_BUILD_ASSETS: '1' }));
  require('./qa-network-guard.cjs');
  const Module = require('node:module'), original = Module._resolveFilename;
  Module._resolveFilename = function(request, ...args) { return request === '@leadcrm/shared' ? resolve(root, 'backend/dist/shared/src/index.js') : original.call(this, request, ...args); };
  prisma = require('../backend/dist/backend/src/config/database.config.js').default;
  const app = require('../backend/dist/backend/src/app.js').default;
  const { tenantContext } = require('../backend/dist/backend/src/core/tenant/tenant-context.js');
  const { issueAuthSession } = require('../backend/dist/backend/src/core/auth/auth-session.js');
  const forms = require('../backend/dist/backend/src/modules/marketing/forms/forms.service.js');
  const { submitPublicForm } = require('../backend/dist/backend/src/modules/marketing/forms/public-forms.service.js');
  const { salesTransaction, salesPipeline } = require('../backend/dist/backend/src/modules/crm/leads/lead-automation.service.js');
  const tenant = await prisma.tenant.create({ data: { name: 'LeadCRM Source Demo', slug: randomUUID(), status: 'ACTIVE', onboardingStep: 3, onboardingCompletedAt: new Date() } });
  const previewPassword = process.argv.includes('--serve') ? 'Preview-' + randomUUID() + '7!' : undefined;
  const previewPasswordHash = previewPassword ? await require('bcryptjs').hash(previewPassword, 10) : undefined;
  const admin = await prisma.user.create({ data: { tenantId: tenant.id, firstName: 'Demo', lastName: 'Admin', email: 'source.demo@camxian.com', passwordHash: previewPasswordHash, passwordChangedAt: previewPassword ? new Date() : undefined, role: 'Client Admin', status: 'ACTIVE', mustChangePassword: false, onboardingCompletedAt: new Date(), emailVerified: new Date() } });
  await tenantContext.run({ tenantId: tenant.id }, () => salesTransaction(tx => salesPipeline(tx, tenant.id)));
  const product = await prisma.productInterest.create({ data: { tenantId: tenant.id, name: 'CCTV Surveillance System', category: 'Security', dealValue: 15000, active: true } });
  const scoped = work => tenantContext.run({ tenantId: tenant.id }, work);
  let form = await scoped(() => forms.createForm(tenant.id, admin.id, { name: 'Golden Bits - Product Inquiry' }));
  form = await scoped(() => forms.updateForm(form.id, tenant.id, admin.id, { revision: form.revision, settings: { notificationEmail: '', trackUrlParams: true, utmParams: [], allowedEmbedOrigins: ['http://localhost:3301'] } }));
  form = await scoped(() => forms.publishForm(form.id, tenant.id, admin.id));
  const touch = { params: { utm_source: 'facebook', utm_medium: 'paid_social', utm_campaign: 'security_demo' }, observedAt: new Date().toISOString() };
  await submitPublicForm(form.publicId, { requestId: randomUUID(), version: form.publishedVersion, values: { firstName: 'Maria', lastName: 'Santos', email: 'maria.source@example.test', productInterest: product.id, phone: '9123456789', address: 'Makati City' }, tracking: touch.params, attribution: { first: touch, last: touch, storage: 'session' } });
  const lead = await prisma.lead.findFirstOrThrow({ where: { tenantId: tenant.id, email: 'maria.source@example.test' } });
  const token = (await issueAuthSession(admin)).token;
  api = app.listen(4300, '127.0.0.1'); await new Promise(done => api.once('listening', done));
  website = createServer((_req, res) => { res.setHeader('Content-Type', 'text/html'); res.end(`<!doctype html><html><head><title>Demo company website</title><script src="${base}/leadcrm-forms.js" defer></script></head><body><a href="/inquiry">Continue to inquiry</a><iframe title="Business inquiry" data-leadcrm-form src="${base}/forms/${form.publicId}" style="width:100%;height:1200px;border:0"></iframe></body></html>`); });
  await new Promise(done => website.listen(3301, '127.0.0.1', done));
  frontend = spawn(process.execPath, [resolve(root, 'node_modules/next/dist/bin/next'), 'dev', '--hostname', '127.0.0.1', '--port', '3300'], { cwd: resolve(root, 'frontend'), env: { ...process.env }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  const log = createWriteStream(resolve(output, 'frontend.log')); frontend.stdout.pipe(log); frontend.stderr.pipe(log);
  // Local browser fixtures retain the development server and loopback API.
  let frontendReady = false;
  for (let i = 0; i < 120; i++) { try { if ((await fetch(base + '/login')).ok) { frontendReady = true; break; } } catch {} await new Promise(done => setTimeout(done, 500)); }
  if (!frontendReady) throw Error('The disposable frontend did not become ready; inspect frontend.log.');
  const { chromium } = require('playwright');
  browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1500 } });
  await context.addCookies([{ name: 'leadcrm_token', value: token, url: base, httpOnly: true, sameSite: 'Lax' }]);
  const page = await context.newPage(), errors = []; activePage = page;
  page.on('dialog', dialog => dialog.accept());
  page.setDefaultTimeout(60000); page.setDefaultNavigationTimeout(600000);
  page.on('pageerror', e => errors.push(e.message));
  const verifyProductPanel = async (name, hasStatus) => {
    const dialog = page.getByRole('dialog').last();
    const category = dialog.getByRole('combobox', { name: 'Product category filter' });
    const picker = dialog.getByRole('button', { name: /^Product Interests?$/ });
    await category.waitFor({ state: 'visible' }); await picker.waitFor({ state: 'visible' });
    if (await dialog.getByText('Product Category', { exact: true }).count() !== 1) throw Error(name+': repeated category label');
    await category.scrollIntoViewIfNeeded();
    const c=await category.boundingBox(), p=await picker.boundingBox();
    if (!c || !p || Math.abs(c.y-p.y)>4 || c.x>=p.x) throw Error(name+': desktop product controls are not aligned');
    if (hasStatus) { const status=await dialog.getByLabel('Status', { exact: true }).boundingBox(); if (!status || status.y>=c.y || status.width<c.width*1.8) throw Error(name+': Status must occupy its own row'); }
    await category.selectOption('Security'); await picker.click();
    const checkbox=page.getByRole('checkbox', { name: product.name, exact: true });
    await checkbox.check(); await page.keyboard.press('Escape');
    await category.selectOption(''); await picker.focus(); await page.keyboard.press('Enter');
    if (!(await checkbox.isChecked())) throw Error(name+': category change lost the selection');
    const menu=page.getByRole('group', { name: 'Product interests', exact: true });
    await page.waitForFunction(() => {
      const menu=document.querySelector('[role="group"][aria-label="Product interests"]');
      const trigger=document.querySelector('button[aria-expanded="true"][aria-label^="Product Interest"]');
      if (!menu || !trigger) return false;
      const m=menu.getBoundingClientRect(), p=trigger.getBoundingClientRect();
      return Math.abs(m.x-p.x)<4 && Math.abs(m.width-p.width)<4 && (Math.abs(m.y-p.bottom-4)<6 || Math.abs(m.bottom+4-p.y)<6);
    });
    await page.screenshot({ path: resolve(output, name+'-desktop.png'), fullPage: true });
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 390, height: 1000 });
    await picker.scrollIntoViewIfNeeded();
    const mc=await category.boundingBox(), mp=await picker.boundingBox();
    if (!mc || !mp || mc.y>=mp.y || mc.x<0 || mp.x+mp.width>391) throw Error(name+': mobile product controls do not stack within the panel');
    await page.screenshot({ path: resolve(output, name+'-mobile.png'), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1500 });
    console.log('Verified paired desktop/mobile controls, keyboard opening, retained selections:', name);
  };
  if (!process.argv.includes('--remaining-only')) {
  await page.goto(base + '/settings?tab=forms');
  await page.getByText(form.name, { exact: true }).first().click();
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  await page.getByRole('heading', { name: 'Source links and QR codes' }).waitFor();
  await page.screenshot({ path: resolve(output, '01-forms-source-links.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.screenshot({ path: resolve(output, '01-forms-source-links-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1500 });
  console.log('Captured source-link sharing screen.');
  const pdf = await context.request.get(base + `/api/proxy/marketing/forms/${form.id}/source-links.pdf`);
  if (!pdf.ok()) throw Error('PDF download failed: ' + pdf.status());
  writeFileSync(resolve(output, 'leadcrm-source-links-local-preview.pdf'), await pdf.body());
  await page.goto(base + '/inbox/business-email');
  await page.getByRole('heading', { name: 'Business email inquiries' }).waitFor();
  await page.screenshot({ path: resolve(output, '02-business-email-intake.png'), fullPage: true });
  await page.goto(base + '/crm/leads/' + lead.id);
  await page.getByRole('tab', { name: /Details/ }).click();
  await page.getByRole('heading', { name: 'Source attribution' }).waitFor();
  await page.getByRole('region', { name: 'Source attribution' }).scrollIntoViewIfNeeded();
  await page.getByRole('region', { name: 'Source attribution' }).screenshot({ path: resolve(output, '03-lead-source-evidence.png'), animations: 'disabled' });
  }
  if (!process.argv.includes('--embed-only') && !process.argv.includes('--deal-only')) {
  await page.goto(base + '/crm/leads');
  await page.getByRole('button', { name: /Add Lead|Create Lead|New Lead/ }).first().click();
  await page.getByRole('menuitem', { name: 'Create New', exact: true }).click();
  await verifyProductPanel('06-lead-panel', true);
  await page.getByRole('combobox', { name: 'Lead Source', exact: true }).selectOption('Others');
  await page.getByLabel('Source detail', { exact: true }).fill('SMS');
  await page.getByLabel('Source detail', { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: resolve(output, '04-manual-call-sms.png'), fullPage: true });
  }
  if (!process.argv.includes('--embed-only')) {
    if (!process.argv.includes('--deal-only')) {
    await page.goto(base + '/crm/contacts');
    await page.getByRole('button', { name: /Create Contact|Add Contact|New Contact/ }).first().click();
    await page.getByRole('menuitem', { name: 'Create New', exact: true }).click();
    await verifyProductPanel('07-contact-panel', true);
    }
    await page.goto(base + '/crm/deals');
    await page.getByRole('button', { name: /Create Deal|Add Deal|New Deal/ }).first().click();
    const createNew=page.getByRole('menuitem', { name: 'Create New', exact: true });
    if (await createNew.isVisible()) await createNew.click();
    await verifyProductPanel('08-deal-panel', false);
  }
  await page.goto(base + '/forms/' + form.publicId + '?utm_source=flyer&utm_medium=direct_mail&utm_campaign=source_demo');
  await page.getByRole('heading', { name: form.name }).waitFor();
  await page.screenshot({ path: resolve(output, '05-public-inquiry-form.png'), fullPage: true });
  // Verify that a real parent website forwards its campaign after navigation.
  await page.goto('http://localhost:3301/landing?utm_source=google&utm_medium=cpc&utm_campaign=embed_demo');
  await page.getByRole('link', { name: 'Continue to inquiry' }).click();
  const embedded = page.frameLocator('iframe');
  await embedded.getByLabel(/First Name/).fill('Embedded'); await embedded.getByLabel(/Last Name/).fill('Prospect');
  await embedded.getByLabel(/Email Address/).fill('embed.prospect@example.test');
  await embedded.getByRole('button', { name: 'Product Interest', exact: true }).click();
  await embedded.getByRole('checkbox', { name: product.name, exact: true }).check();
  await embedded.getByRole('button', { name: 'Submit', exact: true }).click();
  await embedded.getByText('Thank you!', { exact: true }).waitFor();
  const embeddedLead = await prisma.lead.findFirstOrThrow({ where: { tenantId: tenant.id, email: 'embed.prospect@example.test' } });
  if (embeddedLead.source !== 'Google Ads') throw Error('Embedded website attribution was not preserved across navigation.');
  const moduleResponses=[];
  for (const endpoint of ['/marketing/forms', '/crm/leads', '/crm/contacts', '/crm/deals', '/administration/product-interests', '/operations/tasks', '/automation/workflows', '/marketing/campaigns', '/integrations/gmail/status', '/notifications/counts', '/reporting/dashboard']) {
    const response=await context.request.get(base+'/api/proxy'+endpoint);
    moduleResponses.push({ endpoint, status: response.status() });
    if (!response.ok()) throw Error('Local module read failed: '+endpoint+' ('+response.status()+')');
  }
  writeFileSync(resolve(output, 'module-checks.json'), JSON.stringify(moduleResponses,null,2));
  writeFileSync(resolve(output, 'verification.json'), JSON.stringify({ screenshots: 12, formId: form.id, publicId: form.publicId, leadId: lead.id, localOnly: true, pageErrors: errors }, null, 2));
  if (errors.length) throw Error('Browser errors: ' + errors.join('; '));
  console.log('Screenshots saved:', output);
  if (process.argv.includes('--serve')) {
    writeFileSync(resolve(output, 'LOGIN.txt'), 'Disposable updated preview: '+base+'/login\nEmail: '+admin.email+'\nPassword: '+previewPassword+'\n', { mode: 0o600 });
    console.log('Updated disposable preview is running at '+base+'. Local login details: '+resolve(output,'LOGIN.txt'));
    await browser.close(); browser=undefined;
    await new Promise(done => {
      const finish = () => { process.stdin.pause(); done(); };
      process.once('SIGINT', finish); process.once('SIGTERM', finish);
      process.stdin.setEncoding('utf8'); process.stdin.on('data', value => { if (value.trim()==='stop') finish(); }); process.stdin.resume();
    });
  }
} catch (error) {
  await activePage?.screenshot({ path: resolve(output, 'browser-failure.png'), fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser?.close(); frontend?.kill(); website?.closeAllConnections(); api?.closeAllConnections(); await new Promise(done => website ? website.close(done) : done()); await new Promise(done => api ? api.close(done) : done()); await prisma?.$disconnect(); pg.stop();
}
