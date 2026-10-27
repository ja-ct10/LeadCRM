// Isolated browser fixture: actual shared UI/CSS, no backend or provider calls.
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const output = resolve('data/outputs/feedback-ui-verification');
await mkdir(output, { recursive: true });
console.log('Bundling the isolated shared UI fixture.');
const reuse = process.argv.includes('--reuse-bundle');
const bundle = reuse ? null : await build({ root: resolve('frontend'), configFile: false, plugins: [react()],
  logLevel: 'warn', css: { postcss: { plugins: [tailwindcss({ base: resolve('frontend') })] } },
  build: { write: false, minify: false, cssCodeSplit: false, lib: { entry: resolve('frontend/qa/feedback/preview.tsx'), formats: ['iife'], name: 'FeedbackQA' } },
  define: { 'process.env': JSON.stringify({ NODE_ENV: 'development' }) },
  resolve: { extensions: ['.ts', '.tsx', '.mjs', '.js', '.jsx', '.json'], alias: [
    { find: '@leadcrm/shared', replacement: resolve('shared/src/index.ts') },
    { find: '@', replacement: resolve('frontend/src') },
  ] },
});
let browser;
const results = [], errors = [];
try {
  const files = bundle ? (Array.isArray(bundle) ? bundle : [bundle]).flatMap(result => result.output) : [];
  const script = reuse ? await readFile(resolve(output, 'bundle.js'), 'utf8') : files.filter(file => file.type === 'chunk').map(file => file.code).join('\n');
  const css = reuse ? await readFile(resolve(output, 'bundle.css'), 'utf8') : files.filter(file => file.type === 'asset' && file.fileName.endsWith('.css')).map(file => file.source).join('\n');
  if (!reuse) { await writeFile(resolve(output, 'bundle.js'), script); await writeFile(resolve(output, 'bundle.css'), css); }
  const logo = 'data:image/png;base64,' + (await readFile(resolve('frontend/public/camxian_logo.png'))).toString('base64');
  console.log('Fixture bundled.');
  browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--no-proxy-server'] });
  const page = await browser.newPage();
  page.on('pageerror', error => errors.push(error.message));
  const dismissToasts = async () => {
    const closeButtons = page.locator('[data-sonner-toast][data-visible="true"]:not([data-removed="true"]) [data-close-button]');
    while (await closeButtons.count()) await closeButtons.first().click();
  };
  await page.route('https://**/*', route => route.abort());
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto('about:blank');
    await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>' + css + '</style></head><body><div id="root"></div><script>window.process={env:{NODE_ENV:"development"}};</script><script>' + script.replaceAll('</script', '<\\/script') + '</script></body></html>');
    await page.getByRole('button', { name: 'Dark', exact: true }).waitFor({ timeout: 90000 });
    await page.getByAltText('Camxian Technologies').evaluate((node, source) => { node.dataset.originalSrc = node.getAttribute('src'); node.src = source; }, logo);
    console.log(`Fixture ready at ${viewport.width}px.`);
    for (const mode of ['Light', 'Dark']) for (const accent of ['blue', 'purple', 'orange']) {
      await page.getByRole('button', { name: mode, exact: true }).click();
      await page.getByRole('button', { name: accent, exact: true }).click();
      await page.getByRole('button', { name: 'Toast stack', exact: true }).click();
      await page.waitForTimeout(650);
      const metrics = await page.locator('[data-sonner-toast][data-visible="true"]:not([data-removed="true"])').evaluateAll(nodes => nodes.map(node => {
        const rect = node.getBoundingClientRect(), style = getComputedStyle(node);
        const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
        const luminance = color => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1); const values = [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3).map(value => { const channel = value / 255; return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4; }); return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722; };
        const a = luminance(style.backgroundColor), b = luminance(getComputedStyle(node.querySelector('[data-title]')).color);
        return { contrast: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05), x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, width: rect.width, background: style.backgroundColor, color: style.color, scrollWidth: node.scrollWidth, clientWidth: node.clientWidth };
      }));
      assert(metrics.length > 0);
      if (metrics.some(toast => toast.contrast < 4.5)) console.log(JSON.stringify({ mode, accent, metrics }));
      for (const toast of metrics) { assert(toast.contrast >= 4.5, 'Toast text must meet AA contrast'); assert(toast.x >= 0 && toast.right <= viewport.width + 1); assert(toast.bottom <= viewport.height); assert(toast.scrollWidth <= toast.clientWidth + 1); }
      const sorted = [...metrics].sort((a, b) => a.y - b.y);
      for (let index = 1; index < sorted.length; index++) assert(sorted[index].y >= sorted[index - 1].bottom + 10, 'Toasts must have a visible stacking gap');
      await page.frameLocator('iframe').getByRole('heading', { name: 'Hello Sam' }).waitFor();
      const preview = await page.frameLocator('iframe').locator('body').evaluate(node => ({ background: getComputedStyle(node).backgroundColor, color: getComputedStyle(node).color, width: window.innerWidth, bodyWidth: node.getBoundingClientRect().width }));
      assert.equal(preview.background, mode === 'Dark' ? 'rgb(22, 25, 30)' : 'rgb(255, 255, 255)');
      assert.equal(await page.getByAltText('Camxian Technologies').getAttribute('data-original-src'), '/camxian_logo.png');
      results.push({ viewport, mode, accent, metrics, preview });
      await page.waitForTimeout(250);
      await page.screenshot({ animations: 'disabled', path: resolve(output, `${viewport.width}-${mode}-${accent}.png`), fullPage: true });
      await dismissToasts();
      await page.getByRole('button', { name: 'Long toast', exact: true }).click();
      await page.waitForTimeout(650);
      const overflow = await page.locator('[data-sonner-toast][data-visible="true"]:not([data-removed="true"])').evaluateAll(nodes => nodes.some(node => node.scrollWidth > node.clientWidth + 1));
      assert(!overflow, 'Long messages must wrap');
      await dismissToasts();
      await page.getByRole('button', { name: 'Dismiss all', exact: true }).click();
    }
    for (const mode of ['Classic', 'System']) { await page.getByRole('button', { name: mode, exact: true }).click(); await page.getByRole('button', { name: 'Success toast', exact: true }).click(); await dismissToasts(); await page.getByRole('button', { name: 'Dismiss all', exact: true }).click(); }
    await page.getByRole('button', { name: 'Open drawer', exact: true }).click();
    await page.getByRole('button', { name: 'Archive record in drawer', exact: true }).click();
    await page.getByRole('alertdialog').waitFor();
    await page.keyboard.press('Escape'); assert.equal(await page.getByRole('alertdialog').count(), 0);
    await page.getByRole('dialog', { name: 'Record editor' }).getByRole('button', { name: /Close/ }).click();
    await page.getByRole('dialog', { name: 'Record editor' }).waitFor({ state: 'hidden' });
    await page.getByLabel('Fail confirmation').check();
    await page.getByRole('button', { name: 'Archive record', exact: true }).click();
    await page.getByRole('button', { name: 'Archive', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'administrator' }).waitFor();
    assert.equal(await page.getByRole('alertdialog').count(), 1);
    assert.equal(await page.locator('[data-sonner-toast][data-type="error"]').count(), 0);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  }
  assert.deepEqual(errors, []); console.log(`Passed ${results.length} theme/accent/viewport combinations, long-message and modal checks.`);
} finally {
  await writeFile(resolve(output, 'results.json'), JSON.stringify({ results, errors }, null, 2));
  await browser?.close();
}
