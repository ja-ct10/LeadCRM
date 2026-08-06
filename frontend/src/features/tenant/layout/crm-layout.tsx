'use client';

import React, { useState } from 'react';
import SidebarNav from './sidebar-nav';
import Topbar from './topbar';
import { useLayout } from './use-layout';

/**
 * CrmLayout — tenant portal shell.
 * Composes sidebar, topbar, and content area.
 * Navigation items and permissions are owned by `use-layout.ts` (single source of truth).
 */
export default function CrmLayout({ children }: { children: React.ReactNode }) {
  const { navigate } = useLayout();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-[#030712]">
      <SidebarNav
        sidebarOpen={sidebarOpen}
        onCloseSidebar={() => setSidebarOpen(false)}
        navigate={navigate}
        isAccountDropdownOpen={isAccountDropdownOpen}
        onToggleAccountDropdown={() => setIsAccountDropdownOpen(prev => !prev)}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar
          onOpenSidebar={() => setSidebarOpen(true)}
          onOpenNotes={() => {}}
        />

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>

      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
