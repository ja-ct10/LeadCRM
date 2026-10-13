// Real DataGrid + production CSS; no application route or persistent fixture is added.
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { createServer } from 'node:http';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { resolve, basename } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || process.argv[2] || 'playwright');
const virtual = resolve(root, 'src/acceptance-grid.tsx').replaceAll('\\', '/');
const source = `import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DataGrid } from '@/shared/components/data-grid/data-grid';
import { TableRefreshContext } from '@/shared/components/crm/data-view-states';
const columns = [
  { id: 'a', header: 'Left A', pinned: 'left', width: 170, resizable: true },
  { id: 'b', header: 'Left B', pinned: 'left', width: 180 },
  ...Array.from({length: 8}, (_, i) => ({id: 'm'+i, header: 'Middle '+i, width: 180})),
  { id: 'c', header: 'Right A', pinned: 'right', width: 140 },
  { id: 'd', header: 'Right B', pinned: 'right', width: 150, resizable: true },
].map(c => ({...c, accessor: row => row.id}));
const data = Array.from({length: 50}, (_, i) => ({id: 'row-'+i}));
function Fixture() {
  const [target, setTarget] = useState('row-30'), [busy, setBusy] = useState(false);
  return <div data-theme-container className="crm-shell" style={{padding: 8}}>
    <button onClick={() => setTarget('row-40')}>Next target</button>
    <button onClick={() => setBusy(!busy)}>Toggle refresh</button>
    <TableRefreshContext.Provider value={busy}><DataGrid columns={columns} data={data} getRowId={row => row.id}
      height={320} selectable rowActions={() => [{id: 'view', label: 'View', onClick: () => {}}]}
      highlightRowId={target} ariaLabel="Layout grid" /></TableRefreshContext.Provider>
  </div>;
}
createRoot(document.getElementById('root')).render(<Fixture />);`;
const bundle = await build({
  root, configFile: false, logLevel: 'error', define: { 'process.env.NODE_ENV': '"production"' },
  resolve: { extensions: ['.ts', '.tsx', '.mjs', '.js', '.json'], alias: { '@/store/AuthContext': 'fixture-auth', '@/shared': resolve(root, 'src/shared'), '@/lib': resolve(root, 'src/lib'), '@leadcrm/shared': resolve(root, '../shared/src/index.ts'), '@': root } },
  plugins: [{ name: 'disposable-fixture', enforce: 'pre',
    resolveId(id) { if (id.replaceAll('\\', '/') === virtual) return virtual; if (id === 'fixture-auth') return '\0fixture-auth'; },
    load(id) { if (id.replaceAll('\\', '/') === virtual) return source; if (id === '\0fixture-auth') return 'export const useAuth = () => ({ user: {role: "Client Admin"}, permissions: [], isPermissionsLoaded: true });'; },
  }, react()],
  build: { write: false, emptyOutDir: false, minify: false, lib: { entry: virtual, formats: ['iife'], name: 'GridLayoutFixture' } },
});
const chunks = Array.isArray(bundle) ? bundle.flatMap(result => result.output) : bundle.output;
const javascript = chunks.find(chunk => chunk.type === 'chunk').code;
const cssDirectory = resolve(root, '.next/static/css');
const css = readdirSync(cssDirectory).filter(name => name.endsWith('.css')).map(name => readFileSync(resolve(cssDirectory, name), 'utf8')).join('\n');
const server = createServer((request, response) => {
  if (request.url === '/fixture.js') { response.setHeader('Content-Type', 'application/javascript'); response.end(javascript); return; }
  if (request.url?.includes('/media/')) {
    const path = resolve(root, '.next/static/media', basename(new URL(request.url, 'http://localhost').pathname));
    if (existsSync(path)) { response.end(readFileSync(path)); return; }
  }
  response.setHeader('Content-Type', 'text/html');
  response.end('<html><head><style>' + css + '</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>');
});
let browser;
let checks = 0;
try {
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.getByRole('grid').waitFor().catch(error => { console.error(errors); throw error; });
  for (const dark of [false, true]) for (const width of [320, 375, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    await page.evaluate(dark => { document.documentElement.dataset.appTheme = dark ? 'dark' : 'light'; document.querySelector('[data-theme-container]').classList.toggle('dark', dark); }, dark);
    const geometry = await page.getByRole('grid').evaluate(table => {
      const viewport = table.parentElement;
      viewport.scrollLeft = 0;
      const row = table.querySelector('[data-search-highlight="true"]');
      const cells = [...row.children], before = cells.map(cell => cell.getBoundingClientRect().x);
      viewport.scrollLeft = 250;
      const headers = [...table.querySelectorAll('th')];
      return { scroll: viewport.scrollLeft, cells: cells.map((cell, index) => ({
        pinned: cell.classList.contains('grid-pinned-cell'), position: getComputedStyle(cell).position,
        moved: before[index] - cell.getBoundingClientRect().x,
        left: cell.getBoundingClientRect().left, right: cell.getBoundingClientRect().right,
        fill: getComputedStyle(cell).backgroundColor,
        aligned: Math.abs(cell.getBoundingClientRect().x - headers[index].getBoundingClientRect().x) < 1,
      })) };
    });
    assert.ok(geometry.scroll > 0);
    assert.ok(geometry.cells.every(cell => cell.aligned));
    assert.ok(geometry.cells.every(cell => cell.fill === geometry.cells[0].fill));
    for (const cell of geometry.cells) {
      // Collapsed table borders account for up to one pixel at scroll origin.
      if (width >= 768 && cell.pinned) { assert.equal(cell.position, 'sticky'); assert.ok(Math.abs(cell.moved) <= 1, JSON.stringify({width, cell})); }
      else { assert.notEqual(cell.position, 'sticky'); assert.ok(Math.abs(cell.moved - geometry.scroll) < 1); }
    }
    if (width >= 768) {
      const left = geometry.cells.slice(0, 4), right = geometry.cells.slice(-2);
      assert.ok(left.every((cell, index) => index === 0 || cell.left >= left[index - 1].right - 1));
      assert.ok(right[0].right <= right[1].left + 1);
    }
    console.log('PASS', width, dark ? 'Dark' : 'Light', 'actual multiple left/right pin offsets, cell fills and header alignment'); checks++;
  }
  await page.setViewportSize({ width: 1440, height: 800 });
  const header = page.getByRole('columnheader', { name: 'Right B', exact: true });
  const rect = await header.boundingBox();
  await page.mouse.move(rect.x + rect.width - 2, rect.y + 15); await page.mouse.down();
  await page.mouse.move(rect.x + rect.width + 48, rect.y + 15); await page.mouse.up();
  const rightWidth = (await header.boundingBox()).width;
  assert.ok(rightWidth > 150);
  assert.ok(Math.abs(parseFloat(await page.getByRole('columnheader', { name: 'Right A', exact: true }).evaluate(element => element.style.right)) - rightWidth) <= 1);
  await page.getByRole('button', { name: 'Next target' }).click();
  const target = page.locator('[data-row-id="row-40"]');
  await page.waitForFunction(() => document.querySelector('[data-row-id="row-40"]').getBoundingClientRect().top < 380);
  assert.equal(await target.getAttribute('data-search-highlight'), 'true');
  assert.equal(await page.locator('[data-row-id="row-30"]').getAttribute('data-search-highlight'), null);
  await page.getByRole('button', { name: 'Toggle refresh' }).click();
  assert.ok(await page.getByRole('region').getByRole('status', { name: 'Refreshing data...' }).isVisible());
  assert.ok(await target.isVisible());
  await page.getByRole('button', { name: 'Toggle refresh' }).click();
  assert.equal(await page.getByRole('status', { name: 'Refreshing data...' }).count(), 0);
  assert.deepEqual(errors, []);
  console.log('PASS actual resizing, later target scroll, shared workspace spinner and retained rows'); checks++;
  console.log('PASS', checks, 'browser layout checks');
} finally { await browser?.close(); server.closeAllConnections(); await new Promise(done => server.close(done)); }
