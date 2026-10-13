'use strict';
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { existsSync, readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const excluded = name => /(^|\/)(?:node_modules|\.git|\.tmp|\.next|\.next-dev|dist|coverage)(\/|$)/.test(name) || /^data\/outputs\//.test(name) || /^docs\/audits\//.test(name) || /(^|\/)\.env(?!\.example$)/.test(name);
function proposedFiles(root) {
  const snapshot = resolve(root, '.qa-source-snapshot.json');
  if (existsSync(snapshot)) return JSON.parse(readFileSync(snapshot, 'utf8')).files;
  const git = args => execFileSync('git', ['-c', 'core.fsmonitor=false', ...args], { cwd: root, encoding: 'utf8', windowsHide: true });
  if (resolve(git(['rev-parse', '--show-toplevel']).trim()) !== resolve(root)) throw Error('QA must use its own checkout or explicit clean snapshot inventory');
  return [...new Set([...git(['ls-files', '-z']).split('\0'), ...git(['ls-files', '--others', '--exclude-standard', '-z']).split('\0')])].filter(Boolean).sort();
}
function sourceIdentity(root) {
  const snapshotPath = resolve(root, '.qa-source-snapshot.json');
  const snapshot = existsSync(snapshotPath) ? JSON.parse(readFileSync(snapshotPath, 'utf8')) : undefined;
  const git = args => execFileSync('git', ['-c', 'core.fsmonitor=false', ...args], { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
  // Hash the proposed content, independent of whether Git still lists a deleted
  // path before its cleanup commit. Real removals during QA still change this set.
  const files = proposedFiles(root).filter(name => !excluded(name) && existsSync(resolve(root, name)));
  const hash = createHash('sha256'), executableHash = createHash('sha256'), documentationHash = createHash('sha256'), fileHashes = {};
  for (const name of files) {
    const bytes = existsSync(resolve(root, name)) ? readFileSync(resolve(root, name)) : Buffer.from('<DELETED>');
    fileHashes[name] = createHash('sha256').update(bytes).digest('hex');
    hash.update(name + '\0').update(bytes);
    (/\.(?:md|mdx)$/.test(name) || /^design-system\//.test(name) ? documentationHash : executableHash).update(name + '\0').update(bytes);
  }
  const lock = resolve(root, 'package-lock.json');
  return { revision: snapshot?.revision ?? git(['rev-parse', 'HEAD']), sourceSha256: hash.digest('hex'), executableSourceSha256: executableHash.digest('hex'), documentationSha256: documentationHash.digest('hex'), fileHashes,
    sourceFileCount: files.length, lockSha256: existsSync(lock) ? createHash('sha256').update(readFileSync(lock)).digest('hex') : null,
    excluded: ['private .env files', 'dependencies/build caches', 'data/outputs', 'docs/audits mutable reports/manifest'], snapshot: Boolean(snapshot) };
}
module.exports = { proposedFiles, sourceIdentity };
