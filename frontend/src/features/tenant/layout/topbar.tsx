'use client';

import React from 'react';
import { Menu, Bell, StickyNote, Sun, Moon } from 'lucide-react';
import { useAuth } from '@/store/AuthContext';
import { useData } from '@/store/DataContext';
import { useTheme } from '@/shared/hooks/useTheme';

interface TopbarProps {
  onOpenSidebar: () => void;
  onOpenNotes: () => void;
}

export default function Topbar({ onOpenSidebar, onOpenNotes }: TopbarProps) {
  const { user, switchRole } = useAuth();
  const { resetDemoData, roles } = useData();
  const { theme, toggleTheme, isDark } = useTheme();

  return (
    <header className="h-16 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200/60 dark:border-white/[0.05] flex items-center justify-between px-4 lg:px-8 shrink-0 sticky top-0 z-30 transition-colors duration-300">
      <div className="flex items-center gap-4 flex-1">
        <button
          className="lg:hidden text-gray-400 hover:text-gray-900 dark:hover:text-white bg-gray-100 dark:bg-white/[0.05] p-2 rounded-lg transition-colors"
          onClick={onOpenSidebar}
        >
          <Menu size={20} />
        </button>
      </div>

      <div className="flex items-center gap-4">
        {user?.tenantId !== 'system' && (
          <div className="hidden sm:flex items-center gap-2 bg-gray-50 dark:bg-white/[0.02] px-3 py-1.5 rounded-full border border-gray-200 dark:border-white/[0.08]">
            <span className="text-xs font-medium text-gray-500 dark:text-slate-500">Role:</span>
            <select
              value={user?.role}
              onChange={(e) => switchRole(e.target.value)}
              className="bg-transparent text-xs font-medium text-gray-700 dark:text-slate-300 focus:outline-none cursor-pointer"
            >
              {roles.map(r => (
                <option key={r.id} value={r.name} className="dark:bg-slate-900">{r.name}</option>
              ))}
            </select>
          </div>
        )}

        {user?.role === 'System Admin' && (
          <button onClick={resetDemoData}
            className="text-xs bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 px-3 py-1.5 rounded-full hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors font-medium border border-red-200 dark:border-red-500/30 cursor-pointer">
            Reset Demo
          </button>
        )}

        <button onClick={toggleTheme}
          className="relative p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-white/[0.05]"
          title={`Switch to ${theme === 'Light' ? 'Dark' : 'Light'} Mode`}
          id="header-theme-toggle">
          {isDark ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
        </button>

        <button onClick={onOpenNotes}
          className="relative p-2 text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 transition-colors rounded-full hover:bg-blue-500/10"
          title="Open Scratchpad Notes"
          id="header-notes-toggle">
          <StickyNote className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-amber-500 rounded-full border-2 border-slate-100 dark:border-slate-900 animate-bounce" />
        </button>

        <button className="relative p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-white/[0.05]">
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-500 rounded-full border-2 border-slate-50 dark:border-slate-950" />
        </button>
      </div>
    </header>
  );
}
