'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';

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
    let controlled = Boolean(navigator.serviceWorker.controller);
    const onControllerChange = () => {
      if (controlled) toast.info('A new LeadCRM version is available. Save your work, then refresh.', {
        id: 'leadcrm-update', duration: Infinity,
        action: { label: 'Refresh', onClick: () => window.location.reload() },
      });
      controlled = true;
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    // Register after the page has fully loaded to avoid competing with initial
    // resource loading and to ensure the SW starts in a stable state.
    let registration: ServiceWorkerRegistration | undefined;
    const checkForUpdate = () => {
      if (document.visibilityState === 'visible') void registration?.update().catch(() => {});
    };
    const handleLoad = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/', updateViaCache: 'none' })
        .then((value) => {
          registration = value;
          checkForUpdate();
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
    document.addEventListener('visibilitychange', checkForUpdate);
    return () => {
      window.removeEventListener('load', handleLoad);
      document.removeEventListener('visibilitychange', checkForUpdate);
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  return null;
}
