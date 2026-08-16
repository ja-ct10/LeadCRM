'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useAuth } from '@/store/AuthContext';
import { authApi } from '@/shared/services/auth.api';
import { ArrowRight, Building2, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

// ─── Validation ───────────────────────────────────────────────────────────────
const completeProfileSchema = z.object({
  companyName: z.string().min(2, 'Company name must be at least 2 characters'),
  industry:    z.string().min(1, 'Please select an industry'),
  companySize: z.string().min(1, 'Please select a company size'),
});

type CompleteProfileForm = z.infer<typeof completeProfileSchema>;

const INDUSTRIES = [
  'IT Solutions',
  'Software Development',
  'Cybersecurity',
  'Telecom',
  'Consulting',
  'Other',
];

const COMPANY_SIZES = ['1–10', '11–50', '51–200', '201–500', '500+'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getDashboardUrl(role: string | undefined | null): string {
  return role === 'System Admin' ? '/admin/dashboard' : '/dashboard';
}

// Shape of the extended /auth/me response after our backend change
interface MeUser {
  id: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  tenantId: string;
  status: string;
  tenantName:  string | null;
  industry:    string | null;
  companySize: string | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * CompleteProfilePage
 *
 * Shown to new Google OAuth users who haven't filled in company details yet.
 *
 * Behaviour:
 *  - Pre-fills from existing tenant data (seeder accounts already have values).
 *  - "Continue to Dashboard" validates, saves, then routes to the role-based UI.
 *  - "Skip for now" signs out cleanly and returns to /login.
 */
export default function CompleteProfilePage(): React.ReactElement {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { logout } = useAuth();

  const [form, setForm] = useState<CompleteProfileForm>({
    companyName: '',
    industry:    '',
    companySize: '',
  });
  const [isFormReady,  setIsFormReady]  = useState(false);
  const [error,        setError]        = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSkipping,   setIsSkipping]   = useState(false);

  // ── Guard: redirect unauthenticated visitors ──────────────────────────────
  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  // ── Pre-fill: load existing tenant data from /auth/me ────────────────────
  useEffect(() => {
    if (status !== 'authenticated') return;

    const load = async () => {
      try {
        const res = await authApi.me();
        const apiUser = res?.data?.user as unknown as MeUser | null;
        if (apiUser) {
          setForm({
            companyName: apiUser.tenantName  ?? '',
            industry:    apiUser.industry    ?? '',
            companySize: apiUser.companySize ?? '',
          });
        }
      } catch {
        // Non-critical — user fills the form manually
      } finally {
        setIsFormReady(true);
      }
    };

    load();
  }, [status]);

  // ── Role-aware destination ────────────────────────────────────────────────
  const sessionRole = (session?.user as unknown as { role?: string } | null)?.role;
  const dashboardUrl = getDashboardUrl(sessionRole);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleChange = (field: keyof CompleteProfileForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (error) setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const parsed = completeProfileSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? 'Please fill in all required fields.');
      return;
    }

    setIsSubmitting(true);
    try {
      await authApi.completeOAuthProfile(parsed.data);
      await authApi.refreshSession();
      toast.success('Profile saved! Welcome to LeadCRM.');
      router.replace(dashboardUrl);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save profile. Please try again.');
      setIsSubmitting(false);
    }
  };

  /**
   * Skip — sign out all sessions and return to /login.
   *
   * Seeder accounts that land here have a valid session but don't need this
   * form (their tenant is already complete). Signing out resets the state so
   * they can log in normally via email + OTP on the next attempt.
   */
  const handleSkip = async () => {
    setIsSkipping(true);
    try {
      try { await authApi.logout(); }   catch { /* ignore */ }
      try { await logout(); }           catch { /* ignore */ }
      try { await signOut({ redirect: false }); } catch { /* ignore */ }
    } finally {
      router.replace('/login');
    }
  };

  // ── Loading / skeleton ────────────────────────────────────────────────────
  if (status === 'loading' || !isFormReady) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center">
        <div
          className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"
          aria-label="Loading"
        />
      </div>
    );
  }

  const isBusy = isSubmitting || isSkipping;

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" aria-hidden="true" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" aria-hidden="true" />

      <div className="w-full max-w-md bg-blue-50 dark:bg-[#0A1931]/80 backdrop-blur-xl p-8 rounded-2xl border border-slate-800 shadow-2xl relative z-10">

        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-[#0A6EFF] to-blue-500 rounded-xl flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(10,110,255,0.3)]">
            <Building2 className="text-white" size={22} aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">
            Complete your profile
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm text-center">
            Tell us a bit about your company to finish setting up your workspace.
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div
            role="alert"
            className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg mb-6 text-sm flex items-start gap-2"
          >
            <span className="mt-0.5" aria-hidden="true">⚠️</span>
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>

          {/* Company Name */}
          <div>
            <label
              htmlFor="companyName"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Company Name <span className="text-red-400" aria-hidden="true">*</span>
            </label>
            <input
              id="companyName"
              type="text"
              autoComplete="organization"
              required
              disabled={isBusy}
              value={form.companyName}
              onChange={e => handleChange('companyName', e.target.value)}
              placeholder="e.g. Acme Corp"
              className="w-full bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-700
                rounded-lg px-4 py-2.5 text-slate-900 dark:text-white text-sm
                placeholder:text-slate-400 focus:outline-none focus:border-[#0A6EFF] transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Industry */}
          <div>
            <label
              htmlFor="industry"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Industry <span className="text-red-400" aria-hidden="true">*</span>
            </label>
            <select
              id="industry"
              required
              disabled={isBusy}
              value={form.industry}
              onChange={e => handleChange('industry', e.target.value)}
              className="w-full bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-700
                rounded-lg px-4 py-2.5 text-slate-900 dark:text-white text-sm
                focus:outline-none focus:border-[#0A6EFF] transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="" disabled>Select industry…</option>
              {INDUSTRIES.map(ind => (
                <option key={ind} value={ind}>{ind}</option>
              ))}
            </select>
          </div>

          {/* Company Size */}
          <div>
            <label
              htmlFor="companySize"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Company Size <span className="text-red-400" aria-hidden="true">*</span>
            </label>
            <select
              id="companySize"
              required
              disabled={isBusy}
              value={form.companySize}
              onChange={e => handleChange('companySize', e.target.value)}
              className="w-full bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-700
                rounded-lg px-4 py-2.5 text-slate-900 dark:text-white text-sm
                focus:outline-none focus:border-[#0A6EFF] transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="" disabled>Select size…</option>
              {COMPANY_SIZES.map(size => (
                <option key={size} value={size}>{size} employees</option>
              ))}
            </select>
          </div>

          {/* Continue to Dashboard */}
          <button
            type="submit"
            disabled={isBusy}
            className="w-full flex items-center justify-center gap-2 h-10 bg-[#0A6EFF]
              hover:bg-blue-600 active:scale-[0.98] text-white text-sm font-semibold
              rounded-xl shadow-md shadow-blue-500/20 transition-all
              disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            {isSubmitting ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" aria-hidden="true" />
                Saving…
              </>
            ) : (
              <>
                Continue to Dashboard
                <ArrowRight size={16} aria-hidden="true" />
              </>
            )}
          </button>

        </form>

        {/* Skip for now — signs out and returns to /login */}
        <button
          type="button"
          disabled={isBusy}
          onClick={handleSkip}
          className="w-full mt-4 flex items-center justify-center gap-2 h-9
            rounded-xl border border-slate-200 dark:border-white/[0.08]
            text-sm text-slate-500 dark:text-slate-400
            hover:text-slate-700 dark:hover:text-slate-200
            hover:border-slate-300 dark:hover:border-white/[0.15]
            hover:bg-slate-50 dark:hover:bg-white/[0.03]
            transition-all
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSkipping ? (
            <>
              <span className="w-3.5 h-3.5 rounded-full border-2 border-slate-400 border-t-transparent animate-spin" aria-hidden="true" />
              Signing out…
            </>
          ) : (
            <>
              <LogOut size={13} aria-hidden="true" />
              Skip for now
            </>
          )}
        </button>

      </div>
    </div>
  );
}
