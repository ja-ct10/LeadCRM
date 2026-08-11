'use client';

import { useRouter } from 'next/navigation';
import CompanySetupPage from '@/features/tenant/pages/company-setup-page';
import { PATH_TO_PATHNAME } from '@/lib/route-map';

export default function CompanySetupRoute() {
  const router = useRouter();
  
  const navigate = (path: string) => {
    if (path === 'dashboard') return router.push('/dashboard');
    return router.push(PATH_TO_PATHNAME[path] ?? '/dashboard');
  };
  
  return <CompanySetupPage onNavigate={navigate} />;
}
