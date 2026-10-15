// Isolated loopback fixture only; application database/provider credentials are discarded.
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { replayCrmMigrations } from './replay-crm-migrations.mjs';
const require = createRequire(import.meta.url);
const { qaEnvironment } = require('../../scripts/qa-environment.cjs');
const root = resolve(import.meta.dirname, '../..');
const db = await PGlite.create();
let socket;
try {
  await replayCrmMigrations(db);
  socket = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 0 }); await socket.start();
  const url = `postgresql://postgres:postgres@${socket.getServerConn()}/leadcrm_crm_polish_test?connection_limit=1&statement_cache_size=0`;
  const child = spawn(process.execPath, [resolve(root, 'node_modules/vitest/vitest.mjs'), 'run', 'src/modules/crm/companies/organization-polish.integration.test.ts', '--maxWorkers=1'], {
    cwd: resolve(root, 'backend'), stdio: 'inherit', windowsHide: true, env: qaEnvironment(root, { DATABASE_URL: url, DIRECT_URL: url }),
  });
  const code = await new Promise((done, reject) => { child.on('exit', done); child.on('error', reject); });
  if (code !== 0) process.exitCode = 1;
} finally { await socket?.stop(); await db.close(); }
