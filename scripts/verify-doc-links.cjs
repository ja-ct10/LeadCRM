'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const { proposedFiles } = require('./qa-source-identity.cjs');
const files = proposedFiles(root).filter(name => /\.(md|mdx)$/i.test(name) && fs.existsSync(path.join(root, name)));
const broken = [];
let checked = 0;
for (const name of files) {
  const body = fs.readFileSync(path.join(root, name), 'utf8').replace(/```[\s\S]*?```/g, '');
  for (const match of body.matchAll(/\]\((?:<([^>]+)>|([^\s)]+))(?:\s+"[^"]*")?\)/g)) {
    let target = (match[1] || match[2]).split('#')[0];
    if (!target || /^(?:https?|mailto|app|codex|plugin|data):|^\/\//i.test(target)) continue;
    try { target = decodeURIComponent(target); } catch {}
    checked++;
    if (!fs.existsSync(path.resolve(root, path.dirname(name), target))) broken.push({ file: name, target });
  }
}
const output = path.resolve(root, 'data/outputs/system-audit'); fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, 'document-links.json'), JSON.stringify({ markdownFiles: files.length, checkedLocalLinks: checked, broken }, null, 2) + '\n');
console.log(JSON.stringify({ markdownFiles: files.length, checkedLocalLinks: checked, brokenCount: broken.length, broken: broken.slice(0, 15) }, null, 2));
if (broken.length) process.exitCode = 1;
