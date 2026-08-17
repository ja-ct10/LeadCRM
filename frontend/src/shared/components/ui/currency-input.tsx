'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

/**
 * CurrencyInput — shared numeric input for monetary values.
 *
 * - Accepts values from 0.00 to 999,999,999.99
 * - Enforces exactly 2 decimal places on blur
 * - Displays tenant's configured currency symbol as prefix
 * - Rejects non-numeric input characters (except decimal point)
 * - Supports dark mode
 *
 * Validates: Requirements 10.5
 */

interface CurrencyInputProps {
  /** Current value as a number (e.g. 1234.56) or undefined/null */
  value: number | undefined | null;
  /** Change handler — receives the numeric value or undefined if cleared */
  onChange: (value: number | undefined) => void;
  /** Currency symbol prefix (default: "₱") */
  currencySymbol?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Error state */
  error?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Field name for accessibility */
  name?: string;
  /** aria-describedby for linking to error messages */
  'aria-describedby'?: string;
  /** aria-required */
  'aria-required'?: boolean;
  /** Additional className */
  className?: string;
  /** onBlur callback (in addition to internal formatting) */
  onBlur?: () => void;
}

const MIN_VALUE = 0;
const MAX_VALUE = 999_999_999.99;

/**
 * Formats a number to display with 2 decimal places and thousand separators.
 */
function formatCurrencyDisplay(value: number | undefined | null): string {
  if (value === undefined || value === null) return '';
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Parses a display string back to a number, stripping commas and non-numeric chars.
 */
function parseInputValue(raw: string): number | undefined {
  // Remove commas and whitespace
  const cleaned = raw.replace(/[,\s]/g, '');
  if (cleaned === '' || cleaned === '.') return undefined;
  const num = parseFloat(cleaned);
  if (isNaN(num)) return undefined;
  return num;
}

/**
 * Validates that a character is allowed in currency input.
 * Allowed: digits (0-9), decimal point (.), backspace, delete, arrows, tab
 */
function isAllowedKey(event: React.KeyboardEvent<HTMLInputElement>): boolean {
  // Always allow control keys
  if (
    event.key === 'Backspace' ||
    event.key === 'Delete' ||
    event.key === 'Tab' ||
    event.key === 'Escape' ||
    event.key === 'Enter' ||
    event.key === 'ArrowLeft' ||
    event.key === 'ArrowRight' ||
    event.key === 'Home' ||
    event.key === 'End'
  ) {
    return true;
  }

  // Allow Ctrl/Cmd+A, C, V, X
  if (event.ctrlKey || event.metaKey) {
    return true;
  }

  // Allow digits
  if (/^\d$/.test(event.key)) {
    return true;
  }

  // Allow single decimal point
  if (event.key === '.') {
    const currentValue = (event.target as HTMLInputElement).value;
    // Only allow if there isn't already a decimal point
    if (!currentValue.includes('.')) {
      return true;
    }
    return false;
  }

  return false;
}

export function CurrencyInput({
  value,
  onChange,
  currencySymbol = '₱',
  placeholder = '0.00',
  error = false,
  disabled = false,
  name,
  'aria-describedby': ariaDescribedBy,
  'aria-required': ariaRequired,
  className,
  onBlur,
}: CurrencyInputProps): React.ReactElement {
  const [displayValue, setDisplayValue] = useState<string>(() => formatCurrencyDisplay(value));
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastExternalValueRef = useRef(value);

  // Sync display when external value changes (from parent re-render) and input is not focused
  useEffect(() => {
    if (!isFocused && value !== lastExternalValueRef.current) {
      setDisplayValue(formatCurrencyDisplay(value));
    }
    lastExternalValueRef.current = value;
  }, [value, isFocused]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isAllowedKey(event)) {
      event.preventDefault();
    }
  }, []);

  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;

    // Strip non-numeric except decimal point and comma (for paste)
    const cleaned = raw.replace(/[^0-9.]/g, '');

    // Prevent more than one decimal point
    const parts = cleaned.split('.');
    let sanitized = parts[0];
    if (parts.length > 1) {
      // Limit to 2 decimal places during typing
      sanitized += '.' + parts[1].slice(0, 2);
    }

    setDisplayValue(sanitized);

    // Parse and validate
    const numericValue = parseInputValue(sanitized);
    if (numericValue === undefined) {
      onChange(undefined);
    } else if (numericValue >= MIN_VALUE && numericValue <= MAX_VALUE) {
      onChange(numericValue);
    }
    // If out of range, don't update the parent but keep the display for user to correct
  }, [onChange]);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    // On focus, show raw number without thousand separators for easier editing
    if (value !== undefined && value !== null) {
      setDisplayValue(value.toFixed(2));
    }
  }, [value]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);

    // Parse current display value
    const numericValue = parseInputValue(displayValue);

    if (numericValue === undefined) {
      setDisplayValue('');
      onChange(undefined);
    } else {
      // Clamp to valid range
      const clamped = Math.min(Math.max(numericValue, MIN_VALUE), MAX_VALUE);
      // Round to 2 decimal places
      const rounded = Math.round(clamped * 100) / 100;
      onChange(rounded);
      setDisplayValue(formatCurrencyDisplay(rounded));
    }

    // Call external onBlur for react-hook-form integration
    onBlur?.();
  }, [displayValue, onChange, onBlur]);

  // Handle paste — strip non-numeric characters
  const handlePaste = useCallback((event: React.ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData('text');
    const cleaned = pasted.replace(/[^0-9.]/g, '');

    // Limit to 2 decimal places
    const parts = cleaned.split('.');
    let sanitized = parts[0];
    if (parts.length > 1) {
      sanitized += '.' + parts[1].slice(0, 2);
    }

    setDisplayValue(sanitized);
    const numericValue = parseInputValue(sanitized);
    if (numericValue !== undefined && numericValue >= MIN_VALUE && numericValue <= MAX_VALUE) {
      onChange(numericValue);
    }
  }, [onChange]);

  return (
    <div
      className={cn(
        'flex items-center w-full rounded-xl border transition-all',
        'bg-white dark:bg-white/[0.04]',
        error
          ? 'border-red-500 focus-within:ring-2 focus-within:ring-red-500/20'
          : 'border-gray-200 dark:border-white/[0.08] focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500',
        disabled && 'opacity-50 cursor-not-allowed',
        className,
      )}
    >
      {/* Currency prefix */}
      <span
        className={cn(
          'flex items-center justify-center shrink-0 px-3 py-2.5 text-sm font-medium',
          'border-r border-gray-200 dark:border-white/[0.08]',
          'bg-slate-50 dark:bg-white/[0.03] text-slate-500 dark:text-slate-400',
          'rounded-l-xl select-none',
        )}
      >
        {currencySymbol}
      </span>

      {/* Numeric input */}
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        name={name}
        data-field-name={name}
        value={displayValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onPaste={handlePaste}
        placeholder={placeholder}
        disabled={disabled}
        aria-describedby={ariaDescribedBy}
        aria-required={ariaRequired}
        aria-invalid={error}
        className={cn(
          'flex-1 px-3.5 py-2.5 text-sm text-right',
          'bg-transparent border-none outline-none',
          'text-slate-900 dark:text-white placeholder-slate-400',
          'min-w-0',
          disabled && 'cursor-not-allowed',
        )}
      />
    </div>
  );
}

export default CurrencyInput;
