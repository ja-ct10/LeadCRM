'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

const TermsOfServicePage = dynamic(
  () => import('../../src/features/tenant/pages/terms-of-service'),
  { ssr: false }
);

export default function TermsOfService() {
  const router = useRouter();

  const handleNavigate = (path: string) => {
    if (path === '/') {
      router.push('/');
    } else {
      router.push(`/${path}`);
    }
  };

  return <TermsOfServicePage onNavigate={handleNavigate} />;
}
