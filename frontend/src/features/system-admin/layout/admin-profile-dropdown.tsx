'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Shield, Building2, Receipt, HelpCircle, Keyboard, LogOut, ExternalLink,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { useAuth } from '@/store/AuthContext';
import { AppearancePreferences } from '@/shared/components/appearance-preferences';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AdminProfileDropdownProps {
  /** Navigates within the admin portal using route-map path keys */
  navigate: (path: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Profile menu for the System Admin topbar.
 *
 * Mirrors the tenant `UserProfileDropdown` visual language and shares its
 * appearance controls, but links only to destinations that exist inside the
 * admin portal — the operator has no tenant workspace settings or billing plan.
 */
export function AdminProfileDropdown({ navigate }: AdminProfileDropdownProps): React.ReactElement {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        dropdownRef.current && !dropdownRef.current.contains(target) &&
        triggerRef.current && !triggerRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleLogout = async () => {
    setIsOpen(false);
    try {
      await logout();
      toast.success('Signed out successfully');
    } catch {
      toast.error('Unable to sign out. Please try again.');
    }
  };

  const handleMenuClick = (path: string) => {
    setIsOpen(false);
    navigate(path);
  };

  const fullName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || 'System Admin';
  const email = user?.email ?? '—';
  const initials = `${user?.firstName?.charAt(0) ?? 'S'}${user?.lastName?.charAt(0) ?? ''}`.toUpperCase();

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="System admin profile menu"
        className={cn(
          'relative w-8.5 h-8.5 rounded-full flex items-center justify-center text-white font-semibold text-[11.5px] transition-all duration-200 cursor-pointer shadow-xs select-none',
          'bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] dark:from-[#3B82F6] dark:to-[#1E40AF]',
          'hover:ring-2 hover:ring-[#2563EB]/40 hover:scale-[1.03] active:scale-[0.98]',
          isOpen && 'ring-2 ring-[#2563EB]/50 ring-offset-2 ring-offset-white dark:ring-offset-slate-900',
        )}
      >
        {user?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatarUrl} alt={fullName} className="w-full h-full rounded-full object-cover" />
        ) : (
          <span>{initials}</span>
        )}
        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
      </button>

      {/* Popover */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -6 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            role="menu"
            aria-orientation="vertical"
            className="absolute right-0 top-full mt-2 w-[310px] bg-white dark:bg-[#1E293B] border border-slate-200/90 dark:border-slate-700/80 rounded-2xl shadow-xl shadow-slate-900/10 dark:shadow-black/40 py-1.5 z-50 overflow-hidden backdrop-blur-md focus:outline-none"
          >
            {/* Identity */}
            <div className="px-3.5 py-3 border-b border-slate-100 dark:border-slate-700/70">
              <div className="flex items-start gap-2.5">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-2xs">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-slate-900 dark:text-white truncate leading-snug">
                    {fullName}
                  </p>
                  <p className="text-[11.5px] text-slate-500 dark:text-slate-400 truncate">{email}</p>
                </div>
              </div>

              {/* Control plane pill */}
              <div className="mt-2.5 flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Shield size={12} className="text-slate-400 dark:text-slate-500 shrink-0" />
                  <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300 truncate">
                    System Control Plane
                  </span>
                </div>
                <span className="text-[9.5px] font-semibold uppercase px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/40 text-[#2563EB] dark:text-blue-400 border border-blue-200/50 dark:border-blue-700/40 shrink-0">
                  {user?.role ?? 'System Admin'}
                </span>
              </div>
            </div>

            {/* Operator shortcuts */}
            <div className="py-1 border-b border-slate-100 dark:border-slate-700/70">
              <MenuItem
                icon={<Building2 size={14} />}
                label="Client Management"
                onClick={() => handleMenuClick('admin-clients')}
              />
              <MenuItem
                icon={<Receipt size={14} />}
                label="Billing"
                onClick={() => handleMenuClick('admin-billing')}
              />
            </div>

            {/* Appearance */}
            <AppearancePreferences />

            {/* Support */}
            <div className="py-1 border-b border-slate-100 dark:border-slate-700/70">
              <a
                href="#help"
                role="menuitem"
                onClick={(event) => {
                  event.preventDefault();
                  toast.info('Help Center documentation is opening in a new tab.');
                }}
                className="w-full flex items-center justify-between px-3.5 py-2 text-[12.5px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer group"
              >
                <span className="flex items-center gap-2.5">
                  <HelpCircle size={14} className="text-slate-400 dark:text-slate-500 group-hover:text-[#2563EB] transition-colors" />
                  Help Center
                </span>
                <ExternalLink size={12} className="text-slate-400 opacity-60" />
              </a>

              <button
                role="menuitem"
                onClick={() => {
                  setIsOpen(false);
                  toast.info('Press ⌘K for the Command Palette');
                }}
                className="w-full flex items-center justify-between px-3.5 py-2 text-[12.5px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer group"
              >
                <span className="flex items-center gap-2.5">
                  <Keyboard size={14} className="text-slate-400 dark:text-slate-500 group-hover:text-[#2563EB] transition-colors" />
                  Keyboard Shortcuts
                </span>
                <kbd className="text-[10px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                  ⌘K
                </kbd>
              </button>
            </div>

            {/* Log out */}
            <div className="pt-1 pb-0.5">
              <button
                role="menuitem"
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[12.5px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer group"
              >
                <LogOut size={14} className="text-slate-400 dark:text-slate-500 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors" />
                Log out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Menu item ─────────────────────────────────────────────────────────────────

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}

function MenuItem({ icon, label, onClick }: MenuItemProps): React.ReactElement {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className="w-full flex items-center justify-between px-3.5 py-2 text-[12.5px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer group"
    >
      <span className="flex items-center gap-2.5">
        <span className="text-slate-400 dark:text-slate-500 group-hover:text-[#2563EB] transition-colors">
          {icon}
        </span>
        {label}
      </span>
    </button>
  );
}
