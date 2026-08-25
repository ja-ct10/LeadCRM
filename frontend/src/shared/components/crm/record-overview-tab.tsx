'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ChevronDown,
  Pencil,
  Check,
  X,
  Calendar,
  Mail,
  Phone,
  Globe,
  Tag,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useHasPermission } from '@/shared/hooks/use-permissions';
import type { PermissionKey } from '@leadcrm/shared';

// ─── Types ───────────────────────────────────────────────────────────────────

export type FieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'email'
  | 'phone'
  | 'url'
  | 'select'
  | 'multiselect'
  | 'tags'
  | 'textarea';

export interface SelectOption {
  value: string;
  label: string;
}

export interface FieldConfig {
  /** Unique key matching the record property */
  key: string;
  /** Display label */
  label: string;
  /** Current value (string, number, or array) */
  value: unknown;
  /** Field type determines the edit control */
  type: FieldType;
  /** Whether this field can be edited inline */
  editable?: boolean;
  /** Options for select/multiselect fields */
  options?: SelectOption[];
  /** Async save handler — receives the new value */
  onSave?: (value: unknown) => Promise<void>;
  /** Icon to show beside the field */
  icon?: React.ComponentType<{ className?: string }>;
  /** Suffix text (e.g., currency symbol) */
  prefix?: string;
  /** Custom render for display value */
  renderValue?: (value: unknown) => React.ReactNode;
}

export interface FieldSection {
  /** Unique section ID */
  id: string;
  /** Section heading */
  title: string;
  /** Fields within this section */
  fields: FieldConfig[];
  /** Whether section starts collapsed */
  defaultCollapsed?: boolean;
}

export interface RecordOverviewTabProps {
  /** Field sections to render */
  sections: FieldSection[];
  /** Permission key for edit access (e.g., 'contacts.edit') */
  editPermission?: PermissionKey;
  /** Custom fields from the record (rendered as separate section) */
  customFields?: Record<string, string>;
  /** Callback to save custom field updates */
  onCustomFieldSave?: (fields: Record<string, string>) => Promise<void>;
}

// ─── Field Display Value ─────────────────────────────────────────────────────

function formatDisplayValue(value: unknown, type: FieldType): string {
  if (value === null || value === undefined || value === '') return 'Not set';

  switch (type) {
    case 'number':
      return typeof value === 'number' ? value.toLocaleString() : String(value);
    case 'date':
      if (!value) return 'Not set';
      try {
        return new Date(String(value)).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
      } catch {
        return String(value);
      }
    case 'tags':
    case 'multiselect':
      if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : 'Not set';
      return String(value);
    default:
      return String(value);
  }
}

function getFieldIcon(type: FieldType): React.ComponentType<{ className?: string }> | null {
  switch (type) {
    case 'email': return Mail;
    case 'phone': return Phone;
    case 'url': return Globe;
    case 'date': return Calendar;
    case 'tags': return Tag;
    default: return null;
  }
}

// ─── Inline Edit Field ───────────────────────────────────────────────────────

interface InlineEditFieldProps {
  field: FieldConfig;
  canEdit: boolean;
}

function InlineEditField({ field, canEdit }: InlineEditFieldProps): React.ReactElement {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null);

  const isEditable = canEdit && field.editable !== false && !!field.onSave;

  const startEdit = useCallback((): void => {
    if (!isEditable) return;
    const currentValue = field.value;
    if (Array.isArray(currentValue)) {
      setEditValue(currentValue.join(', '));
    } else {
      setEditValue(currentValue?.toString() ?? '');
    }
    setIsEditing(true);
  }, [isEditable, field.value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleSave = async (): Promise<void> => {
    if (!field.onSave) return;
    setIsSaving(true);
    try {
      let saveValue: unknown = editValue;
      if (field.type === 'number') {
        saveValue = parseFloat(editValue) || 0;
      } else if (field.type === 'tags' || field.type === 'multiselect') {
        saveValue = editValue.split(',').map((s) => s.trim()).filter(Boolean);
      }
      await field.onSave(saveValue);
      setIsEditing(false);
    } catch {
      toast.error(`Failed to update ${field.label.toLowerCase()}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = (): void => {
    setIsEditing(false);
    setEditValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' && field.type !== 'textarea') {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      handleCancel();
    }
  };

  // ── Display mode ────────────────────────────────────────────────────────
  if (!isEditing) {
    const FieldIcon = field.icon ?? getFieldIcon(field.type);
    const displayValue = field.renderValue
      ? field.renderValue(field.value)
      : formatDisplayValue(field.value, field.type);
    const isEmpty = !field.value || (Array.isArray(field.value) && field.value.length === 0) || field.value === '';

    return (
      <div
        className={cn(
          'group grid grid-cols-[140px_minmax(0,1fr)] items-start gap-3 px-4 py-2.5 rounded-md transition-colors',
          isEditable && 'cursor-pointer hover:bg-accent/50'
        )}
        onClick={isEditable ? startEdit : undefined}
        role={isEditable ? 'button' : undefined}
        tabIndex={isEditable ? 0 : undefined}
        onKeyDown={isEditable ? (e) => { if (e.key === 'Enter' || e.key === ' ') startEdit(); } : undefined}
        aria-label={isEditable ? `Edit ${field.label}` : undefined}
      >
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-0.5 flex items-center gap-1.5">
          {FieldIcon && <FieldIcon className="h-3.5 w-3.5 shrink-0" />}
          {field.label}
        </span>
        <div className="flex items-center gap-2 min-w-0">
          {field.prefix && <span className="text-sm text-muted-foreground">{field.prefix}</span>}
          <span className={cn(
            'text-sm truncate',
            isEmpty ? 'text-muted-foreground italic' : 'text-foreground'
          )}>
            {typeof displayValue === 'string' ? displayValue : displayValue}
          </span>
          {isEditable && (
            <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground ml-auto shrink-0" />
          )}
        </div>
      </div>
    );
  }

  // ── Edit mode ───────────────────────────────────────────────────────────
  const inputClasses = 'w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:opacity-50';

  return (
    <div className="grid grid-cols-[140px_minmax(0,1fr)] items-start gap-3 px-4 py-2">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-2">
        {field.label}
      </span>
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          {field.type === 'select' ? (
            <select
              ref={inputRef as React.RefObject<HTMLSelectElement>}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleSave}
              className={cn(inputClasses, 'appearance-none cursor-pointer pr-8')}
              disabled={isSaving}
            >
              <option value="">Select...</option>
              {field.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          ) : field.type === 'textarea' ? (
            <textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className={cn(inputClasses, 'min-h-[60px] resize-none')}
              disabled={isSaving}
              rows={3}
            />
          ) : (
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleSave}
              className={inputClasses}
              disabled={isSaving}
              placeholder={field.label}
            />
          )}
        </div>
        {field.type === 'textarea' && (
          <div className="flex flex-col gap-1 shrink-0">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="h-7 w-7 rounded-md bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-50"
              aria-label="Save"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="h-7 w-7 rounded-md border border-border flex items-center justify-center hover:bg-accent transition-colors"
              aria-label="Cancel"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Collapsible Section ─────────────────────────────────────────────────────

interface CollapsibleSectionProps {
  section: FieldSection;
  canEdit: boolean;
}

function CollapsibleSection({ section, canEdit }: CollapsibleSectionProps): React.ReactElement {
  const [isCollapsed, setIsCollapsed] = useState(section.defaultCollapsed ?? false);

  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-foreground hover:bg-accent/30 transition-colors"
        aria-expanded={!isCollapsed}
      >
        <span>{section.title}</span>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-muted-foreground transition-transform duration-200',
            isCollapsed && '-rotate-90'
          )}
        />
      </button>
      {!isCollapsed && (
        <div className="divide-y divide-border/50 pb-1">
          {section.fields.map((field) => (
            <InlineEditField key={field.key} field={field} canEdit={canEdit} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Custom Fields Section ───────────────────────────────────────────────────

interface CustomFieldsSectionProps {
  fields: Record<string, string>;
  canEdit: boolean;
  onSave?: (fields: Record<string, string>) => Promise<void>;
}

function CustomFieldsDisplay({ fields, canEdit, onSave }: CustomFieldsSectionProps): React.ReactElement | null {
  const entries = Object.entries(fields);
  if (entries.length === 0) return null;

  const fieldConfigs: FieldConfig[] = entries.map(([key, value]) => ({
    key: `custom-${key}`,
    label: key,
    value,
    type: 'text' as FieldType,
    editable: canEdit,
    onSave: onSave
      ? async (newValue) => {
          await onSave({ ...fields, [key]: String(newValue) });
        }
      : undefined,
  }));

  const section: FieldSection = {
    id: 'custom-fields',
    title: 'Custom Fields',
    fields: fieldConfigs,
  };

  return <CollapsibleSection section={section} canEdit={canEdit} />;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function RecordOverviewTab({
  sections,
  editPermission,
  customFields,
  onCustomFieldSave,
}: RecordOverviewTabProps): React.ReactElement {
  const canEdit = useHasPermission(editPermission ?? 'contacts.edit' as PermissionKey);

  return (
    <div className="p-6 space-y-4 max-w-4xl">
      {/* Main field sections */}
      {sections.map((section) => (
        <CollapsibleSection key={section.id} section={section} canEdit={canEdit} />
      ))}

      {/* Custom fields (if any) */}
      {customFields && Object.keys(customFields).length > 0 && (
        <CustomFieldsDisplay
          fields={customFields}
          canEdit={canEdit}
          onSave={onCustomFieldSave}
        />
      )}
    </div>
  );
}
