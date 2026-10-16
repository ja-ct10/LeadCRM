'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { resolve } = require('node:path');
const { qaEnvironment } = require('./qa-environment.cjs');
const { browserEvidence, browserFailureDiagnostics, ensureBrowserFailureReport, cleanupBrowserDatabase } = require('./qa-browser-evidence.cjs');
const { sourceIdentity } = require('./qa-source-identity.cjs');
const { acceptanceRuns, cleanPhaseEnvironment, cleanPhaseEvidence } = require('./qa-clean-evidence.cjs');
const root = resolve(__dirname, '..');
const child = code => spawnSync(process.execPath, ['-e', code], { cwd: root, env: qaEnvironment(root), encoding: 'utf8', windowsHide: true });

test('Browser fixtures allocate an available loopback port independently of an active fixture', async () => {
  const { acceptancePort } = await import('../backend/scripts/verify-browser-matrix.mjs');
  const server = require('node:net').createServer();
  const first = await acceptancePort();
  await new Promise((done, fail) => { server.once('error', fail); server.listen(first, '127.0.0.1', done); });
  try {
    const second = await acceptancePort();
    assert.notEqual(second, first);
    assert.ok(Number.isInteger(second) && second > 0 && second <= 65535);
  } finally { await new Promise((done, fail) => server.close(error => error ? fail(error) : done())); }
});

test('Local TLS acceptance preserves the public Host and HTTPS ingress for the real proxy', async () => {
  const { acceptanceGateway } = await import('../backend/scripts/verify-browser-matrix.mjs');
  const gateway = await acceptanceGateway(qaEnvironment(root).TMP);
  const upstream = require('node:http').createServer((request, response) => {
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ host: request.headers.host, protocol: request.headers['x-forwarded-proto'], path: request.url }));
  });
  await new Promise((done, fail) => { upstream.once('error', fail); upstream.listen(Number(new URL(gateway.internalBase).port), '127.0.0.1', done); });
  try {
    await gateway.start();
    const value = await new Promise((done, fail) => {
      // Trust only this freshly generated loopback fixture certificate.
      const request = require('node:https').get(gateway.base + '/health', { rejectUnauthorized: false }, response => {
        let body = ''; response.on('data', data => { body += data; }); response.on('end', () => done(JSON.parse(body))); response.on('error', fail);
      });
      request.on('error', fail);
    });
    assert.deepEqual(value, { host: new URL(gateway.base).host, protocol: 'https', path: '/health' });
  } finally { await gateway.close(); upstream.closeAllConnections(); await new Promise(done => upstream.close(done)); }
});

test('Routed browser fixtures block service workers before installing network isolation', async () => {
  const { createAcceptanceContext } = await import('../backend/scripts/verify-browser-matrix.mjs');
  const calls = [];
  const context = { route: async (pattern, handler) => { calls.push(pattern); await handler({ request: () => ({ url: () => 'https://provider.example/private' }), abort: reason => calls.push(reason) }); } };
  const browser = { newContext: async options => { calls.push(options); return context; } };
  assert.equal(await createAcceptanceContext(browser, { viewport: { width: 320, height: 900 }, serviceWorkers: 'allow' }), context);
  assert.deepEqual(calls, [{ viewport: { width: 320, height: 900 }, serviceWorkers: 'block' }, '**/*', 'blockedbyclient']);
});
test('Source provenance survives committing deleted paths and detects changed content', () => {
  const directory = qaEnvironment(root).TEMP, fs = require('node:fs');
  const snapshot = resolve(directory, '.qa-source-snapshot.json');
  fs.writeFileSync(resolve(directory, 'kept.ts'), 'export const value = 1;');
  fs.writeFileSync(snapshot, JSON.stringify({ revision: 'fixture', files: ['kept.ts', 'removed.ts'] }));
  const before = sourceIdentity(directory);
  fs.writeFileSync(snapshot, JSON.stringify({ revision: 'fixture', files: ['kept.ts'] }));
  assert.equal(sourceIdentity(directory).sourceSha256, before.sourceSha256);
  assert.equal(sourceIdentity(directory).executableSourceSha256, before.executableSourceSha256);
  fs.writeFileSync(resolve(directory, 'kept.ts'), 'export const value = 2;');
  assert.notEqual(sourceIdentity(directory).sourceSha256, before.sourceSha256);
});
test('Browser acceptance rejects empty, incomplete, failed and stale successful reports', () => {
  for (const [result, code] of [[null, 0], [{ checks: [] }, 0], [{ status: 'running', checks: ['first'] }, 0], [{ checks: ['first'], errors: ['page failure'] }, 0], [{ checks: ['first'] }, 1], [{ checks: [{ passed: false }] }, 0]]) {
    assert.equal(browserEvidence(result, code).complete, false);
  }
  assert.deepEqual(browserEvidence({ checks: ['first', { passed: true }] }, 0), { executed: 2, passed: 2, failed: 0, skipped: 0, complete: true });
  for (const status of ['FAIL', 'failed', 'partial', 'BLOCKED', 'NOT TESTED', 'unknown', '', null, false]) {
    assert.equal(browserEvidence({ status, checks: ['first'] }, 0).complete, false, `Status ${status} cannot pass`);
  }
  for (const status of ['PASS', 'passed']) assert.equal(browserEvidence({ status, checks: ['first'] }, 0).complete, true);
});

test('Browser failure diagnostics expose the exact assertion and captured browser errors without changing acceptance', () => {
  const error = new assert.AssertionError({ actual: { syncError: null }, expected: {}, operator: 'deepStrictEqual' });
  const result = {
    checks: Array.from({ length: 39 }, (_, index) => `check ${index + 1}`), error: error.stack,
    pageErrors: ['Uncaught fixture exception'], transportErrors: [{ url: '/api/proxy/fixture', error: 'net::ERR_FAILED' }],
    errors: ['fixture error'], serverErrors: ['fixture server error'],
  };
  const before = JSON.stringify(result), diagnostics = JSON.parse(browserFailureDiagnostics(result, 1));
  assert.deepEqual({ executed: diagnostics.executed, passed: diagnostics.passed, failed: diagnostics.failed }, { executed: 40, passed: 39, failed: 1 });
  assert.equal(diagnostics.exitCode, 1);
  assert.equal(diagnostics.error, error.stack);
  assert.match(diagnostics.error, /syncError/);
  for (const key of ['errors', 'pageErrors', 'transportErrors', 'serverErrors']) assert.deepEqual(diagnostics[key], result[key]);
  assert.equal(JSON.stringify(result), before, 'Reporting preserves the original evidence');
  assert.equal(browserEvidence(result, 1).complete, false);
  const explicit = { checks: [{ label: 'mailbox status', passed: false }] };
  assert.deepEqual(JSON.parse(browserFailureDiagnostics(explicit, 0)).failedChecks, explicit.checks);
  const cleanupFailure = JSON.parse(browserFailureDiagnostics({ status: 'PASS', checks: ['assertion passed'] }, 1));
  assert.equal(cleanupFailure.status, 'PASS');
  assert.equal(cleanupFailure.failed, 1, 'A failing process remains visible even with a successful report');
  assert.equal(JSON.parse(browserFailureDiagnostics(null, 1)).failed, 1);
});

test('Browser startup crashes retain failure evidence without replacing the suite report', () => {
  const fs = require('node:fs'), directory = resolve(qaEnvironment(root).TEMP, 'browser-evidence');
  const childResult = child("throw new Error('fixture startup failed before browser initialization');");
  assert.equal(childResult.status, 1);
  const report = ensureBrowserFailureReport(directory, new Error(childResult.stderr));
  const failure = JSON.parse(fs.readFileSync(report, 'utf8'));
  assert.equal(failure.status, 'FAIL');
  assert.match(failure.error, /fixture startup failed before browser initialization/);
  assert.equal(browserEvidence(failure, childResult.status).complete, false);
  assert.equal(browserEvidence(failure, 0).complete, false, 'The fallback never satisfies required browser assertions');
  const original = fs.readFileSync(report, 'utf8');
  assert.equal(ensureBrowserFailureReport(directory, new Error('later cleanup failed')), report);
  assert.equal(fs.readFileSync(report, 'utf8'), original);
  const successfulDirectory = resolve(directory, 'successful'); fs.mkdirSync(successfulDirectory);
  const successfulReport = resolve(successfulDirectory, 'report.json');
  fs.writeFileSync(successfulReport, JSON.stringify({ status: 'PASS', checks: ['real assertion'] }));
  assert.equal(ensureBrowserFailureReport(successfulDirectory, new Error('cleanup')), successfulReport);
  assert.equal(fs.existsSync(resolve(successfulDirectory, 'results.json')), false);
});

test('Clean acceptance binds evidence to the current phase and rejects missing, malformed or conflicting outcomes', () => {
  const fs = require('node:fs'), directory = resolve(qaEnvironment(root).TEMP, 'evidence');
  const child = { status: 0 }, phase = 'unit', source = 'fixture-source';
  assert.deepEqual(acceptanceRuns(directory), []);
  assert.equal(cleanPhaseEvidence(directory, phase, [], child, source).status, 'FAIL');
  const write = (runId, values = {}) => {
    const folder = resolve(directory, runId); fs.mkdirSync(folder, { recursive: true });
    const file = resolve(folder, 'qa-unit-native.json');
    fs.writeFileSync(file, JSON.stringify({ runId, mode: phase, native: true, sourceStart: { sourceSha256: source }, status: 'PASS', results: [{ label: 'fixture unit', status: 'PASS' }], ...values }));
    return file;
  };
  write('1-old'); const before = acceptanceRuns(directory);
  assert.equal(cleanPhaseEvidence(directory, phase, before, child, source).status, 'FAIL', 'Earlier successful phase evidence is stale');
  const file = write('2-current');
  assert.equal(cleanPhaseEvidence(directory, phase, before, child, source).status, 'PASS');
  assert.equal(cleanPhaseEvidence(directory, phase, before, { status: 1 }, source).status, 'FAIL');
  assert.equal(cleanPhaseEvidence(directory, phase, before, { status: null, error: Error('launch failed') }, source).status, 'FAIL');
  write('2-current', { status: 'BLOCKED', results: [{ label: 'Linux boundary', status: 'BLOCKED' }] });
  assert.equal(cleanPhaseEvidence(directory, phase, before, { status: 1 }, source).status, 'BLOCKED');
  for (const values of [{ runId: '1-old' }, { mode: 'build' }, { native: false }, { sourceStart: { sourceSha256: 'stale' } }, { status: 'unknown' }, { results: [] }, { status: 'BLOCKED' }, { results: [{ status: 'FAIL' }] }]) {
    write('2-current', values); assert.equal(cleanPhaseEvidence(directory, phase, before, child, source).status, 'FAIL');
  }
  fs.writeFileSync(file, '{broken');
  assert.equal(cleanPhaseEvidence(directory, phase, before, child, source).status, 'FAIL');
  write('2-current'); write('3-other');
  assert.equal(cleanPhaseEvidence(directory, phase, before, child, source).status, 'FAIL', 'Multiple reports cannot establish one invocation');
});

test('Clean browser acceptance uses the installed snapshot Playwright package and preserves configured browser binaries', () => {
  const directory = resolve(root, '.tmp', 'fixture-clean-snapshot');
  const inherited = { PLAYWRIGHT_MODULE: 'earlier-snapshot/playwright', PLAYWRIGHT_BROWSERS_PATH: 'configured-browser-binaries', OTHER_FIXTURE: 'preserved' };
  for (const phase of ['browser', 'all']) {
    const env = cleanPhaseEnvironment(directory, phase, inherited);
    assert.equal(env.PLAYWRIGHT_MODULE, resolve(directory, 'node_modules/playwright'));
    assert.equal(env.PLAYWRIGHT_BROWSERS_PATH, inherited.PLAYWRIGHT_BROWSERS_PATH);
    assert.equal(env.OTHER_FIXTURE, inherited.OTHER_FIXTURE);
  }
  assert.equal(inherited.PLAYWRIGHT_MODULE, 'earlier-snapshot/playwright');
  assert.deepEqual(cleanPhaseEnvironment(directory, 'unit', inherited), inherited);
});
test('QA excludes inherited secrets and rejects remote database overrides', () => {
  const saved = { BREVO_API_KEY: process.env.BREVO_API_KEY, PLAYWRIGHT_MODULE: process.env.PLAYWRIGHT_MODULE };
  process.env.BREVO_API_KEY = 'must-not-be-inherited';
  process.env.PLAYWRIGHT_MODULE = resolve(root, '.tmp', 'missing-playwright-module');
  try {
    const env = qaEnvironment(root);
    assert.equal(env.BREVO_API_KEY, '');
    assert.equal(env.TEXTBEE_API_KEY, '');
    assert.equal(env.PLAYWRIGHT_MODULE, resolve(root, 'node_modules/playwright'));
    for (const name of ['ProgramFiles', 'ProgramFiles(x86)', 'ProgramW6432']) {
      assert.equal(env[name], process.env[name], 'Windows browser discovery retains standard installation paths');
    }
    assert.match(env.DATABASE_URL, /127\.0\.0\.1:1/);
    assert.equal(env.TEMP, env.TMP);
    assert.equal(env.TMP, env.TMPDIR);
    assert.equal(env.CACHE_DIR, resolve(root, 'node_modules/.cache'));
    assert.equal(require('node:fs').statSync(env.STORAGE_ROOT).isDirectory(), true);
    assert.ok(env.STORAGE_ROOT.startsWith(env.TEMP + require('node:path').sep));
    assert.notEqual(env.STORAGE_ROOT, qaEnvironment(root).STORAGE_ROOT);
    assert.ok(env.TEMP.startsWith(process.platform === 'linux' ? '/tmp/leadcrm-qa-' : resolve(root, 'data/outputs/system-audit') + require('node:path').sep));
    assert.throws(() => qaEnvironment(root, { DATABASE_URL: 'postgresql://user:password@remote.invalid/leadcrm_test' }), /loopback/);
    assert.throws(() => qaEnvironment(root, { DATABASE_URL: 'postgresql://user:password@127.0.0.1/production' }), /disposable/);
  } finally {
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test('Nested QA environments preserve the selected npm executable without inheriting credentials', () => {
  const savedCli = process.env.npm_execpath, savedToken = process.env.NPM_TOKEN;
  const npmCli = resolve(qaEnvironment(root).TEMP, 'selected-npm-cli.cjs');
  require('node:fs').writeFileSync(npmCli, 'console.log("selected npm executable");');
  try {
    process.env.npm_execpath = npmCli;
    process.env.NPM_TOKEN = 'must-not-be-inherited';
    const result = child(`const assert=require('node:assert/strict');const {qaEnvironment}=require('./scripts/qa-environment.cjs');const env=qaEnvironment(process.cwd());assert.equal(env.npm_execpath,process.env.npm_execpath);assert.equal(env.NPM_TOKEN,undefined);const run=require('node:child_process').spawnSync(process.execPath,[env.npm_execpath],{env,encoding:'utf8',windowsHide:true});assert.equal(run.status,0,run.stderr);assert.equal(run.stdout.trim(),'selected npm executable');`);
    assert.equal(result.status, 0, result.stderr);
  } finally {
    for (const [name, value] of Object.entries({ npm_execpath: savedCli, NPM_TOKEN: savedToken })) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});

test('Standalone native fixture runner removes inherited credentials and installs the outbound guard', async () => {
  const processes = require('node:child_process'), Module = require('node:module');
  const { EventEmitter } = require('node:events');
  const savedSpawn = processes.spawn, savedSecrets = { TEXTBEE_API_KEY: process.env.TEXTBEE_API_KEY, GMAIL_SYSTEM_SENDER_GMAIL_EMAIL: process.env.GMAIL_SYSTEM_SENDER_GMAIL_EMAIL, NODE_OPTIONS: process.env.NODE_OPTIONS };
  let captured;
  try {
    process.env.TEXTBEE_API_KEY = 'must-not-leave-parent'; process.env.GMAIL_SYSTEM_SENDER_GMAIL_EMAIL = 'private@example.test'; process.env.NODE_OPTIONS = '--require deployment-private-loader.cjs';
    processes.spawn = (executable, args, options) => {
      captured = { executable, args, options }; const child = new EventEmitter();
      process.nextTick(() => child.emit('exit', 0)); return child;
    };
    Module.syncBuiltinESMExports();
    const { runNotificationTestFile } = await import('../backend/scripts/notification-test-postgres.mjs');
    assert.equal(await runNotificationTestFile('fixture-only.test.ts', 'postgresql://postgres@127.0.0.1:12345/leadcrm_fixture_test_1'), 0);
    const env = captured.options.env;
    assert.equal(env.TEXTBEE_API_KEY, ''); assert.equal(env.GMAIL_SYSTEM_SENDER_GMAIL_EMAIL, '');
    assert.equal(env.LEADCRM_QA_RUN, '1'); assert.match(env.NODE_OPTIONS, /qa-network-guard\.cjs/);
    assert.ok(!env.NODE_OPTIONS.includes('deployment-private-loader'));
    assert.notEqual(env.STORAGE_ROOT, process.env.STORAGE_ROOT);
    const guard = spawnSync(process.execPath, ['-e', "const assert=require('node:assert/strict');assert.throws(()=>require('https').get('https://provider.invalid'),/QA_EXTERNAL_NETWORK_BLOCKED/);assert.equal(require('node:fs').readFileSync('backend/.env','utf8'),'');"], { cwd: root, env, encoding: 'utf8', windowsHide: true });
    assert.equal(guard.status, 0, guard.stderr);
    await assert.rejects(runNotificationTestFile('fixture-only.test.ts', 'postgresql://postgres@remote.invalid/leadcrm_fixture_test_1'), /loopback/);
  } finally {
    processes.spawn = savedSpawn; Module.syncBuiltinESMExports();
    for (const [name, value] of Object.entries(savedSecrets)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
  }
});

test('Linux QA temporaries stay short, private and independent of nested TMPDIR and checkout length', { skip: process.platform !== 'linux' }, () => {
  const fs = require('node:fs'), os = require('node:os');
  const directory = fs.mkdtempSync('/tmp/leadcrm-path-test-');
  const saved = process.env.TMPDIR;
  try {
    const longRoot = resolve(directory, 'checkout-'.repeat(18));
    const outer = qaEnvironment(longRoot);
    process.env.TMPDIR = outer.TMPDIR;
    const inner = qaEnvironment(longRoot);
    for (const env of [outer, inner]) {
      assert.equal(require('node:path').dirname(env.TMPDIR), '/tmp');
      assert.ok(Buffer.byteLength(env.TMPDIR + '/com.google.Chrome.abcdef/SingletonSocket') < 108);
      assert.equal(fs.statSync(env.TMPDIR).mode & 0o777, 0o700);
    }
    assert.notEqual(outer.TMPDIR, inner.TMPDIR);
    assert.equal(os.tmpdir(), outer.TMPDIR);
    fs.rmSync(outer.TMPDIR, { recursive: true }); fs.rmSync(inner.TMPDIR, { recursive: true });
  } finally {
    if (saved === undefined) delete process.env.TMPDIR; else process.env.TMPDIR = saved;
    fs.rmSync(directory, { recursive: true });
  }
});

test('Disposable native initialization retains runtime durability and stops its cluster when verification fails', async () => {
  const fs = require('node:fs'), path = require('node:path'), processes = require('node:child_process'), Module = require('node:module');
  const bin = qaEnvironment(root).TEMP, savedExec = processes.execFileSync, savedBin = process.env.POSTGRES_TEST_BIN;
  fs.writeFileSync(resolve(bin, process.platform === 'win32' ? 'initdb.exe' : 'initdb'), 'fixture tool placeholder');
  const commands = []; let settings = 'on|on|on\n';
  try {
    process.env.POSTGRES_TEST_BIN = bin;
    processes.execFileSync = (executable, args) => {
      const command = path.basename(executable).replace(/\.exe$/, ''); commands.push({ command, args });
      return Buffer.from(command === 'psql' ? settings : command === 'postgres' ? 'PostgreSQL fixture' : '');
    };
    Module.syncBuiltinESMExports();
    const { notificationTestPostgres } = await import('../backend/scripts/notification-test-postgres.mjs');
    const pg = await notificationTestPostgres();
    assert.deepEqual(pg.durability, { fsync: 'on', synchronous_commit: 'on', full_page_writes: 'on' });
    assert.ok(commands.find(call => call.command === 'initdb').args.includes('--no-sync'));
    const startup = commands.find(call => call.command === 'pg_ctl' && call.args.includes('start'));
    assert.match(fs.readFileSync(resolve(pg.directory, 'postgresql.conf'), 'utf8'), /unix_socket_directories = ''/);
    assert.ok(startup.args.some(value => value.includes('-h 127.0.0.1')));
    assert.ok(!startup.args.some(value => /(?:^|\s)-F(?:\s|$)|(?:fsync|full_page_writes|synchronous_commit)=off/.test(value)));
    pg.stop(); pg.stop();
    assert.equal(fs.existsSync(pg.directory), false);
    assert.equal(commands.filter(call => call.command === 'pg_ctl' && call.args.includes('stop')).length, 1);
    for (const value of ['off|on|on\n', 'on|off|on\n', 'on|on|off\n', 'on|on\n']) {
      settings = value; const before = commands.length;
      await assert.rejects(notificationTestPostgres(), /runtime durability must remain enabled/);
      const stops = commands.slice(before).filter(call => call.command === 'pg_ctl' && call.args.includes('stop'));
      assert.equal(stops.length, 1, 'The owned started cluster must stop before rejection');
    }
  } finally {
    processes.execFileSync = savedExec; Module.syncBuiltinESMExports();
    if (savedBin === undefined) delete process.env.POSTGRES_TEST_BIN; else process.env.POSTGRES_TEST_BIN = savedBin;
  }
});
test('Browser database cleanup reports the original error and permits the next fixture to finish', () => {
  const error = Object.assign(new Error('Owned stopped directory is temporarily locked'), { code: 'EPERM' });
  const failures = [], completed = [];
  for (const database of [{ stop() { throw error; } }, { stop() { completed.push('next fixture'); } }])
    cleanupBrowserDatabase(database, failure => failures.push(failure));
  assert.deepEqual(failures, [error]);
  assert.deepEqual(completed, ['next fixture']);
});

test('Native stopped-directory cleanup can retry after a filesystem lock without deleting a running cluster', async () => {
  const fs = require('node:fs'), path = require('node:path'), processes = require('node:child_process'), Module = require('node:module');
  const bin = qaEnvironment(root).TEMP, savedExec = processes.execFileSync, savedRm = fs.rmSync, savedBin = process.env.POSTGRES_TEST_BIN;
  fs.writeFileSync(resolve(bin, process.platform === 'win32' ? 'initdb.exe' : 'initdb'), 'fixture tool placeholder');
  let pg, stopped = false, locked = true, removes = 0;
  try {
    process.env.POSTGRES_TEST_BIN = bin;
    processes.execFileSync = (executable, args) => {
      const name = path.basename(executable).replace(/\.exe$/, '');
      if (name === 'pg_ctl' && args.includes('stop')) {
        if (stopped) throw Object.assign(Error('Already stopped'), { status: 1 });
        stopped = true;
      }
      if (name === 'pg_ctl' && args.includes('status') && stopped) throw Object.assign(Error('Not running'), { status: 3 });
      return Buffer.from(name === 'psql' ? 'on|on|on\n' : 'fixture');
    };
    Module.syncBuiltinESMExports();
    const { notificationTestPostgres } = await import('../backend/scripts/notification-test-postgres.mjs');
    pg = await notificationTestPostgres();
    fs.rmSync = (target, options) => {
      if (target === pg.directory) {
        assert.equal(stopped, true); removes++;
        if (locked) { locked = false; throw Object.assign(Error('Temporary fixture lock'), { code: 'EPERM' }); }
      }
      return savedRm(target, options);
    };
    Module.syncBuiltinESMExports();
    assert.throws(() => pg.stop(), /Temporary fixture lock/);
    assert.equal(fs.existsSync(pg.directory), true);
    pg.stop(); pg.stop();
    assert.equal(fs.existsSync(pg.directory), false);
    assert.equal(removes, 2);
  } finally {
    fs.rmSync = savedRm; Module.syncBuiltinESMExports();
    try { pg?.stop(); } finally {
      processes.execFileSync = savedExec; Module.syncBuiltinESMExports();
      if (savedBin === undefined) delete process.env.POSTGRES_TEST_BIN; else process.env.POSTGRES_TEST_BIN = savedBin;
    }
  }
});

test('QA blocks fetch and Node transports before an external connection', () => {
  const result = child(`const assert=require('node:assert/strict');(async()=>{await assert.rejects(fetch('https://example.invalid'),/QA_EXTERNAL_NETWORK_BLOCKED/);assert.throws(()=>require('https').get('https://example.invalid'),/QA_EXTERNAL_NETWORK_BLOCKED/);assert.throws(()=>require('http').request({hostname:'example.invalid'}),/QA_EXTERNAL_NETWORK_BLOCKED/);})().catch(e=>{console.error(e);process.exitCode=1;});`);
  assert.equal(result.status, 0, result.stderr);
});

test('Native startup failure preserves server diagnostics and cleans only its owned directory', async () => {
  const fs = require('node:fs'), path = require('node:path'), processes = require('node:child_process'), Module = require('node:module');
  const bin = qaEnvironment(root).TEMP, savedExec = processes.execFileSync, savedBin = process.env.POSTGRES_TEST_BIN;
  fs.writeFileSync(resolve(bin, process.platform === 'win32' ? 'initdb.exe' : 'initdb'), 'fixture tool placeholder');
  const sentinel = resolve(bin, 'unrelated-server'); fs.writeFileSync(sentinel, 'preserve');
  let directory, stops = 0;
  try {
    process.env.POSTGRES_TEST_BIN = bin;
    processes.execFileSync = (executable, args) => {
      if (path.basename(executable).startsWith('initdb')) directory = args[args.indexOf('-D') + 1];
      if (path.basename(executable).startsWith('pg_ctl') && args.includes('start')) {
        fs.writeFileSync(resolve(directory, 'server.log'), 'FATAL: fixture socket directory is not writable');
        fs.writeFileSync(resolve(directory, 'postmaster.pid'), 'owned fixture');
        throw Object.assign(Error('pg_ctl startup failed'), { status: 1 });
      }
      if (args.includes('stop')) { stops++; assert.equal(args[args.indexOf('-D') + 1], directory); }
      return Buffer.from('');
    };
    Module.syncBuiltinESMExports();
    const { notificationTestPostgres } = await import('../backend/scripts/notification-test-postgres.mjs');
    await assert.rejects(notificationTestPostgres(), error => {
      assert.match(error.message, /FATAL: fixture socket directory is not writable/);
      const evidence = error.message.match(/Native PostgreSQL evidence: ([^\n]+)/)[1];
      assert.match(fs.readFileSync(evidence, 'utf8'), /FATAL:/); return true;
    });
    assert.equal(stops, 1); assert.equal(fs.existsSync(directory), false);
    assert.equal(fs.readFileSync(sentinel, 'utf8'), 'preserve');
  } finally {
    processes.execFileSync = savedExec; Module.syncBuiltinESMExports();
    if (savedBin === undefined) delete process.env.POSTGRES_TEST_BIN; else process.env.POSTGRES_TEST_BIN = savedBin;
  }
});
test('QA refuses dotenv files and Next local environment loading', () => {
  const result = child(`const assert=require('node:assert/strict');const fs=require('node:fs');assert.equal(fs.readFileSync('backend/.env','utf8'),'');assert.equal(fs.readFileSync('frontend/.env.local','utf8'),'');const dotenv=require('dotenv');dotenv.config({path:'backend/.env'});assert.equal(process.env.BREVO_API_KEY,'');const nextEnv=require('@next/env');const result=nextEnv.loadEnvConfig('frontend');assert.deepEqual(result.loadedEnvFiles,[]);`);
  assert.equal(result.status, 0, result.stderr);
});
test('QA permits local HTTP fixtures', () => {
  const result = child(`const assert=require('node:assert/strict');const server=require('http').createServer((req,res)=>res.end('fixture'));server.listen(0,'127.0.0.1',async()=>{try{assert.equal(await (await fetch('http://127.0.0.1:'+server.address().port)).text(),'fixture');}catch(e){console.error(e);process.exitCode=1;}finally{server.close();}});`);
  assert.equal(result.status, 0, result.stderr);
});

test('QA refuses remote TCP/TLS before opening a socket and retains loopback/IPC', () => {
  const result = child(`const assert=require('node:assert/strict'),net=require('node:net'),tls=require('node:tls');
    for(const connect of [()=>net.connect(443,'example.invalid'),()=>net.createConnection({host:'192.0.2.1',port:443}),()=>new net.Socket().connect({host:'example.invalid',port:443}),()=>tls.connect({host:'example.invalid',port:443})]) assert.throws(connect,/QA_EXTERNAL_NETWORK_BLOCKED/);
    const socket=new net.Socket(); let errors=0; socket.on('error',error=>{assert.notEqual(error.message,'QA_EXTERNAL_NETWORK_BLOCKED');errors++;});socket.connect(1,'127.0.0.1');
    const ipc=new net.Socket();ipc.on('error',error=>{assert.notEqual(error.message,'QA_EXTERNAL_NETWORK_BLOCKED');errors++;});ipc.connect(process.platform==='win32'?'\\\\\\\\.\\\\pipe\\\\leadcrm-qa-nonexistent':'/tmp/leadcrm-qa-nonexistent.sock');
    process.on('beforeExit',()=>assert.equal(errors,2));`);
  assert.equal(result.status, 0, result.stderr);
});
