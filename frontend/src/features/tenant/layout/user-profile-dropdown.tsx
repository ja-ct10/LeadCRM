'use client';

import { UserAvatar } from '@/shared/components/user-avatar';
import { ThemedPortal } from '@/shared/components/theme-scope';
import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import {
  User,
  Settings,
  Building,
  CreditCard,
  Palette,
  HelpCircle,
  LogOut,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/store/AuthContext';
import { useLayout } from '@/features/tenant/layout/use-layout';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { requestNavigation } from '@/shared/lib/navigation-intent';

export function UserProfileDropdown(): React.ReactElement {
  const { user, tenant, logout } = useAuth();
  const { navigate } = useLayout();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number; width: number; maxHeight: number }>();

  useLayoutEffect(() => {
    if (!isOpen) return;
    const trigger = triggerRef.current;
    if (!trigger) return;
    const header = trigger.closest('header') ?? trigger;
    const align = () => {
      const viewport = window.visualViewport;
      const compact = window.innerWidth < 640;
      const gutter = compact ? 16 : 8;
      const viewportWidth = viewport?.width ?? window.innerWidth;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const leftEdge = viewport?.offsetLeft ?? 0;
      const width = Math.max(0, Math.min(compact ? 280 : 310, viewportWidth - gutter * 2));
      const rect = trigger.getBoundingClientRect();
      const top = Math.max((viewport?.offsetTop ?? 0) + 8, rect.bottom + 8);
      const availableHeight = Math.max(0, viewportHeight + (viewport?.offsetTop ?? 0) - top - 8);
      setPosition({ top, width, left: Math.max(leftEdge + gutter, Math.min(rect.right - width, leftEdge + viewportWidth - width - gutter)),
        maxHeight: compact ? Math.min(viewportHeight * 0.7, availableHeight) : availableHeight });
    };
    align();
    const observer = new ResizeObserver(align);
    observer.observe(header);
    const bannerObserver = new MutationObserver(align);
    bannerObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
    window.addEventListener('resize', align);
    window.addEventListener('scroll', align, true);
    window.visualViewport?.addEventListener('resize', align);
    window.visualViewport?.addEventListener('scroll', align);
    return () => {
      observer.disconnect();
      bannerObserver.disconnect();
      window.removeEventListener('resize', align);
      window.removeEventListener('scroll', align, true);
      window.visualViewport?.removeEventListener('resize', align);
      window.visualViewport?.removeEventListener('scroll', align);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && position) dropdownRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true });
  }, [isOpen, !!position]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: PointerEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('pointerdown', handleClickOutside);
    }
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [isOpen]);

  // Keyboard navigation & accessibility (Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleLogout = async (): Promise<void> => {
    setIsOpen(false);
    try {
      await logout();
      toast.success('Signed out successfully');
    } catch {
      toast.error('Unable to sign out. Please try again.');
    }
  };

  const handleMenuClick = (path: string): void => {
    requestNavigation(() => { setIsOpen(false); navigate(path); });
  };

  // User Details
  const fullName =
    user?.firstName || user?.lastName
      ? `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim()
      : 'User';
  const email = user?.email || '';
  const workspaceName = tenant?.name || 'Workspace';
  const initials = `${user?.firstName?.charAt(0) ?? fullName.charAt(0) ?? 'U'}${
    user?.lastName?.charAt(0) ?? fullName.split(' ')[1]?.charAt(0) ?? ''
  }`.toUpperCase();

  return (
    <div className="relative inline-block text-left">
      {/* ── 1. The Trigger (Avatar) ────────────────────────────────────────── */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="User profile menu"
        className={cn(
          'relative w-8.5 h-8.5 rounded-full flex items-center justify-center text-white font-semibold text-[11.5px] transition-all duration-200 cursor-pointer shadow-xs select-none',
          'bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] dark:from-[#3B82F6] dark:to-[#1E40AF]',
          'hover:ring-2 hover:ring-[#2563EB]/40 hover:scale-[1.03] active:scale-[0.98]',
          isOpen && 'ring-2 ring-[#2563EB]/50 ring-offset-2 ring-offset-white dark:ring-offset-slate-900',
        )}
      >
        <UserAvatar user={user} />
        {/* Active presence indicator */}
        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
      </button>

      {/* ── 2. The Dropdown Popover ───────────────────────────────────────── */}
      <ThemedPortal><AnimatePresence>
        {isOpen && position && (
          <motion.div
            ref={dropdownRef}
            style={position}
            initial={{ opacity: 0, scale: 0.96, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -6 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            role="menu"
            aria-orientation="vertical"
            className="fixed overflow-y-auto overscroll-contain bg-white dark:bg-[#1E293B] border border-slate-200/90 dark:border-slate-700/80 rounded-2xl shadow-xl shadow-slate-900/10 dark:shadow-black/40 py-1.5 z-50 backdrop-blur-md focus:outline-none"
          >
            {/* Section 1: User Identity */}
            <div className="px-3 py-2 sm:px-3.5 sm:py-3 border-b border-slate-100 dark:border-slate-700/70">
              <div className="flex items-start gap-2.5">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-2xs">
                  <UserAvatar user={user} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-slate-900 dark:text-white truncate leading-snug">
                    {fullName}
                  </p>
                  <p className="text-[11.5px] text-slate-500 dark:text-slate-400 truncate">
                    {email}
                  </p>
                </div>
              </div>

              {/* Active Workspace Pill */}
              <div className="mt-2.5 flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Building size={12} className="text-slate-400 dark:text-slate-500 shrink-0" />
                  <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300 truncate">
                    {workspaceName}
                  </span>
                </div>
                <span className="text-[9.5px] font-semibold uppercase px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/40 text-[#2563EB] dark:text-blue-400 border border-blue-200/50 dark:border-blue-700/40 shrink-0">
                  {user?.role || 'Admin'}
                </span>
              </div>
            </div>

            {/* Section 2: Account and Appearance */}
            <div className="py-1 border-b border-slate-100 dark:border-slate-700/70">
              <button
                role="menuitem"
                onClick={() => handleMenuClick('settings')}
                className="w-full flex items-center justify-between px-3.5 py-2 text-[12.5px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer group"
              >
                <span className="flex items-center gap-2.5">
                  <User size={14} className="text-slate-400 dark:text-slate-500 group-hover:text-[#2563EB] transition-colors" />
                  My Account
                </span>
              </button>

              <button
                role="menuitem"
                onClick={() => handleMenuClick('settings')}
                className="w-full flex items-center justify-between px-3.5 py-2 text-[12.5px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer group"
              >
                <span className="flex items-center gap-2.5">
                  <Settings size={14} className="text-slate-400 dark:text-slate-500 group-hover:text-[#2563EB] transition-colors" />
                  Workspace Settings
                </span>
              </button>

              <button
                role="menuitem"
                onClick={() => requestNavigation(() => { setIsOpen(false); router.push('/settings?tab=appearance'); })}
                className="w-full flex items-center justify-between px-3.5 py-2 text-[12.5px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer group"
              >
                <span className="flex items-center gap-2.5">
                  <Palette size={14} className="text-slate-400 dark:text-slate-500 group-hover:text-[#2563EB] transition-colors" />
                  Appearance
                </span>
              </button>


            </div>

            {/* Section 3: Support & Resources */}
            <div className="py-1 border-b border-slate-100 dark:border-slate-700/70">
              <Link
                href="/help"
                role="menuitem"
                onClick={() => setIsOpen(false)}
                className="w-full flex items-center justify-between px-3.5 py-2 text-[12.5px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer group"
              >
                <span className="flex items-center gap-2.5">
                  <HelpCircle size={14} className="text-slate-400 dark:text-slate-500 group-hover:text-[#2563EB] transition-colors" />
                  Help Center
                </span>
              </Link>
            </div>

            {/* Section 4: Log out */}
            <div className="pt-1 pb-0.5">
              <button
                role="menuitem"
                onClick={() => requestNavigation(handleLogout)}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[12.5px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer group"
              >
                <LogOut size={14} className="text-slate-400 dark:text-slate-500 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors" />
                Log out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence></ThemedPortal>
    </div>
  );
}
