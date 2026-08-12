'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Menu, Bell, Mail, Sun, Moon, Search, ChevronRight } from 'lucide-react';
import { useAuth } from '@/store/AuthContext';
import { useData } from '@/store/DataContext';
import { useNotifications } from '@/features/tenant/notifications/hooks/use-notifications';
import { useTheme } from '@/shared/hooks/use-theme';
import { getGmailStatus, fetchGmailEmails } from '@/features/tenant/inbox/services/gmail.service';
import { useLayout, NAV_ITEMS } from './use-layout';
import { useRouter } from 'next/navigation';
import NotificationsDropdown from '@/features/tenant/notifications/ui/notifications-dropdown';
import { cn } from '@/lib/utils';

interface TopbarProps {
  onOpenSidebar: () => void;
  onOpenInbox: () => void;
}

export default function Topbar({ onOpenSidebar, onOpenInbox }: TopbarProps) {
  const { user, switchRole } = useAuth();
  const { resetDemoData, roles } = useData();
  const { unreadCount: notificationCount } = useNotifications();
  const { theme, toggleTheme, isDark } = useTheme();
  const { currentPath } = useLayout();
  const [inboxCount, setInboxCount] = useState(0);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notificationButtonRef = useRef<HTMLButtonElement>(null!);
  const router = useRouter();

  // Get current module name from navigation
  const currentModule = NAV_ITEMS.find(item => item.path === currentPath)?.name || 
    (currentPath === 'notifications' ? 'Notifications' : 
     currentPath === 'inbox' ? 'Messages' : 'Dashboard');

  // Fetch unread email count for badge
  useEffect(() => {
    let isMounted = true;
    getGmailStatus()
      .then((status) => {
        if (status.isConnected) {
          return fetchGmailEmails({ maxResults: 30, query: 'in:inbox is:unread' });
        }
        return null;
      })
      .then((result) => {
        if (isMounted && result) {
          setInboxCount(result.emails.length);
        }
      })
      .catch(() => { /* silently ignore */ });

    return () => { isMounted = false; };
  }, []);

  return (
    <header className="h-14 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-gray-200 dark:border-white/[0.08] flex items-center justify-between px-4 lg:px-6 shrink-0 sticky top-0 z-40 transition-colors duration-200">
      {/* Left: Mobile menu + Breadcrumb */}
      <div className="flex items-center gap-4 flex-1 lg:min-w-[240px]">
        <button
          className="lg:hidden text-slate-500 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 p-2 rounded-lg transition-colors cursor-pointer"
          onClick={onOpenSidebar}
          aria-label="Open sidebar"
        >
          <Menu size={18} />
        </button>
        
        {/* Breadcrumb */}
        <div className="hidden lg:flex items-center gap-2 text-sm">
          <span className="font-semibold text-blue-600 dark:text-blue-400">
            LeadCRM
          </span>
          <ChevronRight size={14} className="text-slate-400 dark:text-slate-500" />
          <span className="text-slate-900 dark:text-slate-100 font-medium">
            {currentModule}
          </span>
        </div>
      </div>

      {/* Center: Global Search (Desktop) */}
      <div className="hidden lg:flex flex-1 max-w-[400px] mx-4">
        <div className="relative w-full">
          <input
            type="text"
            placeholder="Search contacts, deals, campaigns..."
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-400 transition-all"
          />
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 lg:gap-3 flex-1 justify-end lg:min-w-[240px]">
        {/* Role Switcher (non-system users) */}
        {user?.tenantId !== 'system' && (
          <div className="hidden sm:flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/[0.08]">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Role:</span>
            <select
              value={user?.role}
              onChange={(e) => switchRole(e.target.value)}
              className="bg-transparent text-xs font-semibold focus:outline-none cursor-pointer text-slate-900 dark:text-slate-100"
            >
              {roles.map(r => (
                <option key={r.id} value={r.name}>{r.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Reset Demo (System Admin) */}
        {user?.role === 'System Admin' && (
          <button 
            onClick={resetDemoData}
            className="text-xs bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 px-3 py-1.5 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors font-semibold border border-rose-200 dark:border-rose-800/60 cursor-pointer active:scale-95"
          >
            Reset Demo
          </button>
        )}

        {/* Theme Toggle */}
        <button 
          onClick={toggleTheme}
          className="relative p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer active:scale-95"
          title={`Switch to ${theme === 'Light' ? 'Dark' : 'Light'} Mode`}
          aria-label={`Switch to ${theme === 'Light' ? 'Dark' : 'Light'} Mode`}
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Inbox */}
        <button 
          onClick={onOpenInbox}
          className={cn(
            "relative p-2 transition-all rounded-lg cursor-pointer active:scale-95",
            currentPath === 'inbox'
              ? "bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400"
              : "hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-600 dark:text-blue-400"
          )}
          title="Open Inbox"
          aria-label="Open Inbox"
        >
          <Mail className="w-4 h-4" />
          {inboxCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center">
              {inboxCount}
            </span>
          )}
        </button>

        {/* Notifications */}
        <button 
          ref={notificationButtonRef}
          onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
          className={cn(
            "relative p-2 transition-all rounded-lg cursor-pointer active:scale-95",
            isNotificationsOpen || currentPath === 'notifications'
              ? "bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400"
              : "text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
          )}
          aria-label="Notifications"
          aria-expanded={isNotificationsOpen}
          aria-haspopup="dialog"
        >
          <Bell size={16} />
          {notificationCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-500" aria-label={`${notificationCount} unread notifications`} />
          )}
        </button>
      </div>

      {/* Notifications Dropdown */}
      <NotificationsDropdown
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        triggerRef={notificationButtonRef}
      />
    </header>
  );
}
