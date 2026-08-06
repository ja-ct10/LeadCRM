'use client';

import React from 'react';
import { Menu, Bell, StickyNote, Sun, Moon } from 'lucide-react';
import { useAuth } from '@/store/AuthContext';
import { useData } from '@/store/DataContext';
import { useTheme } from '@/shared/hooks/use-theme';

interface TopbarProps {
  onOpenSidebar: () => void;
  onOpenNotes: () => void;
}

export default function Topbar({ onOpenSidebar, onOpenNotes }: TopbarProps) {
  const { user, switchRole } = useAuth();
  const { resetDemoData, roles } = useData();
  const { theme, toggleTheme, isDark } = useTheme();

  return (
    <header className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 lg:px-6 shrink-0 sticky top-0 z-30 transition-colors duration-200">
      <div className="flex items-center gap-4 flex-1">
        <button
          className="lg:hidden text-slate-500 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 p-2 rounded-md transition-colors cursor-pointer"
          onClick={onOpenSidebar}
        >
          <Menu size={18} />
        </button>
      </div>

      <div className="flex items-center gap-3">
        {user?.tenantId !== 'system' && (
          <div className="hidden sm:flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Role:</span>
            <select
              value={user?.role}
              onChange={(e) => switchRole(e.target.value)}
              className="bg-transparent text-xs font-medium text-slate-900 dark:text-white focus:outline-none cursor-pointer"
            >
              {roles.map(r => (
                <option key={r.id} value={r.name} className="dark:bg-slate-900">{r.name}</option>
              ))}
            </select>
          </div>
        )}

        {user?.role === 'System Admin' && (
          <button onClick={resetDemoData}
            className="text-xs bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 px-2.5 py-1 rounded-md hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors font-medium border border-rose-200 dark:border-rose-800/60 cursor-pointer">
            Reset Demo
          </button>
        )}

        <button onClick={toggleTheme}
          className="relative p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          title={`Switch to ${theme === 'Light' ? 'Dark' : 'Light'} Mode`}
          id="header-theme-toggle">
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
        </button>

        <button onClick={onOpenNotes}
          className="relative p-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors rounded-md hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer"
          title="Open Scratchpad Notes"
          id="header-notes-toggle">
          <StickyNote className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-amber-500 rounded-full animate-bounce" />
        </button>

        <button className="relative p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
          <Bell size={16} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-600 rounded-full" />
        </button>
      </div>
    </header>

  );
}
