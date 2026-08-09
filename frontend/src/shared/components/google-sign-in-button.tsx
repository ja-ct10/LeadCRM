'use client';

import React, { useState } from 'react';

interface GoogleSignInButtonProps {
  onClick: () => Promise<void>;
  label?: string;
}

/**
 * GoogleSignInButton — renders the canonical "Continue with Google" button.
 *
 * Design follows Google's branding guidelines:
 *  - White background, border, Google logo SVG, Inter font
 *  - Full-width to match the existing form inputs
 *  - Loading state disables the button and shows a spinner
 *  - Dark mode paired per project UI standards
 */
export function GoogleSignInButton({
  onClick,
  label = 'Continue with Google',
}: GoogleSignInButtonProps): React.ReactElement {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      await onClick();
      // Note: onClick triggers a full-page redirect to Google —
      // the loading state will be cleared when the page reloads after OAuth.
      // We intentionally do NOT setIsLoading(false) here.
    } catch {
      setIsLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isLoading}
      aria-label="Continue with Google"
      className="w-full flex items-center justify-center gap-3 h-10 px-4
        rounded-lg border border-gray-200 dark:border-white/[0.08]
        bg-white dark:bg-white/[0.03]
        text-slate-700 dark:text-slate-200
        text-sm font-medium
        hover:bg-slate-50 dark:hover:bg-white/[0.06]
        active:scale-[0.98]
        transition-all duration-150
        disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
    >
      {isLoading ? (
        <svg
          className="w-4 h-4 animate-spin text-slate-400"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z" />
        </svg>
      ) : (
        /* Google "G" logo — official colors, no external dependency */
        <svg
          width="18"
          height="18"
          viewBox="0 0 18 18"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
            fill="#4285F4"
          />
          <path
            d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
            fill="#34A853"
          />
          <path
            d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
            fill="#FBBC05"
          />
          <path
            d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
            fill="#EA4335"
          />
        </svg>
      )}
      <span>{isLoading ? 'Redirecting to Google…' : label}</span>
    </button>
  );
}
