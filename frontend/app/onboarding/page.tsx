'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAuth } from '@/store/AuthContext';

const OnboardingPage = dynamic(
  () => import('../../src/features/tenant/pages/onboarding-page'),
  { ssr: false },
);

export default function OnboardingRoute() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    // Not authenticated — send to login
    if (!user) {
      router.replace('/login');
      return;
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) return null;

  const handleNavigate = (path: string) => {
    if (path === 'dashboard') {
      router.push('/dashboard');
    } else if (path === 'login') {
      router.push('/login');
    } else {
      router.push('/dashboard');
    }
  };

  return <OnboardingPage onNavigate={handleNavigate} />;
}
