'use client';

import React from 'react';
import { EntityCombobox } from '@/shared/components/entity-combobox';
import { cn } from '@/lib/utils';

// ─── Types ─────────────────────────────────────────────────────────────────

interface DealLeadsFieldProps {
  /** Currently selected Lead IDs (UUIDs) */
  values: string[];
  /** Callback when lead selection changes — receives array of leadIds */
  onChange: (leadIds: string[]) => void;
  /** Field-level error message from form validation */
  error?: string;
  /** Disabled state (e.g. insufficient RBAC, loading) */
  disabled?: boolean;
  /** Optional className for the wrapper */
  className?: string;
}

// ─── Component ─────────────────────────────────────────────────────────────

/**
 * Lead multi-select field for the Deal Create/Edit form.
 *
 * - Searches and displays leads with firstName + lastName + email/company
 * - Multi-select mode with removable chips for selected leads
 * - Stores `leadIds[]` (UUIDs) for form submission — never display names
 * - The X button on each chip removes that lead without confirmation
 */
export function DealLeadsField({
  values,
  onChange,
  error,
  disabled = false,
  className,
}: DealLeadsFieldProps): React.ReactElement {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
        Leads
      </label>
      <EntityCombobox
        entityType="leads"
        multiple={true}
        values={values}
        onMultiChange={onChange}
        placeholder="Search leads..."
        minSearchChars={2}
        debounceMs={300}
        error={error}
        disabled={disabled}
      />
      {!error && (
        <p className="text-xs text-slate-400 dark:text-slate-500">
          Associate one or more leads with this deal (optional)
        </p>
      )}
    </div>
  );
}

export default DealLeadsField;
