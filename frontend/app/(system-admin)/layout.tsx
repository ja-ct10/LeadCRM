'use client';

import { AuthGuard } from '@/shared/providers/auth-guard';
import AdminLayoutShell from '@/features/system-admin/layout/admin-layout-shell';

export default function SystemAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AdminLayoutShell>{children}</AdminLayoutShell>
    </AuthGuard>
  );
}
  