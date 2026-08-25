'use client';
import dynamic from 'next/dynamic';
const ImportContactDetailsPage = dynamic(() => import('../../../../../../src/features/tenant/crm/contacts/ui/import-contact-details-page'), { ssr: false });
export default ImportContactDetailsPage;
