import type { ImportModuleConfig, ValidatedRow } from '../types/import.types';

/**
 * Email validation regex — simple but effective.
 */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * URL validation — checks for a reasonable URL pattern.
 */
function isValidUrl(url: string): boolean {
  try {
    // Accept with or without protocol
    const withProtocol = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
    new URL(withProtocol);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate a single mapped row against the module's field definitions.
 *
 * Checks:
 * - Required fields are non-empty
 * - Email fields have valid format
 * - URL fields have valid format
 * - Select fields have allowed values (if options defined and value provided)
 *
 * @param config - The module import configuration
 * @param rowData - Record of field key → cell value
 * @param rowNumber - The original CSV row number (1-indexed, row 1 = header)
 * @returns ValidatedRow with data, validation status, and error messages
 */
export function validateRow(
  config: ImportModuleConfig,
  rowData: Record<string, string>,
  rowNumber: number,
): ValidatedRow {
  const errors: string[] = [];
  const allFields = [...config.requiredFields, ...config.optionalFields];

  for (const field of allFields) {
    const value = (rowData[field.key] || '').trim();

    // Required check
    if (field.required && !value) {
      errors.push(`${field.label} is required.`);
      continue;
    }

    // Skip further validation if value is empty (optional field)
    if (!value) continue;

    // Type-specific validation
    switch (field.type) {
      case 'email':
        if (!isValidEmail(value)) {
          errors.push(`Invalid email address.`);
        }
        break;
      case 'url':
        if (!isValidUrl(value)) {
          errors.push(`${field.label} must be a valid URL.`);
        }
        break;
      case 'select':
        if (field.options && field.options.length > 0) {
          const normalizedValue = value.toLowerCase();
          const validOptions = field.options.map((o) => o.toLowerCase());
          if (!validOptions.includes(normalizedValue)) {
            errors.push(`${field.label} must be one of: ${field.options.join(', ')}.`);
          }
        }
        break;
      // 'text' and 'phone' have no additional validation beyond required
    }
  }

  return {
    rowNumber,
    data: rowData,
    isValid: errors.length === 0,
    errors,
  };
}
