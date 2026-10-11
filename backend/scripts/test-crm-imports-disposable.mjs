// Replays the real migration history in memory. Never reads a configured database URL.
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { replayCrmMigrations } from './replay-crm-migrations.mjs';

const db = await PGlite.create();
let socket;
try {
  await replayCrmMigrations(db);
  socket = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 0 });
  await socket.start();
  // This name is explicitly allowed by the existing guarded import/sales suites.
  const database = `postgresql://postgres:postgres@${socket.getServerConn()}/leadcrm_forms_test_2?connection_limit=1&statement_cache_size=0`;
  const preview = process.argv.includes('--preview');
  const suites = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
  const args = preview ? ['-r', 'ts-node/register/transpile-only', 'src/modules/crm/leads/sales-automation.preview.ts']
    : [resolve(import.meta.dirname, '../../node_modules/vitest/vitest.mjs'), 'run', '--no-file-parallelism',
      ...(process.argv.includes('--all') ? [] : suites.length ? suites : ['src/modules/crm/imports/imports.integration.test.ts', 'src/modules/crm/leads/sales-automation.integration.test.ts'])];
  const child = spawn(process.execPath, args, { cwd: resolve(import.meta.dirname, '..'), windowsHide: true, stdio: 'inherit',
    env: { ...process.env, NODE_ENV: preview ? 'development' : 'test', DATABASE_URL: database, DIRECT_URL: database,
      JWT_SECRET: randomBytes(32).toString('hex'), ENCRYPTION_KEY: randomBytes(32).toString('hex'), BREVO_API_KEY: '', BREVO_SMS_SENDER: '' },
  });
  process.exitCode = await new Promise((done, reject) => { child.once('error', reject); child.once('exit', code => done(code ?? 1)); });
} finally { await socket?.stop(); await db.close(); }
