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
      fixed lg:static inset-y-0 left-0 z-50 w-64 bg-slate-100/40 dark:bg-slate-900/40 backdrop-blur-md
      border-r border-slate-200/60 dark:border-white/[0.05]
      transform transition-transform duration-300 ease-in-out flex flex-col shadow-xl lg:shadow-none
      ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
    `}>
      {/* Logo */}
      <div className="border-b border-gray-200 dark:border-white/[0.08] p-6 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white bg-opacity-95 ring-1 ring-blue-500/20 overflow-hidden shrink-0">
            <img src="/leadcrm_logo.png" alt="LeadCRM Logo" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-white">LeadCRM</h1>
        </div>
        <button
          className="lg:hidden text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors p-1.5 rounded-lg"
          onClick={onCloseSidebar}
        >
          <X size={18} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-1 p-4 overflow-y-auto custom-scrollbar">
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
                w-full flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors
                ${isActive
                  ? 'bg-blue-500/10 text-blue-500 ring-1 ring-blue-500/20'
                  : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-white/[0.05] hover:text-gray-900 dark:hover:text-white'}
              `}
            >
              <Icon className="h-5 w-5 shrink-0" />
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
