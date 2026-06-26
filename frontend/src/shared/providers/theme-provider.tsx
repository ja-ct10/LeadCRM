'use client';

import { useEffect } from 'react';

/**
 * ThemeProvider — applies saved theme/accent/font-size settings on mount.
 * Extracted from App.tsx. Renders no UI, only applies DOM effects.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const apply = () => {
      const savedTheme = localStorage.getItem('app_theme') || 'Dark';
      const savedAccent = localStorage.getItem('app_accent_color') || '#3B82F6';
      const savedFontSize = localStorage.getItem('app_font_size') || 'Medium';

      if (savedTheme === 'Light') {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
      } else if (savedTheme === 'Dark') {
        document.documentElement.classList.remove('light');
        document.documentElement.classList.add('dark');
      } else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.classList.toggle('dark', prefersDark);
        document.documentElement.classList.toggle('light', !prefersDark);
      }

      document.documentElement.style.setProperty('--color-blue-400', `color-mix(in srgb, ${savedAccent} 85%, white)`);
      document.documentElement.style.setProperty('--color-blue-500', savedAccent);
      document.documentElement.style.setProperty('--color-blue-600', `color-mix(in srgb, ${savedAccent} 85%, black)`);
      document.documentElement.style.setProperty('--color-blue-700', `color-mix(in srgb, ${savedAccent} 70%, black)`);

      const sizeMap: Record<string, string> = { Small: '14px', Medium: '16px', Large: '18px' };
      document.documentElement.style.fontSize = sizeMap[savedFontSize] ?? '16px';
    };

    apply();
    window.addEventListener('themechange', apply);
    return () => window.removeEventListener('themechange', apply);
  }, []);

  return <>{children}</>;
}
