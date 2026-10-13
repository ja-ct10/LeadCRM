// Inventory proposed tracked source; never reads environment files/private storage.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'docs/audits/cleanup-manifest.json');
const list = args => execFileSync('git', ['-c', 'core.fsmonitor=false', ...args], { cwd: root }).toString().split('\0').filter(Boolean);
const previous = fs.existsSync(output) ? JSON.parse(fs.readFileSync(output, 'utf8')) : {};
const baselineCommit = previous.baselineCommit || execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root }).toString().trim();
// Keep before/after measurements stable when the repair is committed in phases.
const tracked = list(['ls-tree', '-r', '--name-only', '-z', baselineCommit]);
const proposed = [...new Set([...list(['ls-files', '-z']), ...list(['ls-files', '--others', '--exclude-standard', '-z'])])];
const additions = proposed.filter(name => !tracked.includes(name));
const files = [...new Set([...tracked, ...proposed])];
const actions = new Map((previous.files || []).map(item => [item.path, item]));
for (const name of files) {
  if (actions.has(name)) continue;
  const historical = name.startsWith('backend/prisma/migrations/');
  const category = /\.(md|mdx)$/i.test(name) ? 'Documentation' : /(?:test|spec|fixture)/i.test(name) ? 'Test' : /\.(png|jpg|jpeg|svg|ico|woff2?|zip)$/i.test(name) ? 'Asset' : /(?:scripts\/|\.sql$)/.test(name) ? 'Script' : 'Source';
  const addition = additions.includes(name);
  actions.set(name, { path: name, category, action: addition ? 'ADD' : historical ? 'HISTORICAL RETAIN' : 'KEEP', reason: addition ? 'New implementation, regression coverage or audit deliverable.' : historical ? 'Applied migration history is immutable.' : 'Retained pending consumer and runtime verification.', dependencyCheck: addition ? 'Review alongside the implementation diff.' : 'Pending full verification', replacement: null, risk: 'Low', verification: [] });
}
const present = files.filter(name => fs.existsSync(path.join(root, name)));
const counts = { trackedFiles: tracked.filter(name => present.includes(name)).length, proposedFiles: present.length, newFiles: additions.filter(name => present.includes(name)).length, markdownFiles: present.filter(name => /\.(md|mdx)$/i.test(name)).length, trackedBytes: tracked.filter(name => present.includes(name)).reduce((sum, name) => sum + fs.statSync(path.join(root, name)).size, 0), proposedBytesExcludingManifest: present.filter(name => name !== 'docs/audits/cleanup-manifest.json').reduce((sum, name) => sum + fs.statSync(path.join(root, name)).size, 0) };
const manifest = { ...previous, baselineCommit, countDefinitions: { trackedFiles: 'Baseline paths still present in the proposed tree.', newFiles: 'Present proposed paths absent from the fixed baseline commit.', proposedBytes: 'Present source plus the serialized manifest; excludes ignored private/build/QA outputs.' }, baseline: previous.baseline || counts, current: counts, files: [...actions.values()].sort((a, b) => a.path.localeCompare(b.path)) };
fs.mkdirSync(path.dirname(output), { recursive: true });
// Include the manifest's own final serialized size without a changing timestamp.
for (let attempt = 0; attempt < 4; attempt++) {
  const contents = JSON.stringify(manifest, null, 2) + '\n';
  const total = counts.proposedBytesExcludingManifest + Buffer.byteLength(contents);
  if (counts.proposedBytes === total) break;
  counts.proposedBytes = total;
}
fs.writeFileSync(output, JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ baseline: manifest.baseline, current: counts }));
