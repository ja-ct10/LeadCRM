'use client';
import dynamic from 'next/dynamic';
const ImportAccountsPage = dynamic(() => import('../../../../../src/features/tenant/crm/accounts/ui/import-accounts-page'), { ssr: false });
export default ImportAccountsPage;
