'use client';
import dynamic from 'next/dynamic';
const ClientBillingPage = dynamic(() => import('@/features/tenant/billing/ui/client-billing-page'), { ssr: false });
export default ClientBillingPage;
