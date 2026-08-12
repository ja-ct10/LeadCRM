'use client';

import { useEffect } from 'react';

/**
 * ThemeProvider — applies saved font-size setting on mount.
 * Dark mode is now scoped to the tenant CRM layout container (not <html>),
 * so public pages (landing, login, register, onboarding) always stay light.
 * Accent color is no longer user-customizable — uses the system blue palette.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const apply = () => {
      const savedFontSize = localStorage.getItem('app_font_size') || 'Medium';
      const sizeMap: Record<string, string> = { Small: '14px', Medium: '16px', Large: '18px' };
      document.documentElement.style.fontSize = sizeMap[savedFontSize] ?? '16px';

      // Remove any dark class from <html> — dark mode is tenant-only (applied on
      // the CrmLayout wrapper element, not documentElement).
      document.documentElement.classList.remove('dark', 'light');
    };

    apply();
    window.addEventListener('themechange', apply);
    return () => window.removeEventListener('themechange', apply);
  }, []);

  return <>{children}</>;
}
