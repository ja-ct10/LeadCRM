'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import EmailVerificationPage from '@/features/tenant/pages/email-verification-page';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const email = searchParams.get('email') || '';
  const error = searchParams.get('error') || '';

  const navigate = (path: string) => {
    if (path === 'login') return router.push('/login');
    if (path === 'register') return router.push('/register');
    if (path === 'onboarding') return router.push('/onboarding');
    if (path === 'landing' || path === '/') return router.push('/');
    return router.push('/dashboard');
  };

  // If no email and no error, redirect to register
  if (!email && !error) {
    router.push('/register');
    return null;
  }

  return (
    <EmailVerificationPage
      email={email}
      error={error}
      onNavigate={navigate}
    />
  );
}

export default function VerifyEmailRoute() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950"><div className="text-slate-500">Loading...</div></div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
