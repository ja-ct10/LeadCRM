'use client';

import { AuthGuard } from '@/shared/providers/auth-guard';
import AdminLayoutShell from '@/features/system-admin/layout/AdminLayoutShell';

export default function SystemAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AdminLayoutShell>{children}</AdminLayoutShell>
    </AuthGuard>
  );
}
