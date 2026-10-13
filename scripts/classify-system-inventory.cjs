'use strict';
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'docs/audits/cleanup-manifest.json');
const manifest = JSON.parse(fs.readFileSync(output, 'utf8'));
const rows = new Map(manifest.files.map(row => [row.path, row]));
const present = [...rows.keys()].filter(name => fs.existsSync(path.join(root, name)));
const code = present.filter(name => /\.(?:[cm]?js|jsx|tsx?|json|css|html|md|mdx|ya?ml|py|sql)$/i.test(name) && name !== 'docs/audits/cleanup-manifest.json');
const text = new Map(code.map(name => [name, fs.readFileSync(path.join(root, name), 'utf8')]));
const edges = new Map(), inbound = new Map(), roots = new Map();
function targets(base) {
  const normalized = path.relative(root, base).replaceAll('\\', '/');
  const candidates = [normalized, ...['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '/index.ts', '/index.tsx', '/index.js'].map(ext => normalized + ext)];
  if (/\.js$/.test(normalized)) candidates.push(normalized.slice(0, -3) + '.ts', normalized.slice(0, -3) + '.tsx');
  return candidates.filter(name => rows.has(name) && fs.existsSync(path.join(root, name)));
}
function resolveImport(from, request) {
  let base;
  if (request.startsWith('.')) base = path.resolve(root, path.dirname(from), request);
  else if (request === '@leadcrm/shared') return ['shared/src/index.ts'];
  else if (request.startsWith('@/') && from.startsWith('frontend/')) {
    const part = request.slice(2); base = path.resolve(root, 'frontend', part);
    if (!targets(base).length) base = path.resolve(root, 'frontend/src', part);
  } else return [];
  if (base.includes(`${path.sep}dist${path.sep}backend${path.sep}src${path.sep}`)) base = base.replace(`${path.sep}dist${path.sep}backend${path.sep}src${path.sep}`, `${path.sep}src${path.sep}`);
  if (base.includes(`${path.sep}backend${path.sep}dist${path.sep}shared${path.sep}`)) base = base.replace(`${path.sep}backend${path.sep}dist${path.sep}shared${path.sep}`, `${path.sep}shared${path.sep}`);
  return targets(base);
}
for (const [name, body] of text) {
  if (!/\.(?:[cm]?js|jsx|tsx?)$/.test(name)) continue;
  const source = ts.createSourceFile(name, body, ts.ScriptTarget.Latest, true);
  const requests = new Set();
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) requests.add(node.moduleSpecifier.text);
    if (ts.isCallExpression(node) && node.arguments[0] && ts.isStringLiteral(node.arguments[0]) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(source) === 'require' || node.expression.getText(source) === 'require.resolve')) requests.add(node.arguments[0].text);
    ts.forEachChild(node, visit);
  }
  visit(source);
  const dependencies = [...new Set([...requests].flatMap(request => resolveImport(name, request)))]; edges.set(name, dependencies);
  for (const target of dependencies) { if (!inbound.has(target)) inbound.set(target, []); inbound.get(target).push(name); }
  if (/^frontend\/app\//.test(name)) roots.set(name, 'Next.js filesystem route/layout/API convention.');
  if (/\.(test|spec)\./.test(name) || /(?:^|\/)__tests__\//.test(name)) roots.set(name, 'Maintained regression source discovered by test tooling.');
  if (/^backend\/scripts\/verify-.*-browser\.mjs$/.test(name)
    && (body.includes('PGlite.create(') || text.get('scripts/qa-local.mjs')?.includes(path.basename(name)))) {
    roots.set(name, 'Disposable browser harness discovered by scripts/qa-local.mjs from its database fixture or explicit native registration.');
  }
}
for (const name of ['backend/src/server.ts', 'backend/src/app.ts', 'backend/src/notifications-worker.ts', 'backend/start.js', 'shared/src/index.ts']) if (rows.has(name)) roots.set(name, 'Declared application/shared runtime entrypoint.');
for (const [name, body] of text) if (/package\.json$/.test(name)) {
  let pkg; try { pkg = JSON.parse(body); } catch { continue; }
  for (const command of Object.values(pkg.scripts ?? {})) for (const match of String(command).matchAll(/(?:^|\s)([^\s]+\.(?:[cm]?js|tsx?))(?=\s|$)/g)) {
    for (const target of targets(path.resolve(root, path.dirname(name), match[1]))) roots.set(target, `Package script in ${name}.`);
  }
}
const reachable = new Set(roots.keys()), queue = [...reachable];
for (let index = 0; index < queue.length; index++) for (const target of edges.get(queue[index]) ?? []) if (!reachable.has(target)) { reachable.add(target); queue.push(target); }
const rootMetadata = /(^|\/)(?:package(?:-lock)?\.json|tsconfig[^/]*\.json|vitest\.config\.ts|next\.config\.ts|postcss\.config\.[cm]?js|tailwind\.config\.[cm]?js|\.gitignore|\.gitattributes|\.dockerignore|\.env\.example|AGENTS\.md|CLAUDE\.md|CONTRIBUTING\.md|README\.md|\.cursorrules|turbo\.json|render\.yaml)$/;
for (const row of rows.values()) {
  if (row.action === 'MOVED') row.action = 'RELOCATE';
  if (['DELETE', 'CONSOLIDATE', 'RELOCATE'].includes(row.action)) {
    row.evidenceStatus = 'Verified cleanup decision; runtime regression status recorded separately'; continue;
  }
  if (!fs.existsSync(path.join(root, row.path))) { row.action = 'BLOCKED'; row.reason = 'Missing file without a recorded verified deletion decision.'; continue; }
  if (row.action === 'ADD') row.changeType = 'ADD';
  if (row.action === 'UPDATE') row.changeType = 'UPDATE';
  const name = row.path, consumers = (inbound.get(name) ?? []).filter(file => reachable.has(file));
  const basename = path.basename(name), literalConsumers = [...text].filter(([file, body]) => file !== name && (body.includes(name) || (basename.length > 10 && body.includes(basename)))).map(([file]) => file);
  row.consumerEvidence = { resolvedImports: consumers.slice(0, 8), textualReferences: literalConsumers.slice(0, 8), frameworkEntry: roots.get(name) ?? null };
  if (/^backend\/prisma\/migrations\//.test(name)) {
    row.action = 'HISTORICAL RETAIN'; row.reason = 'Versioned migration history consumed by Prisma deploy and disposable replay; never rewritten for cleanup.';
    row.dependencyCheck = 'Prisma migration convention; backend/scripts/replay-crm-migrations.mjs and guarded deployment runner enumerate this directory.';
  } else if (/^shared\/src\/.*\.js$/.test(name) && rows.has(name.slice(0, -3) + '.ts')) {
    row.action = 'REGENERATE'; row.reason = 'Intentional JavaScript compatibility companion generated from retained TypeScript; plain Node consumers require this format.';
    row.dependencyCheck = 'shared/scripts/sync-generated.cjs synchronizes companions; architecture/ADR document current consumers.'; row.replacement = name.slice(0, -3) + '.ts';
  } else if (reachable.has(name)) {
    row.action = 'KEEP'; row.reason = roots.get(name) ?? 'Resolved from a registered runtime/shared/test entrypoint in the source import graph.';
    row.dependencyCheck = roots.has(name) ? roots.get(name) : `Reachable consumer(s): ${consumers.slice(0, 4).join(', ')}`;
  } else if (rootMetadata.test(name) || name === 'backend/prisma/schema.prisma' || name === 'backend/prisma/seed.ts' || /^infrastructure\//.test(name) || /^\.github\//.test(name)) {
    row.action = 'KEEP'; row.reason = 'Repository installation, build, deployment or contributor entrypoint configuration.';
    row.dependencyCheck = 'Conventional package/Git/framework or documented infrastructure entrypoint; relevant configuration checks recorded in validation.';
  } else if (/^(?:\.kiro\/|\.agents\/)/.test(name)) {
    row.action = 'HISTORICAL RETAIN'; row.reason = 'Contributor skill/settings or historical specification; retained outside product-runtime cleanup scope.';
    row.dependencyCheck = 'Editor/skill filesystem conventions and historical project provenance; not a claim of current product usage.';
  } else if (/\.(?:md|mdx)$/.test(name) && literalConsumers.length) {
    row.action = 'KEEP'; row.reason = 'Referenced documentation retained; contents were not proved redundant with a complete canonical replacement.';
    row.dependencyCheck = `Document/reference consumer(s): ${literalConsumers.slice(0, 4).join(', ')}`;
  } else if (/^(?:artifacts\/|docs\/.*\.(?:png|jpg|jpeg)|data\/outputs\/gmail-recovery\/)/.test(name) && literalConsumers.length) {
    row.action = 'HISTORICAL RETAIN'; row.reason = 'Referenced historical verification/incident evidence retained.';
    row.dependencyCheck = `Evidence references: ${literalConsumers.slice(0, 4).join(', ')}`;
  } else if (/^frontend\/public\//.test(name) && literalConsumers.some(file => reachable.has(file) || /manifest|next\.config/.test(file))) {
    row.action = 'KEEP'; row.reason = 'Public asset or PWA identity referenced by application source/manifest.';
    row.dependencyCheck = `Source/static manifest consumer(s): ${literalConsumers.slice(0, 4).join(', ')}`;
  } else {
    row.action = 'BLOCKED'; row.reason = 'Retained because complete runtime/dynamic/external or historical redundancy proof is unavailable; absence from a direct import graph does not authorize deletion.';
    row.dependencyCheck = literalConsumers.length ? `Textual consumers require further semantic review: ${literalConsumers.slice(0, 4).join(', ')}` : 'No positive resolved import/reference found by this bounded static inventory; manual dynamic/recovery/unique-history review remains required.';
  }
  row.evidenceStatus = row.action === 'BLOCKED' ? 'Incomplete; preserved pending review' : 'Retention justified by the recorded boundary/consumer; full runtime acceptance remains separate';
  row.verification = [...new Set([...(row.verification ?? []).filter(value => value !== 'Pending full verification'), 'TypeScript AST imports/exports/require and framework/package-entry graph', 'Textual path/basename consumer search; ambiguity explicitly blocked'])];
}
manifest.files = [...rows.values()].sort((a, b) => a.path.localeCompare(b.path));
manifest.classificationMethod = { importGraph: 'TypeScript AST literal imports/exports/require; Next routes, runtime, shared and test roots; declared package-script paths', limitations: 'Computed imports, external operators and unlinked unique historical evidence are not proved by static analysis. Such files are preserved as BLOCKED. KEEP indicates retention evidence, not all tests passed.' };
manifest.classificationCounts = manifest.files.reduce((counts, row) => ({ ...counts, [row.action]: (counts[row.action] ?? 0) + 1 }), {});
fs.writeFileSync(output, JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ graphRoots: roots.size, reachable: reachable.size, classifications: manifest.classificationCounts }));
