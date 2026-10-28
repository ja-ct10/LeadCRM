'use client';
import dynamic from 'next/dynamic';
const BusinessEmailPage = dynamic(() => import('../../../../src/features/tenant/inbox/ui/business-email-page'), { ssr: false });
export default BusinessEmailPage;
