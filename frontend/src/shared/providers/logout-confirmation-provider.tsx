'use client';

import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/store/AuthContext';
import { useConfirmDialog } from '@/shared/hooks/use-confirm-dialog';
import { ConfirmActionDialog } from '@/shared/components/crm/confirm-action-dialog';
import { ThemeScope } from '@/shared/components/theme-scope';
import { usesWorkspaceAppearance } from '@/lib/appearance-config';
import { requestNavigation } from '@/shared/lib/navigation-intent';

const LogoutConfirmationContext = createContext<(() => void) | null>(null);

/** UI coordination only; AuthProvider remains responsible for terminating the session. */
export function LogoutConfirmationProvider({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { confirm, close, dialogProps } = useConfirmDialog();
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => { close(); }, [user?.id, user?.tenantId, close]);
  const requestLogout = () => requestNavigation(() => confirm({
    title: 'Log out?', description: 'Are you sure you want to log out?',
    confirmLabel: 'Log Out', cancelLabel: 'Cancel', icon: LogOut,
    onConfirm: async () => { await logout(); router.replace('/login'); },
  }));
  return <LogoutConfirmationContext.Provider value={requestLogout}>
    {children}
    <ThemeScope enabled={usesWorkspaceAppearance(pathname ?? '', Boolean(user))} className="contents">
      <ConfirmActionDialog {...dialogProps} />
    </ThemeScope>
  </LogoutConfirmationContext.Provider>;
}

export function useLogoutConfirmation(): () => void {
  const value = useContext(LogoutConfirmationContext);
  if (!value) throw new Error('useLogoutConfirmation requires LogoutConfirmationProvider');
  return value;
}
