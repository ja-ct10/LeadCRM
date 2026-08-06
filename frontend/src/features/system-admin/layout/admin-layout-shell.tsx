'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { PATHNAME_TO_PATH, PATH_TO_PATHNAME } from '@/lib/route-map';
import AdminLayout from './admin-layout';

interface AdminLayoutShellProps {
  children: React.ReactNode;
}

/**
 * Wires Next.js App Router (useRouter/usePathname) into AdminLayout.
 * Used by app/(system-admin)/layout.tsx.
 */
export default function AdminLayoutShell({ children }: AdminLayoutShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const currentPath = PATHNAME_TO_PATH[pathname] ?? 'admin-dashboard';

  const navigate = (path: string) => {
    const target = PATH_TO_PATHNAME[path];
    if (target) router.push(target);
  };

  return (
    <AdminLayout currentPath={currentPath} navigate={navigate}>
      {children}
    </AdminLayout>
  );
}
