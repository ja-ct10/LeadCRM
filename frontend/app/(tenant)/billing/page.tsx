'use client';
import dynamic from 'next/dynamic';
const BillingPage = dynamic(() => import('@/features/tenant/billing/ui/billing-page'), { ssr: false });
export default BillingPage;
