import 'dotenv/config';
import prisma from '../../config/database.config';
import { startNotificationScheduler } from './notification-events.service';
import { validateEnvironment } from '../../config/validate-env';
import { installCrmRetirementMaintenance } from '../../core/maintenance/crm-retirement-maintenance';

// Dedicated worker entrypoint; the web process can disable its own worker.
validateEnvironment();
let stop: (() => Promise<void>) | undefined;
const maintenance = installCrmRetirementMaintenance({
  start: () => { stop = startNotificationScheduler(); },
  stop: async () => { await stop?.(); stop = undefined; },
  runtimeReadOnly: async () => {
    const [row] = await prisma.$queryRawUnsafe<Array<{readonly:string}>>("SELECT current_setting('transaction_read_only') AS readonly");
    return row.readonly === 'on';
  },
});
void maintenance.start();
const keepAlive = setInterval(() => {}, 60000);
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.once(signal, () => {
  clearInterval(keepAlive);
  void maintenance.stop().finally(() => prisma.$disconnect());
});
