'use client';

import { useRouter } from 'next/navigation';
import AuthPage from '@/features/tenant/pages/auth-page';
import { PATH_TO_PATHNAME } from '@/lib/route-map';

export default function ResetPasswordPage() {
  const router = useRouter();
  const navigate = (path: string) => {
    if (path === 'login') return router.push('/login');
    if (path === 'register') return router.push('/register');
    if (path === 'landing' || path === '/') return router.push('/');
    return router.push(PATH_TO_PATHNAME[path] ?? '/dashboard');
  };

  // AuthPage in login mode detects ?token= in the URL and shows the reset-password view
  return <AuthPage mode="login" onNavigate={navigate} />;
}
