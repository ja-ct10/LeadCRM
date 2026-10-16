import { createServer } from 'node:net';
import { createServer as createHttpsServer } from 'node:https';
import { request as httpRequest } from 'node:http';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Each local fixture owns its frontend port, including when shards share a checkout. */
export async function acceptancePort() {
  const probe = createServer();
  await new Promise((done, fail) => { probe.once('error', fail); probe.listen(0, '127.0.0.1', done); });
  const port = probe.address().port;
  await new Promise((done, fail) => probe.close(error => error ? fail(error) : done()));
  return port;
}

/** Preserve production HTTPS origin checks in fixtures that exercise the real proxy. */
export async function acceptanceGateway(output) {
  const publicPort = await acceptancePort(), internalPort = await acceptancePort();
  const base = `https://localhost:${publicPort}`, internalBase = `http://127.0.0.1:${internalPort}`;
  const key = join(output, 'localhost-key.pem'), cert = join(output, 'localhost-cert.pem');
  const openssl = process.env.OPENSSL_BINARY || (process.platform === 'win32' ? 'C:/Program Files/Git/usr/bin/openssl.exe' : 'openssl');
  execFileSync(openssl, ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '1', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1'], { windowsHide: true, stdio: 'ignore' });
  const server = createHttpsServer({ key: readFileSync(key), cert: readFileSync(cert) }, (request, response) => {
    const upstream = httpRequest(internalBase + request.url, { method: request.method, headers: { ...request.headers, 'x-forwarded-proto': 'https' } }, incoming => {
      incoming.on('aborted', () => response.destroy()); incoming.on('error', () => response.destroy());
      response.writeHead(incoming.statusCode, incoming.headers); incoming.pipe(response);
    });
    upstream.on('error', () => { if (!response.headersSent) response.writeHead(502); response.end(); });
    response.on('close', () => upstream.destroy()); request.pipe(upstream);
  });
  return { base, internalBase,
    start: () => new Promise((done, fail) => { server.once('error', fail); server.listen(publicPort, '127.0.0.1', done); }),
    close: async () => { server.closeAllConnections(); if (server.listening) await new Promise((done, fail) => server.close(error => error ? fail(error) : done())); },
  };
}

export const acceptanceWidths = [320, 375, 390, 430, 768, 1024, 1440, 1920];
/** Routed fixtures own API traffic; service workers must not bypass those routes. */
export async function createAcceptanceContext(browser, options = {}) {
  const { sandboxedFrames = false, ...contextOptions } = options;
  const context = await browser.newContext({ ...contextOptions, serviceWorkers: sandboxedFrames ? 'allow' : 'block' });
  if (sandboxedFrames) {
    // Playwright's blocker reads this property without a guard in every frame.
    // Opaque sandbox origins throw on that read; keep registration blocked there too.
    await context.addInitScript(() => {
      try {
        const worker = navigator.serviceWorker;
        if (worker) worker.register = async () => { throw new Error('Service worker registration is disabled in acceptance tests.'); };
      } catch { /* Sandboxed frames cannot register service workers. */ }
    });
  }
  await isolateBrowserContext(context);
  return context;
}
export async function setAcceptanceTheme(page, mode, { allowUnscoped = false } = {}) {
  await page.evaluate(mode => {
    localStorage.setItem('app_theme', mode);
    window.dispatchEvent(new CustomEvent('themechange', { detail: { mode, theme: mode === 'Dark' ? 'dark' : 'light' } }));
  }, mode);
  await page.waitForFunction(({ mode, allowUnscoped }) => {
    const scopes = [...document.querySelectorAll('[data-theme-container]')];
    return document.documentElement.dataset.appTheme === (mode === 'Dark' ? 'dark' : 'light') &&
      (scopes.length > 0 || allowUnscoped) && scopes.every(scope => scope.classList.contains('dark') === (mode === 'Dark'));
  }, { mode, allowUnscoped });
}
export async function* responsiveMatrix(page, options = {}) {
  for (const theme of ['Light', 'Dark']) {
    await setAcceptanceTheme(page, theme, options);
    for (const width of acceptanceWidths) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(300);
      yield { theme, width };
    }
  }
  await setAcceptanceTheme(page, 'Light', options);
  await page.setViewportSize({ width: 1440, height: 900 });
}
/** Loopback APIs only; allow documented public typography assets, never providers. */
export async function isolateBrowserContext(context) {
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    const allowed = ['localhost', '127.0.0.1', '[::1]', 'fonts.googleapis.com', 'fonts.gstatic.com', 'api.fontshare.com', 'cdn.fontshare.com'].includes(url.hostname);
    return allowed || ['data:', 'blob:'].includes(url.protocol) ? route.fallback() : route.abort('blockedbyclient');
  });
}
