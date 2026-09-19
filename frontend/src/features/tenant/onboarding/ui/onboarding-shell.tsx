'use client';

import { useState, type ReactNode } from 'react';
import { useAuth } from '@/store/AuthContext';

const steps = ['Welcome to LeadCRM'];

export function OnboardingShell({
  step, children,
}: { step: number; children: ReactNode }) {
  const { logout } = useAuth();
  const [error, setError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  async function signOut() {
    setSigningOut(true);
    try { await logout(); }
    catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to sign out. Try again.');
      setSigningOut(false);
    }
  }
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <span className="flex items-center gap-3 text-xl font-bold">
          <img src="/leadcrm_logo.png" alt="" className="h-9 w-9 object-contain" />
          LeadCRM
        </span>
        <button type="button" disabled={signingOut} onClick={() => void signOut()}
          className="text-sm text-slate-500 hover:text-blue-600 disabled:opacity-50">
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </header>
      <div className="mx-auto max-w-3xl px-6 pb-12">
        <ol aria-label="Onboarding progress" className="mb-8 grid grid-cols-1 gap-3">
          {steps.map((title, index) => (
            <li key={title} aria-current={index === step ? 'step' : undefined}
              className={`border-t-4 pt-3 text-xs sm:text-sm ${index <= step
                ? 'border-blue-600 text-blue-600' : 'border-slate-200 text-slate-400'}`}>
              <span className="mb-1 block font-semibold">Step {index + 1}</span>
              {title}
            </li>
          ))}
        </ol>
        {error && <p role="alert" className="mb-4 text-sm text-red-600">{error}</p>}
        <section className="rounded-2xl border bg-white p-6 shadow-sm sm:p-10 dark:border-slate-800 dark:bg-slate-900">
          {children}
        </section>
        <p className="mt-5 text-center text-xs text-slate-500">
          Your acknowledgment is saved securely to your workspace.
        </p>
      </div>
    </main>
  );
}

export const primaryButton =
  'rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50';
export const secondaryButton =
  'rounded-xl border px-6 py-3 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50';
