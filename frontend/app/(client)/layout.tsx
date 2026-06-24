'use client';

import CrmLayout from '@/client-admin/shared/layouts/CrmLayout';
import { AuthGuard } from '@/shared/providers/auth-guard';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <CrmLayout>{children}</CrmLayout>
    </AuthGuard>
  );
}
