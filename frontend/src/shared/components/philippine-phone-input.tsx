'use client';

import React, { useRef, useId } from 'react';
import { cn } from '@/lib/utils';
import { normalizePhInput } from '@/shared/utils/ph-phone';

interface PhilippinePhoneInputProps {
  id?: string;
  required?: boolean;
  disabled?: boolean;
  onBlur?: () => void;
  value: string;
  onChange: (localNumber: string) => void;
  error?: string | null;
  className?: string;
}

export function PhilippinePhoneInput({
  id, required, disabled, onBlur,
  value,
  onChange,
  error,
  className,
}: PhilippinePhoneInputProps): React.ReactElement {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    const allowedKeys = [
      'Backspace', 'Delete', 'Tab',
      'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
    ];
    const isDigit = /^[0-9]$/.test(e.key);

    if (!isDigit && !allowedKeys.includes(e.key) && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      return;
    }

    // Block additional digits once 10 digits reached
    if (isDigit && value.length >= 10 && e.currentTarget.selectionStart === e.currentTarget.selectionEnd) {
      e.preventDefault();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const normalized = normalizePhInput(e.target.value);
    onChange(normalized);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>): void => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text');
    const normalized = normalizePhInput(pasted);
    onChange(normalized);
  };

  return (
    <div className={cn('space-y-1', className)}>
      <div
        className={cn(
          'flex bg-white dark:bg-white/[0.04] border rounded-xl overflow-hidden text-sm transition-all',
          'focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500',
          error
            ? 'border-red-500 focus-within:ring-red-500/20 focus-within:border-red-500'
            : 'border-gray-200 dark:border-white/[0.08]',
        )}
      >
        {/* Fixed PH (+63) prefix — not interactive */}
        <div className="flex items-center px-3 py-2.5 bg-slate-50 dark:bg-white/[0.03] border-r border-gray-200 dark:border-white/[0.08] shrink-0 select-none">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
            PH (+63)
          </span>
        </div>

        {/* Local number input */}
        <input
          ref={inputRef}
          id={inputId}
          required={required}
          disabled={disabled}
          onBlur={onBlur}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : undefined}
          type="tel"
          inputMode="numeric"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="9xxxxxxxxx"
          maxLength={10}
          className="flex-1 min-w-0 px-3 py-2.5 bg-transparent border-none outline-none focus:ring-0 placeholder:text-slate-400 text-slate-900 dark:text-white text-sm"
        />
      </div>

      {error && (
        <p id={`${inputId}-error`} role="alert" className="text-xs text-red-500 mt-1">{error}</p>
      )}
    </div>
  );
}
