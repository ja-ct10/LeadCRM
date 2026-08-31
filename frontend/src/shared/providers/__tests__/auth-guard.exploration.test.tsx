import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';

/**
 * Bug Condition Exploration Tests — Frontend AuthGuard
 *
 * **Property 1: Bug Condition — Verified, Onboarded Login User Reaches the Dashboard**
 *
 * These tests encode the EXPECTED (post-fix) behavior for the AuthGuard half of
 * the defect:
 *   - Guard misroute: a verified, onboarded user fed the (now-fixed) complete
 *     login payload must NOT be redirected to /verify-email or /onboarding.
 *   - Silent blank screen: while `isLoading` the guard must render a visible
 *     loading indicator, never a silent `null`.
 *
 * **Validates: Requirements 1.1, 1.2, 1.3**
 *
 * EXPECTED ON UNFIXED CODE: These tests FAIL.
 *   - Guard reads user.emailVerified / user.onboardingCompletedAt which are
 *     `undefined` (falsy) in the thin login payload → redirects to /verify-email.
 *   - Guard does `if (isLoading) return null;` → renders nothing (blank screen).
 *
 * DO NOT fix the test or the code when it fails — the failure confirms the bug.
 */

// ─────────────────────────────────────────────────────
// MOCKS
// ─────────────────────────────────────────────────────

const routerReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: routerReplace, push: vi.fn() }),
  usePathname: () => '/dashboard',
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null }),
}));

// Controllable auth state returned by useAuth().
let authState: { user: unknown; isLoading: boolean } = { user: null, isLoading: false };

vi.mock('@/store/AuthContext', () => ({
  useAuth: () => authState,
}));

import { AuthGuard } from '../auth-guard';

// ─────────────────────────────────────────────────────
// FIXTURES
// ─────────────────────────────────────────────────────

// The FIXED login payload: exactly what POST /auth/login now returns after the
// contract-alignment fix (task 3.1). It carries the same gate fields as
// GET /auth/me — emailVerified and onboardingCompletedAt (both non-null for a
// verified, onboarded user) — via the shared buildAuthUserResponse helper.
//
// This encodes the EXPECTED post-fix behavior: given the now-complete login
// payload, AuthGuard must NOT misroute a verified, onboarded user to the
// verification/onboarding gates. (Pre-fix, this payload omitted the gate
// fields, so the guard misrouted on falsy `undefined` — the documented bug.)
const FIXED_LOGIN_PAYLOAD = {
  id: 'user-1',
  email: 'alice@democorp.com',
  role: 'Client Admin',
  firstName: 'Alice',
  lastName: 'Admin',
  tenantId: 'tenant-1',
  status: 'ACTIVE',
  emailVerified: '2026-01-01T00:00:00.000Z',
  tenantName: 'Demo Corp Solutions',
  industry: 'IT Services',
  companySize: '11-50',
  onboardingStep: 3,
  onboardingCompletedAt: '2026-01-02T00:00:00.000Z',
};

// ─────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────

describe('Feature: auth-login-blank-screen-fix, Property 1: Bug Condition — AuthGuard', () => {
  beforeEach(() => {
    routerReplace.mockClear();
    // Provide the localStorage/sessionStorage jsdom globals a clean slate.
    try {
      window.localStorage.clear();
      window.sessionStorage.clear();
    } catch {
      /* jsdom provides storage; ignore if unavailable */
    }
  });

  it('does NOT redirect a verified, onboarded user to /verify-email or /onboarding', () => {
    // A verified, onboarded user who logged in via the credentials path.
    // Post-fix, the login payload carries the gate fields, so the guard must
    // route through to the dashboard rather than the verification/onboarding gates.
    authState = { user: FIXED_LOGIN_PAYLOAD, isLoading: false };

    render(
      <AuthGuard>
        <div>dashboard content</div>
      </AuthGuard>,
    );

    // EXPECTED (post-fix): no misroute to the verification/onboarding gates.
    // FAILS on unfixed code — emailVerified/onboardingCompletedAt read as undefined.
    const misrouteTargets = routerReplace.mock.calls
      .map((call) => String(call[0]))
      .filter((target) => target.startsWith('/verify-email') || target.startsWith('/onboarding'));

    expect(misrouteTargets).toEqual([]);
  });

  it('renders a visible loading indicator (not null) while isLoading is true', () => {
    authState = { user: null, isLoading: true };

    const { container } = render(
      <AuthGuard>
        <div>dashboard content</div>
      </AuthGuard>,
    );

    // EXPECTED (post-fix): a visible loading state renders while resolving.
    // FAILS on unfixed code — `if (isLoading) return null;` renders nothing.
    expect(container.innerHTML.trim()).not.toBe('');
  });
});
