'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import AuthPage from '@/features/tenant/pages/auth-page';
import { PATH_TO_PATHNAME } from '@/lib/route-map';

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oauthError = searchParams.get('error') ?? undefined;

  const navigate = (path: string) => {
    if (path === 'register') return router.push('/register');
    if (path === 'landing' || path === '/') return router.push('/');
    return router.push(PATH_TO_PATHNAME[path] ?? '/dashboard');
  };
  
  return <AuthPage mode="login" onNavigate={navigate} oauthError={oauthError} />;
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  );
}
