'use client';
import dynamic from 'next/dynamic';
const LeadsPage = dynamic(() => import('../../../../src/features/tenant/crm/contacts/ui/contacts-page'), { ssr: false });
export default LeadsPage;
