'use client';

import React, { useMemo } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '@/store/AuthContext';
import { useData } from '@/store/DataContext';
import AccountDropdown from './account-dropdown';
import { useLayout } from './use-layout';

interface SidebarNavProps {
  sidebarOpen: boolean;
  onCloseSidebar: () => void;
  navigate: (path: string) => void;
  isAccountDropdownOpen: boolean;
  onToggleAccountDropdown: () => void;
}

export default function SidebarNav({
  sidebarOpen,
  onCloseSidebar,
  navigate,
  isAccountDropdownOpen,
  onToggleAccountDropdown,
}: SidebarNavProps) {
  const { currentPath, filteredNav } = useLayout();
  const { user } = useAuth();
  const { tasks } = useData();

  const overdueCount = useMemo(() =>
    tasks.filter(t =>
      t.assignedUserId === user?.id &&
      t.status !== 'completed' &&
      t.status !== 'cancelled' &&
      !!t.dueDate && new Date(t.dueDate) < new Date(),
    ).length,
    [tasks, user?.id],
  );

  return (
    <aside className={`
      fixed lg:static inset-y-0 left-0 z-50 w-60 bg-white dark:bg-slate-900
      border-r border-slate-200 dark:border-slate-800
      transform transition-transform duration-200 ease-in-out flex flex-col shadow-lg lg:shadow-none
      ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
    `}>
      {/* Logo */}
      <div className="border-b border-slate-200 dark:border-slate-800 px-4 py-3 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white ring-1 ring-slate-200 dark:ring-slate-700 overflow-hidden shrink-0">
            <img src="/leadcrm_logo.png" alt="LeadCRM Logo" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
          </div>
          <h1 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">LeadCRM</h1>
        </div>
        <button
          className="lg:hidden text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors p-1.5 rounded-md cursor-pointer"
          onClick={onCloseSidebar}
        >
          <X size={18} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-0.5 px-3 py-3 overflow-y-auto custom-scrollbar">
        {filteredNav.map((item) => {
          const Icon = item.icon;
          const isActive = currentPath === item.path;
          // Show overdue badge on Tasks nav item
          const showOverdueBadge = item.path === 'tasks' && overdueCount > 0;
          return (
            <button
              key={item.path + item.name}
              onClick={() => { navigate(item.path); onCloseSidebar(); }}
              className={`
                w-full flex items-center gap-2.5 rounded-md px-3 py-2 text-xs font-medium transition-colors cursor-pointer
                ${isActive
                  ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white border border-transparent'}
              `}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate flex-1 text-left">{item.name}</span>
              {showOverdueBadge && (
                <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {overdueCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Account dropdown at bottom of sidebar */}
      <AccountDropdown
        isOpen={isAccountDropdownOpen}
        onToggle={onToggleAccountDropdown}
        navigate={navigate}
      />
    </aside>
  );
}
