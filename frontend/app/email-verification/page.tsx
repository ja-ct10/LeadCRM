'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import EmailVerificationPage from '@/features/tenant/pages/email-verification-page';
import { PATH_TO_PATHNAME } from '@/lib/route-map';

function EmailVerificationPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';
  
  const navigate = (path: string) => {
    if (path === 'login') return router.push('/login');
    if (path === 'register') return router.push('/register');
    if (path === 'landing' || path === '/') return router.push('/');
    return router.push(PATH_TO_PATHNAME[path] ?? '/dashboard');
  };

  if (!email) {
    // Redirect to register if no email provided
    router.push('/register');
    return null;
  }
  
  return <EmailVerificationPage email={email} onNavigate={navigate} />;
}

export default function EmailVerificationRoute() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <EmailVerificationPageContent />
    </Suspense>
  );
}
