/**
 * Philippine mobile phone utilities — shared across Lead and Contact forms.
 * All functions are pure with no side effects.
 */

/**
 * Normalizes raw phone input to a bare 10-digit local number.
 * Handles:
 *   +639xxxxxxxxx  → 9xxxxxxxxx
 *   09xxxxxxxxx    → 9xxxxxxxxx
 *   912 345 6789   → 9123456789
 *   912-345-6789   → 9123456789
 *   (912)3456789   → 9123456789
 * Returns at most 10 characters.
 */
export function normalizePhInput(raw: string): string {
  // Strip all non-digit characters first
  let digits = raw.replace(/\D/g, '');

  // Handle +639... (after stripping + becomes 639...)
  if (digits.startsWith('639') && digits.length >= 12) {
    digits = digits.slice(2); // remove '63'
  } else if (digits.startsWith('63') && digits.length >= 11) {
    digits = digits.slice(2); // remove '63'
  }

  // Handle leading zero (09...)
  if (digits.startsWith('0') && digits.length > 1) {
    digits = digits.slice(1);
  }

  // Cap at 10 digits
  return digits.slice(0, 10);
}

/**
 * Converts a 10-digit local PH mobile number to E.164 format.
 * Input:  '9123456789'
 * Output: '+639123456789'
 */
export function toE164(localNumber: string): string {
  return `+63${localNumber}`;
}

/**
 * Validates a 10-digit local PH mobile number.
 * Returns an error message string, or null if valid (or empty/optional).
 */
export function validatePhMobile(value: string): string | null {
  if (!value || value.length === 0) return null; // optional field — no error when empty
  if (value[0] !== '9') return 'Philippine mobile number must start with 9.';
  if (value.length < 10) return 'Phone number must contain exactly 10 digits.';
  return null; // valid
}
