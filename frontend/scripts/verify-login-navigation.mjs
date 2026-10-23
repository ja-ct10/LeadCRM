// Real production frontend with local HTTP fixtures only; never reaches an application backend.
// Run after building: node frontend/scripts/verify-login-navigation.mjs
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { createRequire } from 'node:module';

const frontend = resolve(import.meta.dirname, '..');
const repository = dirname(frontend);
const output = resolve(process.env.LEADCRM_BROWSER_OUTPUT || mkdtempSync(join(tmpdir(), 'leadcrm-login-navigation-')));
const outputRelative = relative(repository, output);
assert.ok(outputRelative === '..' || outputRelative.startsWith('..' + sep) || isAbsolute(outputRelative), 'Keep browser artifacts outside the repository.');
mkdirSync(output, { recursive: true });
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
process.env.NODE_ENV = 'production';
process.env.API_URL = 'https://leadcrm-build.example/api/v1';
process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify(JSON.parse(readFileSync(join(frontend, '.next/required-server-files.json'), 'utf8')).config);
const { default: next } = await import('next');
const app = next({ dev: false, dir: frontend, hostname: '127.0.0.1' });
const handler = app.getRequestHandler();
const requests = [], checks = [], errors = [], harnessWarnings = [], expectedUnauthorized = [];
const user = {
  id: 'fixture-user', tenantId: 'fixture-tenant', role: 'Sales', status: 'ACTIVE',
  firstName: 'Navigation', lastName: 'Fixture', email: 'navigation@example.test',
  tenantName: 'Local fixture', tenantStatus: 'ACTIVE', groups: [], mustChangePassword: false,
  onboardingCompletedAt: '2026-01-01T00:00:00.000Z', onboardingStep: 0,
};
const pipeline = { id: 'fixture-pipeline', tenantId: user.tenantId, name: 'Sales Pipeline', stages: [
  { id: 'fixture-stage', name: 'Lead', order: 0, isDefault: true },
] };
const server = createServer((request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname;
  if (!path.startsWith('/api/proxy/')) { void handler(request, response); return; }
  // Intercept every API call before Next's proxy, including unknown endpoints.
  requests.push({ method: request.method, path });
  const send = (body, status = 200) => {
    response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify(body));
  };
  if (path === '/api/proxy/auth/login-lockout') return send({ success: true, data: { locked: false, serverNow: new Date().toISOString() } });
  if (path === '/api/proxy/auth/login') {
    response.setHeader('Set-Cookie', 'leadcrm_token=valid-fixture; Path=/; HttpOnly; SameSite=Lax');
    return send({ success: true, data: { user } });
  }
  if (path === '/api/proxy/auth/logout') {
    response.setHeader('Set-Cookie', 'leadcrm_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
    return send({ success: true });
  }
  if (!/(?:^|;\s*)leadcrm_token=valid-fixture(?:;|$)/.test(request.headers.cookie ?? '')) {
    return send({ success: false, error: 'Authentication required' }, 401);
  }
  if (path === '/api/proxy/auth/me') return send({ success: true, data: { user } });
  if (path === `/api/proxy/administration/users/${user.id}/permissions`) return send({ success: true, data: {
    deals: { canView: true, canViewAll: true, canViewMy: true },
    accounts: { canView: true, canViewAll: true, canViewMy: true },
  } });
  if (['/api/proxy/auth/events', '/api/proxy/crm/pipelines/events', '/api/proxy/crm/record-events'].includes(path)) {
    response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' });
    response.write(': local fixture\n\n');
    return;
  }
  if (path === '/api/proxy/auth/activity') return send({ success: true });
  if (path === '/api/proxy/crm/record-access') return send({ success: true, data: { userId: user.id, tenantId: user.tenantId, clientAdmin: false, assignmentRestricted: true } });
  if (path === '/api/proxy/crm/pipelines') return send({ success: true, data: [pipeline] });
  if (['/api/proxy/crm/deals', '/api/proxy/crm/accounts', '/api/proxy/automation/workflows'].includes(path)) return send({ success: true, data: [], meta: { total: 0, page: 1, limit: 100, hasMore: false } });
  if (path === '/api/proxy/integrations/gmail/status') return send({ isConnected: false, email: null, connectedAt: null, lastSyncAt: null });
  if (path === '/api/proxy/notifications/counts') return send({ success: true, totalCount: 0, unreadCount: 0, unreadByModule: {}, unreadRecords: {} });
  errors.push(`Unexpected fixture API: ${request.method} ${path}`);
  return send({ success: false, error: 'Unexpected fixture API' }, 500);
});
function check(condition, label) { assert.ok(condition, label); checks.push(label); }
const sessionChecks = () => requests.filter(request => request.path === '/api/proxy/auth/me').length;
let browser;
try {
  await app.prepare();
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  async function contextWithPage(cookie) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
    if (cookie) await context.addCookies([{ name: 'leadcrm_token', value: cookie, url: origin, httpOnly: true, sameSite: 'Lax' }]);
    await context.addInitScript(() => { localStorage.setItem('app_theme', 'Light'); localStorage.setItem('app_accent_color', 'blue'); });
    // External styles are outside this fixture and must not cause network errors.
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (!['error', 'warning'].includes(message.type())) return;
      if (message.text() === 'Service Worker registration blocked by Playwright') { harnessWarnings.push(message.text()); return; }
      if (message.location().url === origin + '/api/proxy/auth/me' && message.text().includes('401')) { expectedUnauthorized.push(message.text()); return; }
      errors.push(`${message.type()}: ${message.text()}`);
    });
    return { context, page };
  }

  const anonymous = await contextWithPage();
  const beforeAnonymous = sessionChecks();
  await anonymous.page.goto(origin + '/login');
  await anonymous.page.getByRole('button', { name: 'Login', exact: true }).waitFor();
  await anonymous.page.waitForTimeout(1200);
  check(sessionChecks() === beforeAnonymous, 'Fresh login makes zero session probes');
  check(await anonymous.page.locator('[data-sonner-toast]').count() === 0, 'Fresh login has no error toast');
  await anonymous.page.goto(origin + '/crm/deals?tab=my');
  await anonymous.page.waitForURL(origin + '/login');
  check(sessionChecks() === beforeAnonymous, 'Protected route redirects without an anonymous probe');

  const signedIn = await contextWithPage('valid-fixture');
  for (const width of [390, 820, 1440]) {
    await signedIn.page.setViewportSize({ width, height: 900 });
    for (const suffix of ['/crm/deals', '/crm/deals?tab=my&pipelineId=fixture-pipeline', '/crm/pipeline?tab=my']) {
      await signedIn.page.goto(origin + suffix);
      await signedIn.page.getByRole('button', { name: 'All Deals', exact: true }).waitFor();
      const my = new URL(origin + suffix).searchParams.get('tab') === 'my';
      await signedIn.page.getByRole('button', { name: my ? 'My Deals' : 'All Deals', exact: true, pressed: true }).waitFor();
      if (width < 768) await signedIn.page.getByRole('button', { name: 'Open sidebar' }).click();
      const deals = signedIn.page.getByRole('button', { name: 'Deals', exact: true });
      await deals.waitFor();
      check(await deals.getAttribute('aria-current') === 'page', `Deals has aria-current at ${width}: ${suffix}`);
      const style = await deals.evaluate(button => ({
        color: getComputedStyle(button).color, background: getComputedStyle(button).backgroundColor,
        icon: getComputedStyle(button.querySelector('svg')).color,
        indicator: Boolean(button.querySelector('div.absolute.left-0')),
        indicatorColor: button.querySelector('div.absolute.left-0') ? getComputedStyle(button.querySelector('div.absolute.left-0')).backgroundColor : null,
      }));
      check(style.color === 'rgb(37, 99, 235)' && style.icon === style.color, `Blue Deals text and icon at ${width}: ${suffix}`);
      check(style.background === 'rgba(37, 99, 235, 0.08)', `Light blue active background at ${width}: ${suffix}`);
      check(style.indicator === (width !== 820), `Existing expanded/collapsed indicator behavior at ${width}: ${suffix}`);
      if (style.indicator) check(style.indicatorColor === style.color, `Blue left indicator at ${width}: ${suffix}`);
      check(await signedIn.page.locator('#crm-navigation [aria-current="page"]').count() === 1, `Only Deals is active at ${width}: ${suffix}`);
      check(new URL(signedIn.page.url()).searchParams.get('tab') === (my ? 'my' : null), `Tab query is preserved at ${width}: ${suffix}`);
      if (suffix.includes('pipelineId')) check(new URL(signedIn.page.url()).searchParams.get('pipelineId') === pipeline.id, `Other query parameters are preserved at ${width}`);
      await signedIn.page.screenshot({ path: join(output, `deals-${width}-${my ? 'my' : 'all'}-${suffix.includes('/pipeline?') ? 'alias' : 'canonical'}.png`) });
    }
    if (width < 768) await signedIn.page.getByRole('button', { name: 'Close sidebar' }).click();
    await signedIn.page.getByRole('button', { name: 'All Deals', exact: true }).click();
    await signedIn.page.waitForURL(url => !url.searchParams.has('tab'));
    check(await signedIn.page.getByRole('button', { name: 'All Deals', exact: true }).getAttribute('aria-pressed') === 'true', `All Deals tab navigation works at ${width}`);
    await signedIn.page.getByRole('button', { name: 'My Deals', exact: true }).click();
    await signedIn.page.waitForURL(url => url.searchParams.get('tab') === 'my');
    check(await signedIn.page.getByRole('button', { name: 'My Deals', exact: true }).getAttribute('aria-pressed') === 'true', `My Deals tab navigation works at ${width}`);
  }
  check(sessionChecks() > beforeAnonymous, 'Cookie sessions are validated by the session API');
  await signedIn.page.getByRole('button', { name: 'User profile menu' }).click();
  await signedIn.page.getByRole('menuitem', { name: 'Log out', exact: true }).click();
  await signedIn.page.waitForURL(origin + '/login');
  const afterLogout = sessionChecks();
  await signedIn.page.reload();
  await signedIn.page.getByRole('button', { name: 'Login', exact: true }).waitFor();
  check(sessionChecks() === afterLogout, 'Logout and refresh do not restart anonymous probes');

  await anonymous.page.getByLabel('Email address').fill(user.email);
  await anonymous.page.getByLabel('Password', { exact: true }).fill('LocalFixturePassword1!');
  await anonymous.page.getByRole('button', { name: 'Login', exact: true }).click();
  await anonymous.page.waitForURL(origin + '/dashboard');
  check(requests.some(request => request.path === '/api/proxy/auth/login'), 'Credential login reaches the existing account destination');
  await anonymous.context.close();
  await signedIn.context.close();

  const expired = await contextWithPage('expired-fixture');
  const beforeExpired = sessionChecks();
  await expired.page.goto(origin + '/crm/deals');
  await expired.page.waitForURL(origin + '/login');
  await expired.page.getByRole('button', { name: 'Login', exact: true }).waitFor();
  await expired.page.waitForTimeout(1200);
  check(sessionChecks() === beforeExpired + 1, 'Expired cookie settles after one handled unauthorized response');
  check(await expired.page.locator('[data-sonner-toast][data-type="error"]').count() === 0, 'Expired cookie has no application error toast');
  await expired.context.close();
  check(errors.length === 0, `No unexpected application console errors: ${JSON.stringify(errors)}`);
  writeFileSync(join(output, 'results.json'), JSON.stringify({ status: 'PASS', checks, errors, harnessWarnings, expectedUnauthorized, requests }, null, 2));
  console.log(JSON.stringify({ status: 'PASS', checks: checks.length, output }));
} catch (error) {
  writeFileSync(join(output, 'results.json'), JSON.stringify({ status: 'FAIL', checks, errors, error: error.stack, requests }, null, 2));
  console.error(error);
  console.error(`Browser evidence: ${output}`);
  process.exitCode = 1;
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise(done => server.close(done));
  await app.close();
}
