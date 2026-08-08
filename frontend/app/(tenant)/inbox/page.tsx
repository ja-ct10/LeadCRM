'use client';
import dynamic from 'next/dynamic';
const InboxPage = dynamic(() => import('../../../src/features/tenant/inbox/ui/inbox-page'), { ssr: false });
export default InboxPage;
