// Run after the frontend production build: node frontend/scripts/verify-public-responsive.mjs
// Real public routes and production CSS; API responses and the install event are local fixtures.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { createRequire } from 'node:module';

const frontend = resolve(import.meta.dirname, '..');
const repository = dirname(frontend);
const output = resolve(process.env.LEADCRM_BROWSER_OUTPUT || mkdtempSync(join(tmpdir(), 'leadcrm-public-responsive-')));
const outputRelative = relative(repository, output);
assert.ok(outputRelative === '..' || outputRelative.startsWith('..' + sep) || isAbsolute(outputRelative), 'Keep browser artifacts outside the repository.');
mkdirSync(output, { recursive: true });
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
process.env.NODE_ENV = 'production';
process.env.API_URL = 'https://leadcrm-build.example/api/v1';
const builtConfig = JSON.parse(readFileSync(join(frontend, '.next/required-server-files.json'), 'utf8')).config;
// Match the generated standalone server's config loading without re-transpiling next.config.ts.
process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify(builtConfig);
const { default: next } = await import('next');
const app = next({ dev: false, dir: frontend, hostname: '127.0.0.1' });
const handler = app.getRequestHandler();
const unexpectedApi = [], pageErrors = [], results = [];
const widths = [320, 360, 375, 430, 768, 1366, 1920];
const densities = { Small: 14, Medium: 16, Large: 18 };
const routes = [
  { path: '/login', heading: 'Login', type: 'login' },
  { path: '/privacy-policy', heading: 'Privacy Policy', type: 'legal', sections: 18 },
  { path: '/terms-of-service', heading: 'Terms of Service', type: 'legal', sections: 20 },
  { path: '/help', heading: 'How can we help?', type: 'help' },
];
let browser, checks = 0;
function check(condition, label, details) {
  assert.ok(condition, `${label}: ${JSON.stringify(details)}`);
  checks++;
}
const near = (actual, expected) => Math.abs(actual - expected) <= 1;
const server = createServer((request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname;
  // Catch every API request here so this script can never reach a configured backend.
  if (path.startsWith('/api/proxy/')) {
    response.setHeader('Content-Type', 'application/json');
    if (path === '/api/proxy/auth/me' && request.method === 'GET') {
      response.writeHead(401).end(JSON.stringify({ success: false, error: 'Unauthenticated' }));
    } else if (path === '/api/proxy/auth/login-lockout' && request.method === 'POST') {
      response.end(JSON.stringify({ success: true, data: { locked: false, serverNow: new Date().toISOString() } }));
    } else {
      unexpectedApi.push(`${request.method} ${path}`);
      response.writeHead(404).end(JSON.stringify({ success: false, error: 'Unexpected fixture request' }));
    }
    return;
  }
  void handler(request, response);
});

try {
  await app.prepare();
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const [density, rootSize] of Object.entries(densities)) {
    const context = await browser.newContext({ viewport: { width: 1920, height: 900 }, deviceScaleFactor: 1, serviceWorkers: 'block', reducedMotion: 'reduce' });
    await context.addInitScript(density => {
      localStorage.setItem('app_font_size', density);
      localStorage.setItem('app_theme', 'Light');
      localStorage.setItem('app_accent_color', 'blue');
      // Dispatch after hydration has attached the provider's listener.
      window.__publicInstallFixture = () => {
        const event = new Event('beforeinstallprompt', { cancelable: true });
        Object.assign(event, { prompt: async () => {}, userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }) });
        window.dispatchEvent(event);
      };
    }, density);
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const page = await context.newPage();
    page.on('pageerror', error => pageErrors.push(`${density}: ${error.message}`));
    for (const route of routes) {
      await page.goto(origin + route.path, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.getByRole('heading', { name: route.heading, exact: true }).waitFor();
      await page.waitForFunction(() => {
        window.__publicInstallFixture();
        return Boolean(document.querySelector('[data-pwa-banner]'));
      });
      await page.evaluate(() => document.fonts.ready);
      for (const width of widths) {
        await page.setViewportSize({ width, height: width >= 1366 ? 900 : 844 });
        await page.evaluate(() => { window.scrollTo(0, 0); return new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))); });
        const metrics = await page.evaluate(({ type, heading }) => {
          const box = element => {
            if (!element) return null;
            const rect = element.getBoundingClientRect();
            return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height, centerX: rect.x + rect.width / 2, centerY: rect.y + rect.height / 2 };
          };
          const textBox = element => {
            const range = document.createRange();
            range.selectNodeContents(element);
            return box({ getBoundingClientRect: () => range.getBoundingClientRect() });
          };
          const title = [...document.querySelectorAll('h1,h2')].find(element => element.textContent === heading);
          const footer = document.querySelector('footer'), footerGrid = footer.firstElementChild.firstElementChild;
          const brand = footer.querySelector('a[href="/login"]'), company = footer.querySelector('nav');
          const banner = document.querySelector('[data-pwa-banner]'), bannerTitle = banner.querySelector('.pwa-install-banner__title');
          const form = document.querySelector('form');
          const checkbox = document.querySelector('input[type="checkbox"]');
          const forgot = [...document.querySelectorAll('button')].find(element => element.textContent.trim() === 'Forgot password?');
          const categories = document.querySelector('[class*="categories"]');
          const main = document.querySelector('main');
          return {
            viewport: innerWidth, root: parseFloat(getComputedStyle(document.documentElement).fontSize),
            overflow: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) - innerWidth,
            titleSize: parseFloat(getComputedStyle(title).fontSize),
            inputSizes: [...document.querySelectorAll('input:not([type="checkbox"]),select,textarea')].map(element => parseFloat(getComputedStyle(element).fontSize)),
            footer: { columns: getComputedStyle(footerGrid).gridTemplateColumns.split(' ').length, brand: box(brand), company: box(company), leadColor: getComputedStyle(brand).color, crmColor: getComputedStyle(brand.lastElementChild.lastElementChild).color,
              links: [...footer.querySelectorAll('a')].map(element => ({ href: element.getAttribute('href'), bounds: box(element) })), logo: footer.querySelector('img').getAttribute('src'), copyright: footer.lastElementChild.lastElementChild.textContent },
            banner: { bounds: box(banner), title: box(bannerTitle), text: textBox(bannerTitle), lineHeight: parseFloat(getComputedStyle(bannerTitle).lineHeight), fontSize: parseFloat(getComputedStyle(bannerTitle).fontSize), whiteSpace: getComputedStyle(bannerTitle).whiteSpace,
              icon: box(banner.querySelector('.pwa-install-banner__icon')), install: box(banner.querySelector('.pwa-install-banner__install')), close: box(banner.querySelector('.pwa-install-banner__dismiss')) },
            ...(type === 'login' ? { login: { form: box(form), content: box(form.parentElement), panel: box(form.parentElement.parentElement), promo: box(document.querySelector('aside')), carouselVisible: document.querySelector('[aria-label="Our solutions"]').getClientRects().length > 0,
              remember: box(checkbox.closest('label')), checkbox: box(checkbox), forgot: box(forgot), label: checkbox.closest('label').textContent.trim(), bodySize: parseFloat(getComputedStyle(title.nextElementSibling).fontSize) } } : {}),
            ...(type === 'legal' ? { legal: { main: box(main), bodySize: parseFloat(getComputedStyle(document.querySelector('article section p')).fontSize), sections: document.querySelectorAll('article section').length,
              links: [...document.querySelectorAll('article a')].map(element => ({ bounds: box(element), wrap: getComputedStyle(element).overflowWrap })) } } : {}),
            ...(type === 'help' ? { help: { columns: getComputedStyle(categories).gridTemplateColumns.split(' ').length, root: box(title.closest('[class*="root"]')), search: box(form), inputSize: parseFloat(getComputedStyle(form.querySelector('input')).fontSize) } } : {}),
          };
        }, route);
        const label = `${route.path} ${density} ${width}px`;
        check(metrics.overflow <= 0, `${label} no page overflow`, metrics.overflow);
        check(metrics.root === rootSize, `${label} respects saved density`, metrics.root);
        if (width < 640) check(metrics.inputSizes.every(size => size >= 16), `${label} mobile controls >=16px`, metrics.inputSizes);
        const footer = metrics.footer, banner = metrics.banner;
        check(footer.columns === (width < 768 ? 1 : 2), `${label} footer columns`, footer.columns);
        check(width < 768 ? footer.company.top >= footer.brand.bottom : footer.company.left > footer.brand.right, `${label} footer placement`, footer);
        check(footer.leadColor !== footer.crmColor, `${label} separate Lead/CRM colors`, footer);
        check(footer.logo === '/leadcrm_logo.png' && footer.copyright === '© 2026 LeadCRM. All rights reserved.', `${label} footer identity`, footer);
        check(['/login', '/privacy-policy', '/terms-of-service', '/help', 'mailto:leadcrm.tech@gmail.com'].every(href => footer.links.some(link => link.href === href)), `${label} footer links`, footer.links);
        check(footer.links.every(link => link.bounds.left >= 0 && link.bounds.right <= width + 1), `${label} footer links fit`, footer.links);
        check(banner.whiteSpace === 'nowrap' && banner.text.height <= banner.lineHeight + 1 && banner.text.right <= banner.title.right + 1, `${label} single-line unclipped PWA title`, banner);
        check([banner.icon, banner.install, banner.close].every(bounds => bounds.width > 0 && bounds.left >= 0 && bounds.right <= width + 1), `${label} PWA controls visible`, banner);
        check(banner.icon.right <= banner.title.left + 1 && banner.text.right <= banner.install.left + 1 && banner.install.right <= banner.close.left, `${label} PWA controls do not overlap`, banner);
        check(banner.install.height >= 44 && banner.close.height >= 44, `${label} PWA touch targets`, banner);
        if (width >= 768) check(banner.fontSize >= 14, `${label} desktop PWA typography`, banner.fontSize);
        if (route.type === 'login') {
          const login = metrics.login;
          check(login.label === 'Remember me', `${label} checkbox label`, login.label);
          check(near(login.remember.centerY, login.forgot.centerY) && login.remember.right <= login.forgot.left && login.forgot.right <= login.form.right + 1, `${label} remember/recovery row`, login);
          check(login.checkbox.width > 0 && near(login.checkbox.width, rootSize), `${label} checkbox does not shrink`, login.checkbox);
          check(near(metrics.titleSize, rootSize * (width <= 360 ? 1.5 : 1.875)) && near(login.bodySize, rootSize * (width <= 360 ? .75 : .875)), `${label} compact typography only <=360px`, metrics);
          check(login.carouselVisible === (width >= 1024), `${label} promotional adaptation`, login);
          if (width >= 1024) {
            check(near(login.promo.width, width / 2) && near(login.panel.width, width / 2), `${label} split screen`, login);
            check(near(login.form.width, 28 * rootSize), `${label} comfortable desktop form width`, login.form);
            check(near(login.content.centerX, login.panel.centerX) && near(login.content.centerY, login.panel.centerY), `${label} centered form content`, login);
          } else if (width <= 430) check(login.form.width >= width * .85, `${label} available mobile form width`, login.form);
        } else if (route.type === 'legal') {
          check(metrics.legal.sections === route.sections, `${label} all legal sections retained`, metrics.legal.sections);
          check(metrics.legal.bodySize >= (width < 640 ? 15 : rootSize), `${label} legal body readability`, metrics.legal.bodySize);
          check(metrics.legal.links.every(link => link.wrap === 'anywhere' && link.bounds.left >= 0 && link.bounds.right <= width + 1), `${label} legal URLs/emails wrap within viewport`, metrics.legal.links);
          if (width >= 1366) check(near(metrics.legal.main.width, 56 * rootSize) && near(metrics.legal.main.centerX, width / 2), `${label} centered readable legal width`, metrics.legal.main);
        } else {
          check(metrics.help.columns === (width <= 540 ? 1 : width <= 1000 ? 2 : 3), `${label} Help category columns`, metrics.help);
          check(metrics.help.inputSize >= (width < 640 ? 16 : rootSize), `${label} Help search typography`, metrics.help);
          if (width >= 1366) check(near(metrics.help.root.width, 1160) && metrics.titleSize >= 2.5 * rootSize && near(metrics.help.search.width, 760), `${label} desktop Help sizing`, metrics.help);
          await page.getByRole('searchbox', { name: 'Search LeadCRM help' }).fill('create role');
          await page.getByLabel('Category', { exact: true }).waitFor();
          const search = await page.evaluate(() => ({
            overflow: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) - innerWidth,
            selectSize: parseFloat(getComputedStyle(document.querySelector('#help-category')).fontSize),
            query: new URLSearchParams(location.search).get('q'),
          }));
          check(search.overflow <= 0 && search.query === 'create role', `${label} Help search results fit and retain URL state`, search);
          if (width < 640) check(search.selectSize >= 16, `${label} mobile Help select >=16px`, search);
          await page.getByRole('button', { name: 'Clear help search' }).click();
          await page.getByRole('heading', { name: 'Browse by category' }).waitFor();
        }
        results.push({ path: route.path, density, width, metrics });
        if (density === 'Medium') {
          await page.screenshot({ path: join(output, `${route.path.slice(1)}-${width}.png`) });
          if (width === 320 || width === 1920) await page.getByRole('contentinfo').screenshot({ path: join(output, `${route.path.slice(1)}-footer-${width}.png`) });
        }
        console.log('PASS', label);
      }
    }
    await context.close();
  }
  check(pageErrors.length === 0, 'No browser page errors', pageErrors);
  check(unexpectedApi.length === 0, 'Only expected stubbed auth requests', unexpectedApi);
  const summary = { checks, cases: results.length, widths, densities, simulatedPwa: true, output, pageErrors, unexpectedApi };
  writeFileSync(join(output, 'results.json'), JSON.stringify({ ...summary, results }, null, 2));
  console.log(JSON.stringify(summary, null, 2));
} catch (error) {
  writeFileSync(join(output, 'failure.json'), JSON.stringify({ checks, cases: results.length, error: String(error), pageErrors, unexpectedApi, results }, null, 2));
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  if (server.listening) await new Promise(done => { server.close(done); server.closeAllConnections(); });
  await app.close();
}
