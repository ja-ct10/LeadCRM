'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/store/AuthContext';

/**
 * AuthGuard — redirects to /login if the user is not authenticated.
 * Shows nothing while the session is being restored to prevent
 * a flash-redirect on hard refresh.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user === null) {
      router.replace('/login');
    }
  }, [user, isLoading, router]);

  // Still loading session — render nothing to avoid flash
  if (isLoading) return null;

  // Not authenticated — return nothing (redirect is in-flight)
  if (user === null) return null;

  return <>{children}</>;
}
