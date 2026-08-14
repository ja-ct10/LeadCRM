'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import ModernLoginPage from '@/features/tenant/pages/modern-login-page';
import { PATH_TO_PATHNAME } from '@/lib/route-map';

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oauthError = searchParams.get('error') ?? undefined;

  const navigate = (path: string) => {
    if (path === 'register') return router.push('/register');
    if (path === 'landing' || path === '/') return router.push('/');
    if (path === 'onboarding') return router.push('/onboarding');
    return router.push(PATH_TO_PATHNAME[path] ?? '/dashboard');
  };
  
  return <ModernLoginPage onNavigate={navigate} oauthError={oauthError} />;
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  );
}
