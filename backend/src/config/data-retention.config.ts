import { z } from 'zod';

/** Proposed organizational targets only; no scheduler or deletion is enabled. */
export function readDataRetentionPolicy(env: NodeJS.ProcessEnv = process.env) {
  const days = (key: string) => {
    if (!env[key]?.trim()) return null;
    const result = z.coerce.number().int().positive().safeParse(env[key]);
    if (!result.success) throw new Error(`${key} must be a positive integer or remain unset pending organizational approval.`);
    return result.data;
  };
  return { mailboxHistoryDays: days('MAILBOX_HISTORY_RETENTION_DAYS'), backupDays: days('BACKUP_RETENTION_DAYS'), automaticDeletionEnabled: false as const };
}
