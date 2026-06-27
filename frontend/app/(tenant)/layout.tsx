'use client';

import CrmLayout from '@/features/tenant/shared/layouts/CrmLayout';
import { AuthGuard } from '@/shared/providers/auth-guard';

export default function TenantLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <CrmLayout>{children}</CrmLayout>
    </AuthGuard>
  );
}
