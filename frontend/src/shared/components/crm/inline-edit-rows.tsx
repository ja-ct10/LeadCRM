'use client';
import React, { useEffect, useState } from 'react';
import { Loader2, Pencil } from 'lucide-react';
import { CrmEmailSchema } from '@leadcrm/shared';
import { cn } from '@/lib/utils';
import { CatalogProductInterestSelect } from './product-interest-select';
import { EntityCombobox } from '@/shared/components/entity-combobox';
const displayText = (value: unknown): string => Array.isArray(value) ? value.join(', ') || '—' : String(value ?? '') || '—';
const present = (value: unknown) => value !== undefined && value !== null && value !== '' && (!Array.isArray(value) || value.length > 0);

// ── InlineEditRows — click-to-edit About section ─────────────────────────────
export interface InlineRowDef {
  alwaysVisible?: boolean;
  validate?: (value: string) => string | undefined;
  preserveWhitespace?: boolean;
  editorDisabled?: boolean;
  editorError?: string;
  editorFullWidth?: boolean;
  renderValue?: () => React.ReactNode;
  valueHref?: string;
  renderEditor?: (props: { values: string[]; onValuesChange: (values: string[]) => void; value: string; onChange: (value: string) => void; disabled: boolean; error: string; onSave: () => void; onCancel: () => void }) => React.ReactNode;
  technicalKey?: string;
  label: string;
  value: unknown;
  apiField?: string;
  required?: boolean;
  maxLength?: number;
  type?: 'text' | 'email' | 'tel' | 'url' | 'select' | 'textarea' | 'date' | 'products' | 'users' | 'accounts' | 'contacts' | 'leads';
  valueMode?: 'id' | 'name';
  displayValue?: unknown;
  productLabels?: Record<string, string>;
  showUncategorized?: boolean;
  options?: string[];
}

export interface InlineEditState { field: string | null; dirty: boolean; busy: boolean }

export function InlineEditRows({ rows, canEdit, onSave, disabled = false, onEditStateChange, lockWhileEditing = false, onEscape }: {
  rows: InlineRowDef[];
  canEdit: boolean;
  disabled?: boolean;
  lockWhileEditing?: boolean;
  onEditStateChange?: (state: InlineEditState) => void;
  onEscape?: () => void;
  onSave: (field: string, value: string | string[]) => Promise<void>;
}) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string | string[]>('');
  const [isSaving, setIsSaving] = useState(false);
  const [fieldError, setFieldError] = useState('');
  const [initialValue, setInitialValue] = useState<string | string[]>('');
  const editingField = rows.find(row => (row.technicalKey ?? row.label) === editingKey)?.apiField ?? null;
  const dirty = editingKey !== null && JSON.stringify(initialValue) !== JSON.stringify(editValue);
  useEffect(() => { onEditStateChange?.({ field: editingField, dirty, busy: isSaving }); }, [editingField, dirty, isSaving, onEditStateChange]);
  const blocked = isSaving || disabled;
  useEffect(() => { if (!canEdit) { setEditingKey(null); setEditValue(''); setFieldError(''); } }, [canEdit]);

  const startEdit = (label: string, value: unknown) => {
    if (blocked || lockWhileEditing && editingKey) return;
    setFieldError('');
    setInitialValue(Array.isArray(value) ? value : String(value ?? ''));
    setEditingKey(label);
    setEditValue(Array.isArray(value) ? value : String(value ?? ''));
  };
  const cancelEdit = () => { if (blocked) return; setEditingKey(null); setEditValue(''); };
  const escapeEdit = (event: React.KeyboardEvent) => {
    if (onEscape) { event.preventDefault(); event.stopPropagation(); onEscape(); }
    else cancelEdit();
  };
  const commitEdit = async (apiField: string) => {
    if (blocked || !canEdit) return;
    setFieldError('');
    const row = rows.find(row => row.apiField === apiField);
    if (row?.editorDisabled) return;
    if (row?.validate) {
      const error = row.validate(String(editValue));
      if (error) { setFieldError(error); return; }
    } else {
      if (row?.required && (typeof editValue !== 'string' || !editValue.trim())) { setFieldError(`${row.label} is required`); return; }
      if (row?.required && typeof editValue === 'string' && editValue.trim().length > (row.maxLength ?? 100)) { setFieldError(`Max ${row.maxLength ?? 100} characters`); return; }
    }
    if (rows.find(row => row.apiField === apiField)?.type === 'email') {
      const result = CrmEmailSchema.safeParse(editValue);
      if (!result.success) { setFieldError(result.error.issues[0].message); return; }
    }
    setIsSaving(true);
    try { await onSave(apiField, typeof editValue === 'string' && !row?.preserveWhitespace ? editValue.trim() : editValue); setEditingKey(null); }
    catch (error) { setFieldError(error instanceof Error ? error.message : 'Unable to save field'); }
    finally { setIsSaving(false); }
  };

  return (
    <dl className="divide-y divide-border/60">
      {rows.filter(({ value, displayValue, apiField, label, technicalKey, required, alwaysVisible }) => alwaysVisible || required || present(displayValue ?? value) || (canEdit && !!apiField) || editingKey === (technicalKey ?? label)).map(({ technicalKey, label, value, apiField, type, options, valueMode, displayValue, productLabels, showUncategorized, required, maxLength, renderEditor, renderValue, editorDisabled, editorError, editorFullWidth, valueHref }) => {
        const isEditing = canEdit && editingKey === (technicalKey ?? label);
        const editable = canEdit && !!apiField;
        return (
          <div key={technicalKey ?? label} className={cn('grid min-w-0 gap-3 px-3 py-2.5 text-xs', isEditing && editorFullWidth ? 'grid-cols-1' : required && !renderEditor ? 'grid-cols-[minmax(max-content,2fr)_minmax(0,3fr)]' : 'grid-cols-[minmax(0,2fr)_minmax(0,3fr)]')}>
            <dt className="text-muted-foreground self-start pt-0.5">{label}{(required || type === 'email' && editable) && <span className="text-red-500"> *</span>}</dt>
            <dd className="min-w-0">
              {isEditing && apiField ? (
                <div className="flex flex-col gap-1.5">
                  {renderEditor ? renderEditor({ values: Array.isArray(editValue) ? editValue : [], onValuesChange: next => { setEditValue(next); setFieldError(''); }, value: String(editValue), onChange: next => { setEditValue(next); setFieldError(''); }, disabled: blocked, error: fieldError, onSave: () => void commitEdit(apiField), onCancel: cancelEdit }) : type === 'products' ? <CatalogProductInterestSelect showUncategorized={showUncategorized} values={Array.isArray(editValue) ? editValue : []} onChange={setEditValue} valueMode={valueMode} labels={productLabels} disabled={blocked} /> : type === 'users' || type === 'accounts' ? <EntityCombobox entityType={type} multiple={false} disabled={blocked} value={String(editValue) || null} onChange={value => setEditValue(value || '')} /> : type === 'contacts' || type === 'leads' ? <EntityCombobox entityType={type} multiple disabled={blocked} values={Array.isArray(editValue) ? editValue : []} onMultiChange={setEditValue} /> : type === 'select' ? (
                    <select aria-label={label} disabled={blocked} value={Array.isArray(editValue) ? editValue.join(', ') : editValue} onChange={e => setEditValue(e.target.value)} autoFocus className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring">
                      {options?.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : type === 'textarea' ? (
                    <textarea aria-label={label} disabled={blocked} value={Array.isArray(editValue) ? editValue.join(', ') : editValue} onChange={e => setEditValue(e.target.value)} rows={3} autoFocus onKeyDown={e => { if (e.key === 'Escape') escapeEdit(e); }} className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
                  ) : (
                    <input aria-label={label} disabled={blocked} type={type ?? 'text'} required={required || type === 'email'} aria-required={required || type === 'email'} aria-invalid={!!fieldError} maxLength={type === 'email' ? 254 : required ? maxLength ?? 100 : undefined} value={Array.isArray(editValue) ? editValue.join(', ') : editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Enter') void commitEdit(apiField); if (e.key === 'Escape') escapeEdit(e); }} className={cn("w-full rounded-md border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring", fieldError ? "border-red-500" : "border-input")} />
                  )}
                  {(fieldError || editorError) && <p role="alert" className="text-xs text-destructive [overflow-wrap:anywhere]">{fieldError || editorError}</p>}
                  <div className="flex flex-wrap justify-end gap-1">
                    <button type="button" onClick={() => void commitEdit(apiField)} disabled={blocked || editorDisabled} className="inline-flex items-center rounded-md bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">{isSaving ? <><Loader2 className="mr-1 h-3 w-3 animate-spin" />Saving…</> : 'Save'}</button>
                    <button type="button" onClick={cancelEdit} disabled={blocked} className="inline-flex items-center rounded-md border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-accent disabled:opacity-50 transition-colors">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="min-w-0"><button type="button" disabled={!editable || blocked || lockWhileEditing && !!editingKey} aria-label={editable ? `Edit ${label}` : undefined}
                  className={cn('group flex w-full items-start justify-end gap-1.5 text-right [overflow-wrap:anywhere] focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default', editable && 'hover:text-primary hover:underline')}
                  onClick={() => startEdit(technicalKey ?? label, value)}>
                  <span className="min-w-0">{renderValue ? renderValue() : displayText(displayValue ?? value)}</span>{editable && <Pencil aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" />}
                </button>{valueHref && <a className="mt-1 block text-right text-primary underline" href={valueHref}>Open file</a>}</div>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
