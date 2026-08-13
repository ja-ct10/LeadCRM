'use client';

import { useEffect } from 'react';

/**
 * ThemeProvider — applies saved font-size setting on mount.
 * Dark mode is scoped to the tenant CRM layout container (not <html>),
 * so public pages (landing, login, register, onboarding) always stay light.
 * Theme is managed by the `useTheme` hook and stored in localStorage.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const apply = () => {
      const savedFontSize = localStorage.getItem('app_font_size') || 'Medium';
      const sizeMap: Record<string, string> = { Small: '14px', Medium: '16px', Large: '18px' };
      document.documentElement.style.fontSize = sizeMap[savedFontSize] ?? '16px';

      // Remove any dark/theme class from <html> — dark mode is tenant-only (applied on
      // the CrmLayout wrapper element, not documentElement).
      document.documentElement.classList.remove('dark', 'light', 'theme-classic', 'theme-light', 'theme-dark');
    };

    apply();
    window.addEventListener('themechange', apply);
    return () => window.removeEventListener('themechange', apply);
  }, []);

  return <>{children}</>;
}
