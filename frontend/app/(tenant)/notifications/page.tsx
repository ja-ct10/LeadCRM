'use client';
import dynamic from 'next/dynamic';
const NotificationsPage = dynamic(() => import('../../../src/features/tenant/notifications/ui/notifications-page'), { ssr: false });
export default NotificationsPage;
