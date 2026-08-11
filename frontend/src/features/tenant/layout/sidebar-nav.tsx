'use client';

import React, { useMemo } from 'react';
import { X, ChevronLeft, ChevronRight, Settings } from 'lucide-react';
import { useAuth } from '@/store/AuthContext';
import { useData } from '@/store/DataContext';
import AccountDropdown from './account-dropdown';
import { useLayout } from './use-layout';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SidebarNavProps {
  sidebarOpen: boolean;
  onCloseSidebar: () => void;
  navigate: (path: string) => void;
  isAccountDropdownOpen: boolean;
  onToggleAccountDropdown: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SidebarNav({
  sidebarOpen,
  onCloseSidebar,
  navigate,
  isAccountDropdownOpen,
  onToggleAccountDropdown,
  isCollapsed,
  onToggleCollapse,
}: SidebarNavProps): React.ReactElement {
  const { currentPath, filteredNav } = useLayout();
  const { user } = useAuth();
  const { tasks } = useData();

  const overdueCount = useMemo(
    () =>
      tasks.filter(
        (t) =>
          t.assignedUserId === user?.id &&
          t.status !== 'completed' &&
          t.status !== 'cancelled' &&
          !!t.dueDate &&
          new Date(t.dueDate) < new Date(),
      ).length,
    [tasks, user?.id],
  );

  const isSettingsActive = currentPath === 'settings';

  // On mobile, sidebar is always full-width when open; isCollapsed only applies on lg+
  return (
    <aside
      className={cn(
        'fixed lg:static inset-y-0 left-0 z-50',
        'bg-white dark:bg-slate-900',
        'border-r border-gray-200 dark:border-white/[0.08]',
        'transform transition-all duration-200 ease-in-out',
        'flex flex-col shadow-lg lg:shadow-none',
        // Mobile: slide in/out
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        // Width: mobile always 240px, desktop collapses to icon-strip
        'w-60',
        isCollapsed && 'lg:w-14',
      )}
    >
      {/* ── Logo + collapse button ───────────────────────────────── */}
      <div className={cn(
        'border-b shrink-0 transition-all',
        'border-slate-200 dark:border-slate-800',
        'flex items-center justify-between',
        isCollapsed ? 'lg:flex-col lg:gap-1 px-1.5 py-3' : 'px-4 py-4',
      )}>
        {/* Logo */}
        <div
          className={cn('flex items-center gap-3 min-w-0', isCollapsed && 'lg:justify-center')}
          title={isCollapsed ? 'LeadCRM' : undefined}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg overflow-hidden shrink-0 ring-1 ring-slate-200 dark:ring-slate-700 bg-white dark:bg-slate-800">
            <img
              src="/leadcrm_logo.png"
              alt="LeadCRM"
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          {!isCollapsed && (
            <h1 className="font-display text-base font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              Lead<span className="text-[#4A9EFF]">CRM</span>
            </h1>
          )}
        </div>

        {/* Mobile close button */}
        <button
          className="lg:hidden text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors p-1.5 rounded-md cursor-pointer shrink-0"
          onClick={onCloseSidebar}
          aria-label="Close sidebar"
        >
          <X size={18} />
        </button>

        {/* Desktop collapse toggle */}
        <button
          className={cn(
            'hidden lg:flex items-center justify-center rounded-lg transition-all cursor-pointer',
            'text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800',
            isCollapsed ? 'w-8 h-8 shrink-0' : 'w-7 h-7 shrink-0',
          )}
          onClick={onToggleCollapse}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* ── Main navigation ──────────────────────────────────────── */}
      <nav className="flex-1 flex flex-col gap-1 px-2 py-3 overflow-y-auto custom-scrollbar">
        {(() => {
          const groups: Record<string, typeof filteredNav> = {};
          const ungrouped: typeof filteredNav = [];

          filteredNav.forEach((item) => {
            const group = (item as any).group;
            if (group) {
              if (!groups[group]) groups[group] = [];
              groups[group].push(item);
            } else {
              ungrouped.push(item);
            }
          });

          const groupOrder = ['CRM', 'Operations', 'Marketing', 'Automation', 'Billing', 'Administration'];
          const orderedGroups = groupOrder.filter(g => groups[g]);

          return (
            <>
              {/* Ungrouped items (Dashboard, My Jobs, etc.) */}
              {ungrouped.map((item) => {
                const Icon = item.icon;
                const isActive = currentPath === item.path;
                const showOverdueBadge = item.path === 'tasks' && overdueCount > 0;

                return (
                  <button
                    key={item.path + item.name}
                    onClick={() => { navigate(item.path); onCloseSidebar(); }}
                    title={isCollapsed ? item.name : undefined}
                    className={cn(
                      'relative w-full flex items-center rounded-lg py-2.5 text-xs font-medium transition-all cursor-pointer',
                      isCollapsed ? 'lg:justify-center px-2' : 'gap-2.5 px-3',
                      isActive
                        ? 'text-white'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white',
                    )}
                    style={isActive ? { backgroundColor: 'var(--primary)' } : undefined}
                  >
                    {/* Active rail accent */}
                    {isActive && !isCollapsed && (
                      <div 
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full"
                        style={{ backgroundColor: 'var(--primary-dark)' }}
                      />
                    )}
                    <div className="relative shrink-0">
                      <Icon className="h-4 w-4" />
                      {isCollapsed && showOverdueBadge && (
                        <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-red-500" />
                      )}
                    </div>
                    {!isCollapsed && (
                      <>
                        <span className="truncate flex-1 text-left">{item.name}</span>
                        {showOverdueBadge && (
                          <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                            {overdueCount}
                          </span>
                        )}
                      </>
                    )}
                  </button>
                );
              })}

              {/* Grouped sections */}
              {orderedGroups.map((groupName) => (
                <div key={groupName} className="mt-4">
                  {!isCollapsed && (
                    <div className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-600">
                      {groupName}
                    </div>
                  )}
                  {isCollapsed && (
                    <div className="h-px bg-slate-200 dark:bg-slate-800 my-2 mx-2" />
                  )}
                  <div className="flex flex-col gap-0.5">
                    {groups[groupName].map((item) => {
                      const Icon = item.icon;
                      const isActive = currentPath === item.path;
                      const showOverdueBadge = item.path === 'tasks' && overdueCount > 0;

                      return (
                        <button
                          key={item.path + item.name}
                          onClick={() => { navigate(item.path); onCloseSidebar(); }}
                          title={isCollapsed ? item.name : undefined}
                          className={cn(
                            'relative w-full flex items-center rounded-lg py-2.5 text-xs font-medium transition-all cursor-pointer',
                            isCollapsed ? 'lg:justify-center px-2' : 'gap-2.5 px-3',
                            isActive
                              ? 'text-white'
                              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white',
                          )}
                          style={isActive ? { backgroundColor: 'var(--primary)' } : undefined}
                        >
                          {/* Active rail accent */}
                          {isActive && !isCollapsed && (
                            <div 
                              className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full"
                              style={{ backgroundColor: 'var(--primary-dark)' }}
                            />
                          )}
                          <div className="relative shrink-0">
                            <Icon className="h-4 w-4" />
                            {isCollapsed && showOverdueBadge && (
                              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-red-500" />
                            )}
                          </div>
                          {!isCollapsed && (
                            <>
                              <span className="truncate flex-1 text-left">{item.name}</span>
                              {showOverdueBadge && (
                                <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                                  {overdueCount}
                                </span>
                              )}
                            </>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </>
          );
        })()}
      </nav>

      {/* ── Footer: Settings + Account ───────────────────────────── */}
      <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 pt-2">
        {/* Settings button */}
        <div className="px-2 pb-1">
          <button
            onClick={() => { navigate('settings'); onCloseSidebar(); }}
            title={isCollapsed ? 'Settings' : undefined}
            className={cn(
              'relative w-full flex items-center rounded-lg py-2.5 text-xs font-medium transition-all cursor-pointer',
              isCollapsed ? 'lg:justify-center px-2' : 'gap-2.5 px-3',
              isSettingsActive
                ? 'text-white'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white',
            )}
            style={isSettingsActive ? { backgroundColor: 'var(--primary)' } : undefined}
          >
            {/* Active rail accent */}
            {isSettingsActive && !isCollapsed && (
              <div 
                className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full"
                style={{ backgroundColor: 'var(--primary-dark)' }}
              />
            )}
            <Settings className="h-4 w-4 shrink-0" />
            {!isCollapsed && <span className="truncate flex-1 text-left">Settings</span>}
          </button>
        </div>

        {/* Account dropdown — full mode on mobile & expanded desktop; collapsed avatar on lg collapsed */}
        <div className={cn(isCollapsed && 'lg:hidden')}>
          <AccountDropdown
            isOpen={isAccountDropdownOpen}
            onToggle={onToggleAccountDropdown}
            navigate={navigate}
          />
        </div>

        {/* Collapsed avatar-only version — only shows on desktop collapsed */}
        {isCollapsed && (
          <div className="hidden lg:flex justify-center px-1 pb-2">
            <AccountDropdown
              isOpen={isAccountDropdownOpen}
              onToggle={onToggleAccountDropdown}
              navigate={navigate}
              collapsed
            />
          </div>
        )}
      </div>
    </aside>
  );
}
