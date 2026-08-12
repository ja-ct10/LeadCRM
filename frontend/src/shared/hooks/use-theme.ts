'use client';
import { useEffect, useState, useCallback } from 'react';

type Theme = 'Light' | 'Dark';

const THEME_KEY = 'app_theme';
const THEME_CONTAINER_ATTR = 'data-theme';

/**
 * Manages dark/light theme for the tenant CRM area only.
 * Applies the `dark` class to the nearest ancestor element with
 * [data-theme-container] instead of <html>, so public pages are unaffected.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>('Light');

  useEffect(() => {
    const saved = localStorage.getItem(THEME_KEY) as Theme | null;
    const initial = saved === 'Dark' ? 'Dark' : 'Light';
    setTheme(initial);
  }, []);

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
    window.dispatchEvent(new Event('themechange'));
  }, []);

  // Apply on mount and when theme changes
  useEffect(() => {
    applyTheme(theme);
  }, [theme, applyTheme]);

  const toggleTheme = useCallback(() => {
    const next: Theme = theme === 'Light' ? 'Dark' : 'Light';
    setTheme(next);
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  }, [theme, applyTheme]);

  const isDark = theme === 'Dark';

  return { theme, isDark, toggleTheme };
}
