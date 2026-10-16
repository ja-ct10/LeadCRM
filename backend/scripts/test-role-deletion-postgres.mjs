import { notificationTestPostgres, runNotificationTestFile } from './notification-test-postgres.mjs';

// Reuse the native disposable fixture; concurrent lock tests require separate connections.
if (process.platform === 'win32') process.env.POSTGRES_TEST_BIN ??= 'C:/Program Files/PostgreSQL/17/bin';
const pg = await notificationTestPostgres();
try {
  const suites = [
    ['src/modules/administration/roles/__tests__/role-deletion.integration.test.ts', 'leadcrm_environment_test_1'],
    ['src/modules/administration/roles/__tests__/roles.integration.test.ts', 'leadcrm_environment_test_2'],
    ['src/modules/administration/roles/__tests__/custom-role-settings.integration.test.ts', 'leadcrm_environment_test_3'],
    ['src/modules/administration/archived-data/archive-date-page.integration.test.ts', 'leadcrm_polish_test'],
  ];
  const requested = process.argv.slice(2);
  const selected = suites.filter(([file]) => !requested.length || requested.includes(file) || requested.includes(file.split('/').at(-1)));
  if (!selected.length) throw new Error('Select a supported role deletion or archive acceptance suite.');
  for (const [file, database] of selected) {
    const code = await runNotificationTestFile(file, await pg.database(database));
    if (code) process.exitCode = code;
  }
} finally { pg.stop(); }
