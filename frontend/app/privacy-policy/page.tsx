'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

const PrivacyPolicyPage = dynamic(
  () => import('../../src/features/tenant/pages/privacy-policy'),
  { ssr: false }
);

export default function PrivacyPolicy() {
  const router = useRouter();

  const handleNavigate = (path: string) => {
    if (path === '/') {
      router.push('/');
    } else {
      router.push(`/${path}`);
    }
  };

  return <PrivacyPolicyPage onNavigate={handleNavigate} />;
}
