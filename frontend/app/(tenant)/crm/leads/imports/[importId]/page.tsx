'use client';
import dynamic from 'next/dynamic';
const ImportLeadDetailsPage = dynamic(() => import('../../../../../../src/features/tenant/crm/leads/ui/import-lead-details-page'), { ssr: false });
export default ImportLeadDetailsPage;
