'use client';

import { useRouter } from 'next/navigation';
import AuthPage from '@/features/tenant/pages/AuthPage';
import { PATH_TO_PATHNAME } from '@/shared/lib/route-map';

export default function LoginPage() {
  const router = useRouter();
  const navigate = (path: string) => router.push(PATH_TO_PATHNAME[path] ?? '/dashboard');
  return <AuthPage mode="login" onNavigate={navigate} />;
}
