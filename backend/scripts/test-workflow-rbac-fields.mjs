// Uses fresh native PostgreSQL databases only; never reads a configured database URL.
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { notificationTestPostgres } from './notification-test-postgres.mjs';
const root = resolve(import.meta.dirname, '../..');
const output = resolve(root, 'data/outputs/workflow-rbac-fields');
mkdirSync(output, { recursive: true });
const pg = await notificationTestPostgres();
const selected = process.argv.slice(2);
const summaryPath = resolve(output, 'summary.json');
const summary = selected.length && existsSync(summaryPath) ? JSON.parse(readFileSync(summaryPath, 'utf8')) : [];
try {
  const suites = [
    ['leadcrm_workflow_test_91', ['src/modules/automation/workflows/__tests__/workflow-rbac.integration.test.ts', 'src/modules/automation/workflows/__tests__/workflow.integration.test.ts']],
    ['leadcrm_environment_test_91', ['src/core/permissions/permissions.integration.test.ts', 'src/modules/administration/roles/__tests__/custom-role-settings.integration.test.ts']],
    ['leadcrm_custom_fields_test', ['src/modules/crm/closing-requirements/custom-fields.integration.test.ts']],
    ['leadcrm_campaign_test_91', ['src/modules/marketing/campaigns/__tests__/role-visibility.integration.test.ts']],
  ];
  for (const [database, files] of suites) {
    if (selected.length && !selected.includes(database)) continue;
    const url = await pg.database(database);
    const child = spawn(process.execPath, [resolve(root, 'node_modules/vitest/vitest.mjs'), 'run', ...files, '--maxWorkers=1', '--no-file-parallelism', '--silent', '--reporter=dot', '--reporter=json', `--outputFile=${resolve(output, database + '.json')}`], {
      cwd: resolve(root, 'backend'), windowsHide: true, stdio: 'inherit', env: { ...process.env, NODE_ENV: 'test', DATABASE_URL: url, DIRECT_URL: url,
        JWT_SECRET: 'workflow-rbac-disposable-test-only', ENCRYPTION_KEY: 'a'.repeat(64), BREVO_API_KEY: '', BREVO_SMS_SENDER: '' },
    });
    const code = await new Promise((done, reject) => { child.once('error', reject); child.once('exit', code => done(code ?? 1)); });
    if (code) process.exitCode = code;
    const previous = summary.findIndex(result => result.database === database);
    if (previous >= 0) summary.splice(previous, 1);
    summary.push({ database, files, exitCode: code });
    writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  }
} finally { await pg.stop(); }
