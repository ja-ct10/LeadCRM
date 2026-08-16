'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useAuth } from '@/store/AuthContext';

// ── localStorage keys ─────────────────────────────────────────────────────────
export const ONBOARDING_COMPLETE_KEY    = 'leadcrm_onboarding_complete';
export const NEEDS_COMPANY_SETUP_KEY    = 'leadcrm_needs_company_setup';

/**
 * AuthGuard — redirects to /login if the user is not authenticated.
 *
 * Post-login routing priority (highest → lowest):
 *   1. Company-setup gate — Google OAuth users who need to complete their
 *      company profile (requiresProfileCompletion=true from NextAuth session).
 *      These users see the feature-tour onboarding first, then /company-setup.
 *   2. Onboarding gate — all non-admin users who haven't seen the feature tour.
 *   3. Saved redirect — restore the originally intended URL after login.
 *   4. Role-based default — System Admin → /admin/dashboard, others → /dashboard.
 *
 * Entry points where the gate logic runs:
 *   - /  (Google OAuth callbackUrl lands here)
 *   - /login
 *   - /dashboard
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const { data: nextAuthSession } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  // ── Sync requiresProfileCompletion from NextAuth session to localStorage ──
  // NextAuth session is the only place this signal lives after Google OAuth.
  // We mirror it to localStorage so the /onboarding route shell can read it
  // without a useSession dependency.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (nextAuthSession?.requiresProfileCompletion === true) {
      localStorage.setItem(NEEDS_COMPANY_SETUP_KEY, 'true');
    }
  }, [nextAuthSession?.requiresProfileCompletion]);

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

    // ── Onboarding / company-setup gate (runs before saved redirect) ─────
    // Only non-System-Admin users who land on an entry point get this check.
    const isEntryPoint =
      pathname === '/' || pathname === '/login' || pathname === '/dashboard';

    // Determine System Admin using role + tenantId (matches use-layout.ts detection)
    const isSystemAdmin = user.role === 'System Admin'
      || user.tenantId === 'system'
      || user.tenantId === 'leadcrm-system-demo';

    if (isEntryPoint && !isSystemAdmin) {
      // CRITICAL: Check NextAuth session flag FIRST (for OAuth users)
      // If requiresProfileCompletion is true, ALWAYS send to onboarding
      // even if localStorage has stale "onboarding complete" data
      if (nextAuthSession?.requiresProfileCompletion === true) {
        // Clear any stale saved redirect so it can't skip the onboarding flow
        sessionStorage.removeItem('leadcrm_redirect_after_login');
        router.replace('/onboarding');
        return;
      }

      // For non-OAuth users or OAuth users who don't need profile completion,
      // check localStorage for onboarding completion
      const hasSeenOnboarding =
        typeof window !== 'undefined'
          ? localStorage.getItem(ONBOARDING_COMPLETE_KEY)
          : 'true'; // SSR fallback — never block server render

      if (!hasSeenOnboarding) {
        // Clear any stale saved redirect so it can't skip the onboarding flow.
        sessionStorage.removeItem('leadcrm_redirect_after_login');
        // The /onboarding route shell reads NEEDS_COMPANY_SETUP_KEY to decide
        // whether to show the "Get Started → company setup" path.
        router.replace('/onboarding');
        return;
      }
    }

    // ── Saved redirect (post-onboarding or returning users) ──────────────
    // Guard: never send a non-System-Admin user to an /admin/* path
    // (stale key left over from a previous System Admin session).
    const savedRedirect = sessionStorage.getItem('leadcrm_redirect_after_login');
    sessionStorage.removeItem('leadcrm_redirect_after_login');
    if (savedRedirect && savedRedirect !== '/login' && savedRedirect !== '/register') {
      const isAdminPath = savedRedirect.startsWith('/admin');
      if (!isAdminPath || isSystemAdmin) {
        router.replace(savedRedirect);
        return;
      }
      // Fall through to role-based default landing below
    }

    // ── Role-based default landing ────────────────────────────────────────
    // Only redirect when on an entry point — avoid interrupting deep links.
    if (isEntryPoint) {
      if (isSystemAdmin) {
        router.replace('/admin/dashboard');
      } else {
        router.replace('/dashboard');
      }
    }
  }, [user, isLoading, pathname, router, nextAuthSession?.requiresProfileCompletion]);

  if (isLoading) return null;
  if (user === null) return null;

  return <>{children}</>;
}
