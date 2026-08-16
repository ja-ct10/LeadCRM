'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthGuard } from '@/shared/providers/auth-guard';
import { useAuth } from '@/store/AuthContext';
import AdminLayoutShell from '@/features/system-admin/layout/admin-layout-shell';

/**
 * SystemAdminGuard — blocks non-system-admin users from accessing /admin/* routes.
 * Uses the same detection logic as use-layout.ts and AuthGuard.
 */
function SystemAdminGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const isSystemAdmin =
    user?.role === 'System Admin' ||
    user?.tenantId === 'system' ||
    user?.tenantId === 'leadcrm-system-demo';

  useEffect(() => {
    if (isLoading) return;
    if (user && !isSystemAdmin) {
      router.replace('/dashboard');
    }
  }, [user, isLoading, isSystemAdmin, router]);

  if (isLoading || !user) return null;
  if (!isSystemAdmin) return null;

  return <>{children}</>;
}

export default function SystemAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <SystemAdminGuard>
        <AdminLayoutShell>{children}</AdminLayoutShell>
      </SystemAdminGuard>
    </AuthGuard>
  );
}
