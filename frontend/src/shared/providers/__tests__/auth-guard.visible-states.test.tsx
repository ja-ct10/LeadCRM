import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

/**
 * Visible-States Tests — Frontend AuthGuard resolution rendering
 *
 * **Property 2: Bug Condition — Auth Resolution Never Shows a Silent Blank Screen**
 *
 * These tests lock in the FIXED AuthGuard rendering behavior for the three
 * resolution phases that previously rendered a silent `null` (blank screen):
 *   - `isLoading` -> visible loading state (spinner, role="status" / aria-label="Loading").
 *   - `authError` set -> explicit error state with a "Try again" retry action
 *     (wired to retryAuthInit) and a "Back to login" action — never `null`.
 *   - `user === null` -> redirect to /login AND render the loading state during the
 *     brief redirect (never a blank frame).
 *
 * **Validates: Requirements 2.2, 2.3**
 */

// ─────────────────────────────────────────────────────
// MOCKS (mirror auth-guard.preservation.test.tsx)
// ─────────────────────────────────────────────────────

const routerReplace = vi.fn();
const retryAuthInit = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: routerReplace, push: vi.fn() }),
  usePathname: () => currentPathname,
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null }),
}));

interface AuthState {
  user: unknown;
  isLoading: boolean;
  authError: string | null;
  retryAuthInit: () => void;
}

let authState: AuthState = {
  user: null,
  isLoading: false,
  authError: null,
  retryAuthInit,
};
let currentPathname = '/dashboard';

vi.mock('@/store/AuthContext', () => ({
  useAuth: () => authState,
}));

import { AuthGuard } from '../auth-guard';

function renderGuard(): { container: HTMLElement } {
  const result = render(
    <AuthGuard>
      <div>protected content</div>
    </AuthGuard>,
  );
  return { container: result.container };
}

describe('Feature: auth-login-blank-screen-fix, Property 2: AuthGuard visible states', () => {
  beforeEach(() => {
    routerReplace.mockClear();
    retryAuthInit.mockClear();
    currentPathname = '/dashboard';
    authState = { user: null, isLoading: false, authError: null, retryAuthInit };
    try {
      window.localStorage.clear();
      window.sessionStorage.clear();
    } catch {
      /* jsdom provides storage; ignore if unavailable */
    }
  });

  // 2.2 — while resolving, render a visible loading state (never null)
  it('renders a visible loading spinner while isLoading (not a blank screen)', () => {
    authState = { user: null, isLoading: true, authError: null, retryAuthInit };

    const { container } = renderGuard();

    // Spinner is exposed with role="status" / aria-label="Loading"
    const spinner = screen.getByRole('status');
    expect(spinner).toBeTruthy();
    expect(spinner.getAttribute('aria-label')).toBe('Loading');
    // Not a silent blank screen and children are not rendered while loading.
    expect(container.innerHTML).not.toBe('');
    expect(screen.queryByText('protected content')).toBeNull();
  });

  // 2.3 — on authError, render an explicit error state with a working retry
  it('renders an error state with a retry action when authError is set', () => {
    authState = {
      user: null,
      isLoading: false,
      authError: 'Unable to reach the server',
      retryAuthInit,
    };

    renderGuard();

    // Error UI is present (message + retry/back actions), not null.
    expect(screen.getByText('Unable to load your session')).toBeTruthy();
    expect(screen.getByText('Unable to reach the server')).toBeTruthy();

    const tryAgain = screen.getByRole('button', { name: /try again/i });
    expect(tryAgain).toBeTruthy();
    expect(screen.getByRole('button', { name: /back to login/i })).toBeTruthy();

    // The explicit error UI is rendered instead of a silent blank screen —
    // protected children are not shown.
    expect(screen.queryByText('protected content')).toBeNull();
  });

  it('clicking "Try again" in the error state calls retryAuthInit', () => {
    authState = {
      user: null,
      isLoading: false,
      authError: 'Unable to reach the server',
      retryAuthInit,
    };

    renderGuard();

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(retryAuthInit).toHaveBeenCalledTimes(1);
  });

  // 2.2 — user === null redirects to /login AND shows loading (not null) during redirect
  it('redirects to /login when user is null and renders the loading state (not blank) during redirect', () => {
    authState = { user: null, isLoading: false, authError: null, retryAuthInit };
    currentPathname = '/dashboard';

    const { container } = renderGuard();

    // Redirect to /login is issued.
    const targets = routerReplace.mock.calls.map((call) => String(call[0]));
    expect(targets).toContain('/login');

    // During the redirect, a visible loading spinner is shown — never a blank frame.
    const spinner = screen.getByRole('status');
    expect(spinner).toBeTruthy();
    expect(spinner.getAttribute('aria-label')).toBe('Loading');
    expect(container.innerHTML).not.toBe('');
  });
});
