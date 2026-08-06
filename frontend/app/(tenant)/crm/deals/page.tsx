'use client';
import dynamic from 'next/dynamic';
const DealsPage = dynamic(() => import('../../../../src/features/tenant/crm/deals/ui/deals-page'), { ssr: false });
export default DealsPage;
