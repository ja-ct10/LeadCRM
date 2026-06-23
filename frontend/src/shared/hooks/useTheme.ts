'use client';
import { useEffect, useState } from 'react';

type Theme = 'Light' | 'Dark';

/**
 * Manages dark/light theme state and accent color.
 * Extracted from CrmLayout so any component can use theme logic without coupling to the layout.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>('Dark');

  useEffect(() => {
    const syncTheme = () => {
      const saved = localStorage.getItem('app_theme');
      if (saved === 'Light' || saved === 'Dark') {
        setTheme(saved);
      } else {
        const isDark = document.documentElement.classList.contains('dark');
        setTheme(isDark ? 'Dark' : 'Light');
      }
    };

    syncTheme();
    window.addEventListener('themechange', syncTheme);
    return () => window.removeEventListener('themechange', syncTheme);
  }, []);

  const toggleTheme = () => {
    const next: Theme = theme === 'Light' ? 'Dark' : 'Light';
    setTheme(next);
    localStorage.setItem('app_theme', next);

    if (next === 'Light') {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    }

    window.dispatchEvent(new Event('themechange'));
  };

  const isDark = theme === 'Dark';

  return { theme, isDark, toggleTheme };
}
