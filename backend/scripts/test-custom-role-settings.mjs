// Permission fixtures retain compatibility columns; guarded destructive cutovers
// belong to their separate release rehearsals and are never weakened here.
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { replayCrmMigrations } from './replay-crm-migrations.mjs';

const db = await PGlite.create();
let socket;
try {
  await replayCrmMigrations(db, { exclude: [
    '20261102000000_retire_relationship_compatibility', '20261110000000_retire_unused_crm_columns',
    '20261112000000_retire_lead_nonform_columns', '20261129000000_retire_contact_obsolete_columns',
  ] });
  socket = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 0 });
  await socket.start();
  const url = `postgresql://postgres:postgres@${socket.getServerConn()}/leadcrm_environment_test_1?connection_limit=1&statement_cache_size=0`;
  const root = resolve(import.meta.dirname, '..');
  const child = spawn(process.execPath, [resolve(root, '../node_modules/vitest/vitest.mjs'), 'run', '--no-file-parallelism',
    'src/modules/administration/roles/__tests__/custom-role-settings.integration.test.ts'], {
    cwd: root, windowsHide: true, stdio: 'inherit', env: { ...process.env, NODE_ENV: 'test', DATABASE_URL: url, DIRECT_URL: url,
      JWT_SECRET: randomBytes(32).toString('hex'), ENCRYPTION_KEY: randomBytes(32).toString('hex'), BREVO_API_KEY: '', BREVO_SMS_SENDER: '' },
  });
  process.exitCode = await new Promise((done, fail) => { child.once('exit', code => done(code ?? 1)); child.once('error', fail); });
} catch (error) {
  console.error(JSON.stringify({ stage: 'disposable custom-role fixture', code: error.code, message: error.message }));
  process.exitCode = 1;
} finally { await socket?.stop(); await db.close(); }
