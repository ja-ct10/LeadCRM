// Disposable production-mode Next + TLS backend + HTTP/2 ingress. No real accounts or providers.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createServer as httpsServer } from 'node:https';
import { request as httpRequest } from 'node:http';
import { connect, constants, createSecureServer } from 'node:http2';
import { acceptancePort } from '../backend/scripts/verify-browser-matrix.mjs';

const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, '..');
const paths = ['auth/events', 'crm/record-events', 'crm/pipelines/events', 'reporting/dashboard/events', 'integrations/gmail/events'];
const pause = ms => new Promise(done => setTimeout(done, ms));
async function until(predicate) {
  const deadline = Date.now() + 10000;
  while (!predicate()) { assert.ok(Date.now() < deadline, 'Fixture did not reach its expected state'); await pause(30); }
}

if (process.argv.includes('--frontend')) {
  assert.equal(process.env.LEADCRM_QA_RUN, '1');
  const expected = new URL(process.env.API_URL);
  assert.equal(expected.hostname, 'proxy-streams.local.test');
  const guardedFetch = globalThis.fetch;
  // Map only this fixture's synthetic origin to a certificate-verified loopback
  // connection before the existing QA network guard checks it. No DNS/OS edits.
  globalThis.fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (url.origin !== expected.origin) return guardedFetch(input, init);
    url.hostname = '127.0.0.1';
    return guardedFetch(input instanceof Request ? new Request(url, input) : url, init);
  };
  await require('next/dist/server/lib/start-server').startServer({
    dir: process.env.PROXY_QA_DIR, port: Number(process.env.PROXY_QA_PORT), hostname: '127.0.0.1', isDev: false, allowRetry: false,
  });
} else {
  await verify();
}

async function verify() {
  const baseline = process.argv.includes('--baseline');
  const { qaEnvironment } = require('./qa-environment.cjs');
  mkdirSync(resolve(root, '.tmp'), { recursive: true });
  const output = mkdtempSync(resolve(root, '.tmp/proxy-streams-'));
  let frontendDir = resolve(root, 'frontend');
  const env = qaEnvironment(root, { NODE_ENV: 'production' });
  if (baseline) {
    // Reproduce the committed handler without modifying the working checkout.
    frontendDir = resolve(output, 'baseline');
    for (const file of ['app/api/proxy/[...path]/route.ts', 'src/lib/auth/cookies.ts', 'src/lib/server/backend-url.ts']) {
      const target = resolve(frontendDir, file); mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, execFileSync('git', ['show', `HEAD:frontend/${file}`], { cwd: root, windowsHide: true }));
    }
    writeFileSync(resolve(frontendDir, 'package.json'), JSON.stringify({ name: 'proxy-baseline-fixture', private: true }));
    writeFileSync(resolve(frontendDir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ES2022', lib: ['dom', 'esnext'], module: 'esnext', moduleResolution: 'bundler', jsx: 'preserve', esModuleInterop: true, skipLibCheck: true, paths: { '@/lib/*': ['./src/lib/*'] } } }));
    writeFileSync(resolve(frontendDir, 'next.config.js'), `module.exports = { outputFileTracingRoot: ${JSON.stringify(root)}, typescript: { ignoreBuildErrors: false } };\n`);
    writeFileSync(resolve(frontendDir, 'app/layout.tsx'), 'export default function Layout({children}: {children: React.ReactNode}) { return <html><body>{children}</body></html>; }\n');
    writeFileSync(resolve(frontendDir, 'app/page.tsx'), 'export default function Page() { return <p>Disposable proxy fixture</p>; }\n');
    execFileSync(process.execPath, [require.resolve('next/dist/bin/next'), 'build'], { cwd: frontendDir, env, windowsHide: true, stdio: 'inherit', timeout: 180000 });
  }
  const key = resolve(output, 'key.pem'), cert = resolve(output, 'cert.pem');
  execFileSync(process.env.OPENSSL_BINARY || (process.platform === 'win32' ? 'C:/Program Files/Git/usr/bin/openssl.exe' : 'openssl'), [
    'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '1', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1',
  ], { windowsHide: true, stdio: 'ignore' });
  const tls = { key: readFileSync(key), cert: readFileSync(cert) };
  const observed = new Map(), checks = [], sessions = new Set();
  const backend = httpsServer(tls, (req, res) => {
    const url = new URL(req.url, 'https://localhost');
    const id = url.searchParams.get('id'), mode = url.searchParams.get('mode');
    const state = { closed: false, passive: req.headers['x-leadcrm-passive'], cookie: req.headers.cookie }; observed.set(id, state);
    let timer, expiry;
    res.on('close', () => { state.closed = true; clearInterval(timer); clearTimeout(expiry); });
    res.on('error', () => {});
    if (mode === 'denied' || req.headers.cookie !== 'leadcrm_token=synthetic-session') {
      res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false, error: 'Synthetic session expired' })); return;
    }
    if (mode === 'ordinary') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.write('{'); return; }
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store, no-transform' });
    res.write('retry: 3000\nevent: fixture-ready\ndata: {}\n\n');
    timer = setInterval(() => { if (!res.writableEnded && !res.destroyed) res.write(': heartbeat\n\n'); }, 30);
    if (mode !== 'hold') expiry = setTimeout(() => { clearInterval(timer); if (mode === 'reset') res.destroy(); else res.end(); }, 180);
  });
  const frontendPort = await acceptancePort();
  let child, client;
  const gateway = createSecureServer(tls, (req, res) => {
    const headers = Object.fromEntries(Object.entries(req.headers).filter(([name]) => !name.startsWith(':')));
    headers.host = req.headers[':authority'];
    const upstream = httpRequest(`http://127.0.0.1:${frontendPort}${req.url}`, { method: req.method, headers }, incoming => {
      const hop = new Set(['connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'proxy-connection']);
      res.writeHead(incoming.statusCode, Object.fromEntries(Object.entries(incoming.headers).filter(([name]) => !hop.has(name))));
      incoming.on('aborted', () => res.destroy()); incoming.on('error', () => res.destroy()); incoming.pipe(res);
    });
    upstream.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end(); });
    res.on('close', () => upstream.destroy()); req.pipe(upstream);
  });
  gateway.on('session', session => { sessions.add(session); session.on('close', () => sessions.delete(session)); });
  let log = '';
  try {
    await new Promise(done => backend.listen(0, '127.0.0.1', done));
    child = spawn(process.execPath, [import.meta.filename, '--frontend'], { cwd: frontendDir, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: {
      ...env, NODE_EXTRA_CA_CERTS: cert, API_URL: `https://proxy-streams.local.test:${backend.address().port}/api/v1`,
      PROXY_QA_DIR: frontendDir, PROXY_QA_PORT: String(frontendPort),
    } });
    child.stdout.on('data', data => { log += data; }); child.stderr.on('data', data => { log += data; });
    await until(() => /Ready in/.test(log) || child.exitCode !== null);
    assert.equal(child.exitCode, null, log);
    await new Promise(done => gateway.listen(0, '127.0.0.1', done));
    client = connect(`https://127.0.0.1:${gateway.address().port}`, { ca: tls.cert, servername: 'localhost' });
    client.on('error', () => {});
    async function read(path, mode, cancel = false) {
      const id = String(observed.size + 1), started = Date.now();
      return new Promise((done, fail) => {
        const stream = client.request({ ':path': `/api/proxy/${path}?mode=${mode}&id=${id}`, cookie: 'leadcrm_token=synthetic-session' });
        let headers, body = '', firstMs, error;
        const cancelTimer = cancel === 'pending' ? setTimeout(() => stream.close(constants.NGHTTP2_CANCEL), 250) : undefined;
        const timer = setTimeout(() => { stream.close(); fail(new Error('HTTP/2 request timed out')); }, 5000);
        stream.on('response', value => { headers = value; });
        stream.on('data', data => { firstMs ??= Date.now() - started; body += data; if (cancel === true) stream.close(constants.NGHTTP2_CANCEL); });
        stream.on('error', value => { error = value.message; });
        stream.on('close', () => { clearTimeout(timer); clearTimeout(cancelTimer); done({ id, headers, body, firstMs, elapsed: Date.now() - started, reset: stream.rstCode, error }); });
        stream.end();
      });
    }
    for (const path of paths) {
      const normal = await read(path, 'clean');
      assert.equal(normal.headers[':status'], 200); assert.equal(normal.reset, 0);
      assert.match(normal.body, /fixture-ready/); assert.ok(normal.firstMs < normal.elapsed, 'Events must arrive before expiry');
      assert.equal(observed.get(normal.id).passive, '1');
      const interrupted = await read(path, 'reset');
      assert.match(interrupted.body, /fixture-ready/);
      if (!baseline) assert.equal(interrupted.reset, 0, interrupted.error);
      const reconnect = await read(path, 'clean'); assert.equal(reconnect.reset, 0); assert.match(reconnect.body, /fixture-ready/);
      const cancelled = await read(path, 'hold', true);
      await until(() => observed.get(cancelled.id)?.closed);
      const denied = await read(path, 'denied'); assert.equal(denied.headers[':status'], 401); assert.match(denied.body, /Synthetic session expired/);
      checks.push({ path, status: 'PASS', normalExpiry: true, interruption: 'upstream reset exercised', http2ResetCode: interrupted.reset, reconnect: true, cancellation: true, authenticationStatus: 401 });
      console.log('PASS', path, checks.at(-1).interruption);
    }
    const ordinary = await read('integrations/gmail/emails', 'ordinary', 'pending');
    assert.ok(observed.has(ordinary.id), 'Ordinary request must reach the synthetic backend');
    if (baseline) { await pause(250); assert.equal(observed.get(ordinary.id).closed, false, 'Committed handler leaves the cancelled body open'); }
    else await until(() => observed.get(ordinary.id).closed);
    checks.push({ path: 'integrations/gmail/emails', status: 'PASS', cancellation: !baseline });
    writeFileSync(resolve(output, 'results.json'), JSON.stringify({ baseline, checks }, null, 2));
    console.log('Evidence:', resolve(output, 'results.json'));
  } finally {
    writeFileSync(resolve(output, 'frontend.log'), log);
    client?.destroy(); for (const session of sessions) session.destroy();
    if (child && child.exitCode === null) { child.kill(); await new Promise(done => child.once('exit', done)); }
    backend.closeAllConnections(); await Promise.all([new Promise(done => backend.close(done)), new Promise(done => gateway.close(done))]);
  }
}
