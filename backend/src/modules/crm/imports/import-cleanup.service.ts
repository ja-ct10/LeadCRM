import prisma from '../../../config/database.config';
import { tenantContext } from '../../../core/tenant/tenant-context';

/** Upload deletion cascades chunks; job history survives with uploadId = null. */
export async function purgeExpiredImportUploads(now = new Date()) {
  return tenantContext.exit(async () => {
    const result = await prisma.crmImportUpload.deleteMany({ where: { expiresAt: { lte: now } } });
    return result.count;
  });
}

export function startImportCleanupScheduler() {
  let pending: Promise<void> | undefined;
  let stopping = false;
  const purge = async () => {
    if (stopping || pending) return;
    try { await purgeExpiredImportUploads(); }
    catch { console.error('[crm-import-cleanup] Cleanup failed; retrying at the next interval.'); }
  };
  const tick = () => { if (!stopping && !pending) pending = purge().finally(() => { pending = undefined; }); };
  tick();
  const timer = setInterval(tick, 60 * 60 * 1000);
  timer.unref();
  return async () => { stopping = true; clearInterval(timer); await pending; };
}
