'use client';
import dynamic from 'next/dynamic';
const ImportAccountDetailsPage = dynamic(() => import('../../../../../../src/features/tenant/crm/accounts/ui/import-account-details-page'), { ssr: false });
export default ImportAccountDetailsPage;
