import { notificationTestPostgres, runNotificationTestFile } from '../../backend/scripts/notification-test-postgres.mjs';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
const { qaEnvironment } = require('../../scripts/qa-environment.cjs');
const root = resolve(import.meta.dirname, '../..');
const pg = await notificationTestPostgres();
try {
  const url = await pg.database('leadcrm_login_lockout_1');
  const result = spawnSync(process.execPath, [resolve(root, 'node_modules/vitest/vitest.mjs'), 'run',
    'src/core/auth/__tests__/login-lockout.integration.test.ts', '--maxWorkers=1',
    '--testNamePattern=queues one administrative|suppresses unlocked|rolls back the permanent|delivers exactly once in day 89'], {
    cwd: resolve(root, 'backend'), windowsHide: true, stdio: 'inherit',
    env: qaEnvironment(root, { DATABASE_URL: url, DIRECT_URL: url, LOGIN_LOCKOUT_POSTGRES_URL: url }),
  });
  process.exitCode = result.status ?? 1;
  const recovery = await runNotificationTestFile('src/core/auth/__tests__/password-recovery.integration.test.ts', await pg.database('leadcrm_forms_test_2'));
  if (recovery) process.exitCode = recovery;
} finally { pg.stop(); }
