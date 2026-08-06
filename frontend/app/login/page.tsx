'use client';

import { useRouter } from 'next/navigation';
import AuthPage from '@/features/tenant/pages/auth-page';
import { PATH_TO_PATHNAME } from '@/lib/route-map';

export default function LoginPage() {
  const router = useRouter();
  const navigate = (path: string) => {
    if (path === 'register') return router.push('/register');
    if (path === 'landing' || path === '/') return router.push('/');
    return router.push(PATH_TO_PATHNAME[path] ?? '/dashboard');
  };
  
  return <AuthPage mode="login" onNavigate={navigate} />;
}
