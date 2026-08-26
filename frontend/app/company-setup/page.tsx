'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/store/AuthContext';
import { ONBOARDING_COMPLETE_KEY, NEEDS_COMPANY_SETUP_KEY } from '@/shared/providers/auth-guard';
import { PATH_TO_PATHNAME } from '@/lib/route-map';

const CompanySetupPage = dynamic(
  () => import('../../src/features/tenant/pages/company-setup-page'),
  { ssr: false },
);

export default function CompanySetupRoute() {
  const { user, isLoading } = useAuth();
  const { data: nextAuthSession, update: updateSession } = useSession();
  const router = useRouter();

  // Auth guard — unauthenticated visitors go to login
  useEffect(() => {
    if (isLoading) return;
    if (!user && !nextAuthSession) {
      router.replace('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading || (!user && !nextAuthSession)) return null;

  const handleNavigate = async (path: string) => {
    if (path === 'dashboard') {
      // Company setup complete — clear localStorage flags so the user never
      // sees the onboarding or company-setup screens again on subsequent logins.
      if (typeof window !== 'undefined') {
        localStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
        localStorage.removeItem(NEEDS_COMPANY_SETUP_KEY);
      }
      // CRITICAL: Update the NextAuth JWT session to clear requiresProfileCompletion.
      // Without this, AuthGuard will see requiresProfileCompletion=true on the
      // next /dashboard visit and redirect back to /onboarding (infinite loop).
      await updateSession({ requiresProfileCompletion: false });
      return router.push('/dashboard');
    }
    return router.push(PATH_TO_PATHNAME[path] ?? '/dashboard');
  };

  return <CompanySetupPage onNavigate={handleNavigate} />;
}
