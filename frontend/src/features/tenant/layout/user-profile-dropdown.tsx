'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  User,
  Settings,
  Building,
  CreditCard,
  Zap,
  Sun,
  Moon,
  Monitor,
  Layout,
  HelpCircle,
  Keyboard,
  LogOut,
  ChevronRight,
  ExternalLink,
  Check,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/store/AuthContext';
import { useLayout } from '@/features/tenant/layout/use-layout';
import { useRouter } from 'next/navigation';
import { ACCENT_COLORS, applyAccentColor, ACCENT_KEY } from '@/lib/accent-colors';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function UserProfileDropdown(): React.ReactElement {
  const { user, tenant, logout } = useAuth();
  const { navigate } = useLayout();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [appTheme, setAppTheme] = useState<string>('Light');
  const [appAccentColor, setAppAccentColor] = useState<string>('blue');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Sync current theme & accent color on mount
  useEffect(() => {
    try {
      const storedTheme = localStorage.getItem('app_theme') || 'Light';
      setAppTheme(storedTheme);
      const storedAccent = localStorage.getItem(ACCENT_KEY) || 'blue';
      setAppAccentColor(storedAccent);
    } catch {
      // noop
    }

    const handleThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ theme: string; mode: string }>;
      if (customEvent.detail?.mode) {
        setAppTheme(customEvent.detail.mode);
      }
    };

    const handleAccentChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ accent: { id: string } }>;
      if (customEvent.detail?.accent?.id) {
        setAppAccentColor(customEvent.detail.accent.id);
      }
    };

    window.addEventListener('themechange', handleThemeChange);
    window.addEventListener('accentcolorchange', handleAccentChange);
    return () => {
      window.removeEventListener('themechange', handleThemeChange);
      window.removeEventListener('accentcolorchange', handleAccentChange);
    };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
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
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Keyboard navigation & accessibility (Escape, Tab, Arrows)
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

  const [appFontSize, setAppFontSize] = useState<string>('Medium');

  // Sync current theme, density & accent color on mount
  useEffect(() => {
    try {
      const storedTheme = localStorage.getItem('app_theme') || 'Light';
      setAppTheme(storedTheme);
      const storedAccent = localStorage.getItem(ACCENT_KEY) || 'blue';
      setAppAccentColor(storedAccent);
      const storedDensity = localStorage.getItem('app_font_size') || 'Medium';
      setAppFontSize(storedDensity);
    } catch {
      // noop
    }

    const handleThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ theme: string; mode: string }>;
      if (customEvent.detail?.mode) {
        setAppTheme(customEvent.detail.mode);
      }
    };

    const handleAccentChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ accent: { id: string } }>;
      if (customEvent.detail?.accent?.id) {
        setAppAccentColor(customEvent.detail.accent.id);
      }
    };

    window.addEventListener('themechange', handleThemeChange);
    window.addEventListener('accentcolorchange', handleAccentChange);
    return () => {
      window.removeEventListener('themechange', handleThemeChange);
      window.removeEventListener('accentcolorchange', handleAccentChange);
    };
  }, []);

  // Theme switch handler with immediate live application
  const handleThemeSelect = (themeId: 'Classic' | 'Light' | 'Dark' | 'System') => {
    setAppTheme(themeId);
    try {
      localStorage.setItem('app_theme', themeId);
    } catch {
      // noop
    }

    const container = document.querySelector('[data-theme-container]');
    if (container) {
      container.classList.remove('dark', 'theme-classic', 'theme-light', 'theme-dark');
      if (themeId === 'Dark') {
        container.classList.add('dark', 'theme-dark');
      } else if (themeId === 'Classic') {
        container.classList.add('theme-classic');
      } else if (themeId === 'System') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark) {
          container.classList.add('dark', 'theme-dark');
        } else {
          container.classList.add('theme-light');
        }
      } else {
        container.classList.add('theme-light');
      }
    }

    const resolved =
      themeId === 'Dark'
        ? 'dark'
        : themeId === 'Classic'
        ? 'classic'
        : themeId === 'System'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : 'light';

    window.dispatchEvent(
      new CustomEvent('themechange', {
        detail: { theme: resolved, mode: themeId },
      }),
    );
  };

  // Density switch handler with immediate live application
  const handleDensitySelect = (size: 'Small' | 'Medium' | 'Large') => {
    setAppFontSize(size);
    try {
      localStorage.setItem('app_font_size', size);
    } catch {
      // noop
    }
    const sizeMap: Record<string, string> = { Small: '14px', Medium: '16px', Large: '18px' };
    document.documentElement.style.fontSize = sizeMap[size] ?? '16px';
    window.dispatchEvent(new CustomEvent('themechange', { detail: { mode: appTheme } }));
  };

  const handleLogout = async () => {
    setIsOpen(false);
    try {
      await logout();
      toast.success('Signed out successfully');
    } catch (err) {
      toast.error('Unable to sign out. Please try again.');
    }
  };

  const handleMenuClick = (path: string) => {
    setIsOpen(false);
    navigate(path);
  };

  // User Details
  const fullName =
    user?.firstName || user?.lastName
      ? `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim()
      : 'Reymark Panes';
  const email = user?.email || 'reymark@camxian.com';
  const workspaceName = tenant?.name || 'Camxian Technologies';
  const initials = `${user?.firstName?.charAt(0) ?? fullName.charAt(0) ?? 'U'}${
    user?.lastName?.charAt(0) ?? fullName.split(' ')[1]?.charAt(0) ?? ''
  }`.toUpperCase();

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
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
        {user?.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={fullName}
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          <span>{initials}</span>
        )}
        {/* Active presence indicator */}
        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
      </button>

      {/* ── 2. The Dropdown Popover ───────────────────────────────────────── */}
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
            {/* Section 1: User Identity */}
            <div className="px-3.5 py-3 border-b border-slate-100 dark:border-slate-700/70">
              <div className="flex items-start gap-2.5">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-2xs">
                  {initials}
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
              <div className="mt-2.5 flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60">
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

            {/* Section 2: Account & Billing */}
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
                onClick={() => { setIsOpen(false); router.push('/settings?tab=plan'); }}
                className="w-full flex items-center justify-between px-3.5 py-2 text-[12.5px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer group"
              >
                <span className="flex items-center gap-2.5">
                  <CreditCard size={14} className="text-slate-400 dark:text-slate-500 group-hover:text-[#2563EB] transition-colors" />
                  Billing & Plans
                </span>
              </button>
            </div>

            {/* Section 3: Preferences (Theme, Density & Accent Color) */}
            <div className="px-3.5 py-2.5 border-b border-slate-100 dark:border-slate-700/70 space-y-3">
              {/* Theme Mode Selector (Classic, Light, Dark, System) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Theme Mode
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">
                    {appTheme === 'Classic' ? 'Dark Sidebar + Light' : appTheme}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 dark:bg-slate-800/90 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                  {(
                    [
                      { id: 'Classic', label: 'Classic', icon: Layout },
                      { id: 'Light', label: 'Light', icon: Sun },
                      { id: 'Dark', label: 'Dark', icon: Moon },
                      { id: 'System', label: 'System', icon: Monitor },
                    ] as const
                  ).map((t) => {
                    const Icon = t.icon;
                    const isSelected = appTheme === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => handleThemeSelect(t.id)}
                        title={t.id === 'Classic' ? 'Classic: Dark sidebar + Light content' : t.label}
                        className={cn(
                          'flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-lg text-[10.5px] font-medium transition-all duration-150 cursor-pointer select-none',
                          isSelected
                            ? 'bg-white dark:bg-[#1E293B] text-slate-900 dark:text-white shadow-xs font-semibold'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200',
                        )}
                      >
                        <Icon
                          size={12}
                          className={cn(
                            isSelected
                              ? 'text-[#2563EB] dark:text-blue-400'
                              : 'text-slate-400 dark:text-slate-500',
                          )}
                        />
                        <span className="whitespace-nowrap">{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Interface Density (Small, Medium, Large) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Interface Density
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">
                    {appFontSize}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-slate-800/90 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                  {(['Small', 'Medium', 'Large'] as const).map((size) => {
                    const isSelected = appFontSize === size;
                    return (
                      <button
                        key={size}
                        type="button"
                        onClick={() => handleDensitySelect(size)}
                        className={cn(
                          'flex items-center justify-center py-1 px-2 rounded-lg text-[10.5px] font-medium transition-all duration-150 cursor-pointer select-none',
                          isSelected
                            ? 'bg-white dark:bg-[#1E293B] text-slate-900 dark:text-white shadow-xs font-semibold'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200',
                        )}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Accent Color Swatches */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Accent Color
                  </span>
                  <span className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400 capitalize">
                    {ACCENT_COLORS.find(c => c.id === appAccentColor)?.name || 'Blue'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-1 pt-0.5">
                  {ACCENT_COLORS.map((color) => {
                    const isSelected = appAccentColor === color.id;
                    return (
                      <button
                        key={color.id}
                        type="button"
                        onClick={() => {
                          setAppAccentColor(color.id);
                          applyAccentColor(color.id);
                        }}
                        title={color.name}
                        aria-label={`Select ${color.name} accent`}
                        aria-pressed={isSelected}
                        className={cn(
                          'w-6 h-6 rounded-full flex items-center justify-center transition-all duration-150 cursor-pointer shadow-2xs',
                          color.previewClass,
                          'hover:scale-115 active:scale-90',
                          isSelected
                            ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-[#1E293B] ring-slate-900 dark:ring-white scale-105'
                            : 'opacity-90 hover:opacity-100',
                        )}
                      >
                        {isSelected && (
                          <Check size={11} className="text-white drop-shadow-xs stroke-[3.5]" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Section 4: Support & Resources */}
            <div className="py-1 border-b border-slate-100 dark:border-slate-700/70">
              <a
                href="#help"
                role="menuitem"
                onClick={(e) => {
                  e.preventDefault();
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
                  toast.info('Press / for search, # for tags, or ⌘K for Command Palette');
                }}
                className="w-full flex items-center justify-between px-3.5 py-2 text-[12.5px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer group"
              >
                <span className="flex items-center gap-2.5">
                  <Keyboard size={14} className="text-slate-400 dark:text-slate-500 group-hover:text-[#2563EB] transition-colors" />
                  Keyboard Shortcuts
                </span>
                <kbd className="text-[10px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                  /
                </kbd>
              </button>
            </div>

            {/* Section 5: Actions (Bottom Log out) */}
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

            {/* Sandbox environment indicator */}
            <div className="px-3.5 py-2 border-t border-slate-100 dark:border-slate-700/70 flex items-center justify-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Sandbox Environment</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
