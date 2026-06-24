'use client';

import { AuthGuard } from '@/shared/providers/auth-guard';

// System admin routes use their own layout without CrmLayout
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
