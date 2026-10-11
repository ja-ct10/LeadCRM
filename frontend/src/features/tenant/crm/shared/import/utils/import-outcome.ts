import type { ImportReviewRow } from '@leadcrm/shared';
import type { ImportSummary } from '../types/import.types';

export type ImportNotice = { type: 'success' | 'warning' | 'error'; title: string; description: string };
export type ReviewSummary = { total: number; valid: number; duplicate: number; invalid: number };
const count = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function summarizeReview(rows: ImportReviewRow[], expectedRows: number[]): ReviewSummary {
  if (!expectedRows.length || rows.length !== expectedRows.length || rows.some((row, index) =>
    row.rowNumber !== expectedRows[index] || !['valid', 'duplicate', 'invalid'].includes(row.status) ||
    row.isValid !== (row.status === 'valid'))) {
    throw new Error('Review is incomplete. Please validate every row before importing.');
  }
  return { total: rows.length, valid: rows.filter(r => r.status === 'valid').length,
    duplicate: rows.filter(r => r.status === 'duplicate').length, invalid: rows.filter(r => r.status === 'invalid').length };
}

export function zeroEligibleNotice(summary: ReviewSummary): ImportNotice {
  const { total, duplicate, invalid } = summary;
  if (invalid === total) return { type: 'error', title: 'Import Failed',
    description: `All ${count(total, 'row')} contain${total === 1 ? 's' : ''} invalid data. Please correct the errors in the Review step before importing.` };
  if (duplicate === total) return { type: 'error', title: 'No Records Imported',
    description: `All ${count(total, 'record')} ${total === 1 ? 'is a duplicate' : 'are duplicates'}. No new records were imported.` };
  return { type: 'error', title: 'No Records Imported',
    description: `No eligible records to import. ${count(duplicate, 'duplicate')} and ${count(invalid, 'invalid row')} were found.` };
}

/** A terminal status alone does not prove that every row has committed. */
export function finalImportNotice(result: ImportSummary): ImportNotice | null {
  const { totalRecords: total, successfulRecords: imported, duplicateRecords: duplicate, failedRecords: failed } = result;
  if (!result.completedAt || ![total, imported, duplicate, failed].every(n => Number.isInteger(n) && n >= 0) ||
    total === 0 || total !== imported + duplicate + failed) return null;
  if (result.status === 'completed' && imported === total) return { type: 'success', title: 'Import Succeeded',
    description: `All ${count(total, 'record')} ${total === 1 ? 'was' : 'were'} imported successfully.` };
  if (result.status === 'completed_with_errors' && imported > 0 && duplicate + failed > 0) return {
    type: 'warning', title: 'Import Partially Succeeded',
    description: `${count(imported, 'record')} imported, ${count(duplicate, 'duplicate')} skipped, and ${count(failed, 'record')} failed.`,
  };
  if (result.status === 'failed' && imported === 0) return zeroEligibleNotice({ total, valid: 0, duplicate, invalid: failed });
  return null;
}

export const importStatusLabel = (status: ImportSummary['status']) => ({ pending: 'Pending', importing: 'Importing',
  completed: 'Succeeded', completed_with_errors: 'Partially Succeeded', failed: 'Failed' })[status];
