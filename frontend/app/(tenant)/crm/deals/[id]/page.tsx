'use client';
import dynamic from 'next/dynamic';
const Page = dynamic(() => import('../../../../../src/features/tenant/crm/deals/ui/deal-detail-page'), { ssr: false });
export default Page;
