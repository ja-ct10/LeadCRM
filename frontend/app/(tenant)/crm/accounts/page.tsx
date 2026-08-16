'use client';
import dynamic from 'next/dynamic';
const AccountsPage = dynamic(() => import('../../../../src/features/tenant/crm/accounts/ui/accounts-page'), { ssr: false });
export default AccountsPage;
