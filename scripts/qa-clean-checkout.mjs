// Snapshot proposed source without git mutation, private environment or cached builds.
import { execFileSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url), { qaEnvironment } = require('./qa-environment.cjs');
const { proposedFiles, sourceIdentity } = require('./qa-source-identity.cjs');
const { acceptanceRuns, cleanPhaseEnvironment, cleanPhaseEvidence } = require('./qa-clean-evidence.cjs');
const sourceStart = sourceIdentity(root);
const files = proposedFiles(root);
const output = resolve(root, '.tmp/clean-acceptance'); mkdirSync(output, { recursive: true });
const directory = mkdtempSync(join(output, 'source-')), hash = createHash('sha256');
let copied = 0;
const copiedNames = [];
for (const name of files) {
  if (/(^|\/)(?:node_modules|\.git|\.tmp|\.next|\.next-dev|dist|coverage)(\/|$)/.test(name) || /^data\/outputs\//.test(name) || /(^|\/)\.env(?!\.example$)/.test(name)) continue;
  const source = resolve(root, name), target = resolve(directory, name);
  if (!source.startsWith(root + sep) || !target.startsWith(directory + sep)) throw Error('Snapshot path outside workspace');
  if (!existsSync(source)) continue;
  mkdirSync(dirname(target), { recursive: true }); cpSync(source, target);
  hash.update(name + '\0').update(readFileSync(source)); copied++; copiedNames.push(name);
}
writeFileSync(resolve(directory, '.qa-source-snapshot.json'), JSON.stringify({ revision: sourceStart.revision, files, copiedFiles: copiedNames, originalSourceSha256: sourceStart.sourceSha256 }, null, 2) + '\n');
const { fileHashes: startHashes, ...startIdentity } = sourceStart;
const report = { directory, copiedFiles: copied, copiedPayloadSha256: hash.digest('hex'), sourceStart: startIdentity, status: 'SNAPSHOT ONLY', node: process.version,
  cachePolicy: 'No dependencies, builds, engine caches or npm package archives copied; installation uses an empty snapshot-local npm cache.', invocation: process.argv.slice(2), results: [] };
try { if (process.argv.includes('--run')) {
  const npmCli = process.env.npm_execpath;
  if (!npmCli) throw Error('Invoke through npm run qa:clean');
  const npmVersion = spawnSync(process.execPath, [npmCli, '--version'], { encoding: 'utf8', windowsHide: true }).stdout?.trim();
  if (npmVersion !== '11.19.1') throw Error('Use npx --yes npm@11.19.1 run qa:clean to preserve the pinned installer.');
  report.npm = npmVersion;
  const selectedPhases = process.argv.find(arg => arg.startsWith('--phases='))?.slice(9).split(',');
  if (selectedPhases && !selectedPhases.every(phase => ['typecheck', 'unit', 'migrations', 'build', 'integration', 'browser'].includes(phase))) throw Error('Unknown clean acceptance phase');
  report.selectedPhases = selectedPhases ?? ['all'];
  const phases = [['locked clean install', [npmCli, 'ci', '--include=dev', '--no-audit', '--no-fund']], ['Prisma generate', [npmCli, '--prefix', 'backend', 'run', 'db:generate']],
    ...(selectedPhases ? selectedPhases.map(phase => [phase + ' acceptance', ['scripts/qa-local.mjs', phase, '--native'], phase]) : [['full native acceptance', [npmCli, 'run', 'qa:local', '--', '--native'], 'all']])];
  for (const [label, args, phase] of process.argv.includes('--install-only') ? phases.slice(0, 1) : phases) {
    const env = qaEnvironment(directory);
    if (label === 'locked clean install') { delete env.NODE_OPTIONS; env.NPM_CONFIG_CACHE = resolve(directory, '.qa-npm-cache'); }
    env.npm_execpath = npmCli;
    const qaRoot = resolve(directory, 'data/outputs/system-audit');
    const previousRuns = phase ? acceptanceRuns(qaRoot) : [];
    const phaseSource = phase ? sourceIdentity(directory).sourceSha256 : undefined;
    const result = spawnSync(process.execPath, args, { cwd: directory, env: cleanPhaseEnvironment(directory, phase, env), windowsHide: true, stdio: 'inherit' });
    const outcome = phase ? cleanPhaseEvidence(qaRoot, phase, previousRuns, result, phaseSource)
      : { status: result.status === 0 && !result.error ? 'PASS' : 'FAIL' };
    const { status } = outcome;
    report.results.push({ label, executable: process.execPath, args, exitCode: result.status, error: result.error?.message,
      ...outcome });
    if (result.status !== 0 || result.error || status !== 'PASS') { report.status = status; process.exitCode = 1; break; }
  }
  if (!process.exitCode) report.status = process.argv.includes('--install-only') ? 'INSTALL PASS; ACCEPTANCE NOT RUN' : selectedPhases ? 'SELECTED PHASES PASS; FULL ACCEPTANCE NOT RUN' : 'PASS';
} } catch (error) { report.status = 'FAIL'; report.error = error.message; process.exitCode = 1; }
const sourceEnd = sourceIdentity(root), snapshotEnd = sourceIdentity(directory);
const { fileHashes: endHashes, ...endIdentity } = sourceEnd;
const { fileHashes: snapshotHashes, ...snapshotIdentity } = snapshotEnd;
report.sourceEnd = endIdentity; report.snapshotEnd = snapshotIdentity;
report.sourceChanged = sourceStart.sourceSha256 !== sourceEnd.sourceSha256;
report.changedFiles = [...new Set([...Object.keys(startHashes), ...Object.keys(endHashes)])].filter(name => startHashes[name] !== endHashes[name]);
report.snapshotChanged = sourceStart.sourceSha256 !== snapshotEnd.sourceSha256;
report.validForFinalSource = !report.sourceChanged && !report.snapshotChanged;
report.validForExecutableSource = sourceStart.executableSourceSha256 === sourceEnd.executableSourceSha256 && sourceStart.executableSourceSha256 === snapshotEnd.executableSourceSha256;
if (!report.validForFinalSource && /PASS/.test(report.status)) { report.status = 'REVALIDATION REQUIRED'; process.exitCode = 1; }
writeFileSync(resolve(directory, 'clean-acceptance.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
