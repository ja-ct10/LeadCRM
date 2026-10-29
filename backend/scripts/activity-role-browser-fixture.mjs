// Imported by activity-role-visibility.integration.test.ts with its disposable database and sessions.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createWriteStream, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { acceptancePort, createAcceptanceContext } from './verify-browser-matrix.mjs';

export async function verifyActivityRolePanels({ db, apiBase, admin, head, agent, outsider, records }) {
  assert.equal(new URL(apiBase).hostname, '127.0.0.1');
  const root = resolve(import.meta.dirname, '../..'), port = await acceptancePort(), base = `http://localhost:${port}`;
  const output = resolve(root, 'data/outputs/activity-role-visibility'); mkdirSync(output, { recursive: true });
  const log = createWriteStream(resolve(output, 'frontend.log'));
  const frontend = spawn(process.execPath, [resolve(root, 'node_modules/next/dist/bin/next'), 'dev', '-p', String(port), '-H', '127.0.0.1'], {
    cwd: resolve(root, 'frontend'), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'development', API_URL: apiBase, NEXT_PUBLIC_USE_MOCK_AUTH: 'false', NEXT_PUBLIC_USE_MOCK_DATA: 'false' },
  });
  frontend.stdout.pipe(log); frontend.stderr.pipe(log);
  const require = createRequire(import.meta.url), { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
  let browser, page;
  const checks = [], errors = [];
  try {
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      try { if ((await fetch(base + '/login')).ok) { ready = true; break; } } catch {}
      await new Promise(done => setTimeout(done, 500));
    }
    assert.ok(ready, 'Local frontend must start');
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const context = await createAcceptanceContext(browser, { viewport: { width: 1440, height: 1000 } });
    let actor = admin;
    await context.addCookies([{ name: 'leadcrm_token', value: actor.token, url: base, httpOnly: true, sameSite: 'Lax' }]);
    page = await context.newPage(); page.setDefaultTimeout(45000); page.setDefaultNavigationTimeout(90000);
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/proxy/**', async route => {
      const request = route.request(), url = new URL(request.url()), path = url.pathname.replace('/api/proxy', '');
      // Keep the fixture focused on reads/refresh; background streams are verified by existing hook tests.
      if (path.endsWith('/events') || path === '/crm/record-events') return route.fulfill({ status: 200, contentType: 'text/event-stream', body: 'retry: 600000\n\n: acceptance\n\n' });
      assert.notEqual(path, '/integrations/gmail/sync', 'Opening CRM history must not start synchronization');
      const headers = { ...request.headers(), authorization: `Bearer ${actor.token}` };
      delete headers['content-length']; delete headers.host;
      const response = await page.request.fetch(apiBase + path + url.search, { method: request.method(),
        headers, data: request.postDataBuffer() ?? undefined });
      return route.fulfill({ response });
    });
    async function openPanel(kind, owner) {
      const module = kind === 'lead' ? 'leads' : kind === 'contact' ? 'contacts' : 'deals';
      const row = await db[kind].findUniqueOrThrow({ where: { id: records[owner.id][kind].id } });
      const title = kind === 'deal' ? row.title : `${row.firstName} ${row.lastName}`;
      await page.goto(`${base}/crm/${module}${kind === 'deal' ? `?pipelineId=${row.pipelineId}` : ''}`);
      if (kind === 'deal') await page.getByRole('heading', { name: title, exact: true, level: 4 }).click();
      else if (kind === 'contact') await page.getByRole('row').filter({ hasText: row.email }).getByText(row.firstName, { exact: true }).click();
      else await page.getByText(title, { exact: true }).first().click();
      await page.getByRole('heading', { name: title, exact: true, level: 1 }).waitFor();
      return page.getByRole('region', { name: 'Activity Timeline', exact: true });
    }
    for (const [role, user] of [['admin', admin], ['head', head], ['agent', agent]]) {
      actor = user;
      await context.addCookies([{ name: 'leadcrm_token', value: actor.token, url: base, httpOnly: true, sameSite: 'Lax' }]);
      for (const kind of ['lead', 'contact', 'deal']) {
        const timeline = await openPanel(kind, agent);
        await timeline.getByRole('button', { name: 'Emails', exact: true }).click();
        await page.waitForFunction(() => document.querySelectorAll('[data-email-body]').length === 2);
        assert.match(await timeline.innerText(), /Sent/); assert.match(await timeline.innerText(), /Received/);
        assert.equal(await page.getByText('Connect your work Gmail account first.', { exact: true }).count(), 0);
        await timeline.getByRole('button', { name: 'View more', exact: true }).first().click();
        await timeline.getByRole('button', { name: 'View less', exact: true }).waitFor();
        const search = timeline.getByRole('textbox', { name: 'Search activities' });
        await search.fill('inbound');
        await page.waitForFunction(() => document.querySelectorAll('[data-email-body]').length === 1);
        await search.fill('');
        await page.waitForFunction(() => document.querySelectorAll('[data-email-body]').length === 2);
        await page.screenshot({ path: resolve(output, `${role}-${kind}.png`), fullPage: true });
        checks.push(`${role} ${kind}: sent/received, expansion and search`);
      }
    }
    actor = admin;
    await context.addCookies([{ name: 'leadcrm_token', value: actor.token, url: base, httpOnly: true, sameSite: 'Lax' }]);
    let timeline = await openPanel('lead', outsider);
    await timeline.getByRole('button', { name: 'Emails', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('[data-email-body]').length === 2);
    actor = head;
    await context.addCookies([{ name: 'leadcrm_token', value: actor.token, url: base, httpOnly: true, sameSite: 'Lax' }]);
    timeline = await openPanel('lead', outsider);
    await timeline.getByRole('button', { name: 'Emails', exact: true }).click();
    await timeline.getByText('No activities match your filter.', { exact: true }).waitFor();
    assert.equal(await timeline.locator('[data-email-body]').count(), 0);
    checks.push('same browser account switch clears administrator history for an unrelated team');
    assert.deepEqual(errors, []);
    writeFileSync(resolve(output, 'results.json'), JSON.stringify({ passed: checks.length, failed: 0, checks, errors }, null, 2));
  } catch (error) {
    await page?.screenshot({ path: resolve(output, 'failure.png'), fullPage: true }).catch(() => {});
    writeFileSync(resolve(output, 'results.json'), JSON.stringify({ passed: checks.length, failed: 1, checks, errors, failure: String(error) }, null, 2));
    throw error;
  } finally {
    await browser?.close();
    if (process.platform === 'win32' && frontend.exitCode === null && frontend.signalCode === null) {
      try { execFileSync('taskkill', ['/PID', String(frontend.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); } catch { frontend.kill(); }
    } else frontend.kill();
    await new Promise(done => frontend.exitCode !== null || frontend.signalCode !== null ? done() : frontend.once('exit', done));
    log.end();
  }
}
