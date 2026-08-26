﻿'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useAuth } from '@/store/AuthContext';

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
  const { user, isLoading } = useAuth();
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

  if (isLoading) return null;
  if (user === null) return null;

  return <>{children}</>;
}
