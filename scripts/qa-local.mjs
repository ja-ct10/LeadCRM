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
const { browserEvidence, browserFailureDiagnostics, ensureBrowserFailureReport, cleanupBrowserDatabase } = require('./qa-browser-evidence.cjs');
const ci = require('./qa-ci.cjs');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceStart = sourceIdentity(root);
const suiteManifest = ci.discovery(root);
const ciPlan = ci.plan(process.argv.slice(2), suiteManifest);
const ciInvocation = ciPlan.ci ? ci.invocation() : undefined;
if (ciInvocation && sourceStart.revision !== ciInvocation.revision) throw Error('CI checkout does not match its tested GITHUB_SHA');
const runId = `${Date.now()}-${randomUUID()}`;
const output = resolve(root, 'data/outputs/system-audit', runId);
mkdirSync(output, { recursive: true });
const mode = process.argv[2] || 'all';
const native = process.argv.includes('--native');
const filter = process.argv.find(arg => arg.startsWith('--filter='))?.slice(9);
const exclude = process.argv.find(arg => arg.startsWith('--exclude='))?.slice(10).split(',').filter(Boolean) ?? [];
const testNamePattern = process.argv.find(arg => arg.startsWith('--testNamePattern='))?.slice(18);
const selectedNames = testNamePattern ? new RegExp(testNamePattern) : undefined;
const nativeBrowserScripts = ci.NATIVE_BROWSERS;
let ciPostgresVersion;
const records = [];
const commands = [];
let sequence = 0;
const unavailableRuntime = error => error?.code === 'ENOENT' || /Set POSTGRES_TEST_BIN|Executable doesn't exist at|Chromium distribution 'chrome' is not found|spawn(?:Sync)? .*?(?:initdb|pg_config|chrome).*?(?:EACCES|EPERM|ENOENT)|Failed to launch the browser process.*?(?:EACCES|EPERM|ENOENT)/s.test(error?.message ?? String(error));
function recordFailure(label, error, details = {}) { if (!error.qaRecorded) records.push({ label, status: unavailableRuntime(error) ? 'BLOCKED' : 'FAIL', reason: error.message, ...details }); }
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
    child.once('close', code => { command.exitCode = code ?? 1; command.finishedAt = new Date().toISOString(); done(code ?? 1); });
  });
}
async function check(label, args, cwd = root, env = {}) {
  const counted = ciPlan.ci && args[0] === '--test';
  if (counted) args = ['--test', '--test-reporter=tap', ...args.slice(1)];
  const code = await run(label, args, cwd, env);
  const command = commands.at(-1), log = resolve(root, command.log);
  const evidence = existsSync(log) ? readFileSync(log, 'utf8') : '';
  const unavailable = code && unavailableRuntime(evidence);
  const count = name => Number([...evidence.matchAll(new RegExp('^# ' + name + ' (\\d+)\\r?$', 'gm'))].at(-1)?.[1] ?? NaN);
  const counts = counted ? { passed: count('pass'), failed: count('fail'), skipped: count('skipped'), cancelled: count('cancelled'), todo: count('todo') } : {};
  const incomplete = counted && (!counts.passed || counts.failed !== 0 || counts.skipped !== 0 || counts.cancelled !== 0 || counts.todo !== 0);
  const status = code === 0 && !incomplete ? 'PASS' : unavailable ? 'BLOCKED' : 'FAIL';
  records.push({ label, status, exitCode: code, ...counts, ...(incomplete ? { reason: 'Required Node assertions were missing, failed, cancelled or skipped.' } : {}), ...(unavailable ? { reason: 'Required local runtime unavailable before acceptance assertions; see saved command log.' } : {}) });
  if (status !== 'PASS') { const error = new Error(`${label} failed (${code})`); error.qaRecorded = true; throw error; }
}
async function browserCheck(label, script, directory, env) {
  const code = await run(label, [script], root, env);
  const existingReport = ['results.json', 'report.json'].map(name => resolve(directory, name)).find(path => existsSync(path));
  const reportPath = existingReport || ensureBrowserFailureReport(directory, new Error(`${label} exited ${code} before writing its required browser report; see the saved command log.`));
  const result = JSON.parse(readFileSync(reportPath, 'utf8'));
  const { complete, ...counts } = browserEvidence(result, code);
  const log = resolve(root, commands.at(-1).log);
  const blocked = code && existsSync(log) && unavailableRuntime(readFileSync(log, 'utf8'));
  const status = reportPath && complete ? 'PASS' : blocked ? 'BLOCKED' : 'FAIL';
  records.push({ label, suiteId: relative(root, script).replaceAll('\\', '/'), status, exitCode: code, ...counts,
    failedAssertions: status === 'PASS' ? [] : [{ name: label, messages: [browserFailureDiagnostics(result, code)] }],
    database: env.DATABASE_URL || script.endsWith('verify-notifications-browser.mjs') ? 'Fresh native PostgreSQL' : 'Fresh PGlite fixture',
    report: reportPath ? relative(root, reportPath).replaceAll('\\', '/') : null,
    ...(!existingReport || !counts.executed ? { reason: 'Required browser assertions/report missing; exit zero alone cannot pass.' } : {}) });
  if (status !== 'PASS') { const error = new Error(`${label}: failed, missing or empty browser evidence`); error.qaRecorded = true; throw error; }
}
function walk(folder) {
  return readdirSync(folder, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(resolve(folder, entry.name)) : [resolve(folder, entry.name)]);
}
async function vitest(label, workspace, args, env = {}, expectedFile, database) {
  const report = resolve(output, `${mode}-${++sequence}.json`);
  rmSync(report, { force: true });
  // Bound component-suite parallelism while keeping database suites serial.
  const workers = workspace === 'frontend' ? 2 : 1;
  const code = await run(label, [resolve(root, 'node_modules/vitest/vitest.mjs'), 'run', ...args, `--maxWorkers=${workers}`, '--reporter=default', '--reporter=json', `--outputFile=${report}`], resolve(root, workspace), env);
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
  records.push({ label, ...(expectedFile ? { suiteId: 'backend/' + expectedFile } : {}), status, passed, failed, skipped, skippedNames, failedAssertions: [...assertions.filter(test => test.status === 'failed').map(test => ({ name: test.fullName, messages: test.failureMessages })), ...suites.filter(suite => suite.message).map(suite => ({ name: 'Suite setup/teardown', messages: [suite.message] }))], ...(selectedNames ? { selectedCasePattern: testNamePattern, excludedByNamePattern: allAssertions.length - assertions.length, limitation: 'Explicitly selected cases only; excluded assertions do not satisfy full-suite acceptance.' } : {}), ...(historyOnly ? { requiredCaseCoveredBy: historicalRehearsal ? 'Populated import History migration and HTTP rehearsal' : null } : {}), ...(windowsSymlink ? { reason: 'Windows lacks file symlink privileges; mandatory POSIX storage boundary test requires Linux CI/container.' } : {}), database, report: relative(root, report).replaceAll('\\', '/') });
  if (status !== 'PASS') { console.error('[qa] Failed suite:', label, 'Report:', relative(root, report), JSON.stringify(assertions.filter(test => test.status === 'failed').map(test => ({ name: test.fullName, messages: test.failureMessages })), null, 2)); const error = new Error(`${label}: failed, missing or skipped required tests`); error.qaRecorded = true; throw error; }
}
function databaseFor(file) {
  if (file.includes('organization-polish.integration')) return 'leadcrm_crm_polish_test_1';
  if (file.includes('/gmail/')) return 'leadcrm_mailbox_test_1';
  if (file.includes('/workflows/') || file.includes('/tasks/')) return 'leadcrm_workflow_test_1';
  if (file.includes('/campaigns/') || file.includes('contact-relations') || file.includes('/groups/')) return 'leadcrm_campaign_test_1';
  if (file.includes('/permissions/') || file.includes('/roles/')) return 'leadcrm_environment_test_1';
  if (file.includes('crm-completion')) return 'leadcrm_completion_test_1';
  if (file.includes('accounts-full-address')) return 'leadcrm_accounts_full_address_1';
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
  records.push({ label, suiteId: ci.IMPORT_SUITE, status, passed, failed, skipped, failedAssertions: assertions.filter(test => test.status === 'failed').map(test => ({ name: test.fullName, messages: test.failureMessages })), database: `Populated disposable ${native ? 'native PostgreSQL' : 'PGlite'}`, report: relative(root, report).replaceAll('\\', '/') });
  if (status !== 'PASS') { const error = new Error(`${label}: populated import assertions failed, missing or skipped`); error.qaRecorded = true; throw error; }
}
async function integration() {
  const files = suiteManifest.integration.filter(item => !ciPlan.suiteIds || ciPlan.suiteIds.includes(item.id)).map(item => item.id.slice('backend/'.length)).filter(file => (!filter || filter.split(',').some(fragment => file.includes(fragment))) && !exclude.some(fragment => file.includes(fragment))).sort();
  if (!files.length) throw new Error('No integration suites match the requested filter');
  let pg;
  if (native) {
    if (!ciPlan.shard) await check('Populated guarded db:deploy and backend startup rehearsal', ['backend/scripts/test-guarded-startup.mjs']);
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
    if (!ciPlan.workspace || ciPlan.workspace === 'shared') await check('Local documentation references', ['scripts/verify-doc-links.cjs']);
    for (const workspace of ['shared', 'backend', 'frontend'].filter(name => !ciPlan.workspace || name === ciPlan.workspace)) {
      await check(`${workspace} TypeScript`, [resolve(root, 'node_modules/typescript/bin/tsc'), '--noEmit', '--project', resolve(root, workspace, 'tsconfig.json')]);
    }
    if (!ciPlan.workspace || ciPlan.workspace === 'backend') await check('backend test TypeScript', [resolve(root, 'node_modules/typescript/bin/tsc'), '--noEmit', '--project', resolve(root, 'backend/tsconfig.tests.json')]);
  } else if (section === 'import-history') {
    await importHistory();
  } else if (section === 'unit') {
    if (!ciPlan.workspace || ciPlan.workspace === 'backend') {
      await check('QA isolation regression tests', ['--test', 'scripts/qa-safety.test.cjs']);
      await check('CI coordination regressions', ['--test', 'scripts/qa-ci.test.cjs']);
      await check('Coolify release orchestration regressions', ['--test', 'scripts/deploy-coolify.test.mjs']);
      try { await vitest('backend unit tests', 'backend', ['--exclude=**/*.integration.test.ts']); }
      catch (error) { recordFailure('backend unit tests', error); }
    }
    if (!ciPlan.workspace || ciPlan.workspace === 'frontend') await vitest('frontend tests', 'frontend', ['--testTimeout=20000']);
  } else if (section === 'integration') await integration();
  else if (section === 'database') {
    await execute('migrations');
    await check('Populated guarded db:deploy and backend startup rehearsal', ['backend/scripts/test-guarded-startup.mjs']);
    await check('Mailbox worker restart', ['backend/scripts/verify-mailbox-restart.mjs']);
  }
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
    const scripts = suiteManifest.browser.filter(item => !ciPlan.suiteIds || ciPlan.suiteIds.includes(item.id)).map(item => resolve(root, item.id)).sort().filter(file => (!filter || filter.split(',').some(fragment => file.includes(fragment))) && !exclude.some(fragment => file.includes(fragment)));
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
      catch (error) {
        const report = ensureBrowserFailureReport(browserOutput, error);
        const label = relative(root, script), reportName = relative(root, report).replaceAll('\\', '/');
        let result;
        try { result = JSON.parse(readFileSync(report, 'utf8')); }
        catch { result = { error: error.stack || error.message }; }
        const command = commands.findLast(item => item.label === label);
        console.error(`\n[qa] Browser acceptance failed: ${label}\nReport: ${reportName}${command ? `\nCommand log: ${command.log}` : ''}\n${browserFailureDiagnostics(result, command?.exitCode ?? 1)}`);
        recordFailure(label, error, { report: reportName });
      }
      finally { cleanupBrowserDatabase(pg, error => {
        const label = `${relative(root, script)} database cleanup`;
        console.error(`[qa] ${label}: ${error.message}`);
        recordFailure(label, error, { ownedDirectory: pg.directory });
      }); }
    }
    if (!ciPlan.shard) await check('Mailbox worker restart', ['backend/scripts/verify-mailbox-restart.mjs']);
  } else throw new Error(`Unknown QA phase: ${section}`);
}
try {
  if (ciPlan.ci && ['database', 'integration', 'browser'].includes(mode)) {
    const bin = process.env.POSTGRES_TEST_BIN || execFileSync('pg_config', ['--bindir'], { encoding: 'utf8', windowsHide: true }).trim();
    const version = execFileSync(resolve(bin, process.platform === 'win32' ? 'postgres.exe' : 'postgres'), ['--version'], { encoding: 'utf8', windowsHide: true });
    const selected = version.match(/\bPostgreSQL\)? (18(?:\.\d+)*)\b/);
    if (!selected) throw Error('CI requires installed native PostgreSQL 18: ' + version.trim());
    ciPostgresVersion = 'PostgreSQL ' + selected[1];
  }
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
const report = { mode, native, runId, filter, exclude, testNamePattern, workspace: ciPlan.workspace, shard: ciPlan.shard,
  ...(ciPlan.workspace || ciPlan.shard ? { coverageScope: 'Selected workspace or shard only; the mandatory CI gate verifies combined coverage.' } : {}),
  capturedAt: new Date().toISOString(), sourceStart: compact(sourceStart), sourceEnd: compact(sourceEnd), sourceChanged, changedFiles, executableSourceChanged, documentationChanged,
  ...(ciPlan.ci ? { ci: { version: 2, profile: ciPlan.profile, owner: ciPlan.owner, manifestSha256: suiteManifest.sha256, suiteIds: ciPlan.suiteIds,
    executedSuiteIds: records.filter(result => result.status === 'PASS' && result.suiteId).map(result => result.suiteId).sort(), invocation: ciInvocation, postgresVersion: ciPostgresVersion } } : {}),
  validForFinalSource: !sourceChanged, validForExecutableSource: !executableSourceChanged,
  revalidationRequired: executableSourceChanged ? 'Relevant executable QA must be repeated.' : documentationChanged ? 'Recheck changed documentation references and inventory; executable evidence retains its code identity.' : null,
  status: records.some(result => result.status === 'FAIL') ? 'FAIL' : sourceChanged ? 'REVALIDATION REQUIRED' : records.every(result => result.status === 'PASS') ? 'PASS' : 'BLOCKED',
  tools: { node: process.version, platform: process.platform, npm: process.env.npm_execpath ? execFileSync(process.execPath, [process.env.npm_execpath, '--version'], { encoding: 'utf8', windowsHide: true }).trim() : null, vitest: toolVersion('vitest', 'node_modules/vitest'), prisma: toolVersion('prisma', 'node_modules/prisma'), next: toolVersion('next', 'node_modules/next'), typescript: toolVersion('typescript', 'node_modules/typescript') }, invocation: process.argv.slice(2), commands, results: records };
writeFileSync(resolve(output, `qa-${mode}${native ? '-native' : ''}.json`), JSON.stringify(report, null, 2) + '\n');
if (ciPlan.ci) {
  const portable = resolve(root, 'data/outputs/ci', ciPlan.profile, ciPlan.owner.replaceAll('/', '-')); mkdirSync(portable, { recursive: true });
  writeFileSync(resolve(portable, 'qa-ci-report.json'), JSON.stringify(report, null, 2) + '\n');
}
if (process.env.GITHUB_STEP_SUMMARY) {
  const cell = value => String(value ?? '—').replaceAll('|', '\\|').replace(/[\r\n]/g, ' ');
  const seconds = command => command?.finishedAt ? ((Date.parse(command.finishedAt) - Date.parse(command.startedAt)) / 1000).toFixed(1) : undefined;
  const rows = records.map(result => `| ${[result.label, result.status, result.passed, result.failed, result.skipped, seconds(commands.findLast(command => command.label === result.label)), result.database].map(cell).join(' | ')} |`);
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, [
    `\n### LeadCRM acceptance: ${report.status}`, '',
    `Mode: ${mode}. Native PostgreSQL: ${native ? 'requested' : 'not requested'}. Source unchanged: ${!sourceChanged}.`, '',
    '| Check | Result | Passed | Failed | Skipped | Seconds | Fixture |', '| --- | --- | ---: | ---: | ---: | ---: | --- |', ...rows, '', ...records.flatMap(result => (result.failedAssertions ?? []).map(failure => `- ${cell(result.label)}: ${cell(failure.name)} — ${cell(failure.messages?.join(' ').slice(0, 3000))}; report: ${cell(result.report)}`)), '',
    'A dash means this command reports an exit status rather than individual test counts. Full reports, command logs and browser failure captures are retained in the disposable QA evidence artifact.', '',
    ...(ciInvocation ? [`[Current run and evidence artifacts](https://github.com/${ciInvocation.repository}/actions/runs/${ciInvocation.runId})`, ''] : []),
  ].join('\n'));
}
console.log(JSON.stringify(report, null, 2));
if (sourceChanged || records.some(result => result.status !== 'PASS')) process.exitCode = 1;
