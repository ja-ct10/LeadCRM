'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/store/AuthContext';
import { ONBOARDING_COMPLETE_KEY, NEEDS_COMPANY_SETUP_KEY } from '@/shared/providers/auth-guard';

const OnboardingPage = dynamic(
  () => import('../../src/features/tenant/pages/onboarding-page'),
  { ssr: false },
);

export default function OnboardingRoute() {
  const { user, isLoading } = useAuth();
  const { data: nextAuthSession } = useSession();
  const router = useRouter();

  // Read the company-setup flag from NextAuth session directly
  // (can't rely on AuthGuard since /onboarding is outside (tenant) layout)
  const [needsCompanySetup, setNeedsCompanySetup] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Check NextAuth session first (authoritative source for Google OAuth)
    if (nextAuthSession?.requiresProfileCompletion === true) {
      setNeedsCompanySetup(true);
      // Sync to localStorage for consistency
      localStorage.setItem(NEEDS_COMPANY_SETUP_KEY, 'true');
    } else {
      // Fallback: check localStorage (may be set by AuthGuard on previous navigation)
      const flag = localStorage.getItem(NEEDS_COMPANY_SETUP_KEY);
      setNeedsCompanySetup(flag === 'true');
    }
  }, [nextAuthSession?.requiresProfileCompletion]);

  useEffect(() => {
    if (isLoading) return;

    // Not authenticated — send to login
    if (!user) {
      router.replace('/login');
      return;
    }

    // CRITICAL: Check session flag FIRST before localStorage
    // For OAuth users with requiresProfileCompletion, they MUST go through onboarding
    // even if localStorage has stale data from a previous session
    if (nextAuthSession?.requiresProfileCompletion === true) {
      // Force onboarding flow - ignore localStorage
      return;
    }

    // Only check localStorage if session doesn't require completion
    const done = localStorage.getItem(ONBOARDING_COMPLETE_KEY);
    if (done) {
      router.replace('/dashboard');
    }
  }, [user, isLoading, router, nextAuthSession?.requiresProfileCompletion]);

  if (isLoading || !user) return null;

  const handleNavigate = (path: string) => {
    if (path === 'company-setup') {
      // Clear the company-setup flag here — it will be re-checked
      // by company-setup-page on successful save before going to dashboard.
      router.push('/company-setup');
    } else if (path === 'dashboard') {
      // Standard onboarding finish (no company setup needed)
      router.push('/dashboard');
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <OnboardingPage
      onNavigate={handleNavigate}
      needsCompanySetup={needsCompanySetup}
    />
  );
}
