'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/store/AuthContext';
import { PATH_TO_PATHNAME } from '@/lib/route-map';
import { AuthLoadingScreen } from '@/shared/components/auth-loading-screen';

const LandingPage = dynamic(
  () => import('../src/features/tenant/pages/landing-page'),
  { ssr: false }
);

/**
 * Root page — `/`
 *
 * This is also the callbackUrl target for Google OAuth (callbackUrl: '/').
 * When an authenticated user lands here we redirect them to /dashboard,
 * and AuthGuard will intercept to run the onboarding/company-setup flow
 * if needed.
 *
 * Redirect priority (handled by AuthGuard, not here):
 *   - Not authenticated → show landing page (public)
 *   - System Admin      → /admin/dashboard
 *   - Needs profile     → /onboarding → /company-setup → /dashboard
 *   - Already onboarded → /dashboard
 */
export default function Home() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading || !user) return;

    // Authenticated user landed on '/' — send them to dashboard.
    // AuthGuard will intercept and redirect to /onboarding if needed.
    // We no longer check localStorage here to avoid bypassing the AuthGuard's
    // requiresProfileCompletion check for OAuth users.
    if (user.role === 'System Admin') {
      router.replace('/admin/dashboard');
    } else {
      router.replace('/dashboard');
    }
  }, [user, isLoading, router]);

  const handleNavigate = (path: string) => {
    const pathname = PATH_TO_PATHNAME[path];
    if (pathname) {
      router.push(pathname);
    } else if (path === 'login') {
      router.push('/login');
    } else if (path === 'register') {
      router.push('/register');
    } else if (path === 'privacy-policy') {
      router.push('/privacy-policy');
    } else if (path === 'terms-of-service') {
      router.push('/terms-of-service');
    } else {
      router.push(`/${path}`);
    }
  };

  // While auth is resolving, show a visible spinner to avoid a silent blank
  // screen (and landing page flash). Once isLoading=false and user=null, the
  // public landing page is rendered below.
  if (isLoading) return <AuthLoadingScreen />;
  if (user) return <AuthLoadingScreen />; // redirect in progress

  return <LandingPage onNavigate={handleNavigate} />;
}
