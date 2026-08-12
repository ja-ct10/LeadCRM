'use client';

import React, { useState, useEffect, useRef } from 'react';
import SidebarNav from './sidebar-nav';
import Topbar from './topbar';
import { useLayout } from './use-layout';

const SIDEBAR_COLLAPSED_KEY = 'leadcrm_sidebar_collapsed';

/**
 * CrmLayout — tenant portal shell.
 * Composes sidebar, topbar, and content area.
 * Navigation items and permissions are owned by `use-layout.ts`.
 * Dark mode is scoped to this container via [data-theme-container] so
 * public pages (login, landing, onboarding) always render in light mode.
 */
export default function CrmLayout({ children }: { children: React.ReactNode }) {
  const { navigate } = useLayout();
  const containerRef = useRef<HTMLDivElement>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);       // mobile overlay open
  const [isCollapsed, setIsCollapsed] = useState(false);       // desktop collapsed
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);

  // Restore collapse preference from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      if (stored !== null) setIsCollapsed(stored === 'true');
    } catch { /* noop */ }
  }, []);

  // Sync theme to this container on mount (useTheme hook handles updates via themechange event)
  useEffect(() => {
    if (containerRef.current) {
      const saved = localStorage.getItem('app_theme');
      if (saved === 'Dark') {
        containerRef.current.classList.add('dark');
      } else {
        containerRef.current.classList.remove('dark');
      }
    }

    // Listen for theme changes from useTheme hook
    const handleThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ theme: 'Light' | 'Dark' }>;
      if (containerRef.current) {
        if (customEvent.detail?.theme === 'Dark') {
          containerRef.current.classList.add('dark');
        } else {
          containerRef.current.classList.remove('dark');
        }
      }
    };

    window.addEventListener('themechange', handleThemeChange);
    return () => window.removeEventListener('themechange', handleThemeChange);
  }, []);

  const handleToggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next)); } catch { /* noop */ }
      return next;
    });
  };

  return (
    <div ref={containerRef} data-theme-container className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      <SidebarNav
        sidebarOpen={sidebarOpen}
        onCloseSidebar={() => setSidebarOpen(false)}
        navigate={navigate}
        isAccountDropdownOpen={isAccountDropdownOpen}
        onToggleAccountDropdown={() => setIsAccountDropdownOpen((prev) => !prev)}
        isCollapsed={isCollapsed}
        onToggleCollapse={handleToggleCollapse}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar
          onOpenSidebar={() => setSidebarOpen(true)}
          onOpenInbox={() => navigate('inbox')}
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
