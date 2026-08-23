'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { PATHNAME_TO_PATH, PATH_TO_PATHNAME } from '@/lib/route-map';
import AdminLayout from './admin-layout';
import { AdminSubLabelProvider, useAdminSubLabel } from './admin-sub-label-context';

interface AdminLayoutShellProps {
  children: React.ReactNode;
}

/**
 * Inner shell — reads subLabel from context so AdminConsole (rendered as a
 * child page) can write to the same state via useAdminSubLabel().
 */
function AdminLayoutShellInner({ children }: AdminLayoutShellProps) {
  const router   = useRouter();
  const pathname = usePathname();
  const currentPath = PATHNAME_TO_PATH[pathname] ?? 'admin-dashboard';
  const { subLabel } = useAdminSubLabel();

  const navigate = (path: string) => {
    const target = PATH_TO_PATHNAME[path];
    if (target) router.push(target);
  };

  return (
    <AdminLayout currentPath={currentPath} navigate={navigate} subLabel={subLabel}>
      {children}
    </AdminLayout>
  );
}

/**
 * Wires Next.js App Router (useRouter/usePathname) into AdminLayout.
 * Wraps the shell in AdminSubLabelProvider so any AdminConsole page
 * can update the topbar breadcrumb sub-label via useAdminSubLabel().
 */
export default function AdminLayoutShell({ children }: AdminLayoutShellProps) {
  return (
    <AdminSubLabelProvider>
      <AdminLayoutShellInner>{children}</AdminLayoutShellInner>
    </AdminSubLabelProvider>
  );
}
