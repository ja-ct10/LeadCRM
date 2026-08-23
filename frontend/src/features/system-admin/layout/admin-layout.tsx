'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard, Building2, CreditCard, Receipt, Activity,
  ChevronLeft, ChevronRight, Menu, X, Bell,
} from 'lucide-react';
import { useAuth } from '@/store/AuthContext';
import { useNotifications } from '@/features/tenant/notifications/hooks/use-notifications';
import NotificationsDropdown from '@/features/tenant/notifications/ui/notifications-dropdown';
import { useThemeContainer } from '@/shared/hooks/use-theme-container';
import { cn } from '@/lib/utils';
import { AdminProfileDropdown } from './admin-profile-dropdown';

// ── Types ─────────────────────────────────────────────────────────────────────

interface NavItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  label: string | null;
  items: NavItem[];
}

interface AdminLayoutProps {
  children:     React.ReactNode;
  currentPath:  string;
  navigate:     (path: string) => void;
  /** Optional sub-page label appended to the topbar breadcrumb, e.g. "Edit Professional" */
  subLabel?:    string | null;
}

// ── Navigation ────────────────────────────────────────────────────────────────

const NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [
      { name: 'Dashboard', path: 'admin-dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'PLATFORM',
    items: [
      { name: 'Client Management', path: 'admin-clients', icon: Building2 },
      { name: 'Pricing',           path: 'admin-pricing', icon: CreditCard },
      { name: 'Billing',           path: 'admin-billing', icon: Receipt },
    ],
  },
  {
    label: 'SYSTEM',
    items: [
      { name: 'Audit Trail', path: 'admin-audit-log', icon: Activity },
    ],
  },
];

/** Flattened lookup carrying each item's group label, for the topbar breadcrumb */
const NAV_LOOKUP: { item: NavItem; group: string | null }[] = NAV_GROUPS.flatMap(
  (group) => group.items.map((item) => ({ item, group: group.label })),
);

const SIDEBAR_COLLAPSED_KEY = 'leadcrm_admin_sidebar_collapsed';

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Dedicated shell for the System Admin (LeadCRM operator) portal.
 * Separate navigation from CrmLayout, but shares the tenant design tokens
 * so both portals stay visually consistent across all four themes.
 */
export default function AdminLayout({ children, currentPath, navigate, subLabel }: AdminLayoutProps): React.ReactElement {
  const { user } = useAuth();
  const { unreadCount: notificationCount } = useNotifications();
  const containerRef = useRef<HTMLDivElement>(null);
  const notificationButtonRef = useRef<HTMLButtonElement>(null!);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Scopes theme classes to this shell so design tokens and dark: variants resolve
  useThemeContainer(containerRef);

  // Restore collapse preference
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      if (stored !== null) setIsCollapsed(stored === 'true');
    } catch { /* noop */ }
  }, []);

  const handleToggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next)); } catch { /* noop */ }
      return next;
    });
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    setSidebarOpen(false);
  };

  const currentEntry = NAV_LOOKUP.find((entry) => entry.item.path === currentPath);
  const currentModule = currentEntry?.item.name ?? 'Dashboard';
  const currentGroup = currentEntry?.group ?? null;

  return (
    <div
      ref={containerRef}
      data-theme-container
      className="flex h-screen overflow-hidden bg-[var(--background)] transition-colors duration-200"
    >
      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside
        className={cn(
          'fixed lg:static inset-y-0 left-0 z-50',
          'bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)]',
          'transform transition-all duration-200 ease-in-out',
          'flex flex-col',
          'w-[220px]',
          isCollapsed && 'lg:w-[56px]',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* Logo */}
        <div
          className={cn(
            'shrink-0 flex items-center border-b border-[var(--sidebar-border)]',
            isCollapsed ? 'lg:justify-center px-2 py-4' : 'justify-between px-4 py-4',
          )}
        >
          <div
            className={cn('flex items-center gap-2.5 min-w-0', isCollapsed && 'lg:justify-center')}
            title={isCollapsed ? 'LeadCRM — System Admin' : undefined}
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-lg overflow-hidden shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/leadcrm_logo.png" alt="LeadCRM" className="h-7 w-7 object-contain" />
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <p className="text-[14px] font-bold text-[var(--sidebar-text)] tracking-tight leading-tight">
                  Lead<span className="text-[#3B82F6]">CRM</span>
                </p>
                <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--sidebar-group-label)] leading-tight">
                  System Admin
                </p>
              </div>
            )}
          </div>

          <button
            className="lg:hidden text-[var(--sidebar-text-muted)] hover:text-[var(--sidebar-text)] p-1.5 rounded-md transition-colors"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X size={16} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 flex flex-col gap-0.5 px-2 py-3 overflow-y-auto custom-scrollbar">
          {NAV_GROUPS.map((group, groupIndex) => (
            <div key={group.label ?? 'primary'} className={cn(group.label && 'mt-4')}>
              {group.label && !isCollapsed && (
                <p className="px-3 mb-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--sidebar-group-label)]">
                  {group.label}
                </p>
              )}
              {group.label && isCollapsed && groupIndex > 0 && (
                <div className="h-px bg-[var(--sidebar-border)] my-2 mx-2" />
              )}
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => (
                  <NavButton
                    key={item.path}
                    item={item}
                    isActive={currentPath === item.path}
                    isCollapsed={isCollapsed}
                    onClick={() => handleNavigate(item.path)}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="shrink-0 border-t border-[var(--sidebar-border)]">
          <div className="px-3 py-3 flex items-center gap-2">
            {!isCollapsed && (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] flex items-center justify-center text-white font-bold text-[10px] shrink-0">
                  {`${user?.firstName?.charAt(0) ?? 'S'}${user?.lastName?.charAt(0) ?? ''}`.toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11.5px] font-semibold text-[var(--sidebar-text)] truncate leading-tight">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-[10px] text-[var(--sidebar-text-muted)] truncate">
                    {user?.email ?? 'System Admin'}
                  </p>
                </div>
              </div>
            )}

            <button
              onClick={handleToggleCollapse}
              className={cn(
                'hidden lg:flex items-center justify-center rounded-md text-[var(--sidebar-text-muted)] hover:text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] transition-all',
                isCollapsed ? 'w-8 h-8 mx-auto' : 'w-7 h-7 shrink-0',
              )}
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={isCollapsed ? 'Expand' : 'Collapse'}
            >
              {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-[52px] bg-[var(--surface)] border-b border-[var(--border)] flex items-center justify-between px-4 lg:px-5 shrink-0 sticky top-0 z-40 transition-colors duration-200">
          {/* Left: mobile hamburger + breadcrumb */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              className="lg:hidden text-[var(--text-tertiary)] hover:text-[var(--text-primary)] p-1.5 rounded-lg transition-colors"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <Menu size={18} />
            </button>

            <div className="hidden lg:flex items-center gap-1.5 text-[13px] min-w-0">
              {currentGroup && (
                <>
                  <span className="text-[var(--text-tertiary)] font-medium">{currentGroup}</span>
                  <span className="text-[var(--text-tertiary)] opacity-50">&gt;</span>
                </>
              )}
              <span className={cn(
                'font-semibold truncate',
                subLabel
                  ? 'text-[var(--text-tertiary)]'
                  : 'text-[var(--text-primary)]',
              )}>
                {currentModule}
              </span>
              {subLabel && (
                <>
                  <span className="text-[var(--text-tertiary)] opacity-50 shrink-0">&gt;</span>
                  <span className="text-[var(--text-primary)] font-semibold truncate">{subLabel}</span>
                </>
              )}
            </div>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-1.5 flex-1 justify-end">
            {/* Notifications */}
            <button
              ref={notificationButtonRef}
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              className={cn(
                'relative w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
                isNotificationsOpen
                  ? 'bg-[#3B82F6]/10 text-[#3B82F6]'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)]',
              )}
              aria-label="Notifications"
              aria-expanded={isNotificationsOpen}
            >
              <Bell size={16} />
              {notificationCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#3B82F6]" />
              )}
            </button>

            {/* Profile */}
            <div className="ml-1">
              <AdminProfileDropdown navigate={navigate} />
            </div>
          </div>

          {/* Notifications dropdown */}
          <NotificationsDropdown
            isOpen={isNotificationsOpen}
            onClose={() => setIsNotificationsOpen(false)}
            triggerRef={notificationButtonRef}
          />
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 custom-scrollbar">
          {children}
        </main>
      </div>

      {/* Mobile backdrop */}
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

// ── Nav Button ────────────────────────────────────────────────────────────────

interface NavButtonProps {
  item: NavItem;
  isActive: boolean;
  isCollapsed: boolean;
  onClick: () => void;
}

function NavButton({ item, isActive, isCollapsed, onClick }: NavButtonProps): React.ReactElement {
  const Icon = item.icon;

  return (
    <button
      onClick={onClick}
      title={isCollapsed ? item.name : undefined}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'relative w-full flex items-center rounded-lg text-[12.5px] font-medium transition-all cursor-pointer',
        isCollapsed ? 'lg:justify-center px-2 py-2.5' : 'gap-2.5 px-3 py-2',
        isActive
          ? 'bg-[var(--sidebar-active-bg)] text-[var(--sidebar-active-text)]'
          : 'text-[var(--sidebar-text-muted)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-text)]',
      )}
    >
      {isActive && !isCollapsed && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#3B82F6] rounded-r-full" />
      )}

      <Icon className="h-[16px] w-[16px] shrink-0" />

      {!isCollapsed && <span className="truncate flex-1 text-left">{item.name}</span>}
    </button>
  );
}
