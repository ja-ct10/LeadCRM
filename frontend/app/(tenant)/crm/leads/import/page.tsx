'use client';
import dynamic from 'next/dynamic';
const ImportLeadsPage = dynamic(() => import('../../../../../src/features/tenant/crm/leads/ui/import-leads-page'), { ssr: false });
export default ImportLeadsPage;
