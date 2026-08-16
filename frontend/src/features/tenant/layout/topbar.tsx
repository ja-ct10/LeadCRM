'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Menu, Bell, Mail, Settings, Plus } from 'lucide-react';
import { useNotifications } from '@/features/tenant/notifications/hooks/use-notifications';
import { getGmailStatus, fetchGmailEmails } from '@/features/tenant/inbox/services/gmail.service';
import { useLayout, NAV_ITEMS } from './use-layout';
import NotificationsDropdown from '@/features/tenant/notifications/ui/notifications-dropdown';
import { GlobalOmnibox } from '@/shared/components/global-omnibox';
import { UserProfileDropdown } from './user-profile-dropdown';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TopbarProps {
  onOpenSidebar: () => void;
  onOpenInbox: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Topbar({ onOpenSidebar, onOpenInbox }: TopbarProps): React.ReactElement {
  const { unreadCount: notificationCount } = useNotifications();
  const { currentPath, navigate } = useLayout();
  const [inboxCount, setInboxCount] = useState(0);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notificationButtonRef = useRef<HTMLButtonElement>(null!);

  // Fetch unread email count for inbox badge
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
      .catch(() => { /* silently ignore — Gmail may not be connected */ });

    return () => { isMounted = false; };
  }, []);

  // Get current module name from navigation
  const currentModule = NAV_ITEMS.find(item => item.path === currentPath)?.name ||
    (currentPath === 'notifications' ? 'Notifications' :
     currentPath === 'inbox' ? 'Messages' : 'Dashboard');

  // Get parent group for breadcrumb
  const currentGroup = NAV_ITEMS.find(item => item.path === currentPath);
  const groupName = (currentGroup as any)?.group ?? '';

  return (
    <header className="h-[52px] bg-[var(--surface)] border-b border-[var(--border)] flex items-center justify-between px-4 lg:px-5 shrink-0 sticky top-0 z-40 transition-colors duration-200">
      {/* Left: Mobile hamburger + Breadcrumb */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <button
          className="lg:hidden text-[var(--text-tertiary)] hover:text-[var(--text-primary)] p-1.5 rounded-lg transition-colors"
          onClick={onOpenSidebar}
          aria-label="Open sidebar"
        >
          <Menu size={18} />
        </button>

        {/* Breadcrumb */}
        <div className="hidden lg:flex items-center gap-1.5 text-[13px] min-w-0">
          {groupName && (
            <>
              <span className="text-[var(--text-tertiary)] font-medium">
                {groupName}
              </span>
              <span className="text-[var(--text-tertiary)] opacity-50">
                &gt;
              </span>
            </>
          )}
          <span className="text-[var(--text-primary)] font-semibold truncate">
            {currentModule}
          </span>
        </div>
      </div>

      {/* Center: Global Search Omnibox */}
      <div className="hidden md:flex flex-1 max-w-[460px] mx-4 justify-center">
        <GlobalOmnibox />
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5 flex-1 justify-end">
        {/* Quick Create */}
        <button
          className="w-8 h-8 rounded-lg bg-[#D94F4F] hover:bg-[#C24545] text-white flex items-center justify-center transition-colors shadow-sm active:scale-95"
          aria-label="Quick create"
          title="Quick create"
        >
          <Plus size={16} />
        </button>

        {/* Inbox (Gmail) */}
        <button
          onClick={onOpenInbox}
          className={cn(
            'relative w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
            currentPath === 'inbox'
              ? 'bg-[#D94F4F]/10 text-[#D94F4F]'
              : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)]',
          )}
          aria-label="Open Inbox"
          title="Messages"
        >
          <Mail size={16} />
          {inboxCount > 0 && (
            <span className="absolute top-1 right-1 min-w-[16px] h-[16px] px-0.5 rounded-full bg-emerald-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
              {inboxCount > 99 ? '99+' : inboxCount}
            </span>
          )}
        </button>

        {/* Notifications */}
        <button
          ref={notificationButtonRef}
          onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
          className={cn(
            'relative w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
            isNotificationsOpen
              ? 'bg-[#D94F4F]/10 text-[#D94F4F]'
              : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)]',
          )}
          aria-label="Notifications"
          aria-expanded={isNotificationsOpen}
        >
          <Bell size={16} />
          {notificationCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#D94F4F]" />
          )}
        </button>

        {/* Settings */}
        <button
          onClick={() => navigate('settings')}
          className="w-8 h-8 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] flex items-center justify-center transition-colors"
          aria-label="Settings"
          title="Settings"
        >
          <Settings size={16} />
        </button>

        {/* User Profile Dropdown */}
        <div className="ml-1">
          <UserProfileDropdown />
        </div>
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
