// Serves the actual compiled auth stack against isolated native PostgreSQL.
// Start after npm run build; never reads .env or invokes background workers.
import { fork, spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, createWriteStream, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import { createServer as httpsServer } from 'node:https';
import { createServer as httpServer, request as httpRequest } from 'node:http';
import { createLoginTestDatabase } from './create-login-test-database.mjs';
const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client'), { hashSync } = require('bcryptjs');
const output = process.env.LOGIN_QA_OUTPUT || resolve(tmpdir(), 'leadcrm-login-lockout-20261012');
mkdirSync(output, { recursive: true });
const database = createLoginTestDatabase(), password = 'DisposableLogin2026!';
const environment = { ...process.env, NODE_ENV: 'test', DATABASE_URL: database, DIRECT_URL: database,
  JWT_SECRET: randomBytes(32).toString('hex'), LOGIN_IDENTITY_SECRET: randomBytes(32).toString('hex'),
  API_URL: '', APP_URL: 'http://localhost:3035', ALLOWED_ORIGINS: 'http://localhost:3035',
  NEXT_PUBLIC_USE_MOCK_AUTH: 'false', NEXT_PUBLIC_USE_MOCK_DATA: 'false', SOURCE_COMMIT: 'disposable-login-acceptance',
};
const db = new PrismaClient({ datasources: { db: { url: database } } });
const tenant = await db.tenant.create({ data: { name: 'Disposable login acceptance', slug: `browser-${Date.now()}`, status: 'ACTIVE', onboardingStep: 3, onboardingCompletedAt: new Date() } });
await db.roleDefinition.create({ data: { tenantId: tenant.id, name: 'Client Admin', isSystemRole: true } });
for (const email of ['lockout-browser@camxian.com', 'elapsed-lockout@camxian.com']) await db.user.create({ data: { tenantId: tenant.id, email, firstName: 'Disposable', lastName: 'Acceptance', role: 'Client Admin', passwordHash: hashSync(password, 12), mustChangePassword: false, onboardingCompletedAt: new Date() } });
await db.$disconnect();
const children = [], log = createWriteStream(resolve(output, 'fixture.log'), { flags: 'a' });
async function worker() {
  const child = fork(resolve(import.meta.dirname, 'login-fixture-worker.cjs'), [], { env: environment, silent: true, windowsHide: true });
  children.push(child); child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false });
  const port = await new Promise((done, reject) => { child.once('message', message => done(message.port)); child.once('error', reject); });
  return { child, url: `http://127.0.0.1:${port}/api/v1` };
}
let first = await worker(); const second = await worker();
const cert = resolve(output,'localhost-cert.pem'), key = resolve(output,'localhost-key.pem');
const openssl = process.env.OPENSSL_BINARY || 'C:/Program Files/Git/usr/bin/openssl.exe';
assert.equal(spawnSync(openssl,['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=login-qa.local.test','-addext','subjectAltName=DNS:login-qa.local.test,DNS:localhost,IP:127.0.0.1'],{windowsHide:true,stdio:'ignore'}).status,0);
function proxy(req,res,target,headers=req.headers) {
  const upstream = httpRequest(target + req.url,{method:req.method,headers}, response => { res.writeHead(response.statusCode,response.headers); response.pipe(res); });
  upstream.on('error',()=>{res.writeHead(502);res.end('Disposable fixture upstream unavailable');});req.pipe(upstream);
}
const apiTls = httpsServer({key:readFileSync(key),cert:readFileSync(cert)},(req,res)=>proxy(req,res,second.url.replace('/api/v1','')));
await new Promise(done=>apiTls.listen(0,'127.0.0.1',done));
// Production proxy requires HTTPS even for this local build. Trust the generated
// localhost certificate only in the child process, never in the OS/global store.
const frontend = spawn(process.execPath, ['--require',resolve(import.meta.dirname,'login-local-dns.cjs'),require.resolve('next/dist/bin/next'), 'start', '-p', '3034'], { cwd: resolve(import.meta.dirname, '../../frontend'), env: { ...environment, NODE_ENV:'production', LOGIN_QA_DISPOSABLE:'true', NODE_EXTRA_CA_CERTS:cert, API_URL:`https://login-qa.local.test:${apiTls.address().port}/api/v1` }, windowsHide: true, stdio: ['ignore','pipe','pipe'] });
children.push(frontend); frontend.stdout.pipe(log, { end: false }); frontend.stderr.pipe(log, { end: false });
const gateway = httpServer((req,res)=>{
  if(req.url==='/qa-theme/dark'||req.url==='/qa-theme/light'){
    const mode=req.url.endsWith('dark')?'Dark':'Light';
    res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store'});
    res.end(`<html><body><script>localStorage.setItem('app_theme','${mode}');location.replace('/login')</script></body></html>`);return;
  }
  const headers={...req.headers};
  // This loopback-only fixture presents HTTP to the controlled browser while
  // exercising the production proxy's HTTPS origin check internally.
  if(headers.origin==='http://localhost:3035')headers.origin='https://localhost:3035';
  proxy(req,res,'http://127.0.0.1:3034',headers);
});
await new Promise(done=>gateway.listen(3035,'127.0.0.1',done));
writeFileSync(resolve(output, 'fixture.json'), JSON.stringify({ origin: 'http://localhost:3035', database, api: first.url, secondApi: second.url, email: 'lockout-browser@camxian.com' }, null, 2));
console.log('READY', 'http://localhost:3035/login', 'Disposable password:', password);
console.log('Evidence directory:', output);
const checks = [];
async function attempt(base, secret, address = 'elapsed-lockout@camxian.com') {
  const response = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: address, password: secret }) });
  return { status: response.status, data: await response.json(), cookie: response.headers.getSetCookie() };
}
if (process.argv.includes('--elapsed')) {
  void (async () => {
    for (let i = 0; i < 5; i++) assert.equal((await attempt(first.url, 'incorrect')).status, 401);
    const denied = await attempt(first.url, password);
    assert.equal(denied.status, 429); const { retryAt, serverNow } = denied.data.error;
    assert.equal(Date.parse(retryAt) - Date.parse(serverNow), 300000);
    assert.equal((await attempt(second.url, password)).status, 429);
    // Restart an actual backend process. The second replica observes the state.
    first.child.send('stop'); await new Promise(done => first.child.once('exit', done)); first = await worker();
    assert.equal((await attempt(first.url, password)).status, 429);
    checks.push('Five 401s; correct sixth denied; exact 300000ms expiry; shared replica and backend-process restart');
    console.log('PASS', checks.at(-1));
    while (Date.now() < Date.parse(retryAt) + 100) await new Promise(done => setTimeout(done, Math.min(30000, Date.parse(retryAt) + 100 - Date.now())));
    assert.equal((await attempt(second.url, password)).status, 200);
    assert.equal((await attempt(second.url, 'incorrect')).status, 401);
    checks.push('Actual five-minute elapsed cooldown permits normal login and a new failure sequence');
    writeFileSync(resolve(output, 'elapsed-result.json'), JSON.stringify({ passed: true, checks, retryAt, observedAfter: new Date().toISOString() }, null, 2));
    console.log('PASS', checks.at(-1));
  })().catch(error => { console.error('FAIL local elapsed acceptance:', error.message); writeFileSync(resolve(output, 'elapsed-result.json'), JSON.stringify({ passed: false, checks, error: error.message })); });
}
function stop() { gateway.close();apiTls.close();for (const child of children) { if (child.connected) child.send('stop'); else child.kill(); } setTimeout(() => process.exit(0), 1000); }
process.on('SIGINT', stop); process.on('SIGTERM', stop);
process.stdin.on('data', chunk => { if (chunk.toString().includes('\u0003')) stop(); });
