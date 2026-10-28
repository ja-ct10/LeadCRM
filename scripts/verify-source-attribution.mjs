// Disposable fixtures only. Never loads configured databases or provider accounts.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..'), require = createRequire(import.meta.url);
const { qaEnvironment } = require('./qa-environment.cjs');
const cases = process.argv.find(value => value.startsWith('--cases='))?.slice(8);
const run = (workspace, files, overrides = {}) => new Promise((done, reject) => {
  const child = spawn(process.execPath, [resolve(root, 'node_modules/vitest/vitest.mjs'), 'run', ...files, '--maxWorkers=1', '--no-file-parallelism', '--silent', ...(cases ? ['--testNamePattern=' + cases] : [])], { cwd: resolve(root, workspace), env: qaEnvironment(root, overrides), stdio: 'inherit', windowsHide: true });
  child.once('error', reject); child.once('exit', code => code === 0 ? done() : reject(Error(workspace + ' verification failed: ' + code)));
});
if (!process.argv.includes('--integration-only')) {
  await run('backend', ['src/modules/marketing/forms/source-attribution.test.ts', 'src/modules/marketing/forms/forms.validation.test.ts', 'src/integrations/gmail/business-email.test.ts', 'src/modules/crm/leads/__tests__/lead-serializer.test.ts']);
  await run('frontend', ['src/features/tenant/marketing/forms/services/source-tracking.test.ts', 'src/features/tenant/marketing/forms/ui/forms.test.tsx', 'src/features/tenant/marketing/forms/ui/form-share-panel.test.tsx', 'src/features/tenant/crm/leads/ui/lead-form.test.tsx']);
}
if (!process.argv.includes('--unit-only')) {
  const { notificationTestPostgres } = await import('../backend/scripts/notification-test-postgres.mjs');
  const pg = await notificationTestPostgres();
  try {
    const url = await pg.database('leadcrm_forms_test_2');
    await run('backend', ['src/modules/marketing/forms/forms.integration.test.ts'], { DATABASE_URL: url, DIRECT_URL: url });
  } finally { pg.stop(); }
}
