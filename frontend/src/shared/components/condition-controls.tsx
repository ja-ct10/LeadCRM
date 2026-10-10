'use client';
import type { InputHTMLAttributes } from 'react';

export function ConditionFieldSelect({ fields, value, onChange, className, id, label = 'Field' }: { fields: { key: string; label: string; group?: string }[]; value: string; onChange: (value: string) => void; className?: string; id?: string; label?: string }) {
  const groups = [...new Set(fields.map(field => field.group || 'Fields'))];
  return <select id={id} aria-label={label} className={className} value={value} onChange={event => onChange(event.target.value)}><option value="">Choose a field</option>{value && !fields.some(field => field.key === value) && <option value={value}>Unavailable field — repair required</option>}{groups.map(group => <optgroup key={group} label={group}>{fields.filter(field => (field.group || 'Fields') === group).map(field => <option key={field.key} value={field.key}>{field.label}</option>)}</optgroup>)}</select>;
}
export function ConditionOperatorSelect({ operators, value, onChange, className, id, label = 'Operator' }: { operators: { key: string; label: string }[]; value: string; onChange: (value: string) => void; className?: string; id?: string; label?: string }) {
  return <select id={id} aria-label={label} className={className} value={value} onChange={event => onChange(event.target.value)}>{value && !operators.some(operator => operator.key === value) && <option value={value}>Unavailable operator — repair required</option>}{operators.map(operator => <option key={operator.key} value={operator.key}>{operator.label}</option>)}</select>;
}
export function ConditionScalarInput({ value, onValueChange, type = 'text', ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & { value: unknown; onValueChange: (value: string | number) => void }) {
  return <input {...props} type={type} step={type === 'number' ? 'any' : undefined} value={String(value ?? '')} onChange={event => onValueChange(type === 'number' && event.target.value !== '' ? Number(event.target.value) : event.target.value)} />;
}
