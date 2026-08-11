'use client';

import { useRouter } from 'next/navigation';
import ModernRegisterPage from '@/features/tenant/pages/modern-register-page';
import { PATH_TO_PATHNAME } from '@/lib/route-map';

export default function RegisterPage() {
  const router = useRouter();
  const navigate = (path: string) => {
    if (path === 'login') return router.push('/login');
    if (path === 'landing' || path === '/') return router.push('/');
    if (path === 'email-verification') return router.push('/email-verification');
    if (path === 'onboarding') return router.push('/onboarding');
    if (path === 'company-setup') return router.push('/company-setup');
    return router.push(PATH_TO_PATHNAME[path] ?? '/dashboard');
  };
  
  return <ModernRegisterPage onNavigate={navigate} />;
}
