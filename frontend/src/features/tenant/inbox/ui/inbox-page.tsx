'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Inbox, Mail, ChevronDown, Check, Filter, ArrowDownAZ, Loader2, Pencil, Tag, Users, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';
import { getGmailStatus, fetchGmailEmails, GmailConnectionStatus, GmailEmail } from '../services/gmail.service';
import InboxCurrentEmpty from './inbox-current-empty';
import InboxDoneEmpty from './inbox-done-empty';
import InboxFutureEmpty from './inbox-future-empty';
import InboxEmailList from './inbox-email-list';
import EmailDetailView from './email-detail-view';
import ComposeModal from './compose-modal';

type InboxView = 'current' | 'done' | 'future' | 'drafts';
type InboxCategory = 'primary' | 'promotions' | 'social' | 'updates';

const VIEW_OPTIONS: { id: InboxView; label: string }[] = [
  { id: 'current', label: 'Current' },
  { id: 'done', label: 'Done' },
  { id: 'future', label: 'Future' },
  { id: 'drafts', label: 'Drafts' },
];

export default function InboxPage(): React.ReactElement {
  const [activeView, setActiveView] = useState<InboxView>('current');
  const [activeCategory, setActiveCategory] = useState<InboxCategory>('primary');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<GmailConnectionStatus | null>(null);
  const [emails, setEmails] = useState<GmailEmail[]>([]);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [isLoadingEmails, setIsLoadingEmails] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'unread'>('newest');
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeDraft, setComposeDraft] = useState<{ to: string; subject: string; body: string; draftId?: string } | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<GmailEmail | null>(null);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

  // Fetch connection status on mount
  useEffect(() => {
    setIsLoadingStatus(true);
    getGmailStatus()
      .then((status) => {
        setConnectionStatus(status);
        if (status.isConnected) {
          loadEmails('current', 'primary');
        }
      })
      .catch(() => {
        setConnectionStatus({ isConnected: false, email: null, connectedAt: null, lastSyncAt: null });
      })
      .finally(() => setIsLoadingStatus(false));
  }, []);

  // Reload emails when view or category changes
  useEffect(() => {
    if (connectionStatus?.isConnected) {
      loadEmails(activeView, activeCategory);
    }
  }, [activeView, activeCategory, filterQuery, connectionStatus?.isConnected]);

  const getQueryForViewAndCategory = (view: InboxView, category: InboxCategory): string => {
    let baseQuery = '';

    if (view === 'done') baseQuery = 'is:read -in:inbox';
    else if (view === 'future') baseQuery = 'in:snoozed OR in:scheduled';
    else if (view === 'drafts') baseQuery = 'in:drafts';
    else {
      // Current view — filter by category
      switch (category) {
        case 'primary':
          baseQuery = 'in:inbox category:primary';
          break;
        case 'promotions':
          baseQuery = 'in:inbox category:promotions';
          break;
        case 'social':
          baseQuery = 'in:inbox category:social';
          break;
        case 'updates':
          baseQuery = 'in:inbox category:updates';
          break;
        default:
          baseQuery = 'in:inbox';
      }
    }

    // Append filter query if set
    if (filterQuery) {
      baseQuery = `${baseQuery} ${filterQuery}`;
    }

    return baseQuery;
  };

  const loadEmails = useCallback(async (view?: InboxView, category?: InboxCategory, pageToken?: string): Promise<void> => {
    setIsLoadingEmails(true);
    setEmailError(null);
    try {
      const query = getQueryForViewAndCategory(view ?? activeView, category ?? activeCategory);
      const result = await fetchGmailEmails({ maxResults: 30, query, pageToken });
      setEmails(result.emails);
      setNextPageToken(result.nextPageToken);
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : 'Failed to load emails');
    } finally {
      setIsLoadingEmails(false);
    }
  }, [activeView, activeCategory, filterQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
      if (sortRef.current && !sortRef.current.contains(event.target as Node)) {
        setIsSortOpen(false);
      }
    };
    if (isDropdownOpen || isFilterOpen || isSortOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDropdownOpen, isFilterOpen, isSortOpen]);

  const activeViewLabel = VIEW_OPTIONS.find((v) => v.id === activeView)?.label ?? 'Current';
  const isConnected = connectionStatus?.isConnected === true;
  const emailCount = emails.length;

  // Sort emails based on sortOrder
  const sortedEmails = [...emails].sort((a, b) => {
    if (sortOrder === 'oldest') {
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    }
    if (sortOrder === 'unread') {
      if (!a.isRead && b.isRead) return -1;
      if (a.isRead && !b.isRead) return 1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    }
    // newest first (default)
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  const handleNextPage = (): void => {
    if (nextPageToken) {
      setCurrentPage((p) => p + 1);
      loadEmails(undefined, undefined, nextPageToken);
    }
  };

  const handlePrevPage = (): void => {
    if (currentPage > 1) {
      setCurrentPage(1);
      loadEmails();
    }
  };

  const handleEmailClick = (email: GmailEmail): void => {
    if (activeView === 'drafts') {
      // Open compose modal pre-filled with draft content
      setComposeDraft({
        to: email.to.join(', '),
        subject: email.subject,
        body: email.body,
        draftId: email.id,
      });
      setIsComposeOpen(true);
    } else {
      setSelectedEmail(email);
    }
  };

  const contentAnimation = shouldReduceMotion
    ? {}
    : { initial: { opacity: 0, y: 15 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } };

  const renderContent = (): React.ReactElement => {
    if (isLoadingStatus) {
      return (
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
        </div>
      );
    }

    // Not connected — show connect empty state
    if (!isConnected) return <InboxCurrentEmpty />;

    if (isLoadingEmails) {
      return (
        <div className="flex flex-col items-center justify-center h-96 gap-3">
          <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading emails...</p>
        </div>
      );
    }

    if (emailError) {
      return (
        <div className="flex flex-col items-center justify-center h-96 px-6 text-center">
          <p className="text-sm text-red-500 dark:text-red-400 mb-3">{emailError}</p>
          <button
            onClick={() => loadEmails()}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
          >
            Try again
          </button>
        </div>
      );
    }

    // Show empty states only when there are no emails
    if (emails.length === 0) {
      if (activeView === 'done') return <InboxDoneEmpty />;
      if (activeView === 'future') return <InboxFutureEmpty />;
      if (activeView === 'drafts') {
        return (
          <div className="flex flex-col items-center justify-center h-full px-6 py-16">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-500/10 border border-slate-500/20 mb-6">
              <svg className="w-8 h-8 text-slate-400 dark:text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
            </div>
            <h3 className="font-display text-xl font-bold tracking-tight text-slate-900 dark:text-white mb-3">
              No drafts
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Saved drafts will appear here. Click Compose to start writing.
            </p>
          </div>
        );
      }
    }

    return <InboxEmailList emails={sortedEmails} onEmailsChanged={() => loadEmails()} totalCount={emailCount} onEmailClick={handleEmailClick} currentPage={currentPage} hasNextPage={!!nextPageToken} onNextPage={handleNextPage} onPrevPage={handlePrevPage} />;
  };

  // If an email is selected, show the detail view
  if (selectedEmail) {
    return (
      <motion.div {...contentAnimation} className="flex flex-col h-full -m-4 lg:-m-6">
        <div className="flex-1 overflow-hidden rounded-2xl border border-gray-200 dark:border-white/[0.05] bg-white dark:bg-white/[0.02] mx-6 mt-6">
          <EmailDetailView
            email={selectedEmail}
            onBack={() => setSelectedEmail(null)}
            onEmailsChanged={() => { loadEmails(); setSelectedEmail(null); }}
          />
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div {...contentAnimation} className="flex flex-col h-full -m-4 lg:-m-6">
      {/* Page Header */}
      <div className="px-6 pt-6 pb-0 shrink-0">
        {/* Title row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Inbox
            </h1>

            {/* View dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen((prev) => !prev)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-transparent text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-colors cursor-pointer"
                aria-haspopup="listbox"
                aria-expanded={isDropdownOpen}
                aria-label={`View: ${activeViewLabel}`}
              >
                <span>{activeViewLabel}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              <AnimatePresence>
                {isDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.97, y: 4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97, y: 4 }}
                    transition={{ duration: 0.12 }}
                    className="absolute top-full left-0 mt-1.5 w-44 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-slate-800 shadow-lg py-1 z-10"
                    role="listbox"
                    aria-label="Inbox view options"
                  >
                    {VIEW_OPTIONS.map((option) => {
                      const isActive = activeView === option.id;
                      return (
                        <button
                          key={option.id}
                          onClick={() => {
                            setActiveView(option.id);
                            setIsDropdownOpen(false);
                          }}
                          className={`
                            w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors cursor-pointer
                            ${isActive
                              ? 'bg-blue-600/10 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 font-medium'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.05]'}
                          `}
                          role="option"
                          aria-selected={isActive}
                        >
                          {isActive && <Check className="w-4 h-4 text-blue-500" />}
                          {!isActive && <span className="w-4" />}
                          <span>{option.label}</span>
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Header actions — Filter & Sort */}
          <div className="flex items-center gap-2">
            {/* Filter dropdown */}
            <div className="relative" ref={filterRef}>
              <button
                onClick={() => { setIsFilterOpen((prev) => !prev); setIsSortOpen(false); }}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer border',
                  filterQuery
                    ? 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
                    : 'border-gray-200 dark:border-white/[0.08] bg-white dark:bg-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.05]',
                )}
                aria-label="Filter emails"
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Filter</span>
                {filterQuery && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
              </button>

              <AnimatePresence>
                {isFilterOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.97, y: 4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97, y: 4 }}
                    transition={{ duration: 0.12 }}
                    className="absolute top-full right-0 mt-1.5 w-56 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-slate-800 shadow-lg py-1 z-10"
                  >
                    <p className="px-3 py-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                      Filter by
                    </p>
                    {[
                      { label: 'All emails', query: '' },
                      { label: 'Unread only', query: 'is:unread' },
                      { label: 'Has attachment', query: 'has:attachment' },
                      { label: 'From me', query: 'from:me' },
                    ].map((option) => (
                      <button
                        key={option.label}
                        onClick={() => {
                          setFilterQuery(option.query);
                          setIsFilterOpen(false);
                          loadEmails();
                        }}
                        className={cn(
                          'w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors cursor-pointer',
                          filterQuery === option.query
                            ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 font-medium'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.05]',
                        )}
                      >
                        {filterQuery === option.query && <Check className="w-3.5 h-3.5 text-blue-500" />}
                        {filterQuery !== option.query && <span className="w-3.5" />}
                        <span>{option.label}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Sort dropdown */}
            <div className="relative" ref={sortRef}>
              <button
                onClick={() => { setIsSortOpen((prev) => !prev); setIsFilterOpen(false); }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-transparent text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-colors cursor-pointer"
                aria-label="Sort emails"
              >
                <ArrowDownAZ className="w-3.5 h-3.5" />
                <span>Sort</span>
              </button>

              <AnimatePresence>
                {isSortOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.97, y: 4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97, y: 4 }}
                    transition={{ duration: 0.12 }}
                    className="absolute top-full right-0 mt-1.5 w-48 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-slate-800 shadow-lg py-1 z-10"
                  >
                    <p className="px-3 py-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                      Sort by
                    </p>
                    {[
                      { label: 'Newest first', value: 'newest' as const },
                      { label: 'Oldest first', value: 'oldest' as const },
                      { label: 'Unread first', value: 'unread' as const },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setSortOrder(option.value);
                          setIsSortOpen(false);
                        }}
                        className={cn(
                          'w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors cursor-pointer',
                          sortOrder === option.value
                            ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 font-medium'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.05]',
                        )}
                      >
                        {sortOrder === option.value && <Check className="w-3.5 h-3.5 text-blue-500" />}
                        {sortOrder !== option.value && <span className="w-3.5" />}
                        <span>{option.label}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Category chips — LeadCRM style */}
        {isConnected && activeView === 'current' && (
          <div className="flex items-center gap-2 mt-3">
            {[
              { id: 'primary' as const, label: 'Primary', icon: Inbox, color: 'blue' },
              { id: 'promotions' as const, label: 'Promotions', icon: Tag, color: 'emerald' },
              { id: 'social' as const, label: 'Social', icon: Users, color: 'violet' },
              { id: 'updates' as const, label: 'Updates', icon: Info, color: 'amber' },
            ].map((tab) => {
              const isActive = activeCategory === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveCategory(tab.id)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer border',
                    isActive && tab.color === 'blue' && 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/60',
                    isActive && tab.color === 'emerald' && 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60',
                    isActive && tab.color === 'violet' && 'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-800/60',
                    isActive && tab.color === 'amber' && 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/60',
                    !isActive && 'border-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.05] hover:text-slate-700 dark:hover:text-slate-300',
                  )}
                  aria-label={tab.label}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto rounded-t-2xl border border-gray-200 dark:border-white/[0.05] bg-white dark:bg-white/[0.02] mx-6">
        {renderContent()}
      </div>

      {/* Floating Compose Button — hide when compose is open */}
      {isConnected && !isComposeOpen && (
        <button
          onClick={() => setIsComposeOpen(true)}
          className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2.5 h-14 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-xl shadow-blue-500/30 active:scale-95 transition-all cursor-pointer"
          aria-label="Compose new email"
        >
          <Pencil className="w-5 h-5" />
          <span className="hidden sm:inline">Compose</span>
        </button>
      )}

      {/* Compose Modal */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => { setIsComposeOpen(false); setComposeDraft(null); }}
        onSent={() => loadEmails()}
        initialDraft={composeDraft}
      />
    </motion.div>
  );
}
