// Builtin-only artifact transfer and the mandatory acceptance gate.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..'), require = createRequire(import.meta.url);
const ci = require('./qa-ci.cjs'), { sourceIdentity } = require('./qa-source-identity.cjs');
assert.ok(process.argv.length <= 4, 'Unexpected CI command arguments');
const [command, location] = process.argv.slice(2), source = sourceIdentity(root), manifest = ci.discovery(root), current = ci.invocation();
assert.equal(source.revision, current.revision, 'Checkout does not match the tested workflow revision');
const directory = resolve(location || 'data/outputs/ci-build');
const reports = folder => ci.files(folder).filter(path => path.endsWith('/qa-ci-report.json') || path.endsWith('\\qa-ci-report.json')).map(path => JSON.parse(readFileSync(path, 'utf8')));
const tar = args => execFileSync('tar', args, { cwd: root, encoding: 'utf8', windowsHide: true, maxBuffer: 32 * 1024 * 1024 });
function verifyBuild(meta) {
  assert.equal(meta?.version, 1, 'Unsupported build artifact');
  assert.deepEqual(meta.outputs, ci.BUILD_PATHS, 'Unexpected build outputs');
  ci.validateReport(meta.report, ci.owners(manifest).find(owner => owner.owner === 'build'), manifest, source, current);
  assert.equal(ci.digest(readFileSync(resolve(directory, 'build.tar.gz'))), meta.archiveSha256, 'Build archive checksum mismatch');
  ci.validateArchive(readFileSync(resolve(directory, 'build.tar.gz')));
}
function inspectOutput(path, staging) {
  const stat = lstatSync(path);
  if (stat.isSymbolicLink()) {
    const target = readlinkSync(path);
    assert.ok(!require('node:path').isAbsolute(target), 'Build symlinks must be relative');
    ci.buildLink(relative(staging, path).replaceAll('\\', '/'), target.replaceAll('\\', '/'));
  } else if (stat.isDirectory()) for (const name of readdirSync(path)) inspectOutput(resolve(path, name), staging);
  else assert.ok(stat.isFile(), 'Unsupported build archive object');
}
if (command === 'pack') {
  const matching = reports(resolve(root, 'data/outputs/ci')).filter(report => report.ci?.owner === 'build');
  assert.equal(matching.length, 1, 'Exactly one current build report is required');
  const report = matching[0];
  ci.validateReport(report, ci.owners(manifest).find(owner => owner.owner === 'build'), manifest, source, current);
  for (const path of ci.BUILD_PATHS) { assert.ok(existsSync(resolve(root, path)), `Required build output missing: ${path}`); inspectOutput(resolve(root, path), root); }
  assert.ok(existsSync(resolve(root, 'frontend/.next/BUILD_ID')), 'Frontend production build is incomplete');
  mkdirSync(directory, { recursive: true });
  const stagingRoot = resolve(root, 'data/outputs/ci-pack'); mkdirSync(stagingRoot, { recursive: true });
  const staging = mkdtempSync(resolve(stagingRoot, 'build-'));
  try {
    // Independent copies avoid tar hardlinks without following package links.
    for (const path of ci.BUILD_PATHS) {
      mkdirSync(dirname(resolve(staging, path)), { recursive: true });
      cpSync(resolve(root, path), resolve(staging, path), { recursive: true, dereference: false, verbatimSymlinks: true,
        filter: source => source !== resolve(root, 'frontend/.next/cache') });
    }
    tar(['-czf', resolve(directory, 'build.tar.gz'), '--exclude=frontend/.next/cache', '-C', staging, ...ci.BUILD_PATHS]);
  } finally { assert.ok(staging.startsWith(stagingRoot + sep)); rmSync(staging, { recursive: true }); }
  const meta = { version: 1, outputs: ci.BUILD_PATHS, archiveSha256: ci.digest(readFileSync(resolve(directory, 'build.tar.gz'))), report };
  writeFileSync(resolve(directory, 'build.json'), JSON.stringify(meta, null, 2) + '\n');
  verifyBuild(meta);
  console.log('Packed builds for ' + current.revision);
} else if (command === 'restore') {
  assert.deepEqual(ci.files(directory).map(path => relative(directory, path)).sort(), ['build.json', 'build.tar.gz'], 'Build artifact must contain only its report and archive');
  const meta = JSON.parse(readFileSync(resolve(directory, 'build.json'), 'utf8'));
  verifyBuild(meta);
  const stagingRoot = resolve(root, 'data/outputs/ci-restore'); mkdirSync(stagingRoot, { recursive: true });
  const staging = mkdtempSync(resolve(stagingRoot, 'build-'));
  try {
    tar(['-xzf', resolve(directory, 'build.tar.gz'), '--no-same-owner', '-C', staging]);
    for (const path of ci.BUILD_PATHS) inspectOutput(resolve(staging, path), staging);
    assert.ok(existsSync(resolve(staging, 'frontend/.next/BUILD_ID')), 'Frontend production build is incomplete');
    for (const path of ci.BUILD_PATHS) {
      const target = ci.contained(root, path);
      if (existsSync(target)) { assert.ok(!lstatSync(target).isSymbolicLink(), 'Existing build target cannot be a link'); rmSync(target, { recursive: true }); }
      mkdirSync(dirname(target), { recursive: true });
      cpSync(resolve(staging, path), target, { recursive: true, dereference: false, verbatimSymlinks: true });
    }
    assert.equal(sourceIdentity(root).sourceSha256, source.sourceSha256, 'Restoring builds changed source');
  } finally { assert.ok(staging.startsWith(stagingRoot + sep)); rmSync(staging, { recursive: true }); }
  console.log('Restored tested builds for ' + current.revision);
} else if (command === 'gate' || command === 'pr-gate') {
  assert.ok(location, 'Gate requires the current workflow artifacts directory');
  const result = ci.aggregate(reports(directory), JSON.parse(process.env.CI_NEEDS_JSON || '{}'), manifest, source, current, command === 'pr-gate' ? 'pr' : 'full');
  console.log(JSON.stringify(result, null, 2));
} else throw Error('Use qa-ci.mjs pack [directory], restore <directory>, gate <directory>, or pr-gate <directory>');
