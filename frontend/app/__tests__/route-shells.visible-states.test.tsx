import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

/**
 * Route-Shell Visible-States Tests
 *
 * **Property 2: Bug Condition — Auth Resolution Never Shows a Silent Blank Screen**
 *
 * The root (`app/page.tsx`), `/onboarding`, and `/company-setup` route shells used
 * to `return null` during auth resolution, producing a silent blank screen. They
 * now render the shared <AuthLoadingScreen /> (spinner, role="status" /
 * aria-label="Loading") while resolving instead.
 *
 * For the root shell we additionally assert the preserved public behavior: when
 * NOT loading and user is null, the public landing page renders (spinner NOT shown).
 *
 * **Validates: Requirements 2.2, 2.3**
 */

// ─────────────────────────────────────────────────────
// MOCKS
// ─────────────────────────────────────────────────────

const routerReplace = vi.fn();
const routerPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: routerReplace, push: routerPush }),
  usePathname: () => '/',
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: nextAuthSession, update: vi.fn() }),
}));

interface AuthState {
  user: unknown;
  isLoading: boolean;
}

let authState: AuthState = { user: null, isLoading: false };
let nextAuthSession: unknown = null;

vi.mock('@/store/AuthContext', () => ({
  useAuth: () => authState,
}));

// Mock next/dynamic so the dynamically-imported page components resolve to a
// lightweight marker instead of pulling in the real (heavy) landing/onboarding/
// company-setup pages. Each shell's dynamic() call is distinguished by its target.
vi.mock('next/dynamic', () => ({
  default: () => {
    const DynamicMarker = () => <div data-testid="dynamic-page">dynamic page content</div>;
    return DynamicMarker;
  },
}));

// route-map is imported by the root + company-setup shells.
vi.mock('@/lib/route-map', () => ({
  PATH_TO_PATHNAME: {} as Record<string, string>,
}));

import Home from '../page';
import OnboardingRoute from '../onboarding/page';
import CompanySetupRoute from '../company-setup/page';

function expectSpinner(): void {
  const spinner = screen.getByRole('status');
  expect(spinner).toBeTruthy();
  expect(spinner.getAttribute('aria-label')).toBe('Loading');
}

describe('Feature: auth-login-blank-screen-fix, Property 2: route shells render spinner (not null)', () => {
  beforeEach(() => {
    routerReplace.mockClear();
    routerPush.mockClear();
    authState = { user: null, isLoading: false };
    nextAuthSession = null;
  });

  // ── Root shell (app/page.tsx) ──────────────────────────────────────────
  it('root shell renders the loading spinner while auth is resolving (not null)', () => {
    authState = { user: null, isLoading: true };

    const { container } = render(<Home />);

    expectSpinner();
    expect(container.innerHTML).not.toBe('');
    expect(screen.queryByTestId('dynamic-page')).toBeNull();
  });

  it('root shell renders the public landing page (no spinner) when not loading and user is null', () => {
    authState = { user: null, isLoading: false };

    render(<Home />);

    // Public landing page renders; the auth spinner is NOT shown.
    expect(screen.getByTestId('dynamic-page')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });

  // ── Onboarding shell (app/onboarding/page.tsx) ─────────────────────────
  it('onboarding shell renders the loading spinner while auth is resolving (not null)', () => {
    authState = { user: null, isLoading: true };

    const { container } = render(<OnboardingRoute />);

    expectSpinner();
    expect(container.innerHTML).not.toBe('');
    expect(screen.queryByTestId('dynamic-page')).toBeNull();
  });

  it('onboarding shell renders the loading spinner when user is null (redirecting), not null', () => {
    authState = { user: null, isLoading: false };

    render(<OnboardingRoute />);

    expectSpinner();
    expect(screen.queryByTestId('dynamic-page')).toBeNull();
  });

  // ── Company-setup shell (app/company-setup/page.tsx) ───────────────────
  it('company-setup shell renders the loading spinner while auth is resolving (not null)', () => {
    authState = { user: null, isLoading: true };
    nextAuthSession = null;

    const { container } = render(<CompanySetupRoute />);

    expectSpinner();
    expect(container.innerHTML).not.toBe('');
    expect(screen.queryByTestId('dynamic-page')).toBeNull();
  });

  it('company-setup shell renders the loading spinner when unauthenticated (redirecting), not null', () => {
    authState = { user: null, isLoading: false };
    nextAuthSession = null;

    render(<CompanySetupRoute />);

    expectSpinner();
    expect(screen.queryByTestId('dynamic-page')).toBeNull();
  });
});
