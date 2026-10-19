'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { gzipSync } = require('node:zlib');
const ci = require('./qa-ci.cjs');
const { sourceIdentity } = require('./qa-source-identity.cjs');
const source = { revision: 'a'.repeat(40), sourceSha256: 'b'.repeat(64), executableSourceSha256: 'c'.repeat(64), lockSha256: 'd'.repeat(64) };
const current = { runId: '123', attempt: '2', revision: source.revision, repository: 'owner/repo', job: 'acceptance' };
function manifest() {
  const value = { version: 1, shards: 3, integration: [ci.IMPORT_SUITE, ...['a', 'b', 'c', 'd'].map(name => `backend/src/${name}.integration.test.ts`)].map(id => ({ id, seconds: 60, database: 'native' })),
    browser: ['a', 'b', 'c', 'd'].map(name => ({ id: `backend/scripts/verify-${name}-browser.mjs`, seconds: 180, database: 'pglite' })) };
  return { ...value, sha256: ci.digest(JSON.stringify(value)) };
}
function evidence(owner, inventory = manifest(), identity = source) {
  return { mode: owner.mode, workspace: owner.workspace, shard: owner.shard, status: 'PASS', native: true, exclude: [], sourceChanged: false, validForFinalSource: true, validForExecutableSource: true,
    sourceStart: identity, sourceEnd: identity,
    ci: { version: 2, profile: owner.profile, owner: owner.owner, manifestSha256: inventory.sha256, suiteIds: owner.suiteIds, executedSuiteIds: owner.suiteIds,
      postgresVersion: 'PostgreSQL 18.4', invocation: { ...current, attempt: '1', job: owner.job ?? (owner.owner === 'backend-unit' ? 'backend_unit' : owner.owner === 'frontend-unit' ? 'frontend_unit' : owner.shard ? 'acceptance_matrix' : owner.owner) } },
    results: owner.labels.map(label => ({ label, status: 'PASS', passed: 1, failed: 0, skipped: 0, exitCode: 0 })),
    commands: owner.labels.map(label => ({ label, exitCode: 0, startedAt: new Date(Date.now() - 10).toISOString(), finishedAt: new Date().toISOString() })) };
}
const needs = () => Object.fromEntries(ci.REQUIRED_JOBS.map(name => [name, { result: 'success' }]));
const fixture = () => fs.mkdtempSync(path.join(os.tmpdir(), 'leadcrm-ci-test-'));
function tarMember(name, type = '0', payload = Buffer.alloc(0), link = '') {
  const header = Buffer.alloc(512); header.write(name, 0, 100); header.write('0000755\0', 100); header.write('0000000\0', 108); header.write('0000000\0', 116);
  header.write(payload.length.toString(8).padStart(11, '0') + '\0', 124); header.write('00000000000\0', 136);
  header.fill(32, 148, 156); header.write(type, 156); header.write(link, 157, 100); header.write('ustar\0', 257); header.write('00', 263);
  header.write(header.reduce((sum, byte) => sum + byte, 0).toString(8).padStart(6, '0') + '\0 ', 148);
  return Buffer.concat([header, payload, Buffer.alloc((512 - payload.length % 512) % 512)]);
}
const tarArchive = (...members) => gzipSync(Buffer.concat([...members, Buffer.alloc(1024)]));
function paxRecord(key, value) {
  const record = `${key}=${value}\n`; let length = Buffer.byteLength(record) + 2;
  while (Buffer.byteLength(`${length} ${record}`) !== length) length = Buffer.byteLength(`${length} ${record}`);
  return Buffer.from(`${length} ${record}`);
}
function seed(directory) {
  const names = [ci.IMPORT_SUITE, ...['a', 'b', 'c'].map(name => `backend/src/${name}.integration.test.ts`), ...['a', 'b', 'c'].map(name => `backend/scripts/verify-${name}-browser.mjs`)];
  for (const name of names) { fs.mkdirSync(path.dirname(path.resolve(directory, name)), { recursive: true }); fs.writeFileSync(path.resolve(directory, name), name.endsWith('.mjs') ? 'PGlite.create(' : 'const disposable = true;'); }
  return names;
}
test('Every discovered suite receives one deterministic balanced owner, including new suites', () => {
  const directory = fixture();
  try {
    seed(directory); const before = ci.discovery(directory);
    const added = path.resolve(directory, 'backend/src/new.integration.test.ts'); fs.writeFileSync(added, 'const disposable = true;');
    fs.writeFileSync(path.resolve(directory, 'backend/scripts/verify-new-browser.mjs'), 'PGlite.create(');
    const next = ci.discovery(directory);
    assert.notEqual(next.sha256, before.sha256);
    assert.equal(next.integration.find(item => item.id.endsWith('new.integration.test.ts')).seconds, 60);
    const assigned = ci.owners(next).flatMap(owner => owner.suiteIds).sort();
    assert.deepEqual(assigned, [...next.integration, ...next.browser].map(item => item.id).sort());
    assert.equal(assigned.filter(id => id === ci.IMPORT_SUITE).length, 1);
    assert.deepEqual(ci.partitions(next.integration), ci.partitions([...next.integration].reverse()));
    assert.ok(ci.partitions(next.browser).every(shard => shard.length));
    fs.writeFileSync(path.resolve(directory, 'backend/scripts/verify-undeclared-browser.mjs'), '// Runtime not declared');
    assert.throws(() => ci.discovery(directory), /Declare a disposable runtime/);
  } finally { fs.rmSync(directory, { recursive: true }); }
});

test('Local fixture previews stay outside database acceptance while undeclared browser suites remain rejected', () => {
  const directory = fixture();
  try {
    seed(directory);
    const before = ci.discovery(directory);
    const source = '// Rendered UI with intercepted API fixtures; no disposable database';
    fs.writeFileSync(path.resolve(directory, 'backend/scripts/preview-security-export-products.mjs'), source);
    fs.writeFileSync(path.resolve(directory, 'backend/scripts/preview-record-email-attachments.mjs'), source);
    assert.deepEqual(ci.discovery(directory), before);
    fs.writeFileSync(path.resolve(directory, 'backend/scripts/verify-fixture-browser.mjs'), source);
    assert.throws(() => ci.discovery(directory), /Declare a disposable runtime/);
  } finally { fs.rmSync(directory, { recursive: true }); }
});

test('The real repository inventory includes the native Workflow Policy browser suite', () => {
  const inventory = ci.discovery(path.resolve(__dirname, '..'));
  assert.equal(inventory.browser.find(suite => suite.id === 'backend/scripts/verify-workflow-policy-browser.mjs')?.database, 'native');
  assert.ok(ci.owners(inventory).some(owner => owner.suiteIds.includes('backend/scripts/verify-workflow-policy-browser.mjs')));
});
test('CI selection rejects reduced coverage, malformed shards, missing owners and unsupported modes', () => {
  const inventory = manifest();
  assert.equal(ci.plan(['all'], inventory).ci, false);
  assert.equal(ci.plan(['unit', '--workspace=frontend', '--ci'], inventory).owner, 'frontend-unit');
  for (const args of [
    ['all', '--ci'], ['unit', '--ci'], ['unit', '--workspace=unknown'], ['unit', '--workspace='],
    ['unit', '--workspace=backend', '--workspace=frontend'], ['unit', '--workspace=backend=extra'], ['build', '--shard=1/3'],
    ['integration', '--ci', '--native'], ['browser', '--shard=1/3', '--ci'],
    ...['', '0/3', '4/3', '1/2', '01/3', '1.5/3', '1/3=extra'].map(shard => ['integration', '--shard=' + shard]),
    ...['--filter=mailbox', '--exclude=mailbox', '--testNamePattern=selected', '--unknown'].map(flag => ['integration', '--ci', '--native', '--shard=1/3', flag]),
  ]) assert.throws(() => ci.plan(args, inventory), undefined, JSON.stringify(args));
  assert.equal(ci.plan(['integration', '--ci', '--native', '--shard=1/3'], inventory).owner, 'integration-1/3');
});
test('Mandatory gate permits only complete successful same-run evidence, including previous healthy attempts', () => {
  const inventory = manifest(), reports = ci.owners(inventory).map(owner => evidence(owner, inventory));
  assert.equal(ci.aggregate(reports, needs(), inventory, source, current).status, 'PASS');
  for (const change of [
    report => { report.ci.version = 1; }, report => { report.ci.version = 99; }, report => { report.ci.invocation.attempt = '3'; }, report => { report.ci.invocation.runId = 'other-run'; },
    report => { report.ci.invocation.repository = 'foreign/repo'; }, report => { report.ci.invocation.revision = 'e'.repeat(40); },
    report => { report.ci.invocation.job = 'foreign-job'; }, report => { report.ci.manifestSha256 = 'stale'; },
    report => { report.sourceStart.lockSha256 = 'changed'; }, report => { report.sourceEnd.sourceSha256 = 'changed'; },
    report => { report.filter = 'selected'; }, report => { report.exclude = ['required']; }, report => { report.testNamePattern = 'selected'; },
    report => { report.validForFinalSource = false; }, report => { report.results = []; },
    report => { report.results[0].skipped = 1; }, report => { report.results[0].failed = 1; },
    report => { report.results[0].cancelled = 1; }, report => { report.results[0].todo = 1; },
    report => { report.commands[0].exitCode = 1; }, report => { report.commands[0].finishedAt = undefined; },
    report => { report.status = 'BLOCKED'; }, report => { report.results[0].status = 'FAIL'; },
  ]) {
    const modified = structuredClone(reports); change(modified[0]);
    assert.throws(() => ci.aggregate(modified, needs(), inventory, source, current));
  }
  assert.throws(() => ci.aggregate(reports.slice(1), needs(), inventory, source, current));
  assert.throws(() => ci.aggregate([...reports, reports[0]], needs(), inventory, source, current));
  for (const result of ['failure', 'cancelled', 'skipped', undefined]) {
    const jobs = needs(); jobs.acceptance_matrix.result = result;
    assert.throws(() => ci.aggregate(reports, jobs, inventory, source, current));
  }
  const jobs = needs(); delete jobs.database; assert.throws(() => ci.aggregate(reports, jobs, inventory, source, current));
  const missingSuite = structuredClone(reports); missingSuite.find(report => report.ci.owner.startsWith('browser-')).ci.executedSuiteIds = [];
  assert.throws(() => ci.aggregate(missingSuite, needs(), inventory, source, current));
  const wrongDatabase = structuredClone(reports); wrongDatabase.find(report => report.ci.owner === 'database').ci.postgresVersion = 'PostgreSQL 17.4';
  assert.throws(() => ci.aggregate(wrongDatabase, needs(), inventory, source, current));
});

test('PR selection owns all three TypeScript checks, documentation once, both test jobs and the build', () => {
  const inventory = manifest(), owners = ci.owners(inventory, 'pr');
  assert.equal(owners.length, 6);
  assert.equal(owners.flatMap(owner => owner.suiteIds).length, 0);
  assert.equal(owners.flatMap(owner => owner.labels).filter(label => label === 'Local documentation references').length, 1);
  assert.equal(owners.find(owner => owner.workspace === 'shared').labels[0], 'Local documentation references');
  for (const workspace of ['frontend', 'backend', 'shared']) {
    assert.equal(ci.plan(['typecheck', '--ci', '--profile=pr', `--workspace=${workspace}`], inventory).owner, `typecheck-${workspace}`);
    assert.equal(ci.plan(['typecheck', `--workspace=${workspace}`], inventory).workspace, workspace);
  }
  for (const args of [
    ['typecheck', '--ci', '--profile=pr'], ['typecheck', '--ci', '--workspace=shared'],
    ['database', '--ci', '--native', '--profile=pr'], ['integration', '--ci', '--native', '--profile=pr', '--shard=1/3'],
    ['browser', '--ci', '--native', '--profile=pr', '--shard=1/3'], ['unit', '--ci', '--profile=pr', '--workspace=shared'],
    ['build', '--ci', '--profile='], ['build', '--ci', '--profile=unknown'], ['build', '--ci', '--profile=pr', '--profile=full'],
    ['typecheck', '--profile=pr', '--workspace=frontend'], ['build', '--ci', '--profile=pr', '--filter=shared'],
  ]) assert.throws(() => ci.plan(args, inventory), undefined, JSON.stringify(args));
  assert.equal(ci.plan(['typecheck', '--ci'], inventory).profile, 'full');
  assert.equal(ci.plan(['all', '--native'], inventory).ci, false);
});

test('PR gate rejects omitted checks, canceled jobs, skipped tests and foreign or mixed-profile evidence', () => {
  const inventory = manifest(), owners = ci.owners(inventory, 'pr'), reports = owners.map(owner => evidence(owner, inventory));
  const jobs = Object.fromEntries(ci.PR_REQUIRED_JOBS.map(name => [name, { result: 'success' }]));
  const gate = (values = reports, required = jobs) => ci.aggregate(values, required, inventory, source, current, 'pr');
  const result = gate();
  assert.equal(result.status, 'PASS'); assert.equal(result.profile, 'pr');
  assert.equal(result.integrationSuites, 0); assert.equal(result.browserSuites, 0);
  for (const report of reports) assert.throws(() => gate(reports.filter(value => value !== report)));
  assert.throws(() => gate([...reports, reports[0]]));
  for (const job of ci.PR_REQUIRED_JOBS) for (const status of ['failure', 'cancelled', 'skipped', undefined]) {
    const modified = structuredClone(jobs); modified[job].result = status; assert.throws(() => gate(reports, modified));
  }
  for (const change of [
    report => { report.ci.profile = 'full'; }, report => { delete report.ci.profile; },
    report => { report.ci.invocation.runId = '999'; }, report => { report.ci.invocation.attempt = '3'; },
    report => { report.ci.invocation.revision = 'e'.repeat(40); }, report => { report.ci.invocation.repository = 'foreign/repo'; },
    report => { report.sourceEnd.sourceSha256 = 'stale'; }, report => { report.ci.manifestSha256 = 'stale'; },
    report => { report.results[0].skipped = 1; }, report => { report.results[0].passed = 0; },
    report => { report.commands[0].exitCode = 1; }, report => { report.status = 'FAIL'; },
  ]) {
    const modified = structuredClone(reports); change(modified[0]); assert.throws(() => gate(modified));
  }
  assert.throws(() => gate(reports, { ...jobs, database: { result: 'success' } }));
  const full = ci.owners(inventory).map(owner => evidence(owner, inventory));
  assert.throws(() => ci.aggregate(reports, needs(), inventory, source, current), /Missing or duplicate/);
  assert.throws(() => gate(full));
  for (const name of ['backend-unit', 'frontend-unit', 'build']) {
    const fullOwner = ci.owners(inventory).find(owner => owner.owner === name), prOwner = owners.find(owner => owner.owner === name);
    assert.throws(() => ci.validateReport(evidence(prOwner), fullOwner, inventory, source, current), /Incorrect CI profile/);
    assert.throws(() => ci.validateReport(evidence(fullOwner), prOwner, inventory, source, current), /Incorrect CI profile/);
  }
});

test('Actual PR gate CLI accepts complete reports and rejects missing evidence and unexpected arguments', () => {
  const directory = fixture();
  try {
    const names = seed(directory);
    for (const name of ['qa-ci.cjs', 'qa-ci.mjs', 'qa-source-identity.cjs']) {
      fs.mkdirSync(path.resolve(directory, 'scripts'), { recursive: true });
      fs.copyFileSync(path.resolve(__dirname, name), path.resolve(directory, 'scripts', name)); names.push('scripts/' + name);
    }
    fs.writeFileSync(path.resolve(directory, 'package-lock.json'), '{}'); names.push('package-lock.json');
    fs.writeFileSync(path.resolve(directory, '.qa-source-snapshot.json'), JSON.stringify({ revision: current.revision, files: names.sort() }));
    const inventory = ci.discovery(directory), identity = sourceIdentity(directory), reports = path.resolve(directory, 'data/outputs/ci/pr');
    fs.mkdirSync(reports, { recursive: true });
    for (const owner of ci.owners(inventory, 'pr')) {
      const folder = path.resolve(reports, owner.owner); fs.mkdirSync(folder);
      fs.writeFileSync(path.resolve(folder, 'qa-ci-report.json'), JSON.stringify(evidence(owner, inventory, identity)));
    }
    const jobs = Object.fromEntries(ci.PR_REQUIRED_JOBS.map(name => [name, { result: 'success' }]));
    const env = { ...process.env, GITHUB_RUN_ID: current.runId, GITHUB_RUN_ATTEMPT: current.attempt, GITHUB_SHA: current.revision,
      GITHUB_REPOSITORY: current.repository, GITHUB_JOB: 'required', CI_NEEDS_JSON: JSON.stringify(jobs) };
    const run = args => spawnSync(process.execPath, ['scripts/qa-ci.mjs', ...args], { cwd: directory, env, encoding: 'utf8', windowsHide: true });
    const passed = run(['pr-gate', reports]); assert.equal(passed.status, 0, passed.stderr);
    assert.equal(JSON.parse(passed.stdout).integrationSuites, 0);
    assert.notEqual(run(['gate', reports]).status, 0);
    assert.notEqual(run(['pr-gate', reports, '--profile=full']).status, 0);
    fs.unlinkSync(path.resolve(reports, 'typecheck-shared/qa-ci-report.json'));
    assert.notEqual(run(['pr-gate', reports]).status, 0);
  } finally { fs.rmSync(directory, { recursive: true }); }
});
test('Full gate reads all eleven separate artifact directories and still rejects failed jobs and duplicate owners', () => {
  const directory = fixture();
  try {
    const names = seed(directory);
    for (const name of ['qa-ci.cjs', 'qa-ci.mjs', 'qa-source-identity.cjs']) {
      fs.mkdirSync(path.resolve(directory, 'scripts'), { recursive: true });
      fs.copyFileSync(path.resolve(__dirname, name), path.resolve(directory, 'scripts', name)); names.push('scripts/' + name);
    }
    fs.writeFileSync(path.resolve(directory, 'package-lock.json'), '{}'); names.push('package-lock.json');
    fs.writeFileSync(path.resolve(directory, '.qa-source-snapshot.json'), JSON.stringify({ revision: current.revision, files: names.sort() }));
    const inventory = ci.discovery(directory), identity = sourceIdentity(directory), reports = path.resolve(directory, 'data/outputs/ci-evidence');
    const owners = ci.owners(inventory);
    assert.equal(owners.length, 11);
    for (const owner of owners) {
      const folder = path.resolve(reports, `qa-evidence-full-${owner.owner.replaceAll('/', '-')}`, 'ci', owner.owner.replaceAll('/', '-'));
      fs.mkdirSync(folder, { recursive: true });
      fs.writeFileSync(path.resolve(folder, 'qa-ci-report.json'), JSON.stringify(evidence(owner, inventory, identity)));
    }
    const jobs = needs();
    const run = () => spawnSync(process.execPath, ['scripts/qa-ci.mjs', 'gate', reports], { cwd: directory, encoding: 'utf8', windowsHide: true,
      env: { ...process.env, GITHUB_RUN_ID: current.runId, GITHUB_RUN_ATTEMPT: current.attempt, GITHUB_SHA: current.revision,
        GITHUB_REPOSITORY: current.repository, GITHUB_JOB: 'acceptance', CI_NEEDS_JSON: JSON.stringify(jobs) } });
    const passed = run(); assert.equal(passed.status, 0, passed.stderr);
    assert.equal(JSON.parse(passed.stdout).status, 'PASS');
    jobs.database.result = 'failure';
    const failed = run(); assert.notEqual(failed.status, 0); assert.match(failed.stderr, /database did not succeed/);
    jobs.database.result = 'success';
    fs.mkdirSync(path.resolve(reports, 'duplicate'));
    fs.writeFileSync(path.resolve(reports, 'duplicate/qa-ci-report.json'), JSON.stringify(evidence(owners[0], inventory, identity)));
    assert.notEqual(run().status, 0);
  } finally { fs.rmSync(directory, { recursive: true }); }
});

test('Report inventory refuses symlink or junction evidence outside its owned directory', () => {
  const directory = fixture(), outside = fixture();
  try {
    fs.writeFileSync(path.resolve(outside, 'qa-ci-report.json'), '{}');
    fs.symlinkSync(outside, path.resolve(directory, 'foreign'), process.platform === 'win32' ? 'junction' : 'dir');
    assert.throws(() => ci.files(directory), /Symbolic links/);
    assert.throws(() => ci.files(path.resolve(directory, 'foreign')), /Evidence root/);
  } finally { fs.rmSync(directory, { recursive: true }); fs.rmSync(outside, { recursive: true }); }
});
test('Build archive scope rejects absolute paths, traversal, unrelated files and ambiguous spellings', () => {
  ci.archivePaths(['backend/dist/', 'backend/dist/start.js', 'frontend/.next/BUILD_ID', 'shared/dist/index.js']);
  for (const name of ['/etc/passwd', '../outside', 'C:/private', 'backend\\dist\\start.js', 'frontend/.next/../../source.ts', 'backend/src/private.ts', 'backend/dist/./start.js', 'backend/dist/../dist/start.js']) {
    assert.throws(() => ci.archivePaths([name]));
  }
  assert.throws(() => ci.archivePaths([]));
});
test('Tar validation honors GNU/PAX paths and rejects unsafe links, hardlinks and special members before extraction', () => {
  const long = 'frontend/.next/' + 'long-'.repeat(30) + 'file.js';
  assert.deepEqual(ci.validateArchive(tarArchive(tarMember('LongName', 'L', Buffer.from(long + '\0')), tarMember('short'))), [long]);
  assert.deepEqual(ci.validateArchive(tarArchive(tarMember('Pax', 'x', paxRecord('path', long)), tarMember('short'))), [long]);
  for (const archive of [
    tarArchive(tarMember('Pax', 'x', paxRecord('path', '../outside')), tarMember('backend/dist/file')),
    tarArchive(tarMember('backend/dist/link', '2', Buffer.alloc(0), '../../../outside')),
    tarArchive(tarMember('backend/dist/link', '2', Buffer.alloc(0), '../../.git/config')),
    tarArchive(tarMember('backend/dist/link', '1', Buffer.alloc(0), 'backend/dist/file')),
    tarArchive(tarMember('backend/dist/device', '3')),
    tarArchive(tarMember('Pax', 'x', paxRecord('SCHILY.filetype', 'block')), tarMember('backend/dist/device')),
    tarArchive(tarMember('backend/dist/link', '2', Buffer.alloc(0), '../dist'), tarMember('backend/dist/link/payload')),
  ]) assert.throws(() => ci.validateArchive(archive));
});
test('Actual pack/restore preserves scoped builds and rejects checksum or source changes', () => {
  const directory = fixture();
  try {
    const names = seed(directory);
    for (const name of ['qa-ci.cjs', 'qa-ci.mjs', 'qa-source-identity.cjs']) {
      fs.mkdirSync(path.resolve(directory, 'scripts'), { recursive: true });
      fs.copyFileSync(path.resolve(__dirname, name), path.resolve(directory, 'scripts', name)); names.push('scripts/' + name);
    }
    fs.writeFileSync(path.resolve(directory, 'package-lock.json'), '{}'); names.push('package-lock.json');
    fs.writeFileSync(path.resolve(directory, '.qa-source-snapshot.json'), JSON.stringify({ revision: current.revision, files: names.sort() }));
    for (const name of ['backend/dist/start.js', 'shared/dist/index.js', 'frontend/.next/BUILD_ID']) {
      fs.mkdirSync(path.dirname(path.resolve(directory, name)), { recursive: true }); fs.writeFileSync(path.resolve(directory, name), 'tested-build');
    }
    if (process.platform !== 'win32') fs.symlinkSync('./BUILD_ID', path.resolve(directory, 'frontend/.next/release-link'));
    const inventory = ci.discovery(directory), identity = sourceIdentity(directory), owner = ci.owners(inventory).find(item => item.owner === 'build');
    const reportDirectory = path.resolve(directory, 'data/outputs/ci/build'); fs.mkdirSync(reportDirectory, { recursive: true });
    const buildReport = path.resolve(reportDirectory, 'qa-ci-report.json');
    fs.writeFileSync(buildReport, JSON.stringify(evidence(owner, inventory, identity)));
    const environment = { ...process.env, GITHUB_RUN_ID: current.runId, GITHUB_RUN_ATTEMPT: current.attempt, GITHUB_SHA: current.revision, GITHUB_REPOSITORY: current.repository, GITHUB_JOB: 'build' };
    const run = command => spawnSync(process.execPath, ['scripts/qa-ci.mjs', command], { cwd: directory, env: environment, encoding: 'utf8', windowsHide: true });
    const packed = run('pack'); assert.equal(packed.status, 0, packed.stderr);
    const fullReport = fs.readFileSync(buildReport, 'utf8');
    const prBuildOwner = ci.owners(inventory, 'pr').find(item => item.owner === 'build');
    fs.writeFileSync(buildReport, JSON.stringify(evidence(prBuildOwner, inventory, identity)));
    const prPack = run('pack'); assert.notEqual(prPack.status, 0); assert.match(prPack.stderr, /Incorrect CI profile/);
    fs.writeFileSync(buildReport, fullReport);
    const profileMetadata = path.resolve(directory, 'data/outputs/ci-build/build.json'), fullMetadata = fs.readFileSync(profileMetadata, 'utf8');
    const prMetadata = JSON.parse(fullMetadata); prMetadata.report.ci.profile = 'pr';
    fs.writeFileSync(profileMetadata, JSON.stringify(prMetadata));
    const prRestore = run('restore'); assert.notEqual(prRestore.status, 0); assert.match(prRestore.stderr, /Incorrect CI profile/);
    fs.writeFileSync(profileMetadata, fullMetadata);
    fs.writeFileSync(path.resolve(directory, 'backend/dist/start.js'), 'stale-build');
    const restored = run('restore'); assert.equal(restored.status, 0, restored.stderr);
    assert.equal(fs.readFileSync(path.resolve(directory, 'backend/dist/start.js'), 'utf8'), 'tested-build');
    if (process.platform !== 'win32') assert.equal(fs.readlinkSync(path.resolve(directory, 'frontend/.next/release-link')), './BUILD_ID');
    const archive = path.resolve(directory, 'data/outputs/ci-build/build.tar.gz'), bytes = fs.readFileSync(archive);
    fs.appendFileSync(archive, 'corrupted'); assert.notEqual(run('restore').status, 0); fs.writeFileSync(archive, bytes);
    const metadata = path.resolve(directory, 'data/outputs/ci-build/build.json'), saved = fs.readFileSync(metadata), sentinel = path.resolve(directory, 'outside-sentinel');
    fs.writeFileSync(sentinel, 'preserve');
    const malicious = tarArchive(tarMember('backend/dist/escape', '2', Buffer.alloc(0), '../../../outside-sentinel'), tarMember('backend/dist/escape/payload', '0', Buffer.from('overwrite')));
    fs.writeFileSync(archive, malicious); const changed = JSON.parse(saved); changed.archiveSha256 = ci.digest(malicious); fs.writeFileSync(metadata, JSON.stringify(changed));
    const rejected = run('restore'); assert.notEqual(rejected.status, 0); assert.match(rejected.stderr, /scoped outputs/);
    assert.equal(fs.readFileSync(sentinel, 'utf8'), 'preserve'); assert.equal(fs.existsSync(path.resolve(directory, 'payload')), false);
    fs.writeFileSync(archive, bytes); fs.writeFileSync(metadata, saved);
    fs.writeFileSync(path.resolve(directory, 'package-lock.json'), '{"changed":true}'); assert.notEqual(run('restore').status, 0);
  } finally { fs.rmSync(directory, { recursive: true }); }
});
