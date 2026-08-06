'use client';

import React from 'react';
import { AuthProvider } from '@/store/AuthContext';
import { DataProvider } from '@/store/DataContext';
import { Toaster } from 'sonner';
import GlobalLoader from '@/shared/components/global-loader';

/**
 * AppProviders — wraps the entire app with auth + data context.
 * Auth uses HttpOnly cookie-based JWT (custom backend) — no NextAuth SessionProvider needed.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <DataProvider>
        {children}
        <GlobalLoader />
        <Toaster position="top-right" />
      </DataProvider>
    </AuthProvider>
  );
}
