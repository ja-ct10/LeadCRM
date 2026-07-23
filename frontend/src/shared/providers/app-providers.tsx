'use client';

import React from 'react';
import { AuthProvider } from '@/store/AuthContext';
import { DataProvider } from '@/store/DataContext';
import { Toaster } from 'sonner';
import GlobalLoader from '@/shared/components/GlobalLoader';
import { SessionProvider } from 'next-auth/react';

/**
 * AppProviders — wraps the entire app with auth + data context.
 * Must be 'use client' because AuthProvider and DataProvider use localStorage.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AuthProvider>
        <DataProvider>
          {children}
          <GlobalLoader />
          <Toaster position="top-right" />
        </DataProvider>
      </AuthProvider>
    </SessionProvider>
  );
}
