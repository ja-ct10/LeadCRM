'use client';
import dynamic from 'next/dynamic';
const CompaniesPage = dynamic(() => import('../../../../src/features/tenant/crm/companies/ui/companies-page'), { ssr: false });
export default CompaniesPage;
