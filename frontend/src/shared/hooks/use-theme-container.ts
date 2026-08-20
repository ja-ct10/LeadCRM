'use client';

import { useEffect, type RefObject } from 'react';

const THEME_KEY = 'app_theme';

type ResolvedTheme = 'light' | 'dark' | 'classic';

function applyThemeClasses(element: HTMLElement, resolved: ResolvedTheme): void {
  element.classList.remove('dark', 'theme-classic', 'theme-light', 'theme-dark');

  if (resolved === 'dark') {
    element.classList.add('dark', 'theme-dark');
  } else if (resolved === 'classic') {
    element.classList.add('theme-classic');
  } else {
    element.classList.add('theme-light');
  }
}

function resolveStoredTheme(): ResolvedTheme {
  const saved = localStorage.getItem(THEME_KEY) ?? 'Light';

  if (saved === 'Dark') return 'dark';
  if (saved === 'Classic') return 'classic';
  if (saved === 'System') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

/**
 * Bootstraps and maintains the theme classes on a `[data-theme-container]` element.
 *
 * The design tokens in `index.css` are scoped to `.dark` / `.theme-light` /
 * `.theme-classic`, and `@custom-variant dark (&:is(.dark *))` means Tailwind
 * `dark:` variants only resolve inside a `.dark` ancestor. Any portal shell that
 * wants theming must therefore carry `data-theme-container` and these classes —
 * `useTheme()` writes to that selector and silently no-ops when it is absent.
 *
 * Handles initial paint, `themechange` events from `useTheme()`, and OS
 * preference changes while the stored mode is "System".
 */
export function useThemeContainer(containerRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    applyThemeClasses(element, resolveStoredTheme());

    const handleThemeChange = (event: Event) => {
      const detail = (event as CustomEvent<{ theme: ResolvedTheme; mode: string }>).detail;
      if (detail?.theme) applyThemeClasses(element, detail.theme);
    };

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleOsChange = () => {
      if (localStorage.getItem(THEME_KEY) !== 'System') return;
      applyThemeClasses(element, mediaQuery.matches ? 'dark' : 'light');
    };

    window.addEventListener('themechange', handleThemeChange);
    mediaQuery.addEventListener('change', handleOsChange);

    return () => {
      window.removeEventListener('themechange', handleThemeChange);
      mediaQuery.removeEventListener('change', handleOsChange);
    };
  }, [containerRef]);
}
