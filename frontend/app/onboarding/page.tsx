'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import OnboardingPage from '@/features/tenant/pages/onboarding-page';
import { PATH_TO_PATHNAME } from '@/lib/route-map';

function OnboardingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const needsCompanySetup = searchParams.get('needsCompanySetup') === 'true';
  
  const navigate = (path: string) => {
    if (path === 'dashboard') return router.push('/dashboard');
    if (path === 'company-setup') return router.push('/company-setup');
    return router.push(PATH_TO_PATHNAME[path] ?? '/dashboard');
  };
  
  return <OnboardingPage onNavigate={navigate} needsCompanySetup={needsCompanySetup} />;
}

export default function OnboardingRoute() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <OnboardingPageContent />
    </Suspense>
  );
}
