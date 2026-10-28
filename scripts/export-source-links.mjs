// Read-only checks of a published form. Never submits inquiries or connects a mailbox.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..'), require = createRequire(import.meta.url);
const base = new URL(process.argv[2] || '');
if (base.protocol !== 'https:' || base.username || base.password || !/^\/forms\/[\w-]+$/.test(base.pathname) || base.search || base.hash) throw Error('Pass the exact published HTTPS form URL.');
const output = resolve(root, 'output/pdf'); mkdirSync(output, { recursive: true });
const { SOURCE_LINK_PRESETS, sourceCampaignLink, BUSINESS_INQUIRY_EMAIL, BUSINESS_INQUIRY_MAILTO } = require('../shared/src/contracts/source-attribution.js');
const QRCode = require('qrcode');
const campaign = 'leadcrm_demo';
const rows = [];
for (const preset of SOURCE_LINK_PRESETS) {
  const link = sourceCampaignLink(base.href, preset.source, preset.medium, campaign);
  const response = await fetch(link, { signal: AbortSignal.timeout(45000) });
  if (!response.ok || new URL(response.url).pathname !== base.pathname) throw Error('Form link unavailable: ' + response.status + ' ' + preset.source);
  await response.arrayBuffer();
  rows.push({ ...preset, link, mode: 'Tagged form - submit to capture source', qr: await QRCode.toDataURL(link, { width: 320, margin: 4, errorCorrectionLevel: 'M' }), checkedHttpStatus: response.status });
}
const metaResponse = await fetch(base.origin + '/api/proxy/public/forms/' + base.pathname.split('/').at(-1), { signal: AbortSignal.timeout(45000) });
if (!metaResponse.ok) throw Error('Published form API unavailable: ' + metaResponse.status);
const metadata = await metaResponse.json();
const form = metadata.data ?? metadata;
if (!form.fields || !form.version) throw Error('Published form metadata is incomplete.');
// Browser read confirms the destination actually renders the published form.
const { chromium } = require('playwright');
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
let rendered = false;
try {
  const page = await browser.newPage();
  await page.goto(base.href, { timeout: 120000, waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Submit', exact: true }).waitFor({ timeout: 60000 });
  rendered = true;
  await page.screenshot({ path: resolve(output, 'published-form-link-check.png'), fullPage: true });
} finally { await browser.close(); }
rows.push({ category: 'Direct Email', source: BUSINESS_INQUIRY_EMAIL, medium: 'email', link: BUSINESS_INQUIRY_MAILTO, mode: 'Send email; mailbox connection + staff review required', qr: await QRCode.toDataURL(BUSINESS_INQUIRY_MAILTO, { width: 320, margin: 4, errorCorrectionLevel: 'M' }) });
const manifest = { formName: form.name || 'Published inquiry form', formId: form.id || '', publicId: base.pathname.split('/').at(-1), campaign, base: base.href, rows };
// Load the same PDF renderer used by the application in a credential-free environment.
const { qaEnvironment } = require('./qa-environment.cjs'); Object.assign(process.env, qaEnvironment(root));
const Module = require('node:module'), original = Module._resolveFilename;
Module._resolveFilename = function(request, ...args) { return request === '@leadcrm/shared' ? resolve(root, 'backend/dist/shared/src/index.js') : original.call(this, request, ...args); };
const { sourceLinksPdf } = require('../backend/dist/backend/src/modules/marketing/forms/source-links.service.js');
const checkedAt = new Date().toISOString();
const doc = sourceLinksPdf(manifest, 'Public form destinations checked ' + checkedAt.slice(0, 10) + '. Link access and form rendering passed. Updated source capture still needs deployment and a live rehearsal. Direct Email needs owner connection.');
const chunks = [];
const completed = new Promise((done, reject) => { doc.on('data', chunk => chunks.push(chunk)); doc.on('end', done); doc.on('error', reject); });
doc.end(); await completed;
const destination = resolve(output, 'leadcrm-lead-source-links.pdf'); writeFileSync(destination, Buffer.concat(chunks));
writeFileSync(resolve(output, 'leadcrm-source-links-verification.json'), JSON.stringify({ checkedAt, base: base.href, formRendered: rendered, formVersion: form.version, trackUrlParams: form.settings?.trackUrlParams ?? form.trackUrlParams ?? null, sourceCaptureLiveVerified: false, emailConnectedVerified: false, rows: rows.map(({ qr, ...row }) => row) }, null, 2));
console.log('Verified public form links and saved:', destination);
