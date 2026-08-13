'use client';
import { useEffect, useState, useCallback } from 'react';

export type ThemeMode = 'Classic' | 'Light' | 'Dark' | 'System';
type ResolvedTheme = 'light' | 'dark' | 'classic';

const THEME_KEY = 'app_theme';

function getSystemPreference(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveTheme(mode: ThemeMode): ResolvedTheme {
  switch (mode) {
    case 'Dark':
      return 'dark';
    case 'Light':
      return 'light';
    case 'Classic':
      return 'classic';
    case 'System':
      return getSystemPreference() === 'dark' ? 'dark' : 'light';
    default:
      return 'light';
  }
}

/**
 * Manages the LeadCRM appearance system.
 * Supports 4 modes: Classic | Light | Dark | System
 * Applies theme classes to `[data-theme-container]` so public pages remain unaffected.
 * System mode dynamically tracks OS `prefers-color-scheme` changes.
 */
export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(THEME_KEY) as ThemeMode | null;
      if (saved && ['Classic', 'Light', 'Dark', 'System'].includes(saved)) {
        return saved;
      }
    }
    return 'Light';
  });

  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolveTheme(mode));

  const applyTheme = useCallback((resolvedTheme: ResolvedTheme) => {
    const container = document.querySelector('[data-theme-container]');
    if (!container) return;

    // Remove all theme classes
    container.classList.remove('dark', 'theme-classic', 'theme-light', 'theme-dark');

    // Apply appropriate classes
    if (resolvedTheme === 'dark') {
      container.classList.add('dark', 'theme-dark');
    } else if (resolvedTheme === 'classic') {
      container.classList.add('theme-classic');
    } else {
      container.classList.add('theme-light');
    }

    // Dispatch event for other components to react
    window.dispatchEvent(
      new CustomEvent('themechange', { detail: { theme: resolvedTheme, mode } })
    );
  }, [mode]);

  // Apply theme whenever resolved value changes
  useEffect(() => {
    applyTheme(resolved);
  }, [resolved, applyTheme]);

  // Listen for OS preference changes when in System mode
  useEffect(() => {
    if (mode !== 'System') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const next = resolveTheme('System');
      setResolved(next);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [mode]);

  const setTheme = useCallback((newMode: ThemeMode) => {
    setMode(newMode);
    const next = resolveTheme(newMode);
    setResolved(next);
    localStorage.setItem(THEME_KEY, newMode);
  }, []);

  const toggleTheme = useCallback(() => {
    const next: ThemeMode = mode === 'Light' ? 'Dark' : 'Light';
    setTheme(next);
  }, [mode, setTheme]);

  const isDark = resolved === 'dark';

  return { mode, resolved, isDark, setTheme, toggleTheme };
}
