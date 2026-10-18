// Rendered UI preview with isolated API fixtures. Database/API acceptance is
// independently exercised by test-quotations-disposable.mjs; no live email sends.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createWriteStream, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { acceptancePort, createAcceptanceContext } from './verify-browser-matrix.mjs';
const require = createRequire(import.meta.url), { chromium } = require('playwright');
const root = resolve(import.meta.dirname, '../..'), output = resolve(root, 'data/outputs/quotations/browser');
const shared = require(resolve(root, 'shared/src/index.js'));
mkdirSync(output, { recursive: true });
const port = await acceptancePort(), base = `http://127.0.0.1:${port}`, log = createWriteStream(resolve(output, 'frontend.log'));
const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'start', '-p', String(port), '-H', '127.0.0.1'], {
  cwd: resolve(root, 'frontend'), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NODE_ENV: 'production', API_URL: 'https://leadcrm-quotation-fixture.example/api/v1', NEXT_TELEMETRY_DISABLED: '1' },
});
child.stdout.pipe(log); child.stderr.pipe(log);
let browser;
const assertions = [], now = new Date().toISOString();
const user = { id: randomUUID(), tenantId: randomUUID(), email: 'preview@camxian.com', role: 'Client Admin', firstName: 'Preview', lastName: 'Sender', status: 'ACTIVE', tenantName: 'Quotation Preview', tenantStatus: 'SANDBOX', onboardingStep: 3, onboardingCompletedAt: now, mustChangePassword: false, hasPassword: true, passwordChangedAt: now, currency: 'PHP', groups: [] };
const lead = { id: randomUUID(), firstName: 'Juan', lastName: 'Customer', email: 'juan@example.test', companyName: 'Customer Company', assignedUserId: user.id };
const contact = { ...lead, id: randomUUID(), firstName: 'Maria', lastName: 'Contact', email: 'maria@example.test' };
const product = { id: randomUUID(), name: 'Technical Service', category: 'Services', description: 'Setup and support', dealValue: 1234.56, active: true, createdAt: now, updatedAt: now };
const deal = { id: randomUUID(), title: 'Technical Service Deal', productInterestId: product.id, value: 99999 };
const emptyDeal = { id: randomUUID(), title: 'Deal without Product', productInterestId: null };
const permissions = Object.fromEntries(['campaigns','leads','contacts','accounts','deals','products','settings','users','groups','roles','custom_fields','archived_data','tasks','forms','notifications','dashboard','reporting'].map(module => [module, Object.fromEntries(['canView','canCreate','canEdit','canArchive','canSend','canViewReports'].map(flag => [flag, true]))]));
const names = ['Standard Sales Quotation','Service Quotation','Software Implementation','Annual Maintenance','Product Quotation','Custom Quotation'];
const pdf = readFileSync(resolve(root, 'data/outputs/quotations/lead.pdf'));
async function fits(page, label, width) {
  await page.waitForFunction(() => [...document.querySelectorAll('[role="dialog"]')].every(element => { const box = element.getBoundingClientRect(); return box.left >= -1 && box.right <= innerWidth + 1; }));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `${label}: page overflow at ${width}`);
  assertions.push(`${width}: ${label}`);
}
async function pdfReady(page, title) {
  await page.getByTitle(title).waitFor();
  for (let attempt = 0; attempt < 100; attempt++) {
    for (const frame of page.frames().filter(frame => frame.url().startsWith('blob:'))) {
      if (await frame.locator('embed[type="application/x-google-chrome-pdf"]').count() &&
          await frame.locator('#sizer').count() && (await frame.locator('#sizer').boundingBox())?.height > 0) return;
    }
    await new Promise(done => setTimeout(done, 100));
  }
  throw new Error(`Native PDF viewer did not load: ${title}`);
}
async function templateControls(page, type, width) {
  const controls = [page.getByLabel('Search templates', { exact: true }), page.getByLabel(`Filter ${type.toLowerCase()} templates`, { exact: true }),
    page.getByRole('button', { name: 'Refresh', exact: true }), page.getByRole('button', { name: `New ${type} Template`, exact: true })];
  const boxes = [];
  for (const control of controls) {
    const box = await control.boundingBox();
    assert.ok(box && box.x >= -1 && box.x + box.width <= width + 1, `${type}: accessible toolbar control at ${width}`);
    boxes.push(box);
  }
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    assert.ok(a.x + a.width <= b.x + 1 || b.x + b.width <= a.x + 1 || a.y + a.height <= b.y + 1 || b.y + b.height <= a.y + 1, `${type}: toolbar controls overlap at ${width}`);
  }
  if (width >= 1024) {
    const container = await page.getByRole('button', { name: `New ${type} Template`, exact: true }).locator('..').boundingBox();
    assert.ok(Math.abs(boxes[3].x + boxes[3].width - container.x - container.width) < 2, `${type}: right-aligned create action`);
  }
  const styles = [];
  for (const control of [...controls, page.getByRole('navigation', { name: 'Pagination' }), page.getByRole('button', { name: 'Records per page' })]) {
    styles.push(await control.evaluate(element => {
      const style = getComputedStyle(element);
      return Object.fromEntries(['height', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderRadius', 'borderColor', 'fontSize', 'fontWeight', 'color', 'backgroundColor'].map(key => [key, style[key]]));
    }));
  }
  await fits(page, `${type} template controls and pagination`, width);
  return styles;
}
try {
  for (let attempt = 0; attempt < 60; attempt++) { try { if ((await fetch(base + '/login')).ok) break; } catch {} await new Promise(done => setTimeout(done, 500)); }
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const width of [320,375,390,430,768,1024,1440]) {
    const recipientType = [375, 1024].includes(width) ? 'Contact' : 'Lead', selectedRecipient = recipientType === 'Contact' ? contact : lead;
    const context = await createAcceptanceContext(browser, { viewport: { width, height: 960 }, reducedMotion: 'reduce', sandboxedFrames: true });
    // Permit only Chrome's built-in PDF viewer and its internal resources;
    // the existing guard still blocks external non-fixture requests.
    for (const pattern of ['chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai/**', 'chrome://resources/**']) await context.route(pattern, route => route.continue());
    const page = await context.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    let templates = [...names.map((name, index) => ({ id: randomUUID(), tenantId: user.tenantId, name, category: shared.QUOTATION_CATEGORIES[index], type: 'Quotation', content: JSON.stringify(shared.defaultQuotationContent()) })),
      { id: randomUUID(), tenantId: user.tenantId, name: 'CCTV Quotation', category: 'Custom', type: 'Quotation', content: JSON.stringify(shared.defaultQuotationContent()) },
      ...['Email', 'SMS'].flatMap(type => Array.from({ length: 23 }, (_, index) => ({ id: randomUUID(), tenantId: user.tenantId, name: `${type} Follow ${index + 1}`, type,
        category: index % 2 ? 'Support' : 'Sales', subject: type === 'Email' ? 'Hello {{firstName}}' : undefined, content: `Hello {{firstName}}, ${type} message ${index + 1}.` })))];
    const templateRequests = [], messageControlStyles = [];
    let sends = 0, pdfRequests = 0, pdfFailure = false;
    await context.route('**/api/proxy/**', async route => {
      const url = new URL(route.request().url()), path = url.pathname.replace('/api/proxy', ''), method = route.request().method();
      const json = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
      const list = data => json({ success: true, data, meta: { total: data.length, page: 1, limit: 10, hasMore: false } });
      if (path === '/auth/me') return json({ success: true, data: { user, session: { lastActiveAt: now, idleExpiresAt: new Date(Date.now()+1800000).toISOString(), expiresAt: new Date(Date.now()+86400000).toISOString(), serverNow: new Date().toISOString() } } });
      if (path.endsWith('/permissions')) return json({ success: true, data: permissions });
      if (path.endsWith('/events') || path.endsWith('record-events')) return route.fulfill({ contentType: 'text/event-stream', body: ': UI preview\n\n' });
      if (path.startsWith('/preferences/table/')) return json({ success: true, data: { pageSize: 25, sort: { field: 'createdAt', direction: 'desc' }, conditions: [] } });
      if (path === '/crm/record-access') return json({ success: true, data: { userId: user.id, tenantId: user.tenantId, clientAdmin: true, assignmentRestricted: false } });
      if (path === '/marketing/campaigns/variable-fields') return json({ success: true, data: shared.CUSTOM_FIELD_MODULES.flatMap(module => shared.getCrmFieldCatalog(module)) });
      if (path === '/marketing/campaigns/email-settings') return json({ success: true, data: { senderName: 'Preview Sender', senderEmail: 'preview@example.test' } });
      if (path === '/marketing/campaigns/sms-settings') return json({ success: true, data: { organizationName: 'Preview Organization', organizationEmail: 'preview@example.test' } });
      if (path === '/administration/product-interests') return json({ success: true, data: [product], meta: { enabled: true, categories: ['Services'] } });
      if (path === '/crm/leads') return list([lead]);
      if (path === '/crm/contacts') return list([contact]);
      if (path.endsWith('/relationships')) return json({ success: true, data: { deals: [deal, emptyDeal], hasMoreDeals: false } });
      if (path === `/crm/deals/${deal.id}`) return json({ success: true, data: deal });
      if (path === `/crm/deals/${emptyDeal.id}`) return json({ success: true, data: emptyDeal });
      if (path === `/crm/leads/${lead.id}`) return json({ success: true, data: lead });
      if (path === `/crm/contacts/${contact.id}`) return json({ success: true, data: contact });
      if (path.endsWith('/pdf')) { pdfRequests++; return pdfFailure ? json({ success: false, error: 'Unable to generate PDF. Please try again.' }, 500) : route.fulfill({ contentType: 'application/pdf', body: pdf }); }
      if (path === '/marketing/templates' && method === 'POST') { const data = route.request().postDataJSON(); const template = { ...data, id: randomUUID(), tenantId: user.tenantId }; templates.push(template); return json({ success: true, data: template }, 201); }
      if (path.startsWith('/marketing/templates/') && method === 'PUT') { const index = templates.findIndex(template => path.endsWith(template.id)); templates[index] = { ...templates[index], ...route.request().postDataJSON() }; return json({ success: true, data: templates[index] }); }
      if (path === '/marketing/templates') {
        const query = Object.fromEntries(url.searchParams), category = query.category, type = query.type;
        templateRequests.push(query);
        const terms = (query.search ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean);
        const data = templates.filter(template => (!type || template.type === type) && (!category || template.category === category) && terms.every(term => `${template.name} ${template.category}`.toLowerCase().includes(term)));
        const currentPage = Number(query.page ?? 1), limit = Math.min(100, Number(query.limit ?? 10));
        return json({ success: true, data: data.slice((currentPage - 1) * limit, currentPage * limit), meta: { total: data.length, page: currentPage, limit, hasMore: currentPage * limit < data.length } });
      }
      if (path === '/marketing/campaigns/quotations/preview') { const draft = route.request().postDataJSON(); assert.equal(draft.recipientType, recipientType); assert.equal(draft.recipientId, selectedRecipient.id); assert.equal(draft.dealId, deal.id); assert.deepEqual(draft.products, [{ productId: product.id, quantity: 3 }]); return json({ success: true, data: { pdfBase64: pdf.toString('base64'), filename: 'quotation.pdf', fingerprint: 'a'.repeat(64), document: { total: '3703.68' } } }); }
      if (path === '/marketing/campaigns/quotations/send') { sends++; await new Promise(done => setTimeout(done, 250)); return json({ success: true, data: { messageId: 'fixture', threadId: 'fixture' } }); }
      return list([]);
    });
    try {
      await page.goto(base + '/marketing/campaigns');
      for (const type of ['Email', 'SMS']) {
        await page.getByRole('button', { name: `${type} Templates`, exact: true }).click();
        await page.getByText('Page 1 of 3', { exact: true }).waitFor();
        assert.equal(await page.getByRole('button', { name: 'Preview', exact: true }).count(), 10);
        messageControlStyles.push(await templateControls(page, type, width));
        await page.screenshot({ path: resolve(output, `${type.toLowerCase()}-templates-${width}.png`), fullPage: true });
        await page.getByRole('button', { name: 'Next page' }).click(); await page.getByRole('heading', { name: `${type} Follow 11`, exact: true }).waitFor();
        await page.getByLabel('Search templates', { exact: true }).fill('sAlEs'); await page.getByText('Page 1 of 2', { exact: true }).waitFor();
        assert.equal(await page.getByRole('heading', { name: `${type} Follow 2`, exact: true }).count(), 0);
        await page.getByLabel('Search templates', { exact: true }).fill('Follow'); await page.getByText('Page 1 of 3', { exact: true }).waitFor();
        await page.getByLabel(`Filter ${type.toLowerCase()} templates`, { exact: true }).click();
        await page.getByRole('checkbox', { name: 'Filter by Support', exact: true }).check(); await fits(page, `${type} category filter`, width);
        await page.getByRole('button', { name: 'Close filters', exact: true }).click(); await page.getByText('Page 1 of 2', { exact: true }).waitFor();
        await page.getByRole('button', { name: 'Next page' }).click(); await page.getByRole('heading', { name: `${type} Follow 22`, exact: true }).waitFor();
        assert.equal(await page.getByRole('button', { name: 'Next page' }).isDisabled(), true);
        const beforeRefresh = templateRequests.length;
        await page.getByRole('button', { name: 'Refresh', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('button[aria-label="Refresh"]')?.getAttribute('aria-busy') === 'false');
        assert.ok(templateRequests.slice(beforeRefresh).some(query => query.type === type && query.search === 'Follow' && query.category === 'Support' && query.page === '2'));
        assert.ok(templateRequests.slice(beforeRefresh).every(query => query.type === type));
        await page.getByRole('button', { name: 'Records per page' }).click(); await page.getByRole('option', { name: '20', exact: true }).click();
        await page.getByText('Page 1 of 1', { exact: true }).waitFor(); assert.equal(await page.getByRole('button', { name: 'Preview', exact: true }).count(), 11);
        await page.getByLabel(`Filter ${type.toLowerCase()} templates`, { exact: true }).click(); await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
        await page.getByRole('button', { name: 'Close filters', exact: true }).click(); await page.getByText('Page 1 of 2', { exact: true }).waitFor();
        assert.equal(await page.getByLabel('Search templates', { exact: true }).inputValue(), 'Follow');
        await page.getByLabel('Search templates', { exact: true }).fill('nothing matches this'); await page.getByRole('heading', { name: 'No templates match your search or filters' }).waitFor();
        await fits(page, `${type} empty search results`, width);
        await page.getByRole('button', { name: 'Clear search and filters', exact: true }).click(); await page.getByRole('heading', { name: `${type} Follow 1`, exact: true }).waitFor();
        const template = templates.find(template => template.type === type);
        if (type === 'SMS') assert.ok(await page.getByText(`${template.content.length} characters`, { exact: true }).count());
        await page.getByRole('button', { name: 'Preview', exact: true }).first().click(); await page.getByRole('dialog', { name: 'Template Preview', exact: true }).waitFor();
        await fits(page, `${type} existing preview`, width); await page.getByRole('button', { name: 'Close template preview' }).click();
        await page.getByRole('button', { name: 'Use Template', exact: true }).first().click(); await page.getByRole('heading', { name: 'Create Campaign', exact: true }).waitFor();
        assert.equal(await page.getByLabel('Body', { exact: false }).inputValue(), template.content);
        if (type === 'Email') assert.equal(await page.getByLabel('Subject Line', { exact: false }).inputValue(), template.subject);
        await fits(page, `${type} existing Use Template`, width); await page.getByRole('button', { name: 'Back to campaigns' }).click();
        await page.getByRole('heading', { name: `${type} Follow 1`, exact: true }).waitFor();
        await page.getByRole('button', { name: `New ${type} Template`, exact: true }).click();
        const editor = page.getByRole('dialog', { name: `Create ${type} Template`, exact: true }); await editor.waitFor();
        await editor.getByLabel('Message Content', { exact: false }).fill('');
        await editor.getByRole('button', { name: 'Insert Variable', exact: true }).click(); await page.getByLabel('Search variables').fill('firstName');
        await page.getByRole('button', { name: /First Name.*firstName/ }).click(); assert.equal(await editor.getByLabel('Message Content', { exact: false }).inputValue(), '{{firstName}}');
        await fits(page, `${type} existing creation and variable insertion`, width); await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
      }
      await page.getByRole('button', { name: 'Quotation Templates', exact: true }).click();
      await page.getByRole('heading', { name: 'Standard Sales Quotation', level: 3 }).waitFor();
      assert.equal(await page.locator('article').count(), 7);
      const quotationStyles = await templateControls(page, 'Quotation', width);
      for (const styles of messageControlStyles) assert.deepEqual(styles, quotationStyles, `${width}: shared template control styles match Quotation`);
      for (const card of await page.locator('article').all()) {
        const badge = await card.locator('.inline-flex').first().boundingBox(), icon = await card.getByRole('button', { name: 'Download PDF', exact: true }).boundingBox();
        assert.ok(badge && icon && icon.x > badge.x && Math.abs((badge.y + badge.height/2) - (icon.y + icon.height/2)) < 2);
      }
      await fits(page, 'six starters plus CCTV cards and tabs', width); await page.screenshot({ path: resolve(output, `cards-${width}.png`), fullPage: true });
      const standardCard = page.locator('article').filter({ has: page.getByRole('heading', { name: 'Standard Sales Quotation', level: 3 }) });
      const [blankDownload] = await Promise.all([page.waitForEvent('download'), standardCard.getByRole('button', { name: 'Download PDF', exact: true }).click()]); assert.equal(blankDownload.suggestedFilename(), 'Standard Sales Quotation.pdf');
      await standardCard.getByRole('button', { name: 'Preview', exact: true }).click(); await pdfReady(page, 'Quotation template PDF preview'); await fits(page, 'reusable template preview/download', width); await page.getByRole('button', { name: 'Close sheet', exact: true }).click();
      assert.equal(pdfRequests, 2);
      pdfFailure = true; await standardCard.getByRole('button', { name: 'Preview', exact: true }).click();
      await page.getByText('Unable to generate PDF. Please try again.', { exact: true }).waitFor();
      assert.equal(await page.getByTitle('Quotation template PDF preview').count(), 0); assert.equal(pdfRequests, 3);
      await fits(page, 'PDF error toast', width); pdfFailure = false;
      await page.getByLabel('Search templates', { exact: true }).fill('Software'); await page.getByRole('heading', { name: 'Software Implementation' }).waitFor(); await page.waitForFunction(() => document.querySelectorAll('article').length === 1); assert.equal(await page.locator('article').count(), 1);
      await page.getByLabel('Search templates', { exact: true }).fill(''); await page.getByRole('heading', { name: 'Standard Sales Quotation', level: 3 }).waitFor();
      await page.getByLabel('Filter quotation templates', { exact: true }).click(); await page.getByRole('checkbox', { name: 'Filter by Software', exact: true }).check(); await fits(page, 'category filter', width);
      await page.getByRole('button', { name: 'Close filters', exact: true }).click(); await page.waitForFunction(() => document.querySelectorAll('article').length === 1);
      await page.getByLabel('Filter quotation templates', { exact: true }).click(); await page.getByRole('button', { name: 'Clear filters', exact: true }).click(); await page.getByRole('button', { name: 'Close filters', exact: true }).click(); await page.getByRole('heading', { name: 'Standard Sales Quotation', level: 3 }).waitFor();
      await page.getByRole('button', { name: 'New Quotation Template', exact: true }).click();
      await page.getByLabel('Template Name', { exact: false }).fill('Saved Preview Template');
      await page.getByLabel('Insert Variable into Introduction / Message').click(); await page.getByLabel('Search variables').fill('organizationName'); await page.getByRole('button', { name: /Organization Name.*organizationName/ }).click();
      assert.match(await page.getByLabel('Introduction / Message', { exact: true }).inputValue(), /{{organizationName}}/);
      await fits(page, 'editor and variable picker', width); await page.screenshot({ path: resolve(output, `editor-${width}.png`) });
      await page.getByRole('button', { name: 'Save Template', exact: true }).click(); await page.getByRole('heading', { name: 'Saved Preview Template' }).waitFor();
      const savedCard = page.locator('article').filter({ has: page.getByRole('heading', { name: 'Saved Preview Template', level: 3 }) });
      await savedCard.getByRole('button', { name: 'Preview', exact: true }).click(); await pdfReady(page, 'Quotation template PDF preview');
      await fits(page, 'newly saved template preview', width); await page.screenshot({ path: resolve(output, `template-preview-${width}.png`) });
      await page.getByRole('button', { name: 'Close sheet', exact: true }).click();
      const [savedDownload] = await Promise.all([page.waitForEvent('download'), savedCard.getByRole('button', { name: 'Download PDF', exact: true }).click()]);
      assert.equal(savedDownload.suggestedFilename(), 'Saved Preview Template.pdf'); assert.equal(pdfRequests, 5);
      await page.getByRole('button', { name: 'Actions for Saved Preview Template' }).click(); await page.getByRole('menuitem', { name: 'Edit Template' }).click();
      assert.equal(await page.getByLabel('Template Name', { exact: false }).inputValue(), 'Saved Preview Template');
      await page.getByLabel('Quotation Title', { exact: false }).fill('UPDATED QUOTATION'); await page.getByRole('button', { name: 'Cancel', exact: true }).click(); await page.getByRole('button', { name: 'Keep editing', exact: true }).click(); await page.getByRole('button', { name: 'Save Template', exact: true }).click();
      await page.locator('article').filter({ has: page.getByRole('heading', { name: 'Standard Sales Quotation', level: 3 }) }).getByRole('button', { name: 'Use Template' }).click();
      await page.getByLabel('Send To', { exact: false }).selectOption(recipientType);
      await page.getByRole('combobox', { name: 'Recipient', exact: true }).click(); await page.getByRole('combobox', { name: 'Recipient', exact: true }).fill(selectedRecipient.firstName); await page.getByRole('option').filter({ hasText: `${selectedRecipient.firstName} ${selectedRecipient.lastName}` }).click();
      await page.getByRole('button', { name: 'Next', exact: true }).click(); await page.getByText('Associated Deal is required.', { exact: true }).waitFor();
      assert.equal(await page.getByRole('combobox', { name: 'Associated Deal', exact: true }).getAttribute('aria-required'), 'true');
      await fits(page, 'required Deal validation', width);
      await page.getByLabel('Associated Deal', { exact: false }).selectOption(emptyDeal.id); await page.getByRole('button', { name: 'Next', exact: true }).click();
      await page.getByText('No product is associated with this Deal. Please select a Deal with an assigned product.', { exact: true }).waitFor();
      assert.equal(await page.getByRole('table').count(), 0); await fits(page, 'missing Deal Product error and Back', width);
      await page.getByRole('button', { name: 'Back', exact: true }).click(); await page.getByLabel('Associated Deal', { exact: false }).selectOption(deal.id); await page.getByRole('button', { name: 'Next', exact: true }).click();
      await page.getByLabel('Quantity for Technical Service').waitFor(); assert.equal(await page.getByRole('button', { name: /Add Product|Remove Technical/ }).count(), 0);
      await page.getByRole('cell', { name: 'Services', exact: true }).waitFor(); await page.getByRole('cell', { name: 'Setup and support', exact: true }).waitFor();
      await page.getByLabel('Quantity for Technical Service').fill('1.5'); await page.getByRole('button', { name: 'Next', exact: true }).click(); await page.getByRole('alert').filter({ hasText: 'positive whole-number quantity' }).waitFor();
      await page.getByLabel('Quantity for Technical Service').fill('3'); await fits(page, 'products and four-step progress', width); await page.screenshot({ path: resolve(output, `products-${width}.png`) });
      await page.getByRole('button', { name: 'Next', exact: true }).click(); await page.getByLabel('Notes', { exact: true }).fill('Quotation preview notes'); await fits(page, 'quotation details', width);
      const number = await page.getByLabel('Quotation Number', { exact: true }).inputValue();
      await page.getByRole('button', { name: 'Back', exact: true }).click(); assert.equal(await page.getByLabel('Quantity for Technical Service').inputValue(), '3');
      await page.getByRole('button', { name: 'Next', exact: true }).click(); assert.equal(await page.getByLabel('Notes', { exact: true }).inputValue(), 'Quotation preview notes'); assert.equal(await page.getByLabel('Quotation Number', { exact: true }).inputValue(), number);
      await page.getByRole('button', { name: 'Next', exact: true }).click(); await pdfReady(page, 'Quotation PDF preview'); await fits(page, 'PDF preview actions', width); await page.screenshot({ path: resolve(output, `preview-${width}.png`) });
      const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('dialog').getByRole('button', { name: 'Download PDF', exact: true }).click()]); assert.equal(download.suggestedFilename(), 'quotation.pdf');
      await page.getByRole('button', { name: 'Send', exact: true }).click(); await page.getByRole('button', { name: 'Sent', exact: true }).waitFor(); assert.equal(sends, 1);
      await page.getByRole('button', { name: 'Close', exact: true }).click();
      if (width === 1440) for (const name of [...names, 'CCTV Quotation']) {
        const card = page.locator('article').filter({ has: page.getByRole('heading', { name, exact: true, level: 3 }) });
        const [file] = await Promise.all([page.waitForEvent('download'), card.getByRole('button', { name: 'Download PDF', exact: true }).click()]);
        await file.saveAs(resolve(output, `${name.replaceAll(' ', '-')}.pdf`));
        assert.equal(readFileSync(resolve(output, `${name.replaceAll(' ', '-')}.pdf`)).subarray(0, 5).toString(), '%PDF-');
        await card.getByRole('button', { name: 'Preview', exact: true }).click(); await pdfReady(page, 'Quotation template PDF preview'); await page.getByRole('button', { name: 'Close sheet', exact: true }).click();
        await card.getByRole('button', { name: 'Use Template', exact: true }).click(); await page.getByRole('combobox', { name: 'Associated Deal', exact: true }).waitFor();
        await page.getByRole('button', { name: 'Cancel', exact: true }).click(); assertions.push(`${name}: existing Preview, Download and Use Template actions`);
      }
      assert.deepEqual(errors, []); assertions.push(`${width}: Email/SMS creation access, create/edit/discard guard, new-template PDF preview/download, PDF error handling and request counts, cursor picker, recipient, Products, details, preview, download, single send`);
      console.log(`${width}px: Email, SMS, and Quotation template preview checks passed`);
    } catch (error) {
      await page.screenshot({ path: resolve(output, `failure-${width}.png`), fullPage: true });
      throw error;
    } finally { await context.close(); }
  }
  writeFileSync(resolve(output, 'results.json'), JSON.stringify({ evidence: 'Production frontend with isolated API fixtures; database and Gmail transport checks are separate.', assertions, passed: assertions.length }, null, 2));
  rmSync(resolve(output, 'failure.json'), { force: true });
  console.log(JSON.stringify({ passed: assertions.length, output }));
} catch (error) { writeFileSync(resolve(output, 'failure.json'), JSON.stringify({ message: error.message, stack: error.stack, assertions }, null, 2)); throw error; }
finally { await browser?.close(); child.kill(); log.end(); }
