'use client';
import dynamic from 'next/dynamic';
const AccountDetailsPage = dynamic(() => import('../../../../src/features/tenant/settings/ui/account-details-page'), { ssr: false });
export default AccountDetailsPage;
