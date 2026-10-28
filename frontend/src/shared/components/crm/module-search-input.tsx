'use client';

import { Search } from 'lucide-react';
import { Input } from '@/shared/components/ui/input';

/** Leads toolbar search, shared with standalone module tables. */
export function ModuleSearchInput({ value, onChange, placeholder, label = placeholder, disabled, fullWidth = false }: {
  value: string; onChange: (value: string) => void; placeholder: string; label?: string; disabled?: boolean; fullWidth?: boolean;
}) {
  return <div className={`relative w-full min-w-0 ${fullWidth ? '' : 'sm:flex-none sm:w-auto'}`}>
    <Input type="text" value={value} onChange={event => onChange(event.target.value)}
      placeholder={placeholder} aria-label={label} disabled={disabled}
      className={`h-8 w-full ${fullWidth ? '' : 'sm:w-48 lg:w-56'} pl-8 pr-3 text-[12px] rounded-lg border transition-all`} />
    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5A6B85]" aria-hidden="true" />
  </div>;
}
