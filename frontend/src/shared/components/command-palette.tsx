'use client';

import { subscribePageCacheInvalidation } from '@/shared/cache/page-cache';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Users, Briefcase, LayoutDashboard, Workflow, Mail, Settings } from 'lucide-react';
import { useAuth } from '../../store/AuthContext';
import { useDebounce } from '@/shared/hooks/use-debounce';
import { leadsService } from '@/features/tenant/crm/leads/services/leads.service';
import { dealsApi } from '@/shared/services/deals.api';
import { toFrontendLead } from '@/lib/api/adapters/lead.adapter';
import { toFrontendDeal } from '@/lib/api/adapters/deal.adapter';
import type { Contact, Deal } from '@/store/types';

interface CommandPaletteProps {
  navigate: (path: string) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export default function CommandPalette({ navigate, isOpen, setIsOpen }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const { user, userCan } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const searchVersion = useRef(0);
  const canLeads = (['canViewAll', 'canViewMy', 'canViewActive'] as const).some(action => userCan('leads', action)), canDeals = (['canViewAll', 'canViewMy', 'canViewActive'] as const).some(action => userCan('deals', action));

  // ── Server-side search results ───────────────────────────────────────────
  const [searchedLeads,  setSearchedLeads]  = useState<Contact[]>([]);
  const [searchedDeals,  setSearchedDeals]  = useState<Deal[]>([]);
  const [isSearching,    setIsSearching]    = useState(false);
  const [searchError, setSearchError] = useState('');
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => subscribePageCacheInvalidation(module => {
    if (module !== '*') return;
    searchVersion.current++;
    setSearchedLeads([]); setSearchedDeals([]); setIsSearching(false);
    setQuery('');
  }), []);

  const searchRecords = useCallback(async (term: string): Promise<void> => {
    const version = ++searchVersion.current;
    setSearchError('');
    term = term.trim();
    if (!isOpen || term.length < 2) {
      setSearchedLeads([]);
      setSearchedDeals([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    try {
      const [leadsRes, dealsRes] = await Promise.allSettled([
        canLeads ? leadsService.getAll({ search: term, limit: 5 }) : Promise.resolve(null),
        canDeals ? dealsApi.list({ search: term, limit: 5 }) : Promise.resolve(null),
      ]);
      if (version !== searchVersion.current) return;
      if ([leadsRes, dealsRes].some(result => result.status === 'rejected')) setSearchError('Some records could not be searched. Please try again.');
      setSearchedLeads(
        leadsRes.status === 'fulfilled' && leadsRes.value
          ? (leadsRes.value?.data ?? []).map(toFrontendLead) as Contact[]
          : [],
      );
      setSearchedDeals(
        dealsRes.status === 'fulfilled' && dealsRes.value
          ? (dealsRes.value?.data ?? [])
              .map(toFrontendDeal)
              .filter((d): d is Deal => d !== null && !d.isArchived) as Deal[]
          : [],
      );
    } catch {
      // Silent failure — nav items remain usable
    } finally {
      if (version === searchVersion.current) setIsSearching(false);
    }
  }, [isOpen, user?.id, user?.tenantId, canLeads, canDeals]);

  useEffect(() => {
    if (query.trim() === debouncedQuery.trim()) void searchRecords(debouncedQuery);
    return () => { searchVersion.current++; };
  }, [debouncedQuery, searchRecords, query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(!isOpen);
      }
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, setIsOpen]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setQuery('');
      setSearchedLeads([]);
      setSearchedDeals([]);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const navItems = [
    { name: 'Dashboard',       path: '/dashboard',               icon: LayoutDashboard, module: 'dashboard' },
    { name: 'Client Profiles', path: '/crm/contacts',            icon: Users, module: 'contacts' },
    { name: 'Leads',           path: '/crm/leads',               icon: Users, module: 'leads' },
    { name: 'Accounts',        path: '/crm/accounts',            icon: Users, module: 'accounts' },
    { name: 'Deals',           path: '/crm/deals',               icon: Briefcase, module: 'deals' },
    { name: 'Workflows',       path: '/automation/workflows',    icon: Workflow, module: 'workflows' },
    { name: 'Campaigns',       path: '/marketing/campaigns',     icon: Mail, module: 'campaigns' },
    { name: 'Users',           path: '/settings?tab=users',       icon: Users, module: 'users' },
    { name: 'Settings',        path: '/settings',               icon: Settings, module: 'settings' },
  ];

  const filteredNav = navItems.filter((item) =>
    userCan(item.module, 'canView') &&
    item.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const handleSelect = (path: string): void => {
    searchVersion.current++;
    setQuery(''); setSearchedLeads([]); setSearchedDeals([]); setIsSearching(false);
    navigate(path);
    setIsOpen(false);
  };

  const hasResults = filteredNav.length > 0 || searchedLeads.length > 0 || searchedDeals.length > 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      <div
        className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
      />
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-950 border border-gray-300 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[70vh]">
        {/* Search input */}
        <div className="flex items-center px-4 py-4 border-b border-gray-200 dark:border-white/5">
          <Search className="text-slate-500 dark:text-slate-400 mr-3 shrink-0" size={20} />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none text-lg"
            placeholder="Search leads, deals, or navigate..."
            value={query}
            onChange={(e) => { searchVersion.current++; setSearchedLeads([]); setSearchedDeals([]); setIsSearching(false); setQuery(e.target.value); }}
            aria-label="Search or navigate"
          />
          {isSearching && (
            <div className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mr-2 shrink-0" aria-label="Searching" />
          )}
          <div className="text-xs text-slate-500 font-mono bg-gray-50 dark:bg-white/5 px-2 py-1 rounded border border-gray-300 dark:border-white/10 shrink-0">
            ESC
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
          {searchError && <p role="alert" className="px-3 py-2 text-sm text-destructive">{searchError}</p>}
          {query === '' && (
            <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Quick Navigation
            </div>
          )}

          {/* Navigation items */}
          {filteredNav.length > 0 && (
            <div className="mb-4">
              {query !== '' && (
                <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Navigation
                </div>
              )}
              {filteredNav.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.path}
                    onClick={() => handleSelect(item.path)}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-gray-50 dark:hover:bg-white/[0.04] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors text-left"
                  >
                    <Icon size={18} className="text-slate-500 dark:text-slate-400" />
                    <span>{item.name}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Lead results */}
          {query !== '' && canLeads && searchedLeads.length > 0 && (
            <div className="mb-4">
              <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Leads
              </div>
              {searchedLeads.map((contact) => (
                <button
                  key={contact.id}
                  onClick={() => handleSelect('/crm/leads?highlight=' + encodeURIComponent(contact.id))}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-gray-50 dark:hover:bg-white/[0.04] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors text-left"
                >
                  <Users size={18} className="text-blue-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium truncate">{contact.contactPerson}</div>
                    <div className="text-xs text-slate-500 truncate">{contact.companyName || contact.email}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Deal results */}
          {query !== '' && canDeals && searchedDeals.length > 0 && (
            <div className="mb-4">
              <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Deals
              </div>
              {searchedDeals.map((deal) => (
                <button
                  key={deal.id}
                  onClick={() => handleSelect('/crm/deals?highlight=' + encodeURIComponent(deal.id))}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-gray-50 dark:hover:bg-white/[0.04] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors text-left"
                >
                  <Briefcase size={18} className="text-purple-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium truncate">{deal.title}</div>
                    <div className="text-xs text-slate-500 truncate">
                      {deal.companyName} · ${(deal.value ?? 0).toLocaleString()}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Empty state */}
          {query !== '' && !isSearching && !hasResults && (
            <div className="px-4 py-8 text-center text-slate-500">
              No results found for &ldquo;{query}&rdquo;
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
