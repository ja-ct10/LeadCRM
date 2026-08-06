'use client';

import CrmLayout from '@/features/tenant/layout/crm-layout';
import { AuthGuard } from '@/shared/providers/auth-guard';

export default function TenantLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <CrmLayout>{children}</CrmLayout>
    </AuthGuard>
  );
}
