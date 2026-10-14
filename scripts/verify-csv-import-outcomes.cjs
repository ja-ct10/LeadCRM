// Local acceptance against test-crm-imports-disposable.mjs --preview and a matching frontend.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { mkdirSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { randomUUID } = require('node:crypto');
const assert = require('node:assert/strict');
const base = process.env.CSV_PREVIEW_URL || 'http://localhost:3100';
const output = process.env.CSV_QA_OUTPUT;
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base) || !output) throw new Error('Disposable local preview and explicit evidence directory required.');
mkdirSync(output, { recursive: true });
const widths = [320, 375, 390, 430, 768, 1024, 1440, 1920];
const scenarios = [[10, 0, 0], [7, 3, 0], [8, 0, 2], [6, 2, 2], [0, 10, 0], [0, 0, 10], [0, 6, 4]];
const labels = { firstName: 'First Name', lastName: 'Last Name', email: 'Email', phone: 'Phone Number', companyName: 'Company Name',
  address: 'Full Address', name: 'Company Name', productInterest: 'Product Interest' };
const encode = rows => {
  const keys = Object.keys(rows[0]), quote = value => '"' + String(value ?? '').replace(/"/g, '""') + '"';
  return { fileName: 'test.csv', csvText: [keys.map(k => labels[k] ?? k).join(','), ...rows.map(row => keys.map(k => quote(row[k])).join(','))].join('\n'),
    mappings: Object.fromEntries(keys.map((k, i) => [k, i])), idempotencyKey: randomUUID() };
};
(async () => {
  const { isolateBrowserContext, setAcceptanceTheme } = await import('../backend/scripts/verify-browser-matrix.mjs');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await isolateBrowserContext(page.context());
  page.setDefaultTimeout(60000);
  const report = [], errors = [];
  const saveReport = () => writeFileSync(resolve(output, 'browser-results.json'), JSON.stringify({ report, errors, environment: 'disposable local API' }, null, 2));
  page.on('pageerror', error => errors.push(error.message));
  async function api(module, method = 'GET', payload, suffix = '') {
    const response = await page.request.fetch(`${base}/api/proxy/crm/${module}/imports${suffix}`, { method, ...(payload ? { data: payload } : {}) });
    assert([200, 201, 202].includes(response.status()), `${module}${suffix}: ${response.status()} ${await response.text()}`);
    return response.json();
  }
  async function capture(module, step) {
    for (const theme of ['Light', 'Dark']) {
      await setAcceptanceTheme(page, theme);
    for (const width of widths) {
      await page.setViewportSize({ width, height: 1000 });
      await page.screenshot({ path: resolve(output, `${module}-${step}-${theme.toLowerCase()}-${width}.png`), fullPage: true });
      const size = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
      assert(size.scroll <= size.width + 1, `${module}/${step} overflows at ${width}: ${size.scroll}`);
      report.push(`${module}/${step}/${theme}/${width}: no document overflow`);
    }
    }
    await setAcceptanceTheme(page, 'Light');
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  async function upload(module, payload) {
    await page.goto(`${base}/crm/${module}/import`);
    for (let attempt = 0; attempt < 3; attempt++) {
      const ready = await Promise.race([
        page.getByRole('button', { name: 'Browse files', exact: true }).waitFor().then(() => 'ready'),
        page.getByRole('button', { name: 'Try again', exact: true }).waitFor().then(() => 'retry'),
      ]);
      if (ready === 'ready') break;
      report.push(`${module}: disposable database connection interrupted during auth; used visible Try again`);
      await page.getByRole('button', { name: 'Try again', exact: true }).click();
    }
    await page.getByRole('button', { name: 'Browse files', exact: true }).waitFor();
    await page.locator('input[type=file]').setInputFiles({ name: payload.fileName, mimeType: 'text/csv', buffer: Buffer.from(payload.csvText) });
    await page.getByRole('heading', { name: 'Map your columns', exact: true }).waitFor();
  }
  async function review() {
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('heading', { name: 'Review & validate', exact: true }).waitFor();
  }
  try {
    await page.goto(base + '/login');
    await page.getByLabel('Email address').fill('sales-ui@camxian.com');
    await page.getByLabel('Password', { exact: true }).fill('SalesPreview!2026');
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await page.waitForURL(/\/(dashboard|onboarding)$/, { timeout: 120000 });
    if (page.url().endsWith('/onboarding')) {
      const completed = await page.request.post(`${base}/api/proxy/auth/onboarding/complete`, { data: {} });
      assert.equal(completed.status(), 200);
      await page.goto(base + '/dashboard');
    }
    for (const module of ['leads', 'contacts', 'accounts']) {
      for (const [valid, duplicate, invalid] of scenarios) {
        const seed = randomUUID();
        const make = i => module === 'accounts' ? { name: `Browser ${seed} ${i}`, productInterest: 'Biometrics' }
          : { firstName: 'Browser', lastName: 'Tester', email: `browser-${seed}-${i}@example.com`, phone: '9123456789', companyName: 'Browser Company', address: 'Manila', productInterest: 'Biometrics' };
        const rows = Array.from({ length: valid }, (_, i) => make(i));
        if (!valid && duplicate) await api(module, 'POST', encode([make(0)]));
        rows.push(...Array.from({ length: duplicate }, () => make(0)));
        rows.push(...Array.from({ length: invalid }, (_, i) => ({ ...make(10 + i), productInterest: 'Missing Browser Product' })));
        const payload = encode(rows);
        const before = (await api(module)).meta.total;
        if (valid === 10) {
          await page.goto(`${base}/crm/${module}/import`);
          await page.getByRole('button', { name: 'Browse files', exact: true }).waitFor();
          const download = page.waitForEvent('download');
          await page.getByRole('button', { name: 'Download CSV template' }).click();
          await (await download).saveAs(resolve(output, `${module}-template.csv`));
          await capture(module, 'upload');
        }
        await upload(module, payload);
        if (valid === 6) await capture(module, 'mapping');
        await review();
        if (valid === 6) await capture(module, 'review');
        const keyUrl = page.url();
        await page.getByRole('button', { name: new RegExp(`^Import ${valid} `) }).click();
        const title = valid === 10 ? 'Import Succeeded' : valid ? 'Import Partially Succeeded' : invalid === 10 ? 'Import Failed' : 'No Records Imported';
        const type = valid === 10 ? 'success' : valid ? 'warning' : 'error';
        const toast = page.locator(`[data-sonner-toast][data-type="${type}"]`).filter({ has: page.getByText(title, { exact: true }) });
        await toast.waitFor();
        assert.equal(await toast.count(), 1);
        const toastText = await toast.innerText();
        if (valid) {
          await page.getByRole('heading', { name: title, exact: true }).waitFor();
          if (valid !== 10) assert(toastText.includes(`${valid} records imported, ${duplicate} duplicates skipped, and ${invalid} records failed.`));
          const after = await api(module);
          assert.equal(after.meta.total, before + 1);
          const job = after.data.find(item => item.idempotencyKey === new URL(keyUrl).searchParams.get('importKey'));
          assert(job); assert.equal(job.status, valid === 10 ? 'completed' : 'completed_with_errors');
          assert.deepEqual([job.successfulRecords, job.duplicateRecords, job.failedRecords], [valid, duplicate, invalid]);
          const results = await api(module, 'GET', undefined, `/${job.id}/results?limit=100`);
          assert.equal(results.meta.total, 10); assert.equal(results.data.filter(row => row.recordId).length, valid);
          assert.equal((await api(module, 'POST', { ...payload, idempotencyKey: job.idempotencyKey })).data.id, job.id);
          if (valid === 6) {
            await capture(module, 'result');
            await page.getByRole('button', { name: 'View Details', exact: true }).click();
            await page.getByRole('heading', { name: 'Import Details', exact: true }).waitFor();
            await page.getByRole('link', { name: /^View / }).first().waitFor();
            await capture(module, 'details');
            await page.getByRole('button', { name: 'Failed', exact: true }).click();
            await page.getByText('Missing Browser Product', { exact: false }).first().waitFor();
            await page.getByRole('button', { name: 'Back to Import', exact: true }).click();
            await page.getByRole('button', { name: 'History', exact: true }).click();
            await page.getByRole('table', { name: 'Import history' }).waitFor();
            assert.equal(await page.getByRole('button', { name: 'Failed', exact: true }).count(), 0);
            await capture(module, 'history');
          }
        } else {
          assert.equal((await api(module)).meta.total, before, 'Blocked Review must not create a job');
          assert.equal(await page.getByRole('heading', { name: 'Review & validate' }).count(), 1);
          assert.equal(await page.locator('[data-sonner-toast][data-type="success"]').count(), 0);
          await page.getByRole('button', { name: 'Back', exact: true }).click();
          await page.getByRole('heading', { name: 'Map your columns' }).waitFor();
        }
        report.push(`${module}: ${valid}/${duplicate}/${invalid}; ${type} ${title}; actual persisted counts verified`);
        saveReport();
        console.log(report.at(-1));
      }
      const failure = encode([module === 'accounts' ? { name: `Failed ${randomUUID()}`, productInterest: 'Missing Browser Product' }
        : { firstName: 'Failed', lastName: 'Tester', email: `failed-${randomUUID()}@example.com`, phone: '9123456789', companyName: 'Company', address: 'Manila', productInterest: 'Missing Browser Product' }]);
      const failed = (await api(module, 'POST', failure)).data;
      assert.equal(failed.status, 'failed');
      await page.goto(`${base}/crm/${module}/import?status=failed`);
      await page.getByRole('table', { name: 'Import history' }).waitFor();
      await page.getByRole('cell', { name: 'Failed', exact: true }).first().waitFor();
      assert(!page.url().includes('status=failed'));
      assert.equal(await page.getByRole('button', { name: 'Failed', exact: true }).count(), 0);
      report.push(`${module}: historical failed job remains in All Imports; old Failed URL falls back`);
    }
    // Simulate a lost response after one batch commits, then resume through History.
    const large = encode(Array.from({ length: 27 }, (_, i) => ({ name: `Resume ${randomUUID()} ${i}` })));
    large.csvText = large.csvText.split('\n').map((row, i) => i ? row + ',"' + 'x'.repeat(24000) + '"' : row + ',Unused Notes').join('\n');
    let executions = 0;
    await upload('accounts', large); await review();
    await page.route('**/api/proxy/crm/accounts/imports', route => {
      if (route.request().method() === 'POST' && ++executions === 2) return route.abort('failed');
      return route.continue();
    });
    await page.getByRole('button', { name: /^Import 27 / }).click();
    await page.locator('[data-sonner-toast][data-type="error"]').filter({ has: page.getByText('Import Interrupted', { exact: true }) }).waitFor();
    await page.unroute('**/api/proxy/crm/accounts/imports');
    await page.getByRole('button', { name: 'History', exact: true }).click();
    await page.getByRole('row').filter({ hasText: 'In Progress' }).first().click();
    await page.getByRole('button', { name: 'Resume import', exact: true }).click();
    await page.getByRole('button', { name: 'Browse files', exact: true }).waitFor();
    await page.locator('input[type=file]').setInputFiles({ name: large.fileName, mimeType: 'text/csv', buffer: Buffer.from(large.csvText) });
    await page.getByRole('heading', { name: 'Map your columns' }).waitFor();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('button', { name: 'Resume import', exact: true }).click();
    await page.getByRole('heading', { name: 'Import Succeeded', exact: true }).waitFor();
    report.push('27-row chunked import: first 25 committed, response interruption, History resume, 27 final records');
    assert.deepEqual(errors, []);
    saveReport();
    console.log(`${report.length} acceptance checks passed; evidence: ${output}`);
  } finally { await page.screenshot({ path: resolve(output, 'last-state.png'), fullPage: true }).catch(() => {}); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
