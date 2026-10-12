'use client';

import React, { useId } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { GripVertical } from 'lucide-react';
import { FormFieldType, FormDesign } from '../types/form.types';
import { leadCatalogFormField, type CrmFieldCatalogEntry, type FormField } from '@leadcrm/shared';
import { cn } from '@/lib/utils';
import { panelInputClass, panelLabelClass } from '@/shared/components/side-panel-styles';

// ── Palette item descriptor ─────────────────────────────────────────────────
export interface PaletteField {
  type: FormFieldType;
  label: string;
  icon: string;
  color?: string;         // tailwind bg class — undefined = slate (layout)
  section: 'layout' | 'standard' | 'custom';
  mapToField?: FormField['mapToField'];
  customFieldId?: string;
  required?: boolean;
  options?: readonly string[];
}

export const PALETTE_FIELDS: PaletteField[] = [
  // Layout
  { type: 'header',         label: 'Header',         icon: 'H1',  section: 'layout' },
  { type: 'paragraph',      label: 'Paragraph',      icon: 'P',   section: 'layout' },
  { type: 'divider',        label: 'Separator line', icon: '—',   section: 'layout' },
];

// Encode palette drag ids so the DndContext can distinguish palette vs canvas
export const PALETTE_DRAG_PREFIX = 'palette::';
export function isPaletteDrag(id: string): boolean {
  return String(id).startsWith(PALETTE_DRAG_PREFIX);
}
export function paletteDragId(field: PaletteField): string {
  return `${PALETTE_DRAG_PREFIX}${field.customFieldId ? `custom:${field.customFieldId}` : field.mapToField ? `system:${field.mapToField}` : `layout:${field.type}`}`;
}

function catalogIcon(field: CrmFieldCatalogEntry): string {
  if (field.technicalKey === 'email') return '@';
  if (field.technicalKey === 'phone') return '☎';
  if (field.technicalKey.toLowerCase().includes('address')) return '⌂';
  if (field.type === 'number') return '#';
  if (field.type === 'date') return '📅';
  if (field.type === 'dropdown' || field.type === 'products') return '⊙';
  if (field.type === 'longText') return '≡';
  return 'T';
}
export function paletteFieldsFromCatalog(catalog: CrmFieldCatalogEntry[]): PaletteField[] {
  return catalog.flatMap(field => {
    if (field.kind === 'System' && field.technicalKey === 'source') return [];
    const input = leadCatalogFormField(field);
    if (!input) return [];
    return [{ ...input, icon: catalogIcon(field), color: field.kind === 'Custom' ? 'bg-amber-700' : 'bg-emerald-700', section: field.kind === 'Custom' ? 'custom' : 'standard' } satisfies PaletteField];
  });
}

// ── DraggablePaletteItem ────────────────────────────────────────────────────
interface DraggableItemProps {
  field: PaletteField;
  onAddField: (field: PaletteField) => void;
  disabled?: boolean;
  dragEnabled?: boolean;
}

function DraggableItem({ field, onAddField, disabled, dragEnabled = true }: DraggableItemProps): React.ReactElement {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: paletteDragId(field),
    data: { field, fromPalette: true },
    disabled: disabled || !dragEnabled,
  });

  const isLayout = field.section === 'layout';

  return (
    <button type="button"
      ref={setNodeRef}
      {...(dragEnabled ? listeners : {})}
      {...(dragEnabled ? attributes : {})}
      disabled={disabled}
      onClick={() => onAddField(field)}
      title={dragEnabled ? `Add ${field.label} — or drag onto canvas` : `Add ${field.label}`}
      className={cn(
        'relative flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all select-none group disabled:opacity-40 disabled:cursor-not-allowed',
        dragEnabled ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
        'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-white/[0.07]',
        'hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10',
        isDragging && 'opacity-40 scale-95',
      )}
    >
      {isLayout ? (
        <div className="w-9 h-9 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-700 dark:text-slate-300 group-hover:bg-blue-100 dark:group-hover:bg-blue-500/20 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors text-sm">
          {field.icon}
        </div>
      ) : (
        <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold', field.color)}>
          {field.icon}
        </div>
      )}
      {dragEnabled && <GripVertical aria-hidden="true" size={14} className="absolute right-2 top-2 text-slate-400" />}
      <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 text-center leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
        {field.label}
      </span>
    </button>
  );
}

// ── FieldPalette ────────────────────────────────────────────────────────────
interface FieldPaletteProps {
  onAddField: (field: PaletteField) => void;
  catalog?: CrmFieldCatalogEntry[];
  catalogError?: string;
  loading?: boolean;
  fields?: FormField[];
  onRetry?: () => void;
  dragEnabled?: boolean;
  design?: FormDesign;
  onDesignChange?: (design: FormDesign) => void;
  mode?: 'fields' | 'design';
}

export function FieldPalette({ onAddField, catalog, catalogError, loading, fields = [], onRetry, dragEnabled = true, design, onDesignChange, mode = 'fields' }: FieldPaletteProps): React.ReactElement {
  if (mode === 'design' && design && onDesignChange) {
    return <DesignPanel design={design} onChange={onDesignChange} />;
  }

  const layout = PALETTE_FIELDS.filter((f) => f.section === 'layout');
  const standard = (catalog ? paletteFieldsFromCatalog(catalog) : []).filter((f) => f.section === 'standard');
  const custom = (catalog ? paletteFieldsFromCatalog(catalog) : []).filter((f) => f.section === 'custom');
  const used = (field: PaletteField) => fields.some(input => field.customFieldId ? input.customFieldId === field.customFieldId : !!field.mapToField && (input.mapToField === field.mapToField || input.mapToField === 'fullName' && ['firstName', 'lastName'].includes(field.mapToField)));

  return (
    <div className="p-3 space-y-4 overflow-y-auto custom-scrollbar flex-1">
      {loading && <p role="status" className="text-xs text-muted-foreground">Loading Lead fields…</p>}
      {catalogError && <div role="alert" className="text-xs text-red-600">{catalogError}{onRetry && <button type="button" onClick={onRetry} className="block underline mt-2">Retry loading fields</button>}</div>}

      {/* Layout */}
      <div>
        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">LAYOUT</p>
        <div className="grid grid-cols-2 gap-2">
          {layout.map((f) => <DraggableItem key={f.type} field={f} onAddField={onAddField} dragEnabled={dragEnabled} />)}
        </div>
      </div>

      {/* Standard Lead system fields */}
      <div>
        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">STANDARD FIELDS</p>
        <p className="text-[10px] text-slate-400 dark:text-slate-500 mb-2">Lead System fields from Customize Fields.</p>
        <div className="grid grid-cols-2 gap-2">
          {standard.map((f) => <DraggableItem key={f.mapToField ?? f.label} field={f} onAddField={onAddField} disabled={used(f)} dragEnabled={dragEnabled} />)}
        </div>
      </div>

      {/* Custom Lead fields */}
      <div>
        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">CUSTOM FIELDS</p>
        <p className="text-[10px] text-slate-400 dark:text-slate-500 mb-2">Lead Custom fields from Customize Fields.</p>
        <div className="grid grid-cols-2 gap-2">
          {custom.map((f) => <DraggableItem key={f.customFieldId} field={f} onAddField={onAddField} disabled={used(f)} dragEnabled={dragEnabled} />)}
        </div>
        {!loading && !catalogError && catalog && !custom.length && <p className="text-xs text-muted-foreground">No eligible Lead Custom Fields.</p>}
      </div>
    </div>
  );
}

// ── DesignPanel (unchanged) ─────────────────────────────────────────────────
interface DesignPanelProps { design: FormDesign; onChange: (d: FormDesign) => void; }

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }): React.ReactElement {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className={panelLabelClass}>{label}</label>
      <div className="relative">
        <input type="color" aria-label={`${label} color picker`} value={/^#[\da-f]{6}$/i.test(value) ? value : '#ffffff'} onChange={(e) => onChange(e.target.value)}
          className="absolute left-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded cursor-pointer border-0 bg-transparent" />
        <input id={id} type="text" value={value} maxLength={9} onChange={(e) => onChange(e.target.value)} placeholder="e.g. #3B82F6"
          className={panelInputClass + " pl-9"} />
      </div>
    </div>
  );
}

function DesignPanel({ design, onChange }: DesignPanelProps): React.ReactElement {
  const update = (patch: Partial<FormDesign>) => onChange({ ...design, ...patch });
  return (
    <div className="p-3 space-y-4 overflow-y-auto custom-scrollbar flex-1">
      <details open className="group">
        <summary className="flex items-center justify-between cursor-pointer py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 list-none">
          <span>🎨 General styles</span>
          <svg className="w-3.5 h-3.5 group-open:rotate-180 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
        </summary>
        <div className="mt-2 space-y-3">
          <ColorInput label="Background" value={design.generalBg} onChange={(v) => update({ generalBg: v })} />
          <ColorInput label="Border" value={design.generalBorder} onChange={(v) => update({ generalBorder: v })} />
          <ColorInput label="Text" value={design.generalText} onChange={(v) => update({ generalText: v })} />
        </div>
      </details>
      <details open className="group">
        <summary className="flex items-center justify-between cursor-pointer py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 list-none">
          <span>✏️ Field styles</span>
          <svg className="w-3.5 h-3.5 group-open:rotate-180 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
        </summary>
        <div className="mt-2 space-y-3">
          <ColorInput label="Background" value={design.fieldBg} onChange={(v) => update({ fieldBg: v })} />
          <ColorInput label="Border" value={design.fieldBorder} onChange={(v) => update({ fieldBorder: v })} />
          <ColorInput label="Text" value={design.fieldText} onChange={(v) => update({ fieldText: v })} />
          <div className="space-y-1">
            <label className={panelLabelClass}>Radius</label>
            <select aria-label="Field radius" value={design.fieldRadius} onChange={(e) => update({ fieldRadius: e.target.value as FormDesign['fieldRadius'] })}
              className={panelInputClass}>
              {(['none','sm','md','lg','full'] as const).map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase()+r.slice(1)}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className={panelLabelClass}>Size</label>
            <select aria-label="Field size" value={design.fieldSize} onChange={(e) => update({ fieldSize: e.target.value as FormDesign['fieldSize'] })}
              className={panelInputClass}>
              {(['sm','regular','lg'] as const).map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
            </select>
          </div>
        </div>
      </details>
      <details open className="group">
        <summary className="flex items-center justify-between cursor-pointer py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 list-none">
          <span>👆 Button styles</span>
          <svg className="w-3.5 h-3.5 group-open:rotate-180 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
        </summary>
        <div className="mt-2 space-y-3">
          <ColorInput label="Background" value={design.buttonBg} onChange={(v) => update({ buttonBg: v })} />
          <ColorInput label="Border" value={design.buttonBorder} onChange={(v) => update({ buttonBorder: v })} />
          <ColorInput label="Text" value={design.buttonText} onChange={(v) => update({ buttonText: v })} />
        </div>
      </details>
    </div>
  );
}
