'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface ModuleTabsProps<T extends string> {
  tabs: ReadonlyArray<{ id: T; label: string }>;
  activeTab?: T;
  onTabChange?: (id: T) => void;
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
}

/** Shared underline controls for module views and record filters. */
export function ModuleTabs<T extends string>({ tabs, activeTab, onTabChange, ariaLabel, disabled = false, className }: ModuleTabsProps<T>): React.ReactElement {
  return <div role="group" aria-label={ariaLabel} className={cn('flex w-full min-w-0 flex-nowrap items-center gap-1 overflow-x-auto border-b border-[#E4E9F0] dark:border-slate-700', className)}>
    {tabs.map(tab => <button key={tab.id} type="button" aria-pressed={activeTab === tab.id} disabled={disabled}
      onClick={() => onTabChange?.(tab.id)}
      className={cn('relative shrink-0 whitespace-nowrap px-3 py-2 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
        activeTab === tab.id ? 'text-primary dark:text-primary' : 'text-[#5A6B85] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-white')}>
      {tab.label}
      {activeTab === tab.id && <span aria-hidden="true" className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-primary dark:bg-primary" />}
    </button>)}
  </div>;
}
