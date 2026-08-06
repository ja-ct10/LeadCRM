import { seedSystemAdmin } from './admin.seed';

async function main(): Promise<void> {
  console.log('[Seed] Running production seed...');
  await seedSystemAdmin();
  console.log('[Seed] Done.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[Seed] Failed:', err);
  process.exit(1);
});
