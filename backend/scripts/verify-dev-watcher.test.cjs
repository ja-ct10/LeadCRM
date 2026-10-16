'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { spawn, execFileSync } = require('node:child_process');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { resolve, join } = require('node:path');
const { once } = require('node:events');
const { setTimeout: delay } = require('node:timers/promises');
const { qaEnvironment } = require('../../scripts/qa-environment.cjs');
const root = resolve(__dirname, '../..');

test('backend development watcher reloads a required TypeScript dependency', { timeout: 30000 }, async () => {
  const backend = resolve(root, 'backend');
  const command = require('../package.json').scripts.dev.split(' ');
  assert.equal(command.shift(), 'node');
  assert.equal(command.pop(), 'src/server.ts');
  assert(command.includes('--watch'));
  const env = qaEnvironment(root);
  const directory = mkdtempSync(join(env.TMP, 'watch-'));
  const dependency = join(directory, 'dependency.ts');
  writeFileSync(dependency, "export const value: string = 'initial';\n");
  writeFileSync(join(directory, 'entry.ts'), "const dependency = require('./dependency'); console.log('WATCH_READY:' + dependency.value); setInterval(() => {}, 1000);\n");
  const child = spawn(process.execPath, [...command, join(directory, 'entry.ts')], { cwd: backend, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '', failure;
  child.stdout.on('data', data => { output += data; });
  child.stderr.on('data', data => { output += data; });
  child.on('error', error => { failure = error; });
  const closed = once(child, 'close');
  async function ready(value) {
    const deadline = Date.now() + 12000;
    while (!output.includes(`WATCH_READY:${value}`)) {
      if (failure) throw failure;
      if (child.exitCode !== null || Date.now() >= deadline) throw Error(`Watcher did not load ${value}: ${output}`);
      await delay(50);
    }
  }
  try {
    await ready('initial');
    writeFileSync(dependency, "export const value: string = 'updated';\n");
    await ready('updated');
    assert.equal(output.match(/WATCH_READY:initial/g)?.length, 1, output);
    assert.equal(output.match(/WATCH_READY:updated/g)?.length, 1, output);
  } finally {
    if (child.pid && child.exitCode === null) {
      if (process.platform === 'win32') execFileSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      else child.kill('SIGTERM');
    }
    await closed;
    rmSync(directory, { recursive: true, force: true });
  }
});
