'use client';

import React from 'react';
import { AuthProvider } from '@/store/AuthContext';
import { DataProvider } from '@/store/DataContext';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/store/AuthContext';
import { useTheme } from '@/shared/hooks/use-theme';
import { usesWorkspaceAppearance } from '@/lib/appearance-config';
import { ThemeScope } from '@/shared/components/theme-scope';
import { Toaster } from 'sonner';
import { DealActionsProvider } from '@/shared/components/crm/deal-card-menu';
import { LogoutConfirmationProvider } from './logout-confirmation-provider';

function AppearanceToaster() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const workspace = usesWorkspaceAppearance(usePathname(), Boolean(user));
  return <ThemeScope enabled={workspace} className="contents">
    <Toaster theme={workspace && isDark ? 'dark' : 'light'} position="top-right" expand closeButton duration={4000} gap={4} />
  </ThemeScope>;
}

/** AuthContext restores the server-backed HttpOnly session. */
export function AppProviders({ children, initialHasSessionCookie }: {
  children: React.ReactNode;
  initialHasSessionCookie?: boolean;
}) {
  return (
    <AuthProvider initialHasSessionCookie={initialHasSessionCookie}>
      <DataProvider>
        <LogoutConfirmationProvider><DealActionsProvider>{children}</DealActionsProvider></LogoutConfirmationProvider>
        <AppearanceToaster />
      </DataProvider>
    </AuthProvider>
  );
}
