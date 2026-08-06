'use client';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
const ProfileSettingsPage = dynamic(() => import('../../../../src/features/tenant/settings/ui/profile-settings-page'), { ssr: false });
export default function ProfileSettingsRoute() {
  const router = useRouter();
  return <ProfileSettingsPage navigate={(path: string) => router.push(path)} />;
}
