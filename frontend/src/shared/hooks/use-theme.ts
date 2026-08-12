'use client';
import { useEffect, useState, useCallback } from 'react';

type Theme = 'Light' | 'Dark';

const THEME_KEY = 'app_theme';

/**
 * Manages dark/light theme for the tenant CRM area only.
 * Applies the `dark` class to the nearest ancestor element with
 * [data-theme-container] instead of <html>, so public pages are unaffected.
 * 
 * Default: Light mode
 */
export function useTheme() {
  // Initialize immediately from localStorage to prevent flicker
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(THEME_KEY) as Theme | null;
      return saved === 'Dark' ? 'Dark' : 'Light';
    }
    return 'Light';
  });

  const applyTheme = useCallback((next: Theme) => {
    // Apply dark class on the CRM container, not <html>
    const container = document.querySelector('[data-theme-container]');
    if (container) {
      if (next === 'Dark') {
        container.classList.add('dark');
      } else {
        container.classList.remove('dark');
      }
    }
    // Dispatch event for any listeners (CrmLayout)
    window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: next } }));
  }, []);

  // Apply theme on mount and when it changes
  useEffect(() => {
    applyTheme(theme);
  }, [theme, applyTheme]);

  const toggleTheme = useCallback(() => {
    const next: Theme = theme === 'Light' ? 'Dark' : 'Light';
    setTheme(next);
    localStorage.setItem(THEME_KEY, next);
  }, [theme]);

  const isDark = theme === 'Dark';

  return { theme, isDark, toggleTheme };
}
