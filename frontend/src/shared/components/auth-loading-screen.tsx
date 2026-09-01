'use client';

/**
 * AuthLoadingScreen — shared full-screen loading state for auth-resolution surfaces.
 *
 * Renders the identical visible spinner used by `AuthGuard` while auth resolves or
 * during a brief redirect. Extracted so the root page (`/`), `/onboarding`,
 * `/company-setup`, and `AuthGuard` all render one consistent, accessible spinner
 * instead of a silent blank (`null`) screen.
 */
export function AuthLoadingScreen() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center">
      <div
        className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"
        aria-label="Loading"
        role="status"
      />
    </div>
  );
}
