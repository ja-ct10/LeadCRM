'use client';

import React from 'react';
import { EntityCombobox } from '@/shared/components/entity-combobox';
import { cn } from '@/lib/utils';

// ─── Types ─────────────────────────────────────────────────────────────────

interface DealAccountFieldProps {
  /** Currently selected Account ID (UUID) — null means no account */
  value: string | null;
  /** Callback when account selection changes — receives accountId or null */
  onChange: (accountId: string | null) => void;
  /** Field-level error message from form validation */
  error?: string;
  /** Disabled state (e.g. insufficient RBAC, loading) */
  disabled?: boolean;
  /** Optional className for the wrapper */
  className?: string;
}

// ─── Component ─────────────────────────────────────────────────────────────

/**
 * Account combobox field for the Deal Create/Edit form.
 *
 * - Searches and displays the tenant's accounts (organizations)
 * - Stores `accountId` (UUID) for form submission — never the display name
 * - Single-select: at most one Account per deal
 * - The X button removes the selection without confirmation
 *
 * @validates Requirements 11.1, 11.4, 11.7
 */
export function DealAccountField({
  value,
  onChange,
  error,
  disabled = false,
  className,
}: DealAccountFieldProps): React.ReactElement {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
        Account
      </label>
      <EntityCombobox
        entityType="accounts"
        multiple={false}
        value={value}
        onChange={onChange}
        placeholder="Search accounts..."
        minSearchChars={2}
        debounceMs={300}
        error={error}
        disabled={disabled}
      />
      {!error && (
        <p className="text-xs text-slate-400 dark:text-slate-500">
          Link this deal to an existing account (optional)
        </p>
      )}
    </div>
  );
}

export default DealAccountField;
