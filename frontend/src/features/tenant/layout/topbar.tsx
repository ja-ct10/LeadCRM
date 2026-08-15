'use client';

import React, { useState, useRef } from 'react';
import { Menu, Bell, Search, Settings, Plus } from 'lucide-react';
import { useAuth } from '@/store/AuthContext';
import { useNotifications } from '@/features/tenant/notifications/hooks/use-notifications';
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

export default function Topbar({ onOpenSidebar }: TopbarProps): React.ReactElement {
  const { user } = useAuth();
  const { unreadCount: notificationCount } = useNotifications();
  const { currentPath, navigate } = useLayout();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notificationButtonRef = useRef<HTMLButtonElement>(null!);

  // Get current module name from navigation
  const currentModule = NAV_ITEMS.find(item => item.path === currentPath)?.name ||
    (currentPath === 'notifications' ? 'Notifications' :
     currentPath === 'inbox' ? 'Messages' : 'Dashboard');

  // Get parent group for breadcrumb
  const currentGroup = NAV_ITEMS.find(item => item.path === currentPath);
  const groupName = (currentGroup as any)?.group ?? '';

  const initials = `${user?.firstName?.charAt(0) ?? 'U'}${user?.lastName?.charAt(0) ?? ''}`.toUpperCase();

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
