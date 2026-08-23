'use client';
import dynamic from 'next/dynamic';
const ImportContactsPage = dynamic(() => import('../../../../../src/features/tenant/crm/contacts/ui/import-contacts-page-v2'), { ssr: false });
export default ImportContactsPage;
