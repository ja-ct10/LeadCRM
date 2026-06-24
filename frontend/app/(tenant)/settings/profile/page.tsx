'use client';

import { useRouter } from 'next/navigation';
import ProfileSettingsPage from '@/features/tenant/settings/ui/profile-settings-page';
import { PATH_TO_PATHNAME } from '@/shared/lib/route-map';

export default function ProfileSettingsRoute() {
  const router = useRouter();
  const navigate = (path: string) => router.push(PATH_TO_PATHNAME[path] ?? '/dashboard');
  return <ProfileSettingsPage navigate={navigate} />;
}
