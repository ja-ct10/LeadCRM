'use client';

import React, { useState } from 'react';
import { Trash2, GripVertical, ChevronUp, ChevronDown } from 'lucide-react';
import { FormField, FormDesign } from '../types/form.types';
import { cn } from '@/lib/utils';

interface FormCanvasProps {
  fields: FormField[];
  design: FormDesign;
  onChange: (fields: FormField[]) => void;
}

function resolveRadius(r: FormDesign['fieldRadius']): string {
  if (r === 'none') return 'rounded-none';
  if (r === 'sm') return 'rounded-sm';
  if (r === 'lg') return 'rounded-lg';
  if (r === 'full') return 'rounded-full';
  return 'rounded-md';
}

function resolveSize(s: FormDesign['fieldSize']): string {
  if (s === 'sm') return 'py-1.5 text-xs';
  if (s === 'lg') return 'py-3 text-sm';
  return 'py-2 text-sm';
}

export function FormCanvas({ fields, design, onChange }: FormCanvasProps): React.ReactElement {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const radiusCls = resolveRadius(design.fieldRadius);
  const sizeCls = resolveSize(design.fieldSize);

  const moveField = (idx: number, dir: -1 | 1) => {
    const next = [...fields];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  const removeField = (id: string) => {
    onChange(fields.filter((f) => f.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const updateField = (id: string, patch: Partial<FormField>) => {
    onChange(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  const renderFieldPreview = (field: FormField) => {
    const inputCls = cn(
      'w-full px-3 border focus:outline-none transition-colors',
      sizeCls, radiusCls,
      'bg-white dark:bg-slate-100 border-slate-300 dark:border-slate-300 text-slate-800 placeholder-slate-400',
    );

    switch (field.type) {
      case 'heading':
        return (
          <div>
            <input type="text" value={field.label} onChange={(e) => updateField(field.id, { label: e.target.value })}
              className="text-2xl font-bold bg-transparent text-slate-900 dark:text-slate-900 w-full focus:outline-none border-b-2 border-transparent focus:border-blue-400 transition-colors" />
          </div>
        );
      case 'paragraph':
        return (
          <textarea value={field.label} onChange={(e) => updateField(field.id, { label: e.target.value })} rows={2}
            className="w-full bg-transparent text-sm text-slate-600 dark:text-slate-600 resize-none focus:outline-none border-b-2 border-transparent focus:border-blue-400 transition-colors" />
        );
      case 'checkbox':
        return (
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 rounded accent-blue-500" readOnly />
            <span className="text-sm text-slate-800">{field.label}</span>
          </label>
        );
      case 'dropdown':
        return (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{field.label}</label>
            <select className={cn(inputCls, 'appearance-none')}>
              <option value="">{field.placeholder || 'Select an option'}</option>
              {(field.options || []).map((o, i) => <option key={i}>{o}</option>)}
            </select>
          </div>
        );
      default:
        return (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{field.label}</label>
            <input type={field.type === 'email' || field.type === 'contact-email' ? 'email' : field.type === 'phone' || field.type === 'contact-phone' ? 'tel' : field.type === 'number' ? 'number' : field.type === 'url' ? 'url' : 'text'}
              placeholder={field.placeholder || ''} readOnly className={inputCls} />
          </div>
        );
    }
  };

  const formBgStyle: React.CSSProperties = {};
  if (design.generalBg) formBgStyle.backgroundColor = design.generalBg;
  if (design.generalBorder) formBgStyle.borderColor = design.generalBorder;
  if (design.generalText) formBgStyle.color = design.generalText;

  const submitBtnStyle: React.CSSProperties = {};
  if (design.buttonBg) submitBtnStyle.backgroundColor = design.buttonBg;
  if (design.buttonBorder) submitBtnStyle.borderColor = design.buttonBorder;
  if (design.buttonText) submitBtnStyle.color = design.buttonText;

  return (
    <div className="max-w-xl mx-auto space-y-0">
      {/* Form section */}
      <div className="bg-white border border-slate-200 rounded-t-lg p-8 space-y-4" style={formBgStyle}>
        {fields.map((field, idx) => (
          <div key={field.id} onClick={() => setSelectedId(field.id)}
            className={cn('group relative rounded-lg p-2 -mx-2 cursor-pointer transition-all', selectedId === field.id ? 'ring-2 ring-blue-500 bg-blue-50/40' : 'hover:bg-slate-50')}>
            {renderFieldPreview(field)}
            {/* Controls */}
            <div className={cn('absolute -right-2 top-1/2 -translate-y-1/2 flex flex-col gap-0.5 transition-opacity', selectedId === field.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')}>
              <button onClick={(e) => { e.stopPropagation(); moveField(idx, -1); }} className="p-1 bg-white border border-slate-200 rounded shadow-sm hover:bg-slate-50 cursor-pointer" title="Move up"><ChevronUp size={11} /></button>
              <button onClick={(e) => { e.stopPropagation(); moveField(idx, 1); }} className="p-1 bg-white border border-slate-200 rounded shadow-sm hover:bg-slate-50 cursor-pointer" title="Move down"><ChevronDown size={11} /></button>
              <button onClick={(e) => { e.stopPropagation(); removeField(field.id); }} className="p-1 bg-white border border-rose-200 text-rose-500 rounded shadow-sm hover:bg-rose-50 cursor-pointer" title="Remove"><Trash2 size={11} /></button>
            </div>
            <div className={cn('absolute left-0 top-1/2 -translate-y-1/2 -translate-x-5 transition-opacity cursor-grab', selectedId === field.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')}>
              <GripVertical size={14} className="text-slate-400" />
            </div>
          </div>
        ))}
        {/* Submit button */}
        <div className="pt-2">
          <button type="button" className={cn('w-full py-2.5 bg-blue-600 text-white font-semibold text-sm', radiusCls, 'transition-colors')} style={submitBtnStyle}>
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
