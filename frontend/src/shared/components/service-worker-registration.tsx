'use client';

import { useEffect } from 'react';

/**
 * Registers the LeadCRM service worker for PWA support (offline cache, installability).
 * Must be a client component — mounted inside the root layout's client boundary.
 * The SW file lives at /public/sw.js (served at /sw.js).
 *
 * Spec: Spec 9 PWA — service worker registration.
 */
export function ServiceWorkerRegistration(): null {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    // Register after the page has fully loaded to avoid competing with initial
    // resource loading and to ensure the SW starts in a stable state.
    const handleLoad = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          // SW registered — check for updates on every navigation
          registration.update().catch(() => {/* non-critical */});
        })
        .catch((err) => {
          // SW registration failed — log in development only, silent in production
          if (process.env.NODE_ENV === 'development') {
            console.warn('[SW] Registration failed:', err);
          }
        });
    };

    if (document.readyState === 'complete') {
      handleLoad();
    } else {
      window.addEventListener('load', handleLoad, { once: true });
    }
  }, []);

  return null;
}
