// Local acceptance only. No configured databases, provider accounts or deployments.
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
const require = createRequire(import.meta.url);
const { qaEnvironment } = require('./qa-environment.cjs');
const { sourceIdentity } = require('./qa-source-identity.cjs');
const { browserEvidence } = require('./qa-browser-evidence.cjs');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceStart = sourceIdentity(root);
const runId = `${Date.now()}-${randomUUID()}`;
const output = resolve(root, 'data/outputs/system-audit', runId);
mkdirSync(output, { recursive: true });
const mode = process.argv[2] || 'all';
const native = process.argv.includes('--native');
const filter = process.argv.find(arg => arg.startsWith('--filter='))?.slice(9);
const exclude = process.argv.find(arg => arg.startsWith('--exclude='))?.slice(10).split(',').filter(Boolean) ?? [];
const testNamePattern = process.argv.find(arg => arg.startsWith('--testNamePattern='))?.slice(18);
const selectedNames = testNamePattern ? new RegExp(testNamePattern) : undefined;
const nativeBrowserScripts = ['verify-crm-rbac-browser.mjs', 'verify-tasks-browser.mjs', 'verify-task-workflow-integrity-browser.mjs', 'verify-custom-fields-browser.mjs', 'verify-custom-fields-inline-browser.mjs', 'verify-ui-fixes-browser.mjs', 'verify-ui-polish-browser.mjs'];
const records = [];
const commands = [];
let sequence = 0;
const unavailableRuntime = error => error?.code === 'ENOENT' || /Set POSTGRES_TEST_BIN|Executable doesn't exist at|Chromium distribution 'chrome' is not found|spawn(?:Sync)? .*?(?:initdb|pg_config|chrome).*?(?:EACCES|EPERM|ENOENT)|Failed to launch the browser process.*?(?:EACCES|EPERM|ENOENT)/s.test(error?.message ?? String(error));
function recordFailure(label, error) { if (!error.qaRecorded) records.push({ label, status: unavailableRuntime(error) ? 'BLOCKED' : 'FAIL', reason: error.message }); }
function run(label, args, cwd = root, overrides = {}) {
  console.log(`\n[qa] ${label}`);
  const env = qaEnvironment(root, overrides);
  return new Promise((done, reject) => {
    const log = resolve(output, `command-${commands.length + 1}.log`);
    const command = { label, executable: process.execPath, args, cwd: relative(root, cwd).replaceAll('\\', '/') || '.', log: relative(root, log).replaceAll('\\', '/'), startedAt: new Date().toISOString() };
    commands.push(command);
    const child = spawn(process.execPath, args, { cwd, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    for (const [stream, destination] of [[child.stdout, process.stdout], [child.stderr, process.stderr]]) stream.on('data', data => { appendFileSync(log, data); destination.write(data); });
    child.once('error', error => { command.error = error.message; reject(error); });
    child.once('exit', code => { command.exitCode = code ?? 1; command.finishedAt = new Date().toISOString(); done(code ?? 1); });
  });
}
async function check(label, args, cwd = root, env = {}) {
  const code = await run(label, args, cwd, env);
  const command = commands.at(-1), log = resolve(root, command.log);
  const unavailable = code && existsSync(log) && unavailableRuntime(readFileSync(log, 'utf8'));
  records.push({ label, status: code === 0 ? 'PASS' : unavailable ? 'BLOCKED' : 'FAIL', exitCode: code, ...(unavailable ? { reason: 'Required local runtime unavailable before acceptance assertions; see saved command log.' } : {}) });
  if (code) { const error = new Error(`${label} failed (${code})`); error.qaRecorded = true; throw error; }
}
async function browserCheck(label, script, directory, env) {
  const code = await run(label, [script], root, env);
  const reportPath = ['results.json', 'report.json'].map(name => resolve(directory, name)).find(path => existsSync(path));
  const result = reportPath ? JSON.parse(readFileSync(reportPath, 'utf8')) : null;
  const { complete, ...counts } = browserEvidence(result, code);
  const log = resolve(root, commands.at(-1).log);
  const blocked = code && existsSync(log) && unavailableRuntime(readFileSync(log, 'utf8'));
  const status = reportPath && complete ? 'PASS' : blocked ? 'BLOCKED' : 'FAIL';
  records.push({ label, status, exitCode: code, ...counts,
    database: env.DATABASE_URL || script.endsWith('verify-notifications-browser.mjs') ? 'Fresh native PostgreSQL' : 'Fresh PGlite fixture',
    report: reportPath ? relative(root, reportPath).replaceAll('\\', '/') : null,
    ...(!reportPath || !counts.executed ? { reason: 'Required browser assertions/report missing; exit zero alone cannot pass.' } : {}) });
  if (status !== 'PASS') { const error = new Error(`${label}: failed, missing or empty browser evidence`); error.qaRecorded = true; throw error; }
}
function walk(folder) {
  return readdirSync(folder, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(resolve(folder, entry.name)) : [resolve(folder, entry.name)]);
}
async function vitest(label, workspace, args, env = {}, expectedFile, database) {
  const report = resolve(output, `${mode}-${++sequence}.json`);
  rmSync(report, { force: true });
  const code = await run(label, [resolve(root, 'node_modules/vitest/vitest.mjs'), 'run', ...args, '--maxWorkers=1', '--reporter=default', '--reporter=json', `--outputFile=${report}`], resolve(root, workspace), env);
  const result = existsSync(report) ? JSON.parse(readFileSync(report, 'utf8')) : null;
  const suites = result?.testResults ?? [];
  const allAssertions = suites.flatMap(suite => suite.assertionResults ?? []);
  const assertions = selectedNames ? allAssertions.filter(test => selectedNames.test(test.fullName)) : allAssertions;
  const passed = assertions.filter(test => test.status === 'passed').length;
  const failed = assertions.filter(test => test.status === 'failed').length;
  const skipped = assertions.length - passed - failed;
  const executed = passed + failed;
  const found = !expectedFile || suites.some(suite => suite.name.replaceAll('\\', '/').endsWith(expectedFile));
  const skippedNames = assertions.filter(test => test.status !== 'passed' && test.status !== 'failed').map(test => test.fullName);
  const historyOnly = skippedNames.length === 1 && skippedNames[0].includes('verifies migrated History through deployed APIs before approving retirement');
  const historicalRehearsal = records.some(record => record.label === 'Populated import History migration and HTTP rehearsal' && record.status === 'PASS');
  const windowsSymlink = process.platform === 'win32' && skippedNames.length === 1 && skippedNames[0].includes('refuses symlink directories and objects without touching outside files');
  const allowedConcurrencySkip = !native && label.includes('login-lockout');
  const status = !code && executed > 0 && found && (!skipped || allowedConcurrencySkip || (historyOnly && historicalRehearsal)) ? 'PASS' : (!code && (windowsSymlink || historyOnly) ? 'BLOCKED' : 'FAIL');
  records.push({ label, status, passed, failed, skipped, skippedNames, ...(selectedNames ? { selectedCasePattern: testNamePattern, excludedByNamePattern: allAssertions.length - assertions.length, limitation: 'Explicitly selected cases only; excluded assertions do not satisfy full-suite acceptance.' } : {}), ...(historyOnly ? { requiredCaseCoveredBy: historicalRehearsal ? 'Populated import History migration and HTTP rehearsal' : null } : {}), ...(windowsSymlink ? { reason: 'Windows lacks file symlink privileges; mandatory POSIX storage boundary test requires Linux CI/container.' } : {}), database, report: relative(root, report).replaceAll('\\', '/') });
  if (status !== 'PASS') { const error = new Error(`${label}: failed, missing or skipped required tests`); error.qaRecorded = true; throw error; }
}
function databaseFor(file) {
  if (file.includes('/gmail/')) return 'leadcrm_mailbox_test_1';
  if (file.includes('/workflows/') || file.includes('/tasks/')) return 'leadcrm_workflow_test_1';
  if (file.includes('/campaigns/') || file.includes('contact-relations') || file.includes('/groups/')) return 'leadcrm_campaign_test_1';
  if (file.includes('/permissions/') || file.includes('/roles/')) return 'leadcrm_environment_test_1';
  if (file.includes('crm-completion')) return 'leadcrm_completion_test_1';
  if (file.includes('custom-fields.integration')) return 'leadcrm_custom_fields_test';
  if (file.includes('single-workspace')) return 'leadcrm_smoke_test_1';
  if (file.includes('archive-date-page') || file.includes('user-groups')) return 'leadcrm_polish_test';
  if (file.includes('/organization-settings/') || file.includes('users-import') || file.includes('profile.integration')) return 'leadcrm_account_test_1';
  return 'leadcrm_forms_test_2';
}
async function importHistory(label = 'Populated import History migration and HTTP rehearsal') {
  const report = resolve(output, `import-history-${++sequence}.json`);
  const code = await run(label, ['backend/scripts/test-import-history-rehearsal.mjs', ...(native ? ['--native'] : [])], root, { LEADCRM_IMPORT_HISTORY_REPORT: report });
  const result = existsSync(report) ? JSON.parse(readFileSync(report, 'utf8')) : null;
  const assertions = result?.testResults?.flatMap(suite => suite.assertionResults ?? []) ?? [];
  const passed = assertions.filter(test => test.status === 'passed').length;
  const failed = assertions.filter(test => test.status === 'failed').length;
  const skipped = assertions.length - passed - failed;
  const historical = assertions.some(test => test.fullName.includes('verifies migrated History through deployed APIs') && test.status === 'passed');
  const status = !code && passed > 0 && !failed && !skipped && historical ? 'PASS' : 'FAIL';
  records.push({ label, status, passed, failed, skipped, database: `Populated disposable ${native ? 'native PostgreSQL' : 'PGlite'}`, report: relative(root, report).replaceAll('\\', '/') });
  if (status !== 'PASS') { const error = new Error(`${label}: populated import assertions failed, missing or skipped`); error.qaRecorded = true; throw error; }
}
async function integration() {
  const files = walk(resolve(root, 'backend/src')).filter(file => file.endsWith('.integration.test.ts')).map(file => relative(resolve(root, 'backend'), file).replaceAll('\\', '/')).filter(file => (!filter || filter.split(',').some(fragment => file.includes(fragment))) && !exclude.some(fragment => file.includes(fragment))).sort();
  if (!files.length) throw new Error('No integration suites match the requested filter');
  let pg;
  if (native) {
    const { notificationTestPostgres } = await import('../backend/scripts/notification-test-postgres.mjs');
    pg = await notificationTestPostgres();
    records.push({ label: 'Disposable native PostgreSQL fixture', status: 'PASS', version: pg.version, durability: pg.durability, directory: relative(root, pg.directory).replaceAll('\\', '/') });
  }
  try {
    for (const file of files) {
      if (file === 'src/modules/crm/imports/imports.integration.test.ts' && !testNamePattern) {
        try { await importHistory(file); }
        catch (error) { recordFailure(file, error); }
        continue;
      }
      const source = readFileSync(resolve(root, 'backend', file), 'utf8');
      const selfContained = source.includes('PGlite.create(') && !source.includes('const disposable');
      if (selfContained && !file.includes('login-lockout')) {
        try { await vitest(file, 'backend', [file, ...(testNamePattern ? [`--testNamePattern=${testNamePattern}`] : [])], {}, file, 'Self-contained PGlite fixture'); }
        catch (error) { recordFailure(file, error); }
        continue;
      }
      let db, socket;
      try {
        const name = databaseFor(file);
        let url;
        if (pg) {
          url = await pg.database(file.includes('login-lockout') ? 'leadcrm_login_lockout_1' : name);
          if (file.includes('login-lockout')) url = url.replace('connection_limit=4', 'connection_limit=20&pool_timeout=60');
        }
        else {
          const { PGlite } = await import('@electric-sql/pglite');
          const { PGLiteSocketServer } = await import('@electric-sql/pglite-socket');
          const { replayCrmMigrations } = await import('../backend/scripts/replay-crm-migrations.mjs');
          db = await PGlite.create(); await replayCrmMigrations(db);
          socket = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 0 }); await socket.start();
          url = `postgresql://postgres:postgres@${socket.getServerConn()}/${name}?connection_limit=1&statement_cache_size=0`;
        }
        await vitest(file, 'backend', [file, '--no-file-parallelism', ...(testNamePattern ? [`--testNamePattern=${testNamePattern}`] : [])], { DATABASE_URL: url, DIRECT_URL: url, ...(native && file.includes('login-lockout') ? { LOGIN_LOCKOUT_POSTGRES_URL: url } : {}) }, file, native ? 'Fresh native PostgreSQL' : 'Fresh PGlite socket fixture');
      } catch (error) { recordFailure(file, error); }
      finally { await socket?.stop(); await db?.close(); }
    }
  } finally { pg?.stop(); }
}
async function execute(section) {
  if (section === 'typecheck') {
    await check('Local documentation references', ['scripts/verify-doc-links.cjs']);
    for (const workspace of ['shared', 'backend', 'frontend']) await check(`${workspace} TypeScript`, [resolve(root, 'node_modules/typescript/bin/tsc'), '--noEmit', '--project', resolve(root, workspace, 'tsconfig.json')]);
  } else if (section === 'import-history') {
    await importHistory();
  } else if (section === 'unit') {
    await check('QA isolation regression tests', ['--test', 'scripts/qa-safety.test.cjs']);
    try { await vitest('backend unit tests', 'backend', ['--exclude=**/*.integration.test.ts']); }
    catch (error) { recordFailure('backend unit tests', error); }
    await vitest('frontend tests', 'frontend', ['--testTimeout=20000']);
  } else if (section === 'integration') await integration();
  else if (section === 'migrations') {
    await check('Prisma validation', [resolve(root, 'node_modules/prisma/build/index.js'), 'validate', '--schema', resolve(root, 'backend/prisma/schema.prisma')]);
    try { await check('Rollout and migration regression tests', ['--test', ...walk(resolve(root, 'backend/scripts')).filter(file => /\.test\.(cjs|mjs)$/.test(file))]); }
    catch (error) { recordFailure('Rollout regression', error); }
    await check('Contact preservation and retirement fixtures', ['backend/scripts/test-contact-retirement.mjs']);
    await importHistory();
  } else if (section === 'build') {
    for (const workspace of ['shared', 'backend', 'frontend'].filter(name => !filter || name.includes(filter))) {
      const npmCli = process.env.npm_execpath;
      if (!npmCli) throw new Error('Run builds through npm run qa:local or npm run build');
      await check(`${workspace} production build`, [npmCli, '--prefix', workspace, 'run', 'build'], root, { NODE_ENV: 'production', API_URL: 'https://leadcrm-build.example/api/v1', LEADCRM_QA_BUILD_ASSETS: '1' });
    }
  } else if (section === 'browser') {
    const scripts = walk(resolve(root, 'backend/scripts')).filter(file => /verify-.*-browser\.mjs$/.test(file) && (readFileSync(file, 'utf8').includes('PGlite.create(') || file.endsWith('verify-notifications-browser.mjs') || nativeBrowserScripts.some(name => file.endsWith(name)))).sort().filter(file => (!filter || filter.split(',').some(fragment => file.includes(fragment))) && !exclude.some(fragment => file.includes(fragment)));
    if (!scripts.length) throw new Error('No disposable browser suites match the requested filter');
    for (const script of scripts) {
      const browserOutput = resolve(output, 'browser', script.split(/[\\/]/).at(-1).replace(/\.mjs$/, ''));
      const browserEnv = { LEADCRM_BROWSER_OUTPUT: browserOutput };
      let pg;
      try {
        if (nativeBrowserScripts.some(name => script.endsWith(name))) {
          const { notificationTestPostgres } = await import('../backend/scripts/notification-test-postgres.mjs');
          pg = await notificationTestPostgres();
          const url = await pg.database('leadcrm_forms_test_2');
          Object.assign(browserEnv, { DATABASE_URL: url, DIRECT_URL: url });
        }
        await browserCheck(relative(root, script), script, browserOutput, browserEnv);
      }
      catch (error) { recordFailure(relative(root, script), error); }
      finally { pg?.stop(); }
    }
    await check('Mailbox worker restart', ['backend/scripts/verify-mailbox-restart.mjs']);
  } else throw new Error(`Unknown QA phase: ${section}`);
}
try {
  if (mode === 'all') {
    for (const section of ['typecheck', 'unit', 'migrations', 'build', 'integration', 'browser']) {
      try { await execute(section); } catch (error) { recordFailure(section, error); }
    }
    if (!native) records.push({ label: 'Native PostgreSQL concurrency', status: 'BLOCKED', reason: 'Run npm run test:integration:native; PGlite does not prove concurrent transaction behavior.' });
  } else await execute(mode);
} catch (error) { recordFailure(mode, error); }
const sourceEnd = sourceIdentity(root);
const changedFiles = [...new Set([...Object.keys(sourceStart.fileHashes), ...Object.keys(sourceEnd.fileHashes)])].filter(name => sourceStart.fileHashes[name] !== sourceEnd.fileHashes[name]);
const sourceChanged = changedFiles.length > 0;
const executableSourceChanged = sourceStart.executableSourceSha256 !== sourceEnd.executableSourceSha256;
const documentationChanged = sourceStart.documentationSha256 !== sourceEnd.documentationSha256;
const toolVersion = (name, path) => { try { return JSON.parse(readFileSync(resolve(root, path, 'package.json'), 'utf8')).version; } catch { return null; } };
const compact = ({ fileHashes, ...identity }) => identity;
const report = { mode, native, runId, filter, exclude, testNamePattern, capturedAt: new Date().toISOString(), sourceStart: compact(sourceStart), sourceEnd: compact(sourceEnd), sourceChanged, changedFiles, executableSourceChanged, documentationChanged,
  validForFinalSource: !sourceChanged, validForExecutableSource: !executableSourceChanged,
  revalidationRequired: executableSourceChanged ? 'Relevant executable QA must be repeated.' : documentationChanged ? 'Recheck changed documentation references and inventory; executable evidence retains its code identity.' : null,
  status: records.some(result => result.status === 'FAIL') ? 'FAIL' : sourceChanged ? 'REVALIDATION REQUIRED' : records.every(result => result.status === 'PASS') ? 'PASS' : 'BLOCKED',
  tools: { node: process.version, platform: process.platform, npm: process.env.npm_execpath ? execFileSync(process.execPath, [process.env.npm_execpath, '--version'], { encoding: 'utf8', windowsHide: true }).trim() : null, vitest: toolVersion('vitest', 'node_modules/vitest'), prisma: toolVersion('prisma', 'node_modules/prisma'), next: toolVersion('next', 'node_modules/next'), typescript: toolVersion('typescript', 'node_modules/typescript') }, invocation: process.argv.slice(2), commands, results: records };
writeFileSync(resolve(output, `qa-${mode}${native ? '-native' : ''}.json`), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (sourceChanged || records.some(result => result.status !== 'PASS')) process.exitCode = 1;
