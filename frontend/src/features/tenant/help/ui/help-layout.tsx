'use client';

import type { ReactNode } from 'react';
import { useAuth } from '@/store/AuthContext';
import CrmLayout from '@/features/tenant/layout/crm-layout';

/** Public guides always render; only a restored user receives the existing CRM shell. */
export default function HelpLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (user) return <CrmLayout>{children}</CrmLayout>;
  return <main className="min-h-screen bg-[var(--background)] px-3 py-6 sm:px-4 lg:px-6">{children}</main>;
}
