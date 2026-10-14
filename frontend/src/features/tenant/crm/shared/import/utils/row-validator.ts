import { importRowSchemas, normalizeAccountImportRow } from '@leadcrm/shared';
import type { ImportModuleConfig, ValidatedRow } from '../types/import.types';
/** Same field contract as the API; relationship and duplicate checks run on the server. */
export function validateRow(config: ImportModuleConfig, rowData: Record<string, string>, rowNumber: number): ValidatedRow {
  const parsed = importRowSchemas[config.moduleKey].safeParse(rowData);
  return { rowNumber, data: parsed.success ? (config.moduleKey === 'accounts' ? normalizeAccountImportRow(parsed.data) : parsed.data) : rowData, isValid: parsed.success,
    errors: parsed.success ? [] : parsed.error.issues.map(issue => issue.path.join('.') + ': ' + issue.message) };
}
