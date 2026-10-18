'use strict';

const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { lstatSync, readFileSync, readdirSync, realpathSync } = require('node:fs');
const { resolve, relative, sep, posix } = require('node:path');
const { gunzipSync } = require('node:zlib');

const SHARDS = 3;
const IMPORT_SUITE = 'backend/src/modules/crm/imports/imports.integration.test.ts';
const NATIVE_BROWSERS = ['verify-deal-address-browser.mjs', 'verify-crm-improvements-browser.mjs', 'verify-crm-rbac-browser.mjs', 'verify-tasks-browser.mjs', 'verify-task-workflow-integrity-browser.mjs', 'verify-custom-fields-browser.mjs', 'verify-custom-fields-inline-browser.mjs', 'verify-mailbox-activities-browser.mjs', 'verify-ui-fixes-browser.mjs', 'verify-ui-polish-browser.mjs', 'verify-workflow-policy-browser.mjs'];
const REQUIRED_JOBS = ['quality', 'backend_unit', 'frontend_unit', 'database', 'build', 'acceptance_matrix', 'containers'];
const PR_REQUIRED_JOBS = ['typecheck', 'backend_unit', 'frontend_unit', 'build'];
const BUILD_PATHS = ['shared/dist', 'backend/dist', 'frontend/.next'];
// Approximate elapsed seconds from the maintained suites; new suites receive a
// conservative default and are assigned automatically, never omitted.
const WEIGHTS = {
  'scoped-mailbox.integration.test.ts': 100, 'notification-delivery.integration.test.ts': 140,
  'tasks.integration.test.ts': 180, 'workflow-stage-entry.integration.test.ts': 160,
  'login-lockout.integration.test.ts': 100, 'permissions.integration.test.ts': 100,
  'verify-custom-fields-inline-browser.mjs': 300, 'verify-crm-rbac-browser.mjs': 240,
  'verify-tasks-browser.mjs': 240, 'verify-task-workflow-integrity-browser.mjs': 180,
  'verify-custom-fields-browser.mjs': 240, 'verify-ui-fixes-browser.mjs': 240,
  'verify-ui-polish-browser.mjs': 240, 'verify-notifications-browser.mjs': 180,
  'verify-campaign-variables-browser.mjs': 120, 'verify-customize-fields-browser.mjs': 180,
  'verify-dashboard-browser.mjs': 180, 'verify-deal-actions-browser.mjs': 240,
  'verify-leads-table-browser.mjs': 300, 'verify-record-plan-browser.mjs': 300,
  'verify-workflow-browser.mjs': 240,
};
const digest = value => createHash('sha256').update(value).digest('hex');
const normalized = name => name.replaceAll('\\', '/');

function contained(root, path) {
  const absolute = resolve(root, path), suffix = relative(resolve(root), absolute);
  assert.ok(suffix && suffix !== '..' && !suffix.startsWith('..' + sep) && !require('node:path').isAbsolute(suffix), 'Path must stay inside its owned directory');
  return absolute;
}
/** Reports and inventories never follow artifact links or junctions. */
function files(root, directory = root) {
  assert.ok(!lstatSync(root).isSymbolicLink(), 'Evidence root cannot be a symbolic link or junction');
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(directory, entry.name), stat = lstatSync(path);
    assert.ok(!stat.isSymbolicLink(), `Symbolic links are not allowed in evidence: ${relative(root, path)}`);
    const actual = realpathSync(path);
    assert.equal(actual, contained(realpathSync(root), relative(root, path)), 'Evidence resolved outside its directory');
    return stat.isDirectory() ? files(root, path) : stat.isFile() ? [path] : [];
  });
}
function discovery(root) {
  const integration = files(resolve(root, 'backend/src')).filter(path => path.endsWith('.integration.test.ts'));
  const browser = files(resolve(root, 'backend/scripts')).filter(path => /verify-.*-browser\.mjs$/.test(path));
  const entry = (path, kind) => {
    const id = normalized(relative(root, path)), source = readFileSync(path, 'utf8'), name = posix.basename(id);
    if (kind === 'browser') assert.ok(source.includes('PGlite.create(') || NATIVE_BROWSERS.includes(name) || name === 'verify-notifications-browser.mjs',
      `Declare a disposable runtime for new browser suite: ${id}`);
    const selfContained = source.includes('PGlite.create(') && !source.includes('const disposable') && !id.includes('login-lockout');
    return { id, seconds: WEIGHTS[name] ?? (kind === 'browser' ? 180 : 60), database: kind === 'browser'
      ? NATIVE_BROWSERS.includes(name) || name === 'verify-notifications-browser.mjs' ? 'native' : 'pglite'
      : selfContained ? 'pglite' : 'native' };
  };
  const manifest = { version: 1, shards: SHARDS, integration: integration.map(path => entry(path, 'integration')).sort((a, b) => a.id.localeCompare(b.id)),
    browser: browser.map(path => entry(path, 'browser')).sort((a, b) => a.id.localeCompare(b.id)) };
  assert.ok(manifest.integration.length && manifest.browser.length, 'Both acceptance inventories must contain suites');
  assert.ok(manifest.integration.some(item => item.id === IMPORT_SUITE), 'Populated import History suite is required');
  return { ...manifest, sha256: digest(JSON.stringify(manifest)) };
}
function partitions(entries, count = SHARDS) {
  assert.ok(Number.isInteger(count) && count > 0 && entries.length >= count, 'Every acceptance shard must contain suites');
  const shards = Array.from({ length: count }, () => ({ seconds: 0, ids: [] }));
  for (const item of [...entries].sort((a, b) => b.seconds - a.seconds || a.id.localeCompare(b.id))) {
    const next = shards.reduce((best, shard, index) => shard.seconds < shards[best].seconds ? index : best, 0);
    shards[next].ids.push(item.id); shards[next].seconds += item.seconds;
  }
  return shards.map(shard => shard.ids.sort());
}
function owners(manifest, profile = 'full') {
  assert.ok(['full', 'pr'].includes(profile), 'Unsupported CI profile');
  const fixed = [
    { owner: 'quality', mode: 'typecheck', suiteIds: [], labels: ['Local documentation references', 'shared TypeScript', 'backend TypeScript', 'backend test TypeScript', 'frontend TypeScript'] },
    { owner: 'backend-unit', mode: 'unit', workspace: 'backend', suiteIds: [], labels: ['QA isolation regression tests', 'CI coordination regressions', 'Coolify release orchestration regressions', 'backend unit tests'] },
    { owner: 'frontend-unit', mode: 'unit', workspace: 'frontend', suiteIds: [], labels: ['frontend tests'] },
    { owner: 'database', mode: 'database', suiteIds: [IMPORT_SUITE], labels: ['Prisma validation', 'Rollout and migration regression tests', 'Contact preservation and retirement fixtures', 'Populated import History migration and HTTP rehearsal', 'Populated guarded db:deploy and backend startup rehearsal', 'Mailbox worker restart'] },
    { owner: 'build', mode: 'build', suiteIds: [], labels: ['shared production build', 'backend production build', 'frontend production build'] },
  ];
  if (profile === 'pr') return [
    ...['frontend', 'backend', 'shared'].map(workspace => ({ owner: `typecheck-${workspace}`, job: 'typecheck', mode: 'typecheck', workspace,
      suiteIds: [], labels: [...(workspace === 'shared' ? ['Local documentation references'] : []), `${workspace} TypeScript`, ...(workspace === 'backend' ? ['backend test TypeScript'] : [])] })),
    ...fixed.filter(owner => ['unit', 'build'].includes(owner.mode)),
  ].map(owner => ({ ...owner, profile }));
  for (const mode of ['integration', 'browser']) {
    const entries = manifest[mode].filter(item => item.id !== IMPORT_SUITE);
    for (const [index, suiteIds] of partitions(entries, manifest.shards).entries()) {
      fixed.push({ owner: `${mode}-${index + 1}/${manifest.shards}`, mode, shard: `${index + 1}/${manifest.shards}`, suiteIds,
        labels: suiteIds.map(id => mode === 'integration' ? id.slice('backend/'.length) : id) });
    }
  }
  return fixed.map(owner => ({ ...owner, profile }));
}
function plan(args, manifest) {
  const mode = args[0] || 'all', ci = args.includes('--ci');
  const flags = args.slice(1);
  const selected = key => flags.filter(flag => flag.startsWith(`--${key}=`));
  for (const key of ['workspace', 'shard', 'profile']) assert.ok(selected(key).length <= 1, `Duplicate --${key} flag`);
  const workspace = selected('workspace')[0]?.slice('--workspace='.length), shard = selected('shard')[0]?.slice('--shard='.length);
  const profile = selected('profile')[0]?.slice('--profile='.length) ?? 'full';
  assert.ok(['full', 'pr'].includes(profile), 'Supported CI profiles are full and pr');
  assert.ok(ci || !selected('profile').length, '--profile is only supported for CI');
  assert.ok(!selected('workspace').length || workspace, 'Workspace cannot be empty');
  assert.ok(!selected('shard').length || shard, 'Shard cannot be empty');
  if (workspace) assert.ok((mode === 'unit' && ['backend', 'frontend'].includes(workspace)) ||
    (mode === 'typecheck' && ['backend', 'frontend', 'shared'].includes(workspace)), '--workspace is only supported for unit tests or TypeScript checks');
  if (shard) {
    assert.ok(['integration', 'browser'].includes(mode), '--shard is only supported for integration/browser');
    assert.match(shard, /^[1-9]\d*\/[1-9]\d*$/, 'Use --shard=1/3');
    const [index, total] = shard.split('/').map(Number);
    assert.ok(total === manifest.shards && index <= total, `Supported shards are 1/${manifest.shards} through ${manifest.shards}/${manifest.shards}`);
  }
  if (!ci) return { mode, ci: false, workspace, shard, suiteIds: shard ? owners(manifest).find(owner => owner.mode === mode && owner.shard === shard).suiteIds : undefined };
  assert.ok(flags.every(flag => ['--ci', '--native'].includes(flag) || /^--(?:workspace|shard|profile)=/.test(flag)), 'CI cannot use filters, exclusions, case selection or unknown flags');
  assert.ok(mode !== 'unit' || workspace, 'CI unit tests require an explicit workspace');
  assert.ok(!['integration', 'browser'].includes(mode) || shard, 'CI acceptance requires an explicit shard');
  assert.ok(!['database', 'integration', 'browser'].includes(mode) || flags.includes('--native'), 'CI database and acceptance require native PostgreSQL');
  const owner = owners(manifest, profile).find(item => item.mode === mode && item.workspace === workspace && item.shard === shard);
  assert.ok(owner, `Unsupported CI owner for ${mode}`);
  return { ...owner, ci: true, manifestSha256: manifest.sha256 };
}
function invocation(environment = process.env) {
  const result = { runId: environment.GITHUB_RUN_ID, attempt: environment.GITHUB_RUN_ATTEMPT, revision: environment.GITHUB_SHA,
    repository: environment.GITHUB_REPOSITORY, job: environment.GITHUB_JOB };
  assert.match(result.runId ?? '', /^\d+$/, 'CI requires GITHUB_RUN_ID');
  assert.match(result.attempt ?? '', /^[1-9]\d*$/, 'CI requires GITHUB_RUN_ATTEMPT');
  assert.match(result.revision ?? '', /^[0-9a-f]{40}$/, 'CI requires its full tested GITHUB_SHA');
  assert.match(result.repository ?? '', /^[^/]+\/[^/]+$/, 'CI requires GITHUB_REPOSITORY');
  assert.ok(result.job, 'CI requires GITHUB_JOB');
  return result;
}
function validateReport(report, owner, manifest, source, current) {
  assert.equal(report?.status, 'PASS', `${owner.owner}: required acceptance failed`);
  assert.equal(report.ci?.version, 2, 'Unsupported CI report schema');
  assert.equal(report.ci.profile, owner.profile, 'Incorrect CI profile');
  assert.equal(report.ci?.owner, owner.owner, 'Unexpected evidence owner');
  assert.equal(report.ci.manifestSha256, manifest.sha256, 'Stale suite manifest');
  for (const key of ['runId', 'revision', 'repository']) assert.equal(report.ci.invocation?.[key], current[key], `Stale or foreign ${key}`);
  assert.match(report.ci.invocation?.attempt ?? '', /^[1-9]\d*$/, 'Invalid artifact run attempt');
  assert.ok(Number(report.ci.invocation.attempt) <= Number(current.attempt), 'Artifact belongs to a future attempt');
  const job = owner.job ?? (owner.owner === 'backend-unit' ? 'backend_unit' : owner.owner === 'frontend-unit' ? 'frontend_unit'
    : owner.shard ? 'acceptance_matrix' : owner.owner);
  assert.equal(report.ci.invocation.job, job, 'Evidence belongs to another job');
  assert.equal(report.mode, owner.mode, 'Incorrect owner mode');
  assert.equal(report.workspace, owner.workspace, 'Incorrect workspace ownership');
  assert.equal(report.shard, owner.shard, 'Incorrect shard ownership');
  assert.equal(report.filter, undefined, 'Filtered evidence cannot satisfy CI');
  assert.deepEqual(report.exclude, [], 'Excluded suites cannot satisfy CI');
  assert.equal(report.testNamePattern, undefined, 'Selected cases cannot satisfy CI');
  assert.equal(report.sourceChanged, false, 'Source changed during acceptance');
  assert.equal(report.validForFinalSource, true, 'Acceptance belongs to another source');
  assert.equal(report.validForExecutableSource, true, 'Executable source changed');
  for (const identity of [report.sourceStart, report.sourceEnd]) for (const key of ['revision', 'sourceSha256', 'executableSourceSha256', 'lockSha256']) {
    assert.equal(identity?.[key], source[key], `Incorrect source ${key}`);
  }
  assert.deepEqual(report.ci.suiteIds, owner.suiteIds, 'Incorrect selected suite ownership');
  assert.deepEqual(report.ci.executedSuiteIds, owner.suiteIds, 'A required suite did not execute');
  assert.ok(Array.isArray(report.results) && report.results.length, 'Required gate records missing');
  for (const result of report.results) {
    assert.equal(result.status, 'PASS', `Failed gate record: ${result.label}`);
    assert.equal(result.failed ?? 0, 0, 'Failed assertions cannot pass');
    assert.equal(result.skipped ?? 0, 0, 'Mandatory assertions were skipped');
    assert.equal(result.cancelled ?? 0, 0, 'Mandatory assertions were cancelled');
    assert.equal(result.todo ?? 0, 0, 'Mandatory assertions did not execute');
    if (result.passed !== undefined) assert.ok(Number.isInteger(result.passed) && result.passed > 0, 'No executed assertions');
    if (result.exitCode !== undefined) assert.equal(result.exitCode, 0, 'Failed command exit');
  }
  for (const label of owner.labels) assert.equal(report.results.filter(item => item.label === label).length, 1, `Missing or duplicate gate record: ${label}`);
  const allowed = [...owner.labels, ...(owner.mode === 'integration' ? ['Disposable native PostgreSQL fixture'] : [])];
  assert.ok(report.results.every(item => allowed.includes(item.label)), 'Unexpected ownership in report');
  assert.ok(Array.isArray(report.commands) && report.commands.length && report.commands.every(command => command.exitCode === 0 && !command.error &&
    Number.isFinite(Date.parse(command.startedAt)) && Number.isFinite(Date.parse(command.finishedAt)) && Date.parse(command.finishedAt) >= Date.parse(command.startedAt)), 'Command evidence is incomplete');
  for (const label of owner.labels) assert.equal(report.commands.filter(command => command.label === label).length, 1, `Missing or duplicate command: ${label}`);
  assert.ok(report.commands.every(command => owner.labels.includes(command.label)), 'Unexpected command ownership');
  if (['database', 'integration', 'browser'].includes(owner.mode)) {
    assert.equal(report.native, true, 'Native PostgreSQL was not requested');
    assert.match(report.ci.postgresVersion ?? '', /^PostgreSQL 18(?:\.|\b)/, 'Required PostgreSQL 18 runtime missing');
  }
}
function aggregate(reports, needs, manifest, source, current, profile = 'full') {
  const expected = owners(manifest, profile);
  const requiredJobs = profile === 'pr' ? PR_REQUIRED_JOBS : REQUIRED_JOBS;
  assert.deepEqual(Object.keys(needs).sort(), [...requiredJobs].sort(), 'Required jobs missing or unexpected');
  for (const name of requiredJobs) assert.equal(needs[name]?.result, 'success', `${name} did not succeed`);
  assert.equal(reports.length, expected.length, 'Missing or duplicate owner evidence');
  for (const owner of expected) {
    const matches = reports.filter(report => report.ci?.owner === owner.owner);
    assert.equal(matches.length, 1, `Missing or duplicate owner: ${owner.owner}`);
    validateReport(matches[0], owner, manifest, source, current);
  }
  const actual = reports.flatMap(report => report.ci.executedSuiteIds).sort();
  const required = profile === 'full' ? [...manifest.integration, ...manifest.browser].map(item => item.id).sort() : [];
  assert.deepEqual(actual, required, 'Acceptance coverage is incomplete or duplicated');
  return { status: 'PASS', profile, revision: current.revision, manifestSha256: manifest.sha256,
    coverageScope: profile === 'pr' ? 'Fast checks only; complete acceptance is required separately.' : 'Complete verification of the tested revision.',
    integrationSuites: profile === 'full' ? manifest.integration.length : 0,
    browserSuites: profile === 'full' ? manifest.browser.length : 0, owners: expected.map(item => item.owner),
    jobs: reports.map(report => ({ owner: report.ci.owner, attempt: report.ci.invocation.attempt,
      commandSeconds: report.commands.reduce((total, command) => total + Math.max(0, (Date.parse(command.finishedAt) - Date.parse(command.startedAt)) / 1000 || 0), 0),
      fixtures: [...new Set(report.results.map(result => result.database).filter(Boolean))] })) };
}
function archivePaths(names) {
  assert.ok(names.length, 'Empty build archive');
  for (const name of names) {
    assert.ok(name && !name.includes('\\') && !/^[\/]|^[a-z]:|[\r\n\0]/i.test(name), 'Unsafe archive path');
    const clean = posix.normalize(name.replace(/\/$/, ''));
    assert.ok(clean === name.replace(/\/$/, '') && BUILD_PATHS.some(path => clean === path || clean.startsWith(path + '/')), `Build archive must contain scoped outputs: ${name}`);
  }
}

function buildLink(name, target) {
  assert.ok(target && !posix.isAbsolute(target) && !/^[a-z]:|[\\\r\n\0]/i.test(target), 'Unsafe build symlink target');
  const resolved = posix.normalize(posix.join(posix.dirname(name), target));
  archivePaths([resolved]);
  return resolved;
}
/** Inspect gzip/tar semantics before extraction, including GNU/PAX overrides. */
function validateArchive(archive) {
  const bytes = gunzipSync(archive, { maxOutputLength: 1024 * 1024 * 1024 });
  assert.equal(bytes.length % 512, 0, 'Truncated tar archive');
  const string = (header, start, length) => header.subarray(start, start + length).toString('utf8').split('\0')[0];
  const number = value => { assert.match(value.trim(), /^[0-7]*$/, 'Unsupported tar number'); return parseInt(value.trim() || '0', 8); };
  const pax = payload => {
    const result = {}; let offset = 0;
    while (offset < payload.length) {
      const space = payload.indexOf(32, offset); assert.ok(space > offset, 'Malformed PAX record');
      const lengthText = payload.subarray(offset, space).toString('ascii'); assert.match(lengthText, /^[1-9]\d*$/, 'Invalid PAX record length');
      const length = Number(lengthText); assert.ok(Number.isSafeInteger(length) && offset + length <= payload.length && length > space - offset + 2, 'Truncated PAX record');
      assert.equal(payload[offset + length - 1], 10, 'Unterminated PAX record');
      const record = payload.subarray(space + 1, offset + length - 1).toString('utf8'), equal = record.indexOf('=');
      assert.ok(equal > 0 && !record.includes('\0'), 'Invalid PAX attribute');
      const key = record.slice(0, equal); assert.ok(!key.startsWith('GNU.sparse') && !['SCHILY.filetype', 'SCHILY.devmajor', 'SCHILY.devminor'].includes(key), 'Special PAX file types are not allowed');
      result[key] = record.slice(equal + 1); offset += length;
    }
    return result;
  };
  const members = [], seen = new Set(), links = new Set(); let offset = 0, attributes = {}, global = {}, longName, longLink, terminated = false;
  while (offset + 512 <= bytes.length) {
    const header = bytes.subarray(offset, offset + 512); offset += 512;
    if (header.every(byte => byte === 0)) { assert.ok(bytes.subarray(offset).every(byte => byte === 0), 'Data after tar terminator'); terminated = true; break; }
    const checksum = number(string(header, 148, 8));
    const actual = header.reduce((sum, value, index) => sum + (index >= 148 && index < 156 ? 32 : value), 0);
    assert.equal(checksum, actual, 'Tar header checksum mismatch');
    const type = String.fromCharCode(header[156]), extension = ['x', 'g', 'L', 'K'].includes(type);
    const overrides = { ...global, ...attributes };
    let size = number(string(header, 124, 12));
    if (!extension && overrides.size !== undefined) { assert.match(overrides.size, /^\d+$/, 'Invalid PAX file size'); size = Number(overrides.size); }
    assert.ok(Number.isSafeInteger(size) && size >= 0 && offset + size <= bytes.length, 'Truncated tar member');
    const payload = bytes.subarray(offset, offset + size); offset += Math.ceil(size / 512) * 512;
    assert.ok(offset <= bytes.length, 'Truncated tar padding');
    if (extension) {
      if (type === 'x') attributes = { ...attributes, ...pax(payload) };
      else if (type === 'g') global = { ...global, ...pax(payload) };
      else if (type === 'L') longName = payload.toString('utf8').replace(/\0+$/, '');
      else longLink = payload.toString('utf8').replace(/\0+$/, '');
      continue;
    }
    assert.ok(['\0', '0', '5', '2'].includes(type), 'Hardlinks and special tar members are not allowed');
    assert.ok(!(longName !== undefined && overrides.path !== undefined) && !(longLink !== undefined && overrides.linkpath !== undefined), 'Conflicting GNU/PAX path metadata');
    const prefix = string(header, 257, 6) === 'ustar' ? string(header, 345, 155) : '', ordinary = string(header, 0, 100);
    const name = overrides.path ?? longName ?? (prefix ? prefix + '/' + ordinary : ordinary);
    archivePaths([name]);
    const clean = name.replace(/\/$/, ''); assert.ok(!seen.has(clean), 'Duplicate tar member'); seen.add(clean); members.push(clean);
    if (type === '2') { buildLink(clean, overrides.linkpath ?? longLink ?? string(header, 157, 100)); links.add(clean); }
    if (type === '2' || type === '5') assert.equal(size, 0, 'Link/directory cannot carry tar payload');
    attributes = {}; longName = undefined; longLink = undefined;
  }
  assert.ok(!Object.keys(attributes).length && longName === undefined && longLink === undefined, 'Unconsumed tar metadata');
  assert.ok(terminated, 'Missing tar terminator');
  assert.ok(members.length, 'Empty tar archive');
  for (const name of members) { let parent = posix.dirname(name); while (parent !== '.') { assert.ok(!links.has(parent), 'Tar member traverses a symlink'); parent = posix.dirname(parent); } }
  return members;
}

module.exports = { SHARDS, IMPORT_SUITE, NATIVE_BROWSERS, REQUIRED_JOBS, PR_REQUIRED_JOBS, BUILD_PATHS, digest, contained, files, discovery, partitions, owners, plan, invocation, validateReport, aggregate, archivePaths, buildLink, validateArchive };
