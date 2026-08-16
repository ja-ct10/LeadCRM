'use client';

import React, { useState } from 'react';
import { Trash2, GripVertical, Settings2 } from 'lucide-react';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { FormField, FormFieldType, FormDesign } from '../types/form.types';
import { cn } from '@/lib/utils';

// ── Public API ───────────────────────────────────────────────────────────────
export const CANVAS_DROPPABLE_ID = 'form-canvas';

export { arrayMove };

export interface FormCanvasProps {
  fields: FormField[];
  design: FormDesign;
  /** Called whenever the field list changes (add, reorder, remove, edit) */
  onChange: (fields: FormField[]) => void;
  /** Passed from parent so DragOverlay can render the ghost */
  activeFieldId?: string | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function resolveRadius(r: FormDesign['fieldRadius']): string {
  if (r === 'none') return 'rounded-none';
  if (r === 'sm')   return 'rounded-sm';
  if (r === 'lg')   return 'rounded-lg';
  if (r === 'full') return 'rounded-full';
  return 'rounded-md';
}

function resolveSize(s: FormDesign['fieldSize']): string {
  if (s === 'sm') return 'py-1.5 text-xs';
  if (s === 'lg') return 'py-3 text-sm';
  return 'py-2 text-sm';
}

// ── FieldPreview ─────────────────────────────────────────────────────────────
interface FieldPreviewProps {
  field: FormField;
  inputCls: string;
  onUpdate: (id: string, patch: Partial<FormField>) => void;
}

function FieldPreview({ field, inputCls, onUpdate }: FieldPreviewProps): React.ReactElement {
  switch (field.type) {
    case 'heading':
      return (
        <input type="text" value={field.label}
          onChange={(e) => onUpdate(field.id, { label: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          className="text-2xl font-bold bg-transparent text-slate-900 w-full focus:outline-none border-b-2 border-transparent focus:border-blue-400 transition-colors" />
      );

    case 'paragraph':
      return (
        <textarea value={field.label}
          onChange={(e) => onUpdate(field.id, { label: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          rows={2}
          className="w-full bg-transparent text-sm text-slate-600 resize-none focus:outline-none border-b-2 border-transparent focus:border-blue-400 transition-colors" />
      );

    case 'divider':
      return <hr className="border-slate-300 my-1" />;

    case 'checkbox':
      return (
        <label className="flex items-center gap-2 cursor-default select-none">
          <input type="checkbox" className="w-4 h-4 rounded accent-blue-500" readOnly />
          <span className="text-sm text-slate-800">{field.label}</span>
        </label>
      );

    case 'radio':
      return (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">{field.label}</label>
          <div className="flex flex-col gap-1">
            {(field.options?.length ? field.options : ['Option 1', 'Option 2']).map((opt, i) => (
              <label key={i} className="flex items-center gap-2 cursor-default text-sm text-slate-700">
                <input type="radio" name={field.id} readOnly className="accent-blue-500" />
                {opt}
              </label>
            ))}
          </div>
        </div>
      );

    case 'dropdown':
      return (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">{field.label}</label>
          <select className={cn(inputCls, 'appearance-none')}>
            <option value="">{field.placeholder ?? 'Select an option'}</option>
            {(field.options ?? []).map((o, i) => <option key={i}>{o}</option>)}
          </select>
        </div>
      );

    case 'rating':
      return (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">{field.label}</label>
          <div className="flex gap-1">
            {[1,2,3,4,5].map((n) => (
              <span key={n} className="text-2xl text-slate-300 cursor-pointer hover:text-amber-400 transition-colors">★</span>
            ))}
          </div>
        </div>
      );

    case 'file':
      return (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">{field.label}</label>
          <div className={cn(inputCls, 'flex items-center gap-2 text-slate-400 cursor-default border-dashed')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <span className="text-xs">{field.placeholder ?? 'Click to upload or drag file here'}</span>
          </div>
        </div>
      );

    case 'date':
      return (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">{field.label}</label>
          <input type="date" readOnly className={inputCls} />
        </div>
      );

    default: {
      const inputType =
        field.type === 'email' || field.type === 'contact-email'   ? 'email' :
        field.type === 'phone' || field.type === 'contact-phone'   ? 'tel'   :
        field.type === 'number'                                     ? 'number':
        field.type === 'url'   || field.type === 'company-website' ? 'url'   : 'text';
      return (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">{field.label}</label>
          <input type={inputType} placeholder={field.placeholder ?? ''} readOnly className={inputCls} />
        </div>
      );
    }
  }
}

// ── SortableFieldRow ─────────────────────────────────────────────────────────
interface SortableFieldRowProps {
  field: FormField;
  isSelected: boolean;
  radiusCls: string;
  sizeCls: string;
  isDragOverlay?: boolean;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<FormField>) => void;
}

export function SortableFieldRow({
  field, isSelected, radiusCls, sizeCls, isDragOverlay = false,
  onSelect, onRemove, onUpdate,
}: SortableFieldRowProps): React.ReactElement {
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: field.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const inputCls = cn(
    'w-full px-3 border focus:outline-none transition-colors',
    sizeCls, radiusCls,
    'bg-white border-slate-300 text-slate-800 placeholder-slate-400',
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => !isDragOverlay && onSelect(field.id)}
      className={cn(
        'group relative rounded-lg p-2 -mx-2 transition-all',
        !isDragOverlay && 'cursor-pointer',
        isSelected && !isDragOverlay ? 'ring-2 ring-blue-500 bg-blue-50/40' : (!isDragOverlay && 'hover:bg-slate-50'),
        isDragOverlay && 'shadow-2xl ring-2 ring-blue-400/50 bg-white rounded-xl opacity-95',
        isDragging && !isDragOverlay && 'opacity-30',
      )}
    >
      <FieldPreview field={field} inputCls={inputCls} onUpdate={onUpdate} />

      {/* Delete button — right side */}
      {!isDragOverlay && (
        <div className={cn(
          'absolute -right-2 top-1/2 -translate-y-1/2 flex flex-col gap-0.5 transition-opacity',
          isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
        )}>
          <button type="button"
            onClick={(e) => { e.stopPropagation(); onRemove(field.id); }}
            className="p-1 bg-white border border-rose-200 text-rose-500 rounded shadow-sm hover:bg-rose-50 cursor-pointer"
            title="Remove field">
            <Trash2 size={11} />
          </button>
        </div>
      )}

      {/* Drag handle — left side (grab to reorder within canvas) */}
      {!isDragOverlay && (
        <div
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'absolute left-0 top-1/2 -translate-y-1/2 -translate-x-5 transition-opacity cursor-grab active:cursor-grabbing',
            isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
          )}
          title="Drag to reorder"
        >
          <GripVertical size={14} className="text-slate-400" />
        </div>
      )}
    </div>
  );
}

// ── FormCanvas ────────────────────────────────────────────────────────────────
// NOTE: This component has NO DndContext of its own.
// The parent (FormBuilderPage) owns the single DndContext that spans both the
// palette and the canvas, enabling cross-container drag-from-palette drops.
export function FormCanvas({ fields, design, onChange, activeFieldId }: FormCanvasProps): React.ReactElement {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Make the canvas a droppable target so palette items can be dropped anywhere
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: CANVAS_DROPPABLE_ID });

  const radiusCls = resolveRadius(design.fieldRadius);
  const sizeCls   = resolveSize(design.fieldSize);

  const removeField = (id: string) => {
    onChange(fields.filter((f) => f.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const updateField = (id: string, patch: Partial<FormField>) => {
    onChange(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  const formBgStyle: React.CSSProperties = {};
  if (design.generalBg)     formBgStyle.backgroundColor = design.generalBg;
  if (design.generalBorder) formBgStyle.borderColor     = design.generalBorder;
  if (design.generalText)   formBgStyle.color           = design.generalText;

  const submitBtnStyle: React.CSSProperties = {};
  if (design.buttonBg)     submitBtnStyle.backgroundColor = design.buttonBg;
  if (design.buttonBorder) submitBtnStyle.borderColor     = design.buttonBorder;
  if (design.buttonText)   submitBtnStyle.color           = design.buttonText;

  return (
    <div className="max-w-xl mx-auto">
      {/* Form section */}
      <div
        ref={setDropRef}
        className={cn(
          'bg-white border rounded-t-lg p-8 space-y-4 transition-all',
          isOver
            ? 'border-blue-400 ring-2 ring-blue-400/30 bg-blue-50/20'
            : 'border-slate-200',
        )}
        style={formBgStyle}
      >
        {/* Empty state */}
        {fields.length === 0 && (
          <div className={cn(
            'flex flex-col items-center justify-center py-14 rounded-xl border-2 border-dashed transition-colors',
            isOver ? 'border-blue-400 bg-blue-50/40 text-blue-500' : 'border-slate-200 text-slate-400',
          )}>
            <Settings2 size={28} className="mb-2 opacity-50" />
            <p className="text-sm font-medium">
              {isOver ? 'Release to drop field here' : 'Drag fields here or click in the panel'}
            </p>
          </div>
        )}

        {/* Drop indicator when canvas has fields and palette item is being dragged */}
        {fields.length > 0 && isOver && (
          <div className="h-1 rounded-full bg-blue-400/60 -mt-2 mb-2 transition-all" />
        )}

        <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
          {fields.map((field) => (
            <SortableFieldRow
              key={field.id}
              field={field}
              isSelected={selectedId === field.id}
              radiusCls={radiusCls}
              sizeCls={sizeCls}
              onSelect={setSelectedId}
              onRemove={removeField}
              onUpdate={updateField}
            />
          ))}
        </SortableContext>

        {/* Submit button */}
        <div className="pt-2">
          <button type="button"
            className={cn('w-full py-2.5 bg-blue-600 text-white font-semibold text-sm', radiusCls)}
            style={submitBtnStyle}>
            Submit
          </button>
        </div>
      </div>

      {/* Thank you section */}
      <div className="bg-slate-50 border border-t-0 border-slate-200 rounded-b-lg p-8 text-center space-y-2">
        <h3 className="text-xl font-bold text-slate-800">Thank you!</h3>
        <p className="text-sm font-semibold text-slate-600">Thank you for submitting the form.</p>
        <p className="text-xs text-slate-500">Your submission has been received.<br />We will get back to you shortly.</p>
      </div>
    </div>
  );
}
