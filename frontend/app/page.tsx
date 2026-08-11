'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { PATH_TO_PATHNAME } from '@/lib/route-map';

const LandingPage = dynamic(
  () => import('../src/features/tenant/pages/landing-page'),
  { ssr: false }
);

export default function Home() {
  const router = useRouter();

  const handleNavigate = (path: string) => {
    // Map internal path names to Next.js routes
    const pathname = PATH_TO_PATHNAME[path];
    if (pathname) {
      router.push(pathname);
    } else if (path === 'login') {
      router.push('/login');
    } else if (path === 'register') {
      router.push('/register');
    } else if (path === 'privacy-policy') {
      router.push('/privacy-policy');
    } else if (path === 'terms-of-service') {
      router.push('/terms-of-service');
    } else {
      router.push(`/${path}`);
    }
  };

  return <LandingPage onNavigate={handleNavigate} />;
}
