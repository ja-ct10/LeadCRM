'use client';
import dynamic from 'next/dynamic';
const ImportDetailsPage = dynamic(() => import('../../../../../../src/features/tenant/crm/contacts/ui/import-details-page'), { ssr: false });
export default ImportDetailsPage;
