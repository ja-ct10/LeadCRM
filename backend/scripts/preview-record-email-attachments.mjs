// Local shared Files UI preview. Gmail/record authorization is tested separately in disposable DB tests.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '../..'), require = createRequire(resolve(root, 'frontend/package.json'));
const { createServer } = await import(pathToFileURL(require.resolve('vite')));
const { default: react } = await import(pathToFileURL(require.resolve('@vitejs/plugin-react')));
const { default: tailwind } = await import(pathToFileURL(require.resolve('@tailwindcss/postcss')));
const { chromium } = require('playwright');
const output = resolve(root, 'data/outputs/record-email-attachments-browser'); mkdirSync(output, { recursive: true });
// A small two-page provider fixture, independent of quotation generation.
const PDFDocument = require('pdfkit'), document = new PDFDocument(), pdfChunks = [];
const pdfReady = new Promise((done, fail) => { document.on('data', chunk => pdfChunks.push(chunk)); document.on('end', done); document.on('error', fail); });
document.text('Original Gmail attachment - page 1'); document.addPage().text('Original Gmail attachment - page 2'); document.end();
await pdfReady; writeFileSync(resolve(output, 'original.pdf'), Buffer.concat(pdfChunks));
const sourcePath = resolve(root, 'frontend/src').replaceAll('\\', '/');
writeFileSync(resolve(output, 'index.html'), '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/fixture.tsx"></script></body></html>');
writeFileSync(resolve(output, 'fixture.tsx'), `
import React from 'react'; import { createRoot } from 'react-dom/client';
import '/@fs/${sourcePath}/index.css';
import { RecordFilesTab } from '/@fs/${sourcePath}/shared/components/crm/record-files-tab.tsx';
const params = new URLSearchParams(location.search), module = params.get('module') || 'leads';
const name = 'QT-2026-1275D500-' + 'Long_Quotation_Filename_'.repeat(8) + '.pdf';
const reference = { id:'original-pdf', accountId:'account', messageId:'message', attachmentId:'part', name, type:'application/pdf', size:20173, sentAt:'2026-10-18T01:00:00Z' };
const files = [{id:'manual',name:'Manual upload.pdf',type:'application/pdf',size:2048,uploadedAt:reference.sentAt,url:'/manual'},
{id:reference.id,name,type:reference.type,size:reference.size,uploadedAt:reference.sentAt,emailAttachment:reference},
{id:'photo',name:'photo.png',type:'image/png',uploadedAt:reference.sentAt,emailAttachment:{...reference,attachmentId:'photo',type:'image/png'}},
{id:'office',name:'document.docx',type:'application/msword',uploadedAt:reference.sentAt,emailAttachment:{...reference,attachmentId:'office',type:'application/msword'}}];
window.fixtureName = name;
createRoot(document.getElementById('root')!).render(<main style={{width:'100%',maxWidth:params.get('surface')==='panel'?560:1100,marginLeft:'auto'}}><RecordFilesTab files={files} emailContext={{recordModule:module,recordId:'record'}} onUpload={async()=>{}} onDelete={async()=>{}} /></main>);
`);
const mock = '\0record-attachment-services';
const server = await createServer({ configFile: false, root: output, cacheDir: resolve(output, '.vite'), define: { 'process.env': '{}' },
  plugins: [{ name: 'record-files-fixture-services', enforce: 'pre',
    resolveId(id) { const path = id.replaceAll('\\', '/'); if (/\/shared\/hooks\/use-permissions(?:\.ts)?$/.test(path)) return mock + '-permissions'; if (/\/features\/tenant\/inbox\/services\/gmail.service(?:\.ts)?$/.test(path)) return mock; },
    load(id) {
      if (id === mock + '-permissions') return 'export const useHasPermission=()=>true;';
      if (id === mock) return `export async function fetchGmailAttachment(message,part,signal,context){window.fixtureReads=(window.fixtureReads||0)+1;if(part==='photo'){const canvas=document.createElement('canvas');canvas.width=640;canvas.height=320;const draw=canvas.getContext('2d');draw.fillStyle='#2563eb';draw.fillRect(0,0,640,320);draw.fillStyle='white';draw.font='28px sans-serif';draw.fillText('Original email image',32,170);return await new Promise(done=>canvas.toBlob(done,'image/png'));}return (await fetch('/original.pdf',{signal})).blob();}`;
    },
  }, react()],
  resolve: { extensions: ['.ts', '.tsx', '.mjs', '.js', '.cjs', '.json'], alias: { '@/shared': sourcePath + '/shared', '@/lib': sourcePath + '/lib', '@/store': sourcePath + '/store', '@/features/tenant': sourcePath + '/features/tenant', '@leadcrm/shared': resolve(root, 'shared/src/index.ts'), '@': resolve(root, 'frontend') }, dedupe: ['react', 'react-dom'] },
  css: { postcss: { plugins: [tailwind()] } }, server: { host: '127.0.0.1', port: 0, watch: null, hmr: false, fs: { allow: [root, resolve(root, 'node_modules')] } },
});
let browser;
const errors = [], results = [];
async function nativePdf(page) {
  for (let attempt = 0; attempt < 100; attempt++) {
    for (const frame of page.frames().filter(frame => frame.url().startsWith('blob:'))) {
      if (await frame.locator('embed[type="application/x-google-chrome-pdf"]').count() &&
          (await frame.locator('#sizer').boundingBox())?.height > 0) return frame;
    }
    await new Promise(done => setTimeout(done, 100));
  }
  throw new Error('Native attachment PDF viewer did not load');
}
try {
  await server.listen(); const base = server.resolvedUrls.local[0];
  const executablePath = [chromium.executablePath(), 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
  assert.ok(executablePath, 'A local Chromium browser is required');
  browser = await chromium.launch({ executablePath, headless: true });
  const context = await browser.newContext({ reducedMotion: 'reduce', acceptDownloads: true });
  // This UI fixture needs no external fonts or services.
  await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  // Allow only the browser's built-in PDF viewer resources in this isolated fixture.
  for (const pattern of ['chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai/**', 'chrome://resources/**']) await context.route(pattern, route => route.continue());
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message)); page.setDefaultTimeout(30000);
  page.setDefaultNavigationTimeout(60000);
  for (const width of [320, 375, 390, 430, 768, 1024, 1440]) for (const module of ['leads', 'contacts', 'deals']) for (const surface of ['panel', 'page']) {
    await page.setViewportSize({ width, height: 900 }); await page.goto(base + '?module=' + module + '&surface=' + surface, { waitUntil: 'domcontentloaded' });
    await page.getByText('Manual upload.pdf', { exact: true }).waitFor();
    const name = await page.evaluate(() => window.fixtureName);
    assert.equal(await page.getByRole('button', { name: 'Delete ' + name, exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Preview document.docx', exact: true }).count(), 0);
    const preview = page.getByRole('button', { name: 'Preview ' + name, exact: true });
    const box = await preview.boundingBox(); assert.ok(box && box.x >= 0 && box.x + box.width <= width);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), module + ' overflow at ' + width);
    if (module === 'contacts' && surface === 'panel' && [320, 1440].includes(width)) await page.screenshot({ path: resolve(output, 'files-' + width + '.png'), fullPage: true });
    await preview.click(); await page.getByTitle('Email attachment PDF preview').waitFor();
    const viewer = await nativePdf(page);
    await page.waitForFunction(() => { const rect = document.querySelector('[role="dialog"]')?.getBoundingClientRect(); return rect && rect.left >= -1 && rect.right <= innerWidth + 1; });
    const frame = await page.getByTitle('Email attachment PDF preview').boundingBox(); assert.ok(frame && frame.x >= 0 && frame.x + frame.width <= width && frame.height >= 200);
    if (width >= 1024 && surface === 'panel') {
      const toolbar = page.frames().find(frame => frame.url().startsWith('chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai/'));
      assert.ok(toolbar, 'Native PDF toolbar remains available');
      const pageNumber = toolbar.getByRole('textbox', { name: 'Page number', exact: true });
      await pageNumber.fill('2'); await pageNumber.press('Enter');
      await viewer.waitForFunction(() => scrollY > 0);
      await pageNumber.fill('1'); await pageNumber.press('Enter');
      await viewer.waitForFunction(() => scrollY === 0);
      const zoom = toolbar.getByRole('textbox', { name: 'Zoom level', exact: true });
      const originalZoom = parseInt(await zoom.inputValue());
      await toolbar.getByRole('button', { name: 'Zoom in', exact: true }).click();
      await toolbar.waitForFunction(({ input, previous }) => parseInt(input.value) > previous, { input: await zoom.elementHandle(), previous: originalZoom });
      const enlargedZoom = parseInt(await zoom.inputValue());
      await toolbar.getByRole('button', { name: 'Zoom out', exact: true }).click();
      await toolbar.waitForFunction(({ input, previous }) => parseInt(input.value) < previous, { input: await zoom.elementHandle(), previous: enlargedZoom });
    }
    await page.getByTitle('Email attachment PDF preview').hover(); await page.mouse.wheel(0, 400);
    if (width >= 1024 && surface === 'panel') await viewer.waitForFunction(() => scrollY > 0);
    await page.getByRole('link', { name: 'Open PDF in a new tab' }).waitFor();
    if (width >= 1024 && surface === 'panel') {
      const [popup] = await Promise.all([context.waitForEvent('page'), page.getByRole('link', { name: 'Open PDF in a new tab' }).click()]);
      await popup.waitForLoadState('domcontentloaded');
      assert.ok(popup.url().startsWith('blob:'), 'New tab opens the original PDF');
      await nativePdf(popup); await popup.close();
    }
    const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download', exact: true }).click();
    const downloaded = await download;
    assert.equal(downloaded.suggestedFilename(), name);
    assert.deepEqual(require('node:fs').readFileSync(await downloaded.path()), Buffer.concat(pdfChunks));
    assert.equal(await page.evaluate(() => window.fixtureReads), 2, 'Preview and Download each authorize a fresh read');
    await page.getByLabel('Close sheet').click();
    await page.getByRole('button', { name: 'Preview photo.png', exact: true }).click();
    const image = page.getByRole('dialog').getByAltText('photo.png'); await image.waitFor();
    await page.waitForFunction(() => { const rect = document.querySelector('[role="dialog"]')?.getBoundingClientRect(); return rect && rect.left >= -1 && rect.right <= innerWidth + 1; });
    assert.equal(await image.evaluate(node => getComputedStyle(node).objectFit), 'contain');
    const imageBox = await image.boundingBox(); assert.ok(imageBox && Math.abs(imageBox.width / imageBox.height - 2) < 0.01);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'preview overflow at ' + width);
    if (module === 'contacts' && surface === 'panel' && [320, 1440].includes(width)) await page.screenshot({ path: resolve(output, 'image-preview-' + width + '.png'), fullPage: true });
    results.push({ width, module, surface, nativePdfLoaded: true, nativeControlsChecked: width >= 1024 && surface === 'panel', passed: true });
    if (module === 'deals' && surface === 'page') console.log(`${width}px: Lead, Contact and Deal Files panel/page checks passed`);
  }
  assert.deepEqual(errors, []); writeFileSync(resolve(output, 'results.json'), JSON.stringify({ fixture: 'shared Files UI; simulated attachment bytes', results, errors }, null, 2));
  console.log(JSON.stringify({ passed: results.length, errors, output }));
} finally { await browser?.close(); await server.close(); }
