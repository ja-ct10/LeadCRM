'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, ChevronDown, Building2, CreditCard, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

type AdminScope = 'all' | 'admin-clients' | 'admin-pricing' | 'admin-billing';

interface AdminSearchTarget {
  /** route-map path key handled by AdminLayout.navigate */
  path:        string;
  title:       string;
  description: string;
  keywords:    string[];
  icon:        React.ComponentType<{ size?: number; className?: string }>;
  accent:      string;
}

interface AdminOmniboxProps {
  /** Navigates within the admin portal using route-map path keys */
  navigate: (path: string) => void;
}

// ── Searchable admin destinations (Client Management, Pricing, Billing only) ──

const SEARCH_TARGETS: AdminSearchTarget[] = [
  {
    path:        'admin-clients',
    title:       'Client Management',
    description: 'Manage and monitor all client accounts',
    keywords:    ['client', 'clients', 'tenant', 'tenants', 'company', 'account', 'add new client', 'management'],
    icon:        Building2,
    accent:      'text-blue-500',
  },
  {
    path:        'admin-pricing',
    title:       'Pricing',
    description: 'Manage subscription tiers, plans, and features',
    keywords:    ['pricing', 'plan', 'plans', 'subscription', 'tier', 'edit plan', 'features', 'price'],
    icon:        CreditCard,
    accent:      'text-purple-500',
  },
  {
    path:        'admin-billing',
    title:       'Billing',
    description: 'Stripe payment history and add billing',
    keywords:    ['billing', 'invoice', 'invoices', 'payment', 'payments', 'stripe', 'add billing', 'transaction'],
    icon:        Receipt,
    accent:      'text-emerald-500',
  },
];

const SCOPE_OPTIONS: { value: AdminScope; label: string }[] = [
  { value: 'all',            label: 'All Modules' },
  { value: 'admin-clients',  label: 'Client Management' },
  { value: 'admin-pricing',  label: 'Pricing' },
  { value: 'admin-billing',  label: 'Billing' },
];

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * System Admin search bar. Mirrors the tenant GlobalOmnibox visual language but
 * is scoped to the operator's three platform modules: Client Management,
 * Pricing, and Billing. Selecting a result navigates within the admin portal.
 */
export function AdminOmnibox({ navigate }: AdminOmniboxProps): React.ReactElement {
  const [query, setQuery]           = useState('');
  const [scope, setScope]           = useState<AdminScope>('all');
  const [isOpen, setIsOpen]         = useState(false);
  const [isFocused, setIsFocused]   = useState(false);

  const inputRef    = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Focus with "/" shortcut, close with Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) && target !== inputRef.current) {
        return;
      }
      if (e.key === '/') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      } else if (e.key === 'Escape') {
        inputRef.current?.blur();
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const cleanQuery = query.trim().toLowerCase();

  const results = useMemo(() => {
    const scoped = scope === 'all'
      ? SEARCH_TARGETS
      : SEARCH_TARGETS.filter((target) => target.path === scope);

    if (cleanQuery.length === 0) return scoped;

    return scoped.filter((target) =>
      target.title.toLowerCase().includes(cleanQuery) ||
      target.description.toLowerCase().includes(cleanQuery) ||
      target.keywords.some((keyword) => keyword.includes(cleanQuery)),
    );
  }, [scope, cleanQuery]);

  const showResults = isFocused && isOpen;

  const handleSelect = (path: string) => {
    navigate(path);
    setIsOpen(false);
    setQuery('');
    inputRef.current?.blur();
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-[460px]">
      <div className="flex items-center h-8.5 w-full bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl focus-within:ring-2 focus-within:ring-[#2563EB]/20 focus-within:border-[#2563EB] focus-within:bg-white dark:focus-within:bg-slate-900 transition-all overflow-hidden shadow-2xs">
        {/* Module scoper */}
        <div className="relative shrink-0 border-r border-slate-200 dark:border-slate-700">
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as AdminScope)}
            className="h-8.5 pl-2.5 pr-6 text-[11.5px] font-semibold bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none appearance-none cursor-pointer"
            aria-label="Scope admin search module"
          >
            {SCOPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>

        {/* Input */}
        <div className="relative flex-1 flex items-center h-full">
          <Search size={13} className="absolute left-2.5 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onFocus={() => { setIsFocused(true); setIsOpen(true); }}
            onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
            placeholder="Search modules (Press '/')..."
            className="w-full h-full pl-8 pr-8 text-[12px] bg-transparent text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
          />
          {query ? (
            <button
              onClick={() => { setQuery(''); inputRef.current?.focus(); }}
              aria-label="Clear search"
              className="absolute right-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded"
            >
              <X size={13} />
            </button>
          ) : (
            <div className="absolute right-2 flex items-center gap-1">
              <kbd className="text-[9px] font-semibold text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-800 px-1 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                /
              </kbd>
            </div>
          )}
        </div>
      </div>

      {/* Results dropdown */}
      {showResults && (
        <div className="absolute top-full mt-2 left-0 right-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-2 z-50 max-h-[70vh] overflow-y-auto space-y-0.5 custom-scrollbar backdrop-blur-md">
          <div className="px-2 py-1 text-[10.5px] font-bold uppercase text-slate-400 tracking-wider">
            Modules
          </div>
          {results.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-500">
              No modules match &ldquo;{query.trim()}&rdquo;.
            </div>
          ) : (
            results.map((target) => {
              const Icon = target.icon;
              return (
                <button
                  key={target.path}
                  onClick={() => handleSelect(target.path)}
                  className="group w-full flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors text-left"
                >
                  <span className={cn('shrink-0', target.accent)}>
                    <Icon size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white truncate group-hover:text-blue-500 transition-colors">
                      {target.title}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">{target.description}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
