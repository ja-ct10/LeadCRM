import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync, readdirSync, existsSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { notificationTestPostgres } from './notification-test-postgres.mjs';
const require = createRequire(import.meta.url);
const { qaEnvironment } = require('../../scripts/qa-environment.cjs');
const root = resolve(import.meta.dirname, '../..');
const output = resolve(root, 'data/outputs/workflow-policy-tests');
mkdirSync(output, { recursive: true });
const directory = 'src/modules/automation/workflows/__tests__';
const requested = process.argv.slice(2);
const files = requested.length ? requested : readdirSync(resolve(root, 'backend', directory)).filter(file => file.endsWith('.integration.test.ts')).sort().map(file => `${directory}/${file}`);
if (!files.length || files.some(file => !new RegExp(`^${directory}/[a-z-]+\\.integration\\.test\\.ts$`).test(file))) throw new Error('Choose Workflow integration files from the supported test directory.');
const summary = { startedAt: new Date().toISOString(), suites: [], cleanup: 'pending', success: false };
const summaryPath = resolve(output, 'workflow-integration-summary.json');
writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
const pg = await notificationTestPostgres();
try {
  let index = 4;
  console.log(`Native PostgreSQL: ${pg.version}; durability ${JSON.stringify(pg.durability)}; ${files.length} suites`);
  for (const file of files) {
    const url = await pg.database(`leadcrm_workflow_test_${index++}`);
    const report = resolve(output, file.split('/').at(-1) + '.json');
    if (existsSync(report)) unlinkSync(report);
    const child = spawn(process.execPath, [resolve(root, 'node_modules/vitest/vitest.mjs'), 'run', file, '--maxWorkers=1', '--silent', '--reporter=dot', '--reporter=json', `--outputFile=${report}`], {
      cwd: resolve(root, 'backend'), windowsHide: true, stdio: 'inherit', env: qaEnvironment(root, { DATABASE_URL: url, DIRECT_URL: url }),
    });
    const code = await new Promise((done, fail) => { child.on('exit', code => done(code ?? 1)); child.on('error', fail); });
    const result = JSON.parse(readFileSync(report, 'utf8'));
    console.log(`${file}: ${result.numPassedTests} PASS / ${result.numFailedTests} FAIL / ${result.numPendingTests} SKIPPED`);
    for (const suite of result.testResults) for (const test of suite.assertionResults) if (test.status === 'failed') console.log(test.fullName, test.failureMessages.join('\n'));
    const success = code === 0 && result.success === true && result.numFailedTests === 0 && result.numPendingTests === 0 && result.numTodoTests === 0 && result.numPassedTests > 0 && result.numPassedTests === result.numTotalTests;
    summary.suites.push({ file, passed: result.numPassedTests, failed: result.numFailedTests, skipped: result.numPendingTests, success });
    writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    if (!success) process.exitCode = 1;
  }
} finally {
  try { pg.stop(); summary.cleanup = 'complete'; }
  finally {
    summary.success = summary.cleanup === 'complete' && summary.suites.length === files.length && summary.suites.every(suite => suite.success);
    summary.finishedAt = new Date().toISOString();
    writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    if (!summary.success) process.exitCode = 1;
  }
}
