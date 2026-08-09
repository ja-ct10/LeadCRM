'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/store/AuthContext';

/**
 * AuthGuard — redirects to /login if the user is not authenticated.
 * After login, redirects back to the originally intended URL.
 * System Admin → /admin/dashboard, all others → /dashboard.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading) return;

    if (user === null) {
      // Store the intended path so we can redirect back after login
      if (pathname !== '/login' && pathname !== '/register') {
        sessionStorage.setItem('leadcrm_redirect_after_login', pathname);
      }
      router.replace('/login');
      return;
    }

    // Authenticated — check for a saved redirect target.
    // Guard: never send a non-System-Admin user to an /admin/* path
    // (stale key left over from a previous System Admin session).
    const savedRedirect = sessionStorage.getItem('leadcrm_redirect_after_login');
    sessionStorage.removeItem('leadcrm_redirect_after_login');
    if (savedRedirect && savedRedirect !== '/login' && savedRedirect !== '/register') {
      const isAdminPath = savedRedirect.startsWith('/admin');
      const isSystemAdmin = user.role === 'System Admin';
      if (!isAdminPath || isSystemAdmin) {
        router.replace(savedRedirect);
        return;
      }
      // Fall through to role-based default landing below
    }

    // Role-based default landing: only redirect from root or login page
    if (pathname === '/' || pathname === '/login') {
      if (user.role === 'System Admin') {
        router.replace('/admin/dashboard');
      } else {
        router.replace('/dashboard');
      }
    }
  }, [user, isLoading, pathname, router]);

  if (isLoading) return null;
  if (user === null) return null;

  return <>{children}</>;
}
