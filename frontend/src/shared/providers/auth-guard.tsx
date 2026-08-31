﻿'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useAuth } from '@/store/AuthContext';
import { cn } from '@/lib/utils';
import { AuthLoadingScreen } from '@/shared/components/auth-loading-screen';

// ── localStorage keys (kept for optional dashboard tour overlay only) ─────────
export const ONBOARDING_COMPLETE_KEY    = 'leadcrm_onboarding_complete';
export const NEEDS_COMPANY_SETUP_KEY    = 'leadcrm_needs_company_setup';

// Routes that are exempt from onboarding/verification gates
const EXEMPT_ROUTES = ['/onboarding', '/verify-email', '/email-verification', '/billing', '/settings', '/company-setup'];

/**
 * AuthGuard — protects tenant routes and enforces email verification + onboarding gates.
 *
 * Gate priority (highest → lowest):
 *   1. Email verification gate — unverified users redirected to /verify-email
 *   2. Onboarding gate — verified but not-onboarded users redirected to /onboarding (DB-backed)
 *   3. Saved redirect — restore the originally intended URL after login
 *   4. Role-based default — System Admin → /admin/dashboard, others → /dashboard
 *
 * Source of truth for gates:
 *   - emailVerified: from /auth/me response (server-backed)
 *   - onboardingCompletedAt: from /auth/me response (server-backed via Tenant model)
 *   - localStorage ONBOARDING_COMPLETE_KEY: acts as immediate 'just completed' signal so the AuthGuard doesn't redirect back to /onboarding before the cached user refreshes
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading, authError, retryAuthInit } = useAuth();
  const { data: nextAuthSession } = useSession();
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

    // Determine System Admin (bypasses all onboarding/verification checks)
    // Note: tenantId is always a UUID — cannot compare against slug strings.
    // We also check tenantName from /auth/me for extra safety.
    const isSystemAdmin = user.role === 'System Admin'
      || (user as any).tenantName?.toLowerCase().includes('system');

    // Check if current route is exempt from gates
    const isExempt = EXEMPT_ROUTES.some((r) => pathname.startsWith(r));

    if (!isSystemAdmin && !isExempt) {
      // ── Gate 1: Email verification (server-backed) ─────────────────────
      // If emailVerified is null/falsy, user must verify their email first
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const emailVerified = (user as any).emailVerified;
      if (!emailVerified) {
        sessionStorage.removeItem('leadcrm_redirect_after_login');
        router.replace(`/verify-email?email=${encodeURIComponent(user.email)}`);
        return;
      }

      // ── Gate 2: Onboarding (server-backed via Tenant.onboardingCompletedAt) ──
      // Primary: check server-backed field from /auth/me response.
      // Fallback: if localStorage ONBOARDING_COMPLETE_KEY is set, the user JUST
      // completed onboarding in this session — allow through even if the cached
      // AuthContext user object hasn't refreshed yet. The DB is already updated
      // by the completeOnboarding() API call that ran before navigation.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const onboardingCompletedAt = (user as any).onboardingCompletedAt;
      const localOnboardingDone = typeof window !== 'undefined'
        ? localStorage.getItem(ONBOARDING_COMPLETE_KEY)
        : null;

      if (!onboardingCompletedAt && !localOnboardingDone) {
        sessionStorage.removeItem('leadcrm_redirect_after_login');
        router.replace('/onboarding');
        return;
      }
    }

    // ── Saved redirect (post-login or returning users) ────────────────────
    const isEntryPoint = pathname === '/' || pathname === '/login' || pathname === '/dashboard';

    const savedRedirect = sessionStorage.getItem('leadcrm_redirect_after_login');
    sessionStorage.removeItem('leadcrm_redirect_after_login');
    if (savedRedirect && savedRedirect !== '/login' && savedRedirect !== '/register') {
      const isAdminPath = savedRedirect.startsWith('/admin');
      if (!isAdminPath || isSystemAdmin) {
        router.replace(savedRedirect);
        return;
      }
    }

    // ── Role-based default landing ────────────────────────────────────────
    if (isEntryPoint) {
      if (isSystemAdmin) {
        router.replace('/admin/dashboard');
      } else {
        router.replace('/dashboard');
      }
    }
  }, [user, isLoading, pathname, router, nextAuthSession?.requiresProfileCompletion]);

  // ── Visible resolution states (never a silent blank screen) ───────────
  // While auth is resolving, show a visible loading state instead of null.
  if (isLoading) return <AuthLoadingScreen />;

  // A genuine auth-init transport failure surfaces an explicit error state with
  // a retry action (distinct from the "no session" case, which sets user = null
  // without an error and is handled by the redirect-to-/login path below).
  if (authError) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center px-6">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 dark:bg-red-500/10">
            <AlertTriangle className="h-6 w-6 text-red-500 dark:text-red-400" aria-hidden="true" />
          </div>
          <h2 className="mb-1 text-base font-semibold text-slate-900 dark:text-white">
            Unable to load your session
          </h2>
          <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">{authError}</p>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => { void retryAuthInit(); }}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors',
                'hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500',
              )}
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Try again
            </button>
            <button
              type="button"
              onClick={() => { router.replace('/login'); }}
              className={cn(
                'inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
                'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
              )}
            >
              Back to login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // user === null: the effect above redirects to /login. Render the loading
  // state during that brief redirect rather than a blank screen.
  if (user === null) return <AuthLoadingScreen />;

  return <>{children}</>;
}
