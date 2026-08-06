'use client';
import dynamic from 'next/dynamic';
const CustomersPage = dynamic(() => import('../../../../src/features/tenant/crm/customers/ui/customers-page'), { ssr: false });
export default CustomersPage;
