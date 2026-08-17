'use client';

import React from 'react';
import { DatePicker } from './date-time-picker';

/**
 * DatePickerUTC — wrapper around DatePicker that stores ISO 8601 UTC strings.
 *
 * - Displays date in the tenant's local timezone (browser default)
 * - Stores/returns value as ISO 8601 UTC string (e.g. "2025-01-15T00:00:00.000Z")
 * - Accepts ISO 8601 UTC string or YYYY-MM-DD date string as value
 *
 * Validates: Requirements 10.4 (date picker: display in tenant timezone, store ISO 8601 UTC)
 */

interface DatePickerUTCProps {
  /** Current value as ISO 8601 UTC string (e.g. "2025-01-15T00:00:00.000Z") or empty string */
  value: string;
  /** Change handler — receives ISO 8601 UTC string */
  onChange: (isoUtcDate: string) => void;
  /** Minimum selectable date (YYYY-MM-DD format) */
  minDate?: string;
  /** Placeholder text */
  placeholder?: string;
  /** HTML id for accessibility */
  id?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Error state */
  error?: boolean;
  /** Field name for form integration */
  name?: string;
  /** onBlur callback for react-hook-form integration */
  onBlur?: () => void;
}

/**
 * Converts an ISO 8601 UTC string to a local YYYY-MM-DD string for display.
 * E.g., "2025-01-15T16:00:00.000Z" → "2025-01-15" (in UTC+8 timezone would be "2025-01-16")
 */
function isoUtcToLocalDate(isoUtc: string): string {
  if (!isoUtc) return '';
  try {
    const date = new Date(isoUtc);
    if (isNaN(date.getTime())) return '';
    // Format as local date YYYY-MM-DD
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return '';
  }
}

/**
 * Converts a local YYYY-MM-DD string to an ISO 8601 UTC string for storage.
 * E.g., "2025-01-15" → "2025-01-15T00:00:00.000Z" (midnight UTC on that local date)
 */
function localDateToIsoUtc(localDate: string): string {
  if (!localDate) return '';
  try {
    // Parse as local date components
    const [year, month, day] = localDate.split('-').map(Number);
    // Create date at noon local time to avoid timezone edge cases, then store as start of day UTC
    const date = new Date(year, month - 1, day, 12, 0, 0);
    if (isNaN(date.getTime())) return '';
    // Store as ISO UTC string (midnight UTC for the selected local date)
    const utcDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    return utcDate.toISOString();
  } catch {
    return '';
  }
}

export function DatePickerUTC({
  value,
  onChange,
  minDate,
  placeholder = 'Select date',
  id,
  disabled,
  name,
  onBlur,
}: DatePickerUTCProps): React.ReactElement {
  // Convert stored ISO UTC to local display date
  const displayDate = isoUtcToLocalDate(value);

  const handleChange = (localDate: string): void => {
    // Convert local date back to ISO UTC for storage
    const isoUtc = localDateToIsoUtc(localDate);
    onChange(isoUtc);
    // Trigger onBlur for form validation
    onBlur?.();
  };

  return (
    <div data-field-name={name}>
      <DatePicker
        value={displayDate}
        onChange={handleChange}
        minDate={minDate}
        placeholder={placeholder}
        id={id}
      />
    </div>
  );
}

export default DatePickerUTC;
