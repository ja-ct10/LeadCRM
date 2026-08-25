'use client';
import dynamic from 'next/dynamic';
const Page = dynamic(() => import('../../../../../src/features/tenant/crm/leads/ui/lead-detail-page'), { ssr: false });
export default Page;
