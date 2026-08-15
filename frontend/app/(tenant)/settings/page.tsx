'use client';
import dynamic from 'next/dynamic';
const SettingsPage = dynamic(() => import('@/features/tenant/settings/ui/settings-page'), { ssr: false });
export default SettingsPage;
