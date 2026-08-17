'use client';

import React from 'react';
import { EntityCombobox } from '@/shared/components/entity-combobox';
import { cn } from '@/lib/utils';

// ─── Types ─────────────────────────────────────────────────────────────────

interface DealContactsFieldProps {
  /** Currently selected Contact IDs (UUIDs) */
  values: string[];
  /** Callback when contact selection changes — receives array of contactIds */
  onChange: (contactIds: string[]) => void;
  /** Field-level error message from form validation */
  error?: string;
  /** Disabled state (e.g. insufficient RBAC, loading) */
  disabled?: boolean;
  /** Optional className for the wrapper */
  className?: string;
}

// ─── Component ─────────────────────────────────────────────────────────────

/**
 * Contact multi-select field for the Deal Create/Edit form.
 *
 * - Searches and displays contacts with firstName + lastName + email
 * - Multi-select mode with removable chips for selected contacts
 * - Stores `contactIds[]` (UUIDs) for form submission — never display names
 * - The X button on each chip removes that contact without confirmation
 *
 * @validates Requirements 11.2, 11.5
 */
export function DealContactsField({
  values,
  onChange,
  error,
  disabled = false,
  className,
}: DealContactsFieldProps): React.ReactElement {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
        Contacts
      </label>
      <EntityCombobox
        entityType="contacts"
        multiple={true}
        values={values}
        onMultiChange={onChange}
        placeholder="Search contacts..."
        minSearchChars={2}
        debounceMs={300}
        error={error}
        disabled={disabled}
      />
      {!error && (
        <p className="text-xs text-slate-400 dark:text-slate-500">
          Associate one or more contacts with this deal (optional)
        </p>
      )}
    </div>
  );
}

export default DealContactsField;
