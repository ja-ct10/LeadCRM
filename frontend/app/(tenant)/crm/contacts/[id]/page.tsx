'use client';
import dynamic from 'next/dynamic';
const Page = dynamic(() => import('../../../../../src/features/tenant/crm/contacts/ui/contact-detail-page'), { ssr: false });
export default Page;
