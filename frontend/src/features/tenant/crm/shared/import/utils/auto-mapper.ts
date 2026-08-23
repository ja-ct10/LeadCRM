import type { ImportModuleConfig, CsvColumn, ColumnMapping } from '../types/import.types';

/**
 * Automatically map CSV columns to CRM fields based on pattern matching.
 *
 * For each field (required first, then optional), attempts to find a matching
 * CSV column using the field's autoMapPatterns array. Matching is case-insensitive.
 * Each CSV column is only mapped once (first match wins).
 *
 * @returns A Record keyed by field key with the mapping result.
 */
export function autoMapColumns(
  config: ImportModuleConfig,
  csvColumns: CsvColumn[],
): Record<string, ColumnMapping> {
  const allFields = [...config.requiredFields, ...config.optionalFields];

  const mappings: Record<string, ColumnMapping> = {};
  for (const field of allFields) {
    mappings[field.key] = { csvColumnIndex: null, csvColumnName: null };
  }

  const used = new Set<number>();

  // Process required fields first to give them priority
  for (const field of allFields) {
    const patterns = field.autoMapPatterns;
    for (const col of csvColumns) {
      if (used.has(col.index)) continue;
      const normalized = col.name.toLowerCase().trim();
      if (patterns.includes(normalized)) {
        mappings[field.key] = { csvColumnIndex: col.index, csvColumnName: col.name };
        used.add(col.index);
        break;
      }
    }
  }

  return mappings;
}

/**
 * Build an initial empty mapping record for all fields in a config.
 */
export function createEmptyMappings(config: ImportModuleConfig): Record<string, ColumnMapping> {
  const allFields = [...config.requiredFields, ...config.optionalFields];
  const mappings: Record<string, ColumnMapping> = {};
  for (const field of allFields) {
    mappings[field.key] = { csvColumnIndex: null, csvColumnName: null };
  }
  return mappings;
}
