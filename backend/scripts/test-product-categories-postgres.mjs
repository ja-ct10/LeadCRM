import { notificationTestPostgres, runNotificationTestFile } from './notification-test-postgres.mjs';

// The existing fixture owns its random-port cluster and never uses application .env.
if (process.platform === 'win32') process.env.POSTGRES_TEST_BIN ??= 'C:/Program Files/PostgreSQL/17/bin';
const pg = await notificationTestPostgres();
try {
  process.exitCode = await runNotificationTestFile(
    'src/modules/administration/product-interests/product-categories.integration.test.ts',
    await pg.database('leadcrm_product_categories_test_1'),
  );
} finally { pg.stop(); }
