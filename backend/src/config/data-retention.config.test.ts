import { expect, it } from 'vitest';
import { readDataRetentionPolicy } from './data-retention.config';
it('leaves history and backup periods pending and automatic deletion disabled by default', () => {
  expect(readDataRetentionPolicy({})).toEqual({ mailboxHistoryDays: null, backupDays: null, automaticDeletionEnabled: false });
});
it('accepts proposed configurable periods without enabling automatic deletion', () => {
  expect(readDataRetentionPolicy({ MAILBOX_HISTORY_RETENTION_DAYS: '30', BACKUP_RETENTION_DAYS: '7' })).toEqual({ mailboxHistoryDays: 30, backupDays: 7, automaticDeletionEnabled: false });
});
it.each(['0', '-1', '1.5', 'invalid'])('rejects an invalid proposed retention period: %s', value => {
  expect(() => readDataRetentionPolicy({ MAILBOX_HISTORY_RETENTION_DAYS: value })).toThrow('MAILBOX_HISTORY_RETENTION_DAYS');
});
