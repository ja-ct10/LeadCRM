'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAuth } from '@/store/AuthContext';
import { AuthLoadingScreen } from '@/shared/components/auth-loading-screen';

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

    // If tenant workspace is already configured, redirect to the appropriate
    // portal. This prevents returning users (or users with onboardingCompletedAt
    // already set at registration) from being stuck in onboarding after
    // email verification lands them here via a stale bookmark or cached route.
    // Source of truth: onboardingCompletedAt from /auth/me (server-backed).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onboardingCompletedAt = (user as any).onboardingCompletedAt;
    if (onboardingCompletedAt) {
      const isSystemAdmin = user.role === 'System Admin';
      router.replace(isSystemAdmin ? '/admin/dashboard' : '/dashboard');
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) return <AuthLoadingScreen />;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onboardingCompletedAt = (user as any).onboardingCompletedAt;
  // Redirect in progress — render loading screen to prevent flash of onboarding UI
  if (onboardingCompletedAt) return <AuthLoadingScreen />;

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
